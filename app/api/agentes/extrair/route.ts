import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 120

const ext = (u: string) => (u.split('?')[0].split('.').pop() || '').toLowerCase()
const LIMITE_TEXTO = 20000 // por documento, para nao estourar o prompt do agente

// Extrai o texto de um documento da base de conhecimento do agente.
// DOCX -> mammoth (sem custo de IA). PDF/imagem -> Claude (multimodal).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'apenas admin' }, { status: 403 })
  }

  const { url, nome } = await req.json()
  if (!url) return NextResponse.json({ error: 'url obrigatória' }, { status: 400 })
  const e = ext(nome || url)

  try {
    const resp = await fetch(url)
    if (!resp.ok) return NextResponse.json({ error: 'não foi possível baixar o arquivo' }, { status: 502 })
    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.byteLength > 12 * 1024 * 1024) {
      return NextResponse.json({ error: 'arquivo muito grande (máx. 12MB para extração)' }, { status: 400 })
    }

    // DOCX -> texto direto, sem IA
    if (e === 'docx') {
      const mammoth = await import('mammoth')
      const out = await mammoth.extractRawText({ buffer: buf })
      const texto = (out?.value || '').trim()
      if (!texto) return NextResponse.json({ error: 'não foi possível extrair texto do DOCX' }, { status: 422 })
      return NextResponse.json({ ok: true, texto: texto.slice(0, LIMITE_TEXTO) })
    }

    // PDF e imagens -> extraidos pela Claude (multimodal)
    const KEY = process.env.ANTHROPIC_API_KEY?.trim()
    if (!KEY) return NextResponse.json({ error: 'IA não configurada (ANTHROPIC_API_KEY).' }, { status: 500 })

    const b64 = buf.toString('base64')
    let bloco: any
    if (e === 'pdf') {
      bloco = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
    } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(e)) {
      const mt = e === 'png' ? 'image/png' : e === 'webp' ? 'image/webp' : e === 'gif' ? 'image/gif' : 'image/jpeg'
      bloco = { type: 'image', source: { type: 'base64', media_type: mt, data: b64 } }
    } else {
      return NextResponse.json({ error: `formato não suportado: .${e} (use PDF, DOCX ou imagem)` }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: KEY })
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [bloco, { type: 'text', text: 'Extraia e transcreva TODO o conteúdo textual relevante deste material (texto, listas, dados, instruções). Se for um print/imagem, descreva também o que for visualmente relevante (cores, layout, elementos). Responda apenas com o conteúdo extraído, em português, sem preâmbulos.' }],
      }],
    } as any)
    await registrarGasto(custoEstimado(msg.usage)).catch(() => {})

    const texto = (msg.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()
    if (!texto) return NextResponse.json({ error: 'não foi possível extrair conteúdo do arquivo' }, { status: 422 })
    return NextResponse.json({ ok: true, texto: texto.slice(0, LIMITE_TEXTO) })
  } catch (err: any) {
    console.error('[agentes/extrair] erro:', err?.message)
    return NextResponse.json({ error: `Erro ao extrair: ${err?.message || 'desconhecido'}` }, { status: 500 })
  }
}

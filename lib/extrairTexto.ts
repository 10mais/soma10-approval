import { registrarGasto, custoEstimado } from './anthropicSaldo'
import Anthropic from '@anthropic-ai/sdk'

// Extração de texto de documentos (Blob). Compartilhado entre a base de conhecimento
// dos agentes e a destilação do Brand Playbook.
// DOCX -> mammoth (sem custo de IA). PDF e imagens -> Claude (multimodal).

const ext = (u: string) => (u.split('?')[0].split('.').pop() || '').toLowerCase()
const LIMITE_TEXTO = 20000 // por documento

export type ResultadoExtracao = { ok: boolean; texto?: string; erro?: string }

const PROMPT_EXTRACAO = 'Extraia e transcreva TODO o conteúdo textual relevante deste material (texto, listas, dados, instruções). Se for um print/imagem, descreva também o que for visualmente relevante (cores, layout, elementos). Responda apenas com o conteúdo extraído, em português, sem preâmbulos.'

export async function extrairTextoDeArquivo(url: string, nome?: string): Promise<ResultadoExtracao> {
  if (!url) return { ok: false, erro: 'url obrigatória' }
  const e = ext(nome || url)
  try {
    const resp = await fetch(url)
    if (!resp.ok) return { ok: false, erro: 'não foi possível baixar o arquivo' }
    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.byteLength > 12 * 1024 * 1024) return { ok: false, erro: 'arquivo muito grande (máx. 12MB para extração)' }

    // DOCX -> texto direto, sem IA
    if (e === 'docx') {
      const mammoth = await import('mammoth')
      const out = await mammoth.extractRawText({ buffer: buf })
      const texto = (out?.value || '').trim()
      if (!texto) return { ok: false, erro: 'não foi possível extrair texto do DOCX' }
      return { ok: true, texto: texto.slice(0, LIMITE_TEXTO) }
    }

    // PDF e imagens -> Claude multimodal
    const KEY = process.env.ANTHROPIC_API_KEY?.trim()
    if (!KEY) return { ok: false, erro: 'IA não configurada (ANTHROPIC_API_KEY).' }

    const b64 = buf.toString('base64')
    let bloco: any
    if (e === 'pdf') {
      bloco = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
    } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(e)) {
      const mt = e === 'png' ? 'image/png' : e === 'webp' ? 'image/webp' : e === 'gif' ? 'image/gif' : 'image/jpeg'
      bloco = { type: 'image', source: { type: 'base64', media_type: mt, data: b64 } }
    } else {
      return { ok: false, erro: `formato não suportado: .${e} (use PDF, DOCX ou imagem)` }
    }

    const client = new Anthropic({ apiKey: KEY })
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      messages: [{ role: 'user', content: [bloco, { type: 'text', text: PROMPT_EXTRACAO }] }],
    } as any)
    await registrarGasto(custoEstimado(msg.usage)).catch(() => {})

    const texto = (msg.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()
    if (!texto) return { ok: false, erro: 'não foi possível extrair conteúdo do arquivo' }
    return { ok: true, texto: texto.slice(0, LIMITE_TEXTO) }
  } catch (err: any) {
    return { ok: false, erro: `Erro ao extrair: ${err?.message || 'desconhecido'}` }
  }
}

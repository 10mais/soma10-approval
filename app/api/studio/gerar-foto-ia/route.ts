import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Post } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { bloqueiaAcao } from '@/lib/permissoesGranularServer'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import { ideogramConfigurado, gerarFotoIdeogram } from '@/lib/ideogram'
import { nanoBananaConfigurado, gerarFotoNanoBanana, RefImagem } from '@/lib/nanoBanana'
import { capturarErro } from '@/lib/erros'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

// Foto realista por IA — o CENÁRIO do criativo. Dois motores:
//  1) Nano Banana 2 (GEMINI_API_KEY) — PREFERIDO: recebe fotos REAIS da marca
//     como referência (a cena sai com a cara do cliente) e gera 4:5 nativo.
//  2) Ideogram (IDEOGRAM_API_KEY) — fallback/legado.
// Devolve base64 (o cliente sobe pelo fluxo upload(); Blob é privado).

// Diz ao front se a foto por IA está ligada e qual motor será usado.
export async function GET() {
  const motor = nanoBananaConfigurado() ? 'nano-banana' : ideogramConfigurado() ? 'ideogram' : null
  return NextResponse.json({ configurado: !!motor, motor })
}

// Baixa uma imagem da marca (Blob) e devolve base64 p/ referência multimodal.
async function baixarRef(url: string): Promise<RefImagem | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > 4 * 1024 * 1024) return null // guarda de payload (~4MB por ref)
    let mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return null
    return { mime, base64: buf.toString('base64') }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel(role, 'producao', 'editar', (session!.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  if (await bloqueiaAcao(role, 'gerar_ia', (session!.user as any).permissoesGranular)) {
    return NextResponse.json({ error: 'sem permissão para gerar com IA' }, { status: 403 })
  }
  const nanoOn = nanoBananaConfigurado()
  const ideoOn = ideogramConfigurado()
  if (!nanoOn && !ideoOn) {
    return NextResponse.json({ error: 'Foto realista indisponível: configure GEMINI_API_KEY (Nano Banana) ou IDEOGRAM_API_KEY na Vercel.' }, { status: 400 })
  }

  const { postId, prompt: promptIn } = await req.json()
  if (!postId) return NextResponse.json({ error: 'postId é obrigatório' }, { status: 400 })

  const post = await redis.get<Post>(`post:${postId}`)
  if (!post) return NextResponse.json({ error: 'post não encontrado' }, { status: 404 })
  const cliente = await redis.get<Cliente>(`cliente:${post.clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  // Fotos REAIS da marca como referência (só p/ Nano Banana): ambiente, produtos.
  // Fotos primeiro (são o ouro); evita 'print' (arte com texto induz texto na cena).
  const ativos = Array.isArray(cliente.assetsMarca) ? cliente.assetsMarca : []
  const urlsRef = ativos.filter(a => a.categoria === 'foto' && a.url).map(a => a.url).slice(0, 4)
  const referencias = nanoOn ? (await Promise.all(urlsRef.map(baixarRef))).filter(Boolean) as RefImagem[] : []

  // Prompt fotográfico: usa o que veio do usuário OU deixa a IA escrever a partir
  // da pauta + DNA da marca (curto, em inglês — os geradores respondem melhor).
  let promptFinal = (typeof promptIn === 'string' ? promptIn : '').trim()
  if (!promptFinal) {
    const KEY = process.env.ANTHROPIC_API_KEY?.trim()
    if (!KEY) return NextResponse.json({ error: 'IA não configurada (ANTHROPIC_API_KEY).' }, { status: 500 })
    const pb = cliente.playbook
    const dna = [
      `Brand: ${cliente.nome}`,
      cliente.segmento ? `Segment: ${cliente.segmento}` : '',
      cliente.tomDeVoz ? `Tone: ${cliente.tomDeVoz}` : '',
      pb?.posicionamento ? `Positioning: ${pb.posicionamento}` : '',
      cliente.corPrimaria ? `Primary color: ${cliente.corPrimaria}` : '',
    ].filter(Boolean).join('\n')
    const refNote = referencias.length
      ? `\nThe image generator will ALSO receive ${referencias.length} real photo(s) of this brand as reference. Tell it to match their environment, lighting, style and mood — the scene must look like it belongs to the SAME brand/place.`
      : ''
    const prompt = `You are an art director. Write ONE concise English prompt (max ~60 words) for an AI image generator to create a REALISTIC PHOTO for an Instagram feed post (vertical 4:5). Describe the scene, subject, composition, lighting and mood that fit the brand. Photographic and realistic — NOT an illustration, NOT a poster. Do NOT include any words, letters, logos or typography to render in the image.${refNote}

BRAND:
${dna}

POST BRIEFING: ${post.briefing || post.legenda || ''}
CREATIVE DIRECTION: ${post.sugestaoImagem || ''}

Respond with the prompt ONLY, no quotes, no explanation.`
    try {
      const client = new Anthropic({ apiKey: KEY })
      const msg = await client.messages.create({
        model: 'claude-opus-4-8', max_tokens: 400,
        thinking: { type: 'adaptive' }, output_config: { effort: 'low' } as any,
        messages: [{ role: 'user', content: prompt }],
      } as any)
      await registrarGasto(custoEstimado(msg.usage)).catch(() => {})
      promptFinal = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
    } catch (err: any) {
      return NextResponse.json({ error: `Falha ao montar o prompt: ${err?.message || 'erro'}` }, { status: 500 })
    }
  }
  if (!promptFinal) return NextResponse.json({ error: 'Não foi possível montar um prompt.' }, { status: 502 })

  // ===== 1) Nano Banana 2 (preferido) =====
  if (nanoOn) {
    const res = await gerarFotoNanoBanana(promptFinal, { referencias, aspectRatio: '4:5' })
    if ('base64' in res) {
      console.log('[gerar-foto-ia]', JSON.stringify({ motor: 'nano-banana', cliente: cliente.nome, refs: referencias.length }))
      return NextResponse.json({ ok: true, imagemBase64: res.base64, promptUsado: promptFinal, motor: 'nano-banana' })
    }
    console.error('[gerar-foto-ia] nano-banana:', res.erro)
    await capturarErro('studio/gerar-foto-ia', new Error(res.erro), { motor: 'nano-banana' })
    if (!ideoOn) return NextResponse.json({ error: res.erro }, { status: 502 })
    // cai pro Ideogram
  }

  // ===== 2) Ideogram (fallback/legado) =====
  const res = await gerarFotoIdeogram(promptFinal, { aspectRatio: 'ASPECT_3_4' })
  if ('erro' in res) {
    console.error('[gerar-foto-ia] ideogram:', res.erro)
    return NextResponse.json({ error: res.erro }, { status: 502 })
  }
  try {
    const r = await fetch(res.url)
    if (!r.ok) return NextResponse.json({ error: `Falha ao baixar a imagem (${r.status}).` }, { status: 502 })
    const buf = Buffer.from(await r.arrayBuffer())
    console.log('[gerar-foto-ia]', JSON.stringify({ motor: 'ideogram', cliente: cliente.nome }))
    return NextResponse.json({ ok: true, imagemBase64: buf.toString('base64'), promptUsado: promptFinal, motor: 'ideogram' })
  } catch (err: any) {
    return NextResponse.json({ error: `Falha ao baixar a imagem: ${err?.message || 'erro'}` }, { status: 502 })
  }
}

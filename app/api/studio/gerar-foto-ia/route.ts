import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Post } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { bloqueiaAcao } from '@/lib/permissoesGranularServer'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import { ideogramConfigurado, gerarFotoIdeogram } from '@/lib/ideogram'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

// Diz ao front se o Ideogram está ligado (mostra/oculta o botão "Foto realista").
export async function GET() {
  return NextResponse.json({ configurado: ideogramConfigurado() })
}

// POST { postId, prompt? } — gera uma FOTO realista via Ideogram a partir da pauta
// + DNA da marca. Devolve os bytes em base64 (o cliente sobe pelo fluxo upload()).
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
  if (!ideogramConfigurado()) {
    return NextResponse.json({ error: 'Foto realista indisponível: falta IDEOGRAM_API_KEY na Vercel.' }, { status: 400 })
  }

  const { postId, prompt: promptIn } = await req.json()
  if (!postId) return NextResponse.json({ error: 'postId é obrigatório' }, { status: 400 })

  const post = await redis.get<Post>(`post:${postId}`)
  if (!post) return NextResponse.json({ error: 'post não encontrado' }, { status: 404 })
  const cliente = await redis.get<Cliente>(`cliente:${post.clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  // Prompt fotográfico: usa o que veio do usuário OU deixa a IA escrever a partir
  // da pauta + DNA da marca (curto, em inglês — o Ideogram responde melhor).
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
    const prompt = `You are an art director. Write ONE concise English prompt (max ~60 words) for an AI image generator (Ideogram) to create a REALISTIC PHOTO for an Instagram feed post (vertical 4:5). Describe the scene, subject, composition, lighting and mood that fit the brand. Photographic and realistic — NOT an illustration, NOT a poster with text. Do NOT include any words/letters to render in the image.

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

  // Gera no Ideogram (portrait ASPECT_3_4 — o mais próximo do feed 4:5 aceito).
  const res = await gerarFotoIdeogram(promptFinal, { aspectRatio: 'ASPECT_3_4' })
  if ('erro' in res) {
    console.error('[gerar-foto-ia]', res.erro)
    return NextResponse.json({ error: res.erro }, { status: 502 })
  }

  // Baixa a imagem do Ideogram (URL temporária) e devolve em base64.
  try {
    const r = await fetch(res.url)
    if (!r.ok) return NextResponse.json({ error: `Falha ao baixar a imagem (${r.status}).` }, { status: 502 })
    const buf = Buffer.from(await r.arrayBuffer())
    const base64 = buf.toString('base64')
    return NextResponse.json({ ok: true, imagemBase64: base64, promptUsado: promptFinal })
  } catch (err: any) {
    return NextResponse.json({ error: `Falha ao baixar a imagem: ${err?.message || 'erro'}` }, { status: 502 })
  }
}

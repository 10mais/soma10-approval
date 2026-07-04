import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Post } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import { montarCriativo, carregarFontes, contraste, DadosCriativo, LARGURA, ALTURA } from '@/lib/criativoTemplates'
import { ImageResponse } from '@vercel/og'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST { postId, template? } — a IA dirige a arte, o template branded vira PNG (Blob)
// e entra em post.imagens[]. Track 1 do Studio (design system, sem custo externo).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel(role, 'producao', 'editar', (session!.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }

  const KEY = process.env.ANTHROPIC_API_KEY?.trim()
  if (!KEY) return NextResponse.json({ error: 'IA não configurada (ANTHROPIC_API_KEY).' }, { status: 500 })

  const { postId, template } = await req.json()
  if (!postId) return NextResponse.json({ error: 'postId é obrigatório' }, { status: 400 })

  const post = await redis.get<Post>(`post:${postId}`)
  if (!post) return NextResponse.json({ error: 'post não encontrado' }, { status: 404 })
  const cliente = await redis.get<Cliente>(`cliente:${post.clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  // DNA da marca para a direção de arte
  const pb = cliente.playbook
  const dna = [
    `Marca: ${cliente.nome}`,
    cliente.segmento ? `Segmento: ${cliente.segmento}` : '',
    cliente.tomDeVoz ? `Tom de voz: ${cliente.tomDeVoz}` : '',
    cliente.palavrasChave ? `Palavras-chave: ${cliente.palavrasChave}` : '',
    pb?.posicionamento ? `Posicionamento: ${pb.posicionamento}` : '',
    pb?.padraoCopy ? `Padrão de copy: ${pb.padraoCopy}` : '',
    pb?.fazer ? `Sempre fazer: ${pb.fazer}` : '',
    pb?.naoFazer ? `Nunca fazer: ${pb.naoFazer}` : '',
  ].filter(Boolean).join('\n')

  // Ativos da marca — enviados como imagens para a IA ler logo/fonte/cor/estilo.
  const ativos = Array.isArray(cliente.assetsMarca) ? cliente.assetsMarca : []
  const ordem = ['logo', 'print', 'foto', 'elemento', 'icone', 'outro']
  const escolhidos = [...ativos].sort((a, b) => ordem.indexOf(a.categoria) - ordem.indexOf(b.categoria)).slice(0, 4)
  let refs = escolhidos.map(a => a.url).filter(Boolean)
  if (refs.length === 0) refs = (cliente.referenciasVisuais || []).filter(Boolean).slice(0, 3)
  const temLogo = escolhidos.some(a => a.categoria === 'logo')
  const refNote = refs.length
    ? `\n\nVocê RECEBE ${refs.length} imagem(ns) de ATIVOS da marca${temLogo ? ' (inclui a logomarca)' : ''}. Observe logomarca, tipografia, paleta de cores, composição e estilo, e mantenha total coerência com eles na sua direção de arte.`
    : ''

  const prompt = `Você é diretor de arte de uma agência. Vou te dar uma pauta e o DNA da marca. Devolva o CONTEÚDO de UM criativo de feed (imagem única) — texto curto e impactante, pronto para a arte.

DNA DA MARCA:
${dna}${refNote}

PAUTA:
Briefing: ${post.briefing || post.legenda || ''}
Direção de criativo: ${post.sugestaoImagem || ''}
Texto sugerido para a arte: ${post.textoImagem || ''}

Escolha o TEMPLATE que melhor comunica a mensagem:
- "capa": título forte + apoio (anúncio, tema, gancho)
- "dica": rótulo curto + título + 2 a 4 bullets objetivos
- "citacao": uma frase de efeito + autoria/assinatura
- "dado": um número/estatística de destaque + explicação curta
${template ? `\nUSE OBRIGATORIAMENTE o template "${template}".` : ''}

Regras: texto para ARTE (não legenda) — curtíssimo. Headline com no máx. ~9 palavras. Bullets com no máx. ~8 palavras cada. Nada de hashtag. Respeite o tom e as restrições da marca.

Responda APENAS com JSON válido (sem markdown, sem backticks):
{"template":"capa|dica|citacao|dado","headline":"...","subheadline":"... ou vazio","bullets":["...","..."],"rodape":"assinatura curta ou vazio"}`

  let dados: any
  try {
    const client = new Anthropic({ apiKey: KEY })
    const conteudo: any[] = refs.map(url => ({ type: 'image', source: { type: 'url', url } }))
    conteudo.push({ type: 'text', text: prompt })
    const msg = await client.messages.create({
      model: 'claude-opus-4-8', max_tokens: 1200,
      thinking: { type: 'adaptive' }, output_config: { effort: 'low' } as any,
      messages: [{ role: 'user', content: refs.length ? conteudo : prompt }],
    } as any)
    await registrarGasto(custoEstimado(msg.usage)).catch(() => {})
    const texto = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    const m = texto.match(/\{[\s\S]*\}/)
    if (!m) return NextResponse.json({ error: 'A IA não retornou o formato esperado.' }, { status: 502 })
    dados = JSON.parse(m[0])
  } catch (err: any) {
    return NextResponse.json({ error: `Falha na direção de arte: ${err?.message || 'desconhecido'}` }, { status: 500 })
  }

  const corFundo = (cliente.corPrimaria || '#141414').trim()
  const corAccent = (cliente.corSecundaria || '#ffc00f').trim()
  const d: DadosCriativo = {
    template: ['capa', 'dica', 'citacao', 'dado'].includes(dados.template) ? dados.template : 'capa',
    headline: (dados.headline || '').toString().slice(0, 140),
    subheadline: (dados.subheadline || '').toString().slice(0, 160),
    bullets: Array.isArray(dados.bullets) ? dados.bullets.slice(0, 4).map((b: any) => String(b).slice(0, 120)) : [],
    rodape: (dados.rodape || '').toString().slice(0, 60),
    corFundo, corTexto: contraste(corFundo), corAccent,
    logo: cliente.logo,
    handle: cliente.instagram ? `@${cliente.instagram.replace(/^@/, '')}` : '',
  }

  try {
    const baseUrl = (process.env.APPROVAL_BASE_URL || process.env.NEXTAUTH_URL || new URL(req.url).origin).replace(/\/$/, '')
    const fonts = await carregarFontes(baseUrl)
    const imagem = new ImageResponse(montarCriativo(d), { width: LARGURA, height: ALTURA, fonts })
    const base64 = Buffer.from(await imagem.arrayBuffer()).toString('base64')
    // O store do Blob é privado (put público é barrado). Devolvemos a imagem e o
    // cliente sobe pelo fluxo upload() — mesmo caminho da mídia manual, que gera
    // URL pública que o Instagram consegue buscar.
    return NextResponse.json({ ok: true, imagemBase64: base64, template: d.template })
  } catch (err: any) {
    console.error('[gerar-criativo] render erro:', err?.message)
    return NextResponse.json({ error: `Falha ao gerar a imagem: ${err?.message || 'desconhecido'}` }, { status: 500 })
  }
}

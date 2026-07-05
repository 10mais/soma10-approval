import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Post } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { bloqueiaAcao } from '@/lib/permissoesGranularServer'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import { montarCriativo, carregarFontes, contraste, DadosCriativo, LARGURA, ALTURA } from '@/lib/criativoTemplates'
import { ImageResponse } from '@vercel/og'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

// Baixa uma imagem (Blob) no SERVIDOR e devolve base64/dataUri. Assim o og e a IA
// usam a imagem mesmo que o fetch remoto do og não alcance o Blob (store privado).
async function baixarImg(url?: string): Promise<{ base64: string; mime: string; dataUri: string } | null> {
  if (!url) return null
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    let mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) mime = 'image/jpeg'
    const base64 = buf.toString('base64')
    return { base64, mime, dataUri: `data:${mime};base64,${base64}` }
  } catch { return null }
}

// Re-renderiza o criativo a partir da "receita" (spec com URLs) — usado pelo editor.
async function renderSpec(spec: any, fonts: any): Promise<string> {
  // Editor visual (Nível 2): template "livre" com camadas posicionadas.
  if (spec?.template === 'livre') {
    const fundoData = spec?.fundoUrl ? await baixarImg(spec.fundoUrl) : null
    const camadasIn = Array.isArray(spec?.camadas) ? spec.camadas : []
    const camadas = await Promise.all(camadasIn.map(async (c: any) => {
      if (c?.tipo === 'imagem' && c.url) { const im = await baixarImg(c.url); return { ...c, _data: im?.dataUri } }
      return c
    }))
    const corFundoL = (spec?.corFundo || '#141414')
    const dl: DadosCriativo = {
      template: 'livre', corFundo: corFundoL, corTexto: contraste(corFundoL), corAccent: (spec?.corAccent || '#ffc00f'),
      fundo: fundoData?.dataUri, camadas,
    }
    const imgL = new ImageResponse(montarCriativo(dl), { width: LARGURA, height: ALTURA, fonts })
    return Buffer.from(await imgL.arrayBuffer()).toString('base64')
  }
  const logoData = spec?.logoUrl ? await baixarImg(spec.logoUrl) : null
  const usarFoto = spec?.template === 'foto' && !!spec?.fundoUrl
  const fundoData = usarFoto ? await baixarImg(spec.fundoUrl) : null
  const corFundo = (spec?.corFundo || '#141414')
  const d: DadosCriativo = {
    template: (usarFoto && fundoData) ? 'foto' : (['capa', 'dica', 'citacao', 'dado'].includes(spec?.template) ? spec.template : 'capa'),
    headline: (spec?.headline || '').toString().slice(0, 140),
    subheadline: (spec?.subheadline || '').toString().slice(0, 160),
    bullets: Array.isArray(spec?.bullets) ? spec.bullets.slice(0, 4).map((b: any) => String(b).slice(0, 120)) : [],
    rodape: (spec?.rodape || '').toString().slice(0, 60),
    corFundo, corTexto: contraste(corFundo), corAccent: (spec?.corAccent || '#ffc00f'),
    logo: logoData?.dataUri, handle: spec?.handle || '',
    fundo: (usarFoto && fundoData) ? fundoData.dataUri : undefined,
  }
  const imagem = new ImageResponse(montarCriativo(d), { width: LARGURA, height: ALTURA, fonts })
  return Buffer.from(await imagem.arrayBuffer()).toString('base64')
}

// POST { postId, ... } — gera (IA), re-renderiza (modo:'render') ou refina (modo:'refinar').
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel(role, 'producao', 'editar', (session!.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  if (await bloqueiaAcao(role, 'gerar_ia', (session!.user as any).permissoesGranular)) return NextResponse.json({ error: 'sem permissão para gerar com IA' }, { status: 403 })

  const KEY = process.env.ANTHROPIC_API_KEY?.trim()
  if (!KEY) return NextResponse.json({ error: 'IA não configurada (ANTHROPIC_API_KEY).' }, { status: 500 })

  const { postId, template, fundoUrl, semFoto, headline: headlineIn, modo, dados: dadosIn, instrucao } = await req.json()
  if (!postId) return NextResponse.json({ error: 'postId é obrigatório' }, { status: 400 })
  const fotoEscolhida = typeof fundoUrl === 'string' && fundoUrl.trim() ? fundoUrl.trim() : ''
  const headlineFixa = typeof headlineIn === 'string' && headlineIn.trim() ? headlineIn.trim() : ''

  const post = await redis.get<Post>(`post:${postId}`)
  if (!post) return NextResponse.json({ error: 'post não encontrado' }, { status: 404 })
  const cliente = await redis.get<Cliente>(`cliente:${post.clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  const baseUrl = (process.env.APPROVAL_BASE_URL || process.env.NEXTAUTH_URL || new URL(req.url).origin).replace(/\/$/, '')
  const fonts = await carregarFontes(baseUrl)

  // MODO RENDER — re-renderiza a partir dos campos editados manualmente (sem IA).
  if (modo === 'render' && dadosIn) {
    try {
      const base64 = await renderSpec(dadosIn, fonts)
      return NextResponse.json({ ok: true, imagemBase64: base64, criativoData: dadosIn, template: dadosIn.template })
    } catch (err: any) {
      return NextResponse.json({ error: `Falha ao renderizar: ${err?.message || 'erro'}` }, { status: 500 })
    }
  }

  // MODO REFINAR — a IA ajusta os textos a partir de uma instrução do usuário.
  if (modo === 'refinar' && dadosIn) {
    if (!KEY) return NextResponse.json({ error: 'IA não configurada.' }, { status: 500 })
    try {
      const client = new Anthropic({ apiKey: KEY })
      const promptRef = `Você é diretor de arte. Aqui está o conteúdo ATUAL de um criativo (JSON) e uma INSTRUÇÃO do usuário. Devolva o MESMO JSON com os campos de TEXTO ajustados conforme a instrução — curtíssimo, sem hashtag, sem inventar campos. Pode trocar "template" entre capa|dica|citacao|dado|foto se fizer sentido. NÃO mexa em cores.

ATUAL:
${JSON.stringify({ template: dadosIn.template, headline: dadosIn.headline, subheadline: dadosIn.subheadline, bullets: dadosIn.bullets, rodape: dadosIn.rodape })}

INSTRUÇÃO: ${String(instrucao || '').slice(0, 500)}

Responda APENAS com JSON: {"template":"...","headline":"...","subheadline":"...","bullets":["..."],"rodape":"..."}`
      const msg = await client.messages.create({
        model: 'claude-opus-4-8', max_tokens: 1000,
        thinking: { type: 'adaptive' }, output_config: { effort: 'low' } as any,
        messages: [{ role: 'user', content: promptRef }],
      } as any)
      await registrarGasto(custoEstimado(msg.usage)).catch(() => {})
      const texto = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
      const m = texto.match(/\{[\s\S]*\}/)
      const upd = m ? JSON.parse(m[0]) : {}
      const spec2 = {
        ...dadosIn,
        template: ['capa', 'dica', 'citacao', 'dado', 'foto'].includes(upd.template) ? upd.template : dadosIn.template,
        headline: upd.headline ?? dadosIn.headline,
        subheadline: upd.subheadline ?? dadosIn.subheadline,
        bullets: Array.isArray(upd.bullets) ? upd.bullets : dadosIn.bullets,
        rodape: upd.rodape ?? dadosIn.rodape,
      }
      const base64 = await renderSpec(spec2, fonts)
      return NextResponse.json({ ok: true, imagemBase64: base64, criativoData: spec2, template: spec2.template })
    } catch (err: any) {
      return NextResponse.json({ error: `Falha ao refinar: ${err?.message || 'erro'}` }, { status: 500 })
    }
  }

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
  // Se o usuário escolheu uma imagem de referência no modal, ela entra na frente.
  if (fotoEscolhida && !refs.includes(fotoEscolhida)) refs.unshift(fotoEscolhida)
  const temLogo = escolhidos.some(a => a.categoria === 'logo')
  // Ativos usados DENTRO da arte: logo (com fallback) e a foto de fundo.
  const logoAsset = ativos.find(a => a.categoria === 'logo')?.url
  const fotoFundo = fotoEscolhida
    ? fotoEscolhida
    : (semFoto ? '' : ativos.find(a => ['foto', 'print', 'elemento'].includes(a.categoria))?.url)
  const logoFinal = (cliente.logo || logoAsset || '').trim()
  const refNote = refs.length
    ? `\n\nVocê RECEBE ${refs.length} imagem(ns) de ATIVOS/REFERÊNCIA da marca${temLogo ? ' (inclui a logomarca)' : ''}. É OBRIGATÓRIO SEGUIR ESSAS REFERÊNCIAS: replique a paleta de cores, a tipografia, o estilo visual, a composição e o tom delas. A arte final deve parecer da MESMA marca das referências.${fotoFundo ? ' Use a foto da marca como fundo (template "foto") sempre que combinar.' : ''}`
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
- "foto": uma FOTO da marca como fundo com um título curto por cima${fotoFundo ? ' (há foto disponível — use quando combinar)' : ' (indisponível: não há foto da marca)'}
${template ? `\nUSE OBRIGATORIAMENTE o template "${template}".` : ''}

${headlineFixa ? `\nHEADLINE OBRIGATÓRIA E FIXA: "${headlineFixa}". Use EXATAMENTE essa frase como headline, sem reescrever, resumir ou traduzir. Gere só o resto (subheadline/bullets/rodapé/template).\n` : ''}
Regras: texto para ARTE (não legenda) — curtíssimo. ${headlineFixa ? '' : 'Headline com no máx. ~9 palavras. '}Bullets com no máx. ~8 palavras cada. Nada de hashtag. Respeite o tom e as restrições da marca.

Responda APENAS com JSON válido (sem markdown, sem backticks):
{"template":"capa|dica|citacao|dado|foto","headline":"...","subheadline":"... ou vazio","bullets":["...","..."],"rodape":"assinatura curta ou vazio"}`

  let dados: any
  try {
    const client = new Anthropic({ apiKey: KEY })
    const imgs = (await Promise.all(refs.slice(0, 3).map(baixarImg))).filter(Boolean) as { base64: string; mime: string }[]
    const conteudo: any[] = imgs.map(im => ({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.base64 } }))
    conteudo.push({ type: 'text', text: prompt })
    const msg = await client.messages.create({
      model: 'claude-opus-4-8', max_tokens: 1200,
      thinking: { type: 'adaptive' }, output_config: { effort: 'low' } as any,
      messages: [{ role: 'user', content: imgs.length ? conteudo : prompt }],
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
  const escolhido = ['capa', 'dica', 'citacao', 'dado', 'foto'].includes(dados.template) ? dados.template : 'capa'
  // Usa a foto da marca sempre que houver e o template comportar imagem de fundo
  // (foto ou capa) — não deixa só na escolha da IA.
  const querFoto = !!fotoFundo && (!!fotoEscolhida || escolhido === 'foto' || escolhido === 'capa')
  // Baixa logo (com FALLBACK: cliente.logo pode estar expirado/403 → tenta o
  // ativo 'logo' da marca) e fundo no servidor (base64) para o og renderizar.
  const logoCandidatos = [(cliente.logo || '').trim(), (logoAsset || '').trim()].filter(Boolean)
  let logoData: Awaited<ReturnType<typeof baixarImg>> = null
  let logoUsada = ''
  for (const u of logoCandidatos) { const d0 = await baixarImg(u); if (d0) { logoData = d0; logoUsada = u; break } }
  const fundoData = querFoto ? await baixarImg(fotoFundo) : null
  const usarFoto = !!fundoData
  console.log('[gerar-criativo]', JSON.stringify({
    cliente: cliente.nome, ativos: ativos.length, cats: ativos.map(a => a.categoria),
    templateIA: dados.template, escolhido, querFoto, usarFoto, logoOk: !!logoData, fotoFundoUrl: !!fotoFundo,
  }))
  const d: DadosCriativo = {
    template: usarFoto ? 'foto' : (escolhido === 'foto' ? 'capa' : escolhido),
    headline: (headlineFixa || (dados.headline || '').toString()).slice(0, 140),
    subheadline: (dados.subheadline || '').toString().slice(0, 160),
    bullets: Array.isArray(dados.bullets) ? dados.bullets.slice(0, 4).map((b: any) => String(b).slice(0, 120)) : [],
    rodape: (dados.rodape || '').toString().slice(0, 60),
    corFundo, corTexto: contraste(corFundo), corAccent,
    logo: logoData?.dataUri,
    handle: cliente.instagram ? `@${cliente.instagram.replace(/^@/, '')}` : '',
    fundo: usarFoto ? fundoData!.dataUri : undefined,
  }

  try {
    const imagem = new ImageResponse(montarCriativo(d), { width: LARGURA, height: ALTURA, fonts })
    const base64 = Buffer.from(await imagem.arrayBuffer()).toString('base64')
    // Receita do criativo (URLs, não data URIs) para reabrir no editor.
    const criativoData = {
      template: d.template, headline: d.headline, subheadline: d.subheadline, bullets: d.bullets, rodape: d.rodape,
      corFundo, corAccent, fundoUrl: usarFoto ? fotoFundo : '', logoUrl: logoUsada || logoFinal || '', handle: d.handle,
    }
    // O store do Blob é privado (put público é barrado). Devolvemos a imagem e o
    // cliente sobe pelo fluxo upload() — mesmo caminho da mídia manual.
    return NextResponse.json({ ok: true, imagemBase64: base64, template: d.template, criativoData })
  } catch (err: any) {
    console.error('[gerar-criativo] render erro:', err?.message)
    return NextResponse.json({ error: `Falha ao gerar a imagem: ${err?.message || 'desconhecido'}` }, { status: 500 })
  }
}

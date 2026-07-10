import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Post, FonteMarca } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { bloqueiaAcao } from '@/lib/permissoesGranularServer'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import { capturarErro } from '@/lib/erros'
import { renderHtmlToPng } from '@/lib/renderHtml'
import { CANVAS, FonteResolvida, promptDesigner, promptRefinar, extrairHtml, montarHtmlFinal } from '@/lib/designCriativo'
import { objetivoDef } from '@/lib/criativoObjetivos'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

// Motor de criativos NOVO — o Claude DESENHA o criativo como HTML/CSS com a
// identidade real da marca (fontes @font-face, cores, logo, elementos) e o
// Chrome headless rasteriza (lib/renderHtml). O motor antigo (Satori/templates)
// segue em /api/studio/gerar-criativo como modo clássico.

// Baixa um arquivo (Blob/URL) no servidor e devolve dataUri — o og/Chrome não
// alcançam o Blob privado por URL; tudo entra embutido em base64.
async function baixar(url?: string, mimeFallback = 'image/jpeg'): Promise<{ dataUri: string; base64: string; mime: string } | null> {
  if (!url) return null
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    let mime = (r.headers.get('content-type') || mimeFallback).split(';')[0].trim()
    if (mime === 'application/octet-stream') mime = mimeFallback
    const base64 = buf.toString('base64')
    return { dataUri: `data:${mime};base64,${base64}`, base64, mime }
  } catch { return null }
}

// Resolve as fontes da marca (papel titulo/texto) em @font-face embutíveis.
// Sem fonte da marca no papel -> Poppins do /public (garante tipografia decente
// sempre — o Chromium serverless quase não tem fontes de sistema).
async function resolverFontes(fontes: FonteMarca[] | undefined, baseUrl: string): Promise<{ resolvidas: FonteResolvida[]; info: string }> {
  const out: FonteResolvida[] = []
  const partes: string[] = []
  const doPapel = (papel: 'titulo' | 'texto') => (fontes || []).filter(f => (f.papel || 'texto') === papel && f.url)

  for (const papel of ['titulo', 'texto'] as const) {
    const familia = papel === 'titulo' ? 'TituloMarca' as const : 'TextoMarca' as const
    const daMarca = doPapel(papel)
    let ok = false
    for (const f of daMarca.slice(0, 2)) { // até 2 pesos por papel
      const d = await baixar(f.url, 'font/ttf')
      if (d) { out.push({ familia, dataUri: d.dataUri, peso: f.peso || (papel === 'titulo' ? 700 : 400), italico: f.italico }); ok = true }
    }
    if (ok) {
      partes.push(`${papel === 'titulo' ? 'Título' : 'Texto'}: ${daMarca[0].nome} (fonte oficial da marca)`)
    } else {
      const arq = papel === 'titulo' ? 'Poppins-Bold.ttf' : 'Poppins-Regular.ttf'
      const d = await baixar(`${baseUrl}/fonts/${arq}`, 'font/ttf')
      if (d) out.push({ familia, dataUri: d.dataUri, peso: papel === 'titulo' ? 700 : 400 })
      partes.push(`${papel === 'titulo' ? 'Título' : 'Texto'}: Poppins (fallback — marca sem fonte cadastrada)`)
    }
  }
  return { resolvidas: out, info: partes.join(' · ') }
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
  const KEY = process.env.ANTHROPIC_API_KEY?.trim()
  if (!KEY) return NextResponse.json({ error: 'IA não configurada (ANTHROPIC_API_KEY).' }, { status: 500 })

  try {
    const { postId, fundoUrl, semFoto, headline: headlineIn, brief, modo, instrucao, dadosIn } = await req.json()
    if (!postId) return NextResponse.json({ error: 'postId é obrigatório' }, { status: 400 })

    const post = await redis.get<Post>(`post:${postId}`)
    if (!post) return NextResponse.json({ error: 'post não encontrado' }, { status: 404 })
    const cliente = await redis.get<Cliente>(`cliente:${post.clienteId}`)
    if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

    const baseUrl = (process.env.APPROVAL_BASE_URL || process.env.NEXTAUTH_URL || new URL(req.url).origin).replace(/\/$/, '')
    const headlineFixa = typeof headlineIn === 'string' && headlineIn.trim() ? headlineIn.trim() : ''
    const fotoEscolhida = typeof fundoUrl === 'string' && fundoUrl.trim() ? fundoUrl.trim() : ''

    // ===== Ativos e fontes (resolvidos no servidor, entram como tokens) =====
    const ativos = Array.isArray(cliente.assetsMarca) ? cliente.assetsMarca : []
    const logoAsset = ativos.find(a => a.categoria === 'logo')?.url
    const logoCandidatos = [(cliente.logo || '').trim(), (logoAsset || '').trim()].filter(Boolean)
    let logoData: Awaited<ReturnType<typeof baixar>> = null
    let logoUsada = ''
    for (const u of logoCandidatos) { const d = await baixar(u, 'image/png'); if (d) { logoData = d; logoUsada = u; break } }

    const fotoFundo = fotoEscolhida || (semFoto ? '' : (ativos.find(a => a.categoria === 'foto')?.url || ''))
    const fundoData = fotoFundo ? await baixar(fotoFundo) : null
    const elementos = ativos.filter(a => a.categoria === 'elemento').slice(0, 2)
    const elementosData = (await Promise.all(elementos.map(e => baixar(e.url, 'image/png')))).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof baixar>>>[]

    const tokens: Record<string, string> = {}
    const tokensDisponiveis: string[] = []
    if (logoData) { tokens['LOGO'] = logoData.dataUri; tokensDisponiveis.push('{{LOGO}} (logomarca)') }
    if (fundoData) { tokens['FUNDO'] = fundoData.dataUri; tokensDisponiveis.push('{{FUNDO}} (foto da marca p/ fundo full-bleed)') }
    elementosData.forEach((e, i) => { tokens[`ELEMENTO_${i + 1}`] = e.dataUri; tokensDisponiveis.push(`{{ELEMENTO_${i + 1}}} (grafismo da marca)`) })

    const { resolvidas: fontesResolvidas, info: fontesInfo } = await resolverFontes(cliente.fontes, baseUrl)

    // ===== MODO RENDER — re-render determinístico da receita salva (sem IA) =====
    if (modo === 'render' && dadosIn?.html) {
      const htmlFinal = montarHtmlFinal(dadosIn.html, { tokens, fontes: fontesResolvidas })
      const png = await renderHtmlToPng(htmlFinal, CANVAS)
      return NextResponse.json({ ok: true, imagemBase64: png.toString('base64'), template: 'html', criativoData: dadosIn })
    }

    const client = new Anthropic({ apiKey: KEY })

    // ===== MODO REFINAR — instrução do usuário sobre o HTML atual =====
    if (modo === 'refinar' && dadosIn?.html) {
      const msg = await client.messages.create({
        model: 'claude-opus-4-8', max_tokens: 6000,
        thinking: { type: 'adaptive' }, output_config: { effort: 'medium' } as any,
        messages: [{ role: 'user', content: promptRefinar(dadosIn.html, String(instrucao || '').slice(0, 600)) }],
      } as any)
      await registrarGasto(custoEstimado(msg.usage)).catch(() => {})
      const texto = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
      const html = extrairHtml(texto)
      if (!html) return NextResponse.json({ error: 'A IA não devolveu um HTML válido.' }, { status: 502 })
      const htmlFinal = montarHtmlFinal(html, { tokens, fontes: fontesResolvidas })
      const png = await renderHtmlToPng(htmlFinal, CANVAS)
      const criativoData = { ...dadosIn, template: 'html', html }
      return NextResponse.json({ ok: true, imagemBase64: png.toString('base64'), template: 'html', criativoData })
    }

    // ===== GERAÇÃO — o Claude desenha =====
    const pb = cliente.playbook
    const dna = [
      `Marca: ${cliente.nome}`,
      cliente.segmento ? `Segmento: ${cliente.segmento}` : '',
      cliente.tomDeVoz ? `Tom de voz: ${cliente.tomDeVoz}` : '',
      cliente.publicoAlvo ? `Público: ${cliente.publicoAlvo}` : '',
      pb?.posicionamento ? `Posicionamento: ${pb.posicionamento}` : '',
      pb?.fazer ? `Sempre fazer: ${pb.fazer}` : '',
      pb?.naoFazer ? `Nunca fazer: ${pb.naoFazer}` : '',
      pb?.restricoes ? `Restrições: ${pb.restricoes}` : '',
    ].filter(Boolean).join('\n')

    // Referências visuais multimodais: prints (posts reais) primeiro — são o
    // melhor professor de estilo; depois a foto escolhida e a logo.
    const ordemRef = ['print', 'foto', 'elemento', 'icone', 'outro']
    const refs = [...ativos]
      .filter(a => a.url && a.categoria !== 'logo')
      .sort((a, b) => ordemRef.indexOf(a.categoria) - ordemRef.indexOf(b.categoria))
      .map(a => a.url).slice(0, 3)
    if (fotoEscolhida && !refs.includes(fotoEscolhida)) refs.unshift(fotoEscolhida)

    const b = brief || {}
    const def = objetivoDef(b.objetivo)
    const camposBrief = [
      b.cta ? `CTA: ${b.cta}` : '', b.oferta ? `Oferta: ${b.oferta}` : '', b.preco ? `Preço: ${b.preco}` : '',
      b.dataEvento ? `Data: ${b.dataEvento}` : '', b.horaEvento ? `Hora: ${b.horaEvento}` : '', b.localEvento ? `Local: ${b.localEvento}` : '',
      b.legal ? `Texto legal (letra miúda): ${b.legal}` : '', b.whatsapp ? `WhatsApp: ${b.whatsapp}` : '',
    ].filter(Boolean).join(' · ')

    const prompt = promptDesigner({
      dna,
      paleta: { primaria: (cliente.corPrimaria || '#141414').trim(), secundaria: (cliente.corSecundaria || '#ffc00f').trim() },
      vibe: cliente.style,
      fontesInfo,
      tokens: tokensDisponiveis,
      briefing: [post.briefing || post.legenda || '', post.sugestaoImagem ? `Direção de criativo: ${post.sugestaoImagem}` : ''].filter(Boolean).join('\n'),
      headlineFixa: headlineFixa || undefined,
      objetivo: def ? `${def.label} — ${def.dica}` : undefined,
      camposBrief,
      handle: cliente.instagram ? `@${cliente.instagram.replace(/^@/, '')}` : undefined,
      temReferencias: refs.length > 0,
    })

    const imgs = (await Promise.all(refs.slice(0, 3).map(u => baixar(u)))).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof baixar>>>[]
    const conteudo: any[] = imgs
      .filter(im => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(im.mime))
      .map(im => ({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.base64 } }))
    conteudo.push({ type: 'text', text: prompt })

    const msg = await client.messages.create({
      model: 'claude-opus-4-8', max_tokens: 6000,
      thinking: { type: 'adaptive' }, output_config: { effort: 'medium' } as any,
      messages: [{ role: 'user', content: conteudo }],
    } as any)
    await registrarGasto(custoEstimado(msg.usage)).catch(() => {})
    const texto = msg.content.filter((bl: any) => bl.type === 'text').map((bl: any) => bl.text).join('')
    const html = extrairHtml(texto)
    if (!html) return NextResponse.json({ error: 'A IA não devolveu um HTML válido. Tente de novo.' }, { status: 502 })

    const htmlFinal = montarHtmlFinal(html, { tokens, fontes: fontesResolvidas })
    const png = await renderHtmlToPng(htmlFinal, CANVAS)

    console.log('[gerar-criativo-html]', JSON.stringify({
      cliente: cliente.nome, vibe: cliente.style || '', fontesMarca: (cliente.fontes || []).length,
      logoOk: !!logoData, fundo: !!fundoData, elementos: elementosData.length, refs: imgs.length, htmlKb: Math.round(html.length / 1024),
    }))

    // Receita pequena: HTML com tokens (sem base64) + brief — re-render resolve os ativos de novo.
    const criativoData = {
      template: 'html', html,
      headline: headlineFixa || undefined,
      objetivo: b.objetivo || undefined, cta: b.cta || undefined, oferta: b.oferta || undefined, preco: b.preco || undefined,
      dataEvento: b.dataEvento || undefined, horaEvento: b.horaEvento || undefined, localEvento: b.localEvento || undefined,
      legal: b.legal || undefined, whatsapp: b.whatsapp || undefined,
      corFundo: (cliente.corPrimaria || '#141414').trim(), corAccent: (cliente.corSecundaria || '#ffc00f').trim(),
      fundoUrl: fotoFundo || '', logoUrl: logoUsada || '',
      handle: cliente.instagram ? `@${cliente.instagram.replace(/^@/, '')}` : '',
    }
    return NextResponse.json({ ok: true, imagemBase64: png.toString('base64'), template: 'html', criativoData })
  } catch (err: any) {
    await capturarErro('studio/gerar-criativo-html', err)
    return NextResponse.json({ error: `Falha ao gerar o criativo: ${err?.message || 'erro'}` }, { status: 500 })
  }
}

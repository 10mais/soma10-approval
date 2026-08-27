import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Post, Cliente } from '@/lib/redis'
import { list } from '@vercel/blob'
import nodemailer from 'nodemailer'
import { notificarEquipe, notificarDono, notificar } from '@/lib/notificacoes'
import { clienteSuspenso } from '@/lib/suspensao'
import { checarRate } from '@/lib/rateLimit'
import { capturarErro } from '@/lib/erros'

export const runtime = 'nodejs'
export const maxDuration = 300

const NOTIFY_EMAIL = 'marketing@grupo10mais.com.br'

// Data legível no histórico de mudanças ("12/09/2026 14:30"). ISO vazio = "sem data".
function fmtData(iso: string): string {
  if (!iso) return 'sem data'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'sem data'
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export async function POST(req: NextRequest) {
  try {
    return await decidir(req)
  } catch (e) {
    await capturarErro('decision', e)
    return NextResponse.json({ error: 'erro ao processar decisão' }, { status: 500 })
  }
}

async function decidir(req: NextRequest): Promise<NextResponse> {
  const rl = await checarRate(req, 'decision', 40, 60); if (rl) return rl
  const body = await req.json()
  const { id, annotations, rejectReason, codigo, token, novaLegenda, novaData } = body
  // type: 'approved' | 'corrected' | 'rejected' | 'caption' (correção só de legenda)
  let type = body.type as 'approved' | 'corrected' | 'rejected' | 'caption'

  // Buscar post do Redis
  let post = await redis.get<Post>(`post:${id}`)

  // Fallback: Blob
  if (!post) {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    const { blobs } = await list({ prefix: `briefings/${id}.json`, token })
    if (!blobs.length) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
    const res = await fetch(blobs[0].url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    post = await res.json() as Post
  }

  // Autorização: cliente logado (sessão) OU código de 6 dígitos (link público)
  const session = await getServerSession(authOptions)
  const sessionRole = (session?.user as any)?.role
  const sessionClienteId = (session?.user as any)?.clienteId

  const autorizadoPorSessao = sessionRole === 'cliente' && sessionClienteId === post.clienteId
  const autorizadoPorCodigo = post.codigo && codigo === post.codigo
  // Link público ÚNICO do cliente: token mapeia para o clienteId
  let autorizadoPorToken = false
  if (token) {
    const cid = await redis.get<string>(`aprovtoken:${token}`)
    autorizadoPorToken = !!cid && cid === post.clienteId
  }

  if (!autorizadoPorSessao && !autorizadoPorCodigo && !autorizadoPorToken) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  // Cliente suspenso por inadimplência não pode aprovar/corrigir/reprovar (cobre sessão, código e token).
  if (await clienteSuspenso(post.clienteId)) {
    return NextResponse.json({ error: 'acesso suspenso por pendência de pagamento' }, { status: 403 })
  }

  // FOTOGRAFIA do material ANTES de qualquer alteração. A partir daqui o código
  // sobrescreve post.legenda/headline/etc com o que o cliente mandou; sem esta
  // cópia o valor ORIGINAL some para sempre e a tela de Solicitações fica sem ter
  // como mostrar "antes -> depois" (pedido do dono, 27/08).
  const antesDoPedido: Record<string, unknown> = {
    legenda: (post as any).legenda || '',
    headline: (post as any).headline || '',
    subheadline: (post as any).subheadline || '',
    textoImagem: (post as any).textoImagem || '',
    cta: (post as any).cta || '',
  }
  const CAMPOS_COPY = [
    { chave: 'headline', rotulo: 'Headline' },
    { chave: 'subheadline', rotulo: 'Subtítulo' },
    { chave: 'textoImagem', rotulo: 'Texto na arte' },
    { chave: 'cta', rotulo: 'CTA' },
    { chave: 'legenda', rotulo: 'Legenda' },
  ]

  // ===== LINHA DE MONTAGEM: COPY em aprovação (etapa aprovacao_copy) =====
  // Pelo mesmo link público do criativo, a decisão aqui é sobre o TEXTO.
  // approved -> copy aprovada (nasce a tarefa do designer); corrected/rejected ->
  // aplica os campos EDITADOS pelo cliente (headline/sub/texto/CTA/legenda) +
  // observação e devolve para a agência.
  if ((post as any).etapa === 'aprovacao_copy') {
    const agoraCopy = new Date().toISOString()
    const clienteNomeCopy = (post as any).clienteNome || (post as any).cliente || 'Cliente'
    const novos = (body.novosCampos || {}) as Record<string, unknown>
    const aplicarCampos = () => {
      for (const k of ['headline', 'subheadline', 'textoImagem', 'cta'] as const) {
        if (typeof novos[k] === 'string') (post as any)[k] = novos[k]
      }
      if (typeof novaLegenda === 'string') (post as any).legenda = novaLegenda
    }
    try {
      const { registrarLogCliente, diffCampos } = await import('@/lib/logCliente')
      // O que o cliente REESCREVEU: compara o material original com os campos que
      // vieram no pedido. `aplicarCampos()` ainda não rodou, então `antesDoPedido`
      // e o post são o estado original.
      const editados: Record<string, unknown> = { ...novos }
      if (typeof novaLegenda === 'string') editados.legenda = novaLegenda
      const mudancas = diffCampos(antesDoPedido, editados, CAMPOS_COPY)
      await registrarLogCliente({
        clienteId: (post as any).clienteId || '', clienteNome: clienteNomeCopy,
        tipo: type === 'approved' || type === 'caption' ? 'aprovacao' : type === 'rejected' ? 'reprovacao' : 'ajuste_copy',
        acao: type === 'approved' || type === 'caption' ? 'Aprovou a copy' : type === 'rejected' ? 'Recusou a copy' : 'Pediu ajuste na copy',
        postId: id, resumo: ((post as any).headline || post.legenda || (post as any).briefing || '').slice(0, 140),
        motivo: rejectReason || undefined, origem: autorizadoPorSessao ? 'portal' : autorizadoPorToken ? 'link' : 'codigo',
        mudancas: mudancas.length ? mudancas : undefined,
      })
    } catch { /* nunca bloqueia */ }

    if (type === 'approved' || type === 'caption') {
      if (type === 'caption') aplicarCampos() // "aprovar com meus ajustes"
      ;(post as any).etapa = 'criativo'
      ;(post as any).copyAprovadaEm = agoraCopy
      ;(post as any).ajusteCopy = undefined
      if (post.status === 'aguardando_aprovacao' || post.status === 'corrigir') post.status = 'rascunho'
      ;(post as any).etapaDesde = agoraCopy; (post as any).aguardandoDesde = undefined
      ;(post as any).atualizadoEm = agoraCopy
      await redis.set(`post:${id}`, post)
      // Copy aprovada -> nasce a tarefa do designer (falha nunca derruba a decisão)
      try { const { nascerTarefaDesigner } = await import('@/lib/tarefasDaPauta'); await nascerTarefaDesigner(id, clienteNomeCopy) } catch { /* segue */ }
      await notificarDono((post as any).criadoPor, 'geral', `Copy aprovada — ${clienteNomeCopy}`, `${clienteNomeCopy} aprovou a copy da pauta "${(post as any).briefing || post.legenda || 'sem título'}". Etapa avançou para Criativo.`, id)
      return NextResponse.json({ ok: true })
    }

    aplicarCampos()
    ;(post as any).ajusteCopy = rejectReason || 'Ajuste solicitado'
    post.status = type === 'rejected' ? 'reprovado' : 'corrigir'
    if (type === 'rejected') (post as any).motivoReprovacao = rejectReason || ''
    ;(post as any).etapaDesde = agoraCopy; (post as any).aguardandoDesde = undefined
    ;(post as any).atualizadoEm = agoraCopy
    await redis.set(`post:${id}`, post)
    await notificarDono((post as any).criadoPor, 'geral', `${type === 'rejected' ? 'Copy recusada' : 'Ajuste de copy'} — ${clienteNomeCopy}`, `${clienteNomeCopy} ${type === 'rejected' ? 'recusou a copy' : 'pediu ajuste na copy'}: "${rejectReason || 'sem comentário'}".`, id)
    return NextResponse.json({ ok: true })
  }

  const dataAnterior = String((post as any).dataAgendada || '')

  // Correção SÓ da legenda: substitui o texto e SEGUE a programação (= aprova).
  const soLegenda = type === 'caption'
  if (soLegenda) {
    if (typeof novaLegenda === 'string') post.legenda = novaLegenda
    type = 'approved'
  }

  // Solicitação de ajuste CONSOLIDADA: junto das marcações de layout, o cliente pode
  // pedir nova legenda e/ou nova data. Aplica o que veio (fica EM AJUSTE, não aprova).
  if (type === 'corrected') {
    if (typeof novaLegenda === 'string' && novaLegenda.trim()) post.legenda = novaLegenda
    if (novaData) { const d = new Date(novaData); if (!isNaN(d.getTime())) (post as any).dataAgendada = d.toISOString() }
  }

  // Atualizar status
  const novoStatus = type === 'approved' ? 'aprovado' : type === 'corrected' ? 'corrigir' : 'reprovado'
  const atualizado = { ...post, status: novoStatus, anotacoes: annotations, motivoReprovacao: rejectReason, atualizadoEm: new Date().toISOString() }
  await redis.set(`post:${id}`, atualizado)

  // LOG da solicitação do cliente (30 dias) — para reencontrar mesmo depois de editar.
  try {
    const { registrarLogCliente, diffCampos } = await import('@/lib/logCliente')
    const pontos = Array.isArray(annotations) ? annotations.map((a: any) => a?.text).filter(Boolean).join(' · ') : ''
    // A legenda já foi sobrescrita acima — o original está em `antesDoPedido`.
    const mudancas = diffCampos(antesDoPedido, { legenda: post.legenda || '' }, [{ chave: 'legenda', rotulo: 'Legenda' }])
    if (novaData && (post as any).dataAgendada !== dataAnterior) {
      mudancas.push({ campo: 'Data de publicação', antes: fmtData(dataAnterior), depois: fmtData((post as any).dataAgendada) })
    }
    await registrarLogCliente({
      clienteId: (post as any).clienteId || '',
      clienteNome: (post as any).clienteNome || (post as any).cliente || 'Cliente',
      tipo: soLegenda ? 'corrigir_legenda' : type === 'approved' ? 'aprovacao' : type === 'corrected' ? 'ajuste_layout' : 'reprovacao',
      acao: soLegenda ? 'Corrigiu a legenda' : type === 'approved' ? 'Aprovou' : type === 'corrected' ? 'Pediu ajuste no layout' : 'Reprovou',
      postId: id,
      resumo: (post.legenda || '').slice(0, 140),
      motivo: [rejectReason, pontos].filter(Boolean).join(' — ') || undefined,
      origem: autorizadoPorSessao ? 'portal' : autorizadoPorToken ? 'link' : 'codigo',
      mudancas: mudancas.length ? mudancas : undefined,
    })
  } catch { /* nunca bloqueia a decisão */ }

  {
    const { dispararEvento } = await import('@/lib/automacoesEngine')
    const ctxPost = { postId: id, clienteId: (post as any).clienteId || '', clienteNome: (post as any).clienteNome || (post as any).cliente || '', formato: (post as any).formato || '' }
    await dispararEvento(type === 'approved' ? 'post_aprovado' : 'post_reprovado', ctxPost)
  }

  // Notificar a equipe interna sobre a decisão do cliente
  try {
    const clienteNome = (post as any).clienteNome || (post as any).cliente || 'Cliente'
    const notifInfo: Record<string, { tipo: any; titulo: string; mensagem: string }> = {
      approved: { tipo: 'post_aprovado', titulo: soLegenda ? `Legenda ajustada e aprovado — ${clienteNome}` : `Post aprovado — ${clienteNome}`, mensagem: soLegenda ? `${clienteNome} ajustou a legenda e aprovou. A publicação segue a programação.` : `${clienteNome} aprovou um post. A publicação será iniciada automaticamente.` },
      corrected: { tipo: 'post_corrigir', titulo: `Ajuste de layout — ${clienteNome}`, mensagem: `${clienteNome} pediu ajuste no layout.${rejectReason ? ' Motivo: ' + rejectReason : ''} A programação foi cancelada.` },
      rejected: { tipo: 'post_reprovado', titulo: `Post reprovado — ${clienteNome}`, mensagem: `${clienteNome} reprovou um post.${rejectReason ? ' Motivo: ' + rejectReason : ''}` },
    }
    const info = notifInfo[type]
    if (info) await notificarEquipe(info.tipo, info.titulo, info.mensagem, id)
  } catch (e) { console.error('Erro ao notificar equipe:', e) }

  // Linha de montagem: ajuste/reprovação do criativo REABRE a tarefa do
  // designer com o feedback do cliente dentro (lib/tarefasDaPauta). Nunca
  // bloqueia a decisão do cliente.
  if (type === 'corrected' || type === 'rejected') {
    try {
      const { reabrirTarefaDaPauta } = await import('@/lib/tarefasDaPauta')
      const pontos = Array.isArray(annotations) ? annotations.map((a: any) => a?.text).filter(Boolean).join(' · ') : ''
      const feedback = [rejectReason, pontos].filter(Boolean).join(' — ')
      await reabrirTarefaDaPauta(id, feedback, (post as any).clienteNome || (post as any).cliente || 'Cliente')
    } catch { /* segue */ }
  }

  // Ajuste de LAYOUT: cancela a programação (sai dos agendados) e notifica o
  // responsável pela pauta (criador + squad do cliente), além da equipe acima.
  if (type === 'corrected') {
    try {
      await redis.srem('agendados', id)
      const clienteNome = (post as any).clienteNome || (post as any).cliente || 'Cliente'
      const msg = `${clienteNome} pediu ajuste no layout.${rejectReason ? ' Motivo: ' + rejectReason : ''} A programação foi cancelada.`
      await notificarDono((post as any).criadoPor, 'post_corrigir', `Ajuste de layout — ${clienteNome}`, msg, id)
      const cli = (post as any).clienteId ? await redis.get<Cliente>(`cliente:${(post as any).clienteId}`) : null
      for (const email of (cli?.squad || [])) {
        if (email && email !== (post as any).criadoPor) await notificar(email, 'post_corrigir', `Ajuste de layout — ${clienteNome}`, msg, id)
      }
    } catch (e) { console.error('Erro ao cancelar/notificar ajuste de layout:', e) }
  }

  // Email
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.titan.email',
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

    const labels: Record<string, string> = { approved: 'APROVADO', corrected: 'CORREÇÃO SOLICITADA', rejected: 'REPROVADO' }
    const colors: Record<string, string> = { approved: '#22c55e', corrected: '#ffc00f', rejected: '#ef4444' }

    const annotationsHtml = annotations?.length > 0
      ? `<h3>Anotações:</h3><ol>${annotations.map((a: any, i: number) => `<li><strong>Ponto ${i + 1}:</strong> ${a.text}</li>`).join('')}</ol>`
      : ''

    await transporter.sendMail({
      from: `"Soma10 Approval" <${process.env.SMTP_USER}>`,
      to: NOTIFY_EMAIL,
      subject: `${labels[type]} — ${(post as any).clienteNome || (post as any).cliente}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:${colors[type]};padding:24px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="color:${type === 'corrected' ? '#111' : '#fff'};margin:0">${labels[type]}</h1>
          </div>
          <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #eee">
            <p><strong>Cliente:</strong> ${(post as any).clienteNome || (post as any).cliente}</p>
            <p><strong>Decisão em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            ${annotationsHtml}
            ${rejectReason ? `<h3>Motivo:</h3><p>${rejectReason}</p>` : ''}
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">Soma10 Approval · Grupo 10+</p>
          </div>
        </div>
      `,
    })
  } catch (e) { console.error('Erro email:', e) }

  // Aprovado: entra na FILA de agendados. O cron/publicar publica na hora certa (se há data
  // futura) ou no próximo ciclo (~1 min) quando é "publicar agora". Assim a resposta ao
  // cliente é IMEDIATA — não espera a publicação (que pode demorar, ex.: vídeo/Reel).
  if (type === 'approved') {
    const clienteNome = (post as any).clienteNome || (post as any).cliente || 'Cliente'
    const dataAg = (post as any).dataAgendada
    const futuro = !!(dataAg && new Date(dataAg).getTime() > Date.now())
    const quando = futuro ? dataAg : new Date(Date.now() - 1000).toISOString() // "agora": já vencido -> publica no próximo ciclo

    // etapa -> 'pronto' para o criativo aprovado APARECER no Planner (que só mostra
    // posts sem etapa ou 'pronto'). Sem isso ele fica preso com 'aprovacao_criativo'.
    await redis.set(`post:${id}`, { ...atualizado, status: 'agendado', dataAgendada: quando, ...((post as any).etapa ? { etapa: 'pronto' } : {}), atualizadoEm: new Date().toISOString() })
    await redis.sadd('agendados', id)

    // Automação: post aprovado -> cria tarefa de publicação para a equipe
    try {
      const { getAutomacoes } = await import('@/lib/automacoes')
      if ((await getAutomacoes()).postAprovadoCriaTarefa) {
        const { v4: uuid } = await import('uuid')
        const agora = new Date().toISOString()
        const tarefa: any = {
          id: uuid(), titulo: `Publicar: ${(post as any).legenda?.slice(0, 40) || 'post aprovado'}`,
          descricao: 'Tarefa criada automaticamente quando o cliente aprovou o post.',
          tipo: 'post', status: 'a_fazer', prioridade: 'alta',
          clienteId: post.clienteId || '', clienteNome,
          ...(((post as any).marcoId) ? { marcoId: (post as any).marcoId } : {}),
          criadoPor: 'Automação', criadoEm: agora, atualizadoEm: agora,
          atividades: [{ id: uuid(), tipo: 'criacao', descricao: 'Criada por automação (post aprovado)', autor: 'Automação', criadoEm: agora }],
          comentarios: [],
        }
        await redis.set(`tarefa:${tarefa.id}`, tarefa)
        await redis.sadd('tarefas', tarefa.id)
      }
    } catch { /* não bloqueia */ }
  }

  return NextResponse.json({ ok: true })
}

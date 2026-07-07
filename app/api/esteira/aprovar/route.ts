import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Post, Cliente, podeCliente } from '@/lib/redis'
import { notificarDono, notificar } from '@/lib/notificacoes'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { bloqueiaAcao } from '@/lib/permissoesGranularServer'

export const runtime = 'nodejs'

// POST /api/esteira/aprovar
// Ações do cliente: aprovar ou pedir ajuste na copy ou no criativo.
// Automação total: ao aprovar, avança a etapa automaticamente.
// Ao aprovar criativo, agenda o post automaticamente.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  // Equipe (gerente/usuario) precisa de 'editar' em produção; cliente segue as regras próprias abaixo.
  if (await bloqueiaPapel((session.user as any).role, 'producao', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  }
  // Ação granular "aprovar": só afeta gerente/usuario; cliente/admin passam direto.
  if (await bloqueiaAcao((session.user as any).role, 'aprovar', (session.user as any).permissoesGranular)) {
    return NextResponse.json({ error: 'sem permissão para aprovar' }, { status: 403 })
  }

  const { postId, acao, comentario, novaLegenda } = await req.json()
  // acao: 'aprovar_copy' | 'ajuste_copy' | 'aprovar_criativo' | 'ajuste_criativo' | 'corrigir_legenda'
  if (!postId || !acao) return NextResponse.json({ error: 'postId e acao são obrigatórios' }, { status: 400 })

  const post = await redis.get<Post>(`post:${postId}`)
  if (!post) return NextResponse.json({ error: 'post não encontrado' }, { status: 404 })

  // Verificar permissão: admin/gerente podem aprovar; cliente só do seu próprio
  const role = (session.user as any).role
  const clienteId = (session.user as any).clienteId
  if (role === 'cliente' && post.clienteId !== clienteId) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 403 })
  }
  // Permissao do portal: cliente sem "aprovar" pode visualizar, mas nao decidir
  if (role === 'cliente') {
    const cli = await redis.get<Cliente>(`cliente:${clienteId}`)
    if (cli?.inadimplente) {
      return NextResponse.json({ error: 'acesso suspenso por pendência de pagamento' }, { status: 403 })
    }
    if (!podeCliente(cli?.permissoes, 'aprovar')) {
      return NextResponse.json({ error: 'sem permissao para aprovar conteudo' }, { status: 403 })
    }
  }

  const agora = new Date().toISOString()
  const nome = post.clienteNome || 'Cliente'
  const quem = session.user?.name || 'Usuário'

  // LOG das solicitações do cliente (30 dias) — só ações iniciadas pelo próprio cliente,
  // e não a aprovação de criativo sem data (que falha logo abaixo).
  if (role === 'cliente' && !(acao === 'aprovar_criativo' && !post.dataAgendada)) {
    try {
      const { registrarLogCliente } = await import('@/lib/logCliente')
      const mapa: Record<string, { tipo: any; label: string }> = {
        aprovar_copy: { tipo: 'aprovacao', label: 'Aprovou a copy' },
        aprovar_criativo: { tipo: 'aprovacao', label: 'Aprovou o criativo' },
        ajuste_copy: { tipo: 'ajuste_copy', label: 'Pediu ajuste na copy' },
        ajuste_criativo: { tipo: 'ajuste_layout', label: 'Pediu ajuste no layout' },
        corrigir_legenda: { tipo: 'corrigir_legenda', label: 'Corrigiu a legenda' },
      }
      const m = mapa[acao] || { tipo: 'aprovacao', label: String(acao) }
      await registrarLogCliente({ clienteId: post.clienteId || '', clienteNome: nome, tipo: m.tipo, acao: m.label, postId, resumo: (post.legenda || post.briefing || '').slice(0, 140), motivo: comentario || undefined, origem: 'portal' })
    } catch { /* nunca bloqueia */ }
  }

  if (acao === 'aprovar_copy') {
    post.etapa = 'criativo'
    post.copyAprovadaEm = agora
    post.ajusteCopy = undefined
    post.etapaDesde = agora; post.aguardandoDesde = undefined
    await redis.set(`post:${postId}`, post)
    await notificarDono(post.criadoPor, 'geral', `Copy aprovada — ${nome}`, `${quem} aprovou a copy da pauta "${post.briefing || post.legenda || 'sem título'}". Etapa avançou para Criativo.`, postId)
    return NextResponse.json({ ok: true, etapa: post.etapa })
  }

  if (acao === 'ajuste_copy') {
    post.etapa = 'copy'
    post.ajusteCopy = comentario || 'Ajuste solicitado'
    post.etapaDesde = agora; post.aguardandoDesde = undefined
    await redis.set(`post:${postId}`, post)
    await notificarDono(post.criadoPor, 'geral', `Ajuste de copy — ${nome}`, `${quem} pediu ajuste na copy: "${comentario || 'sem comentário'}".`, postId)
    return NextResponse.json({ ok: true, etapa: post.etapa })
  }

  if (acao === 'aprovar_criativo') {
    // Obrigatorio ter data/horario para aprovar o criativo
    if (!post.dataAgendada) {
      return NextResponse.json({ error: 'Defina a data e horario da postagem antes de aprovar o criativo.', semData: true }, { status: 400 })
    }
    post.etapa = 'pronto'
    post.criativoAprovadoEm = agora
    post.ajusteCriativo = undefined
    post.status = 'agendado'
    post.rascunhoInterno = false
    await redis.sadd('agendados', postId)
    post.etapaDesde = agora; post.aguardandoDesde = undefined
    await redis.set(`post:${postId}`, post)
    const msg = `${quem} aprovou o criativo e o post foi agendado para ${new Date(post.dataAgendada).toLocaleString('pt-BR')}.`
    await notificarDono(post.criadoPor, 'geral', `Criativo aprovado — ${nome}`, msg, postId)
    return NextResponse.json({ ok: true, etapa: post.etapa, status: post.status })
  }

  // Cliente corrigiu APENAS a legenda: substitui o texto e SEGUE a programação
  // (aprova o estágio atual — na copy avança, no criativo agenda pela data).
  if (acao === 'corrigir_legenda') {
    if (typeof novaLegenda === 'string') post.legenda = novaLegenda
    if (post.etapa === 'aprovacao_copy') {
      post.etapa = 'criativo'; post.copyAprovadaEm = agora; post.ajusteCopy = undefined
      post.etapaDesde = agora; post.aguardandoDesde = undefined
      await redis.set(`post:${postId}`, post)
      await notificarDono(post.criadoPor, 'geral', `Legenda ajustada e copy aprovada — ${nome}`, `${quem} ajustou a legenda e aprovou a copy. Etapa avançou para Criativo.`, postId)
      return NextResponse.json({ ok: true, etapa: post.etapa })
    }
    // Criativo: precisa de data para agendar (segue a programação).
    if (!post.dataAgendada) {
      return NextResponse.json({ error: 'Defina a data e horário da postagem antes de aprovar.', semData: true }, { status: 400 })
    }
    post.etapa = 'pronto'; post.criativoAprovadoEm = agora; post.ajusteCriativo = undefined
    post.status = 'agendado'; post.rascunhoInterno = false
    await redis.sadd('agendados', postId)
    post.etapaDesde = agora; post.aguardandoDesde = undefined
    await redis.set(`post:${postId}`, post)
    await notificarDono(post.criadoPor, 'geral', `Legenda ajustada e aprovado — ${nome}`, `${quem} ajustou a legenda e aprovou. Agendado para ${new Date(post.dataAgendada).toLocaleString('pt-BR')}.`, postId)
    return NextResponse.json({ ok: true, etapa: post.etapa, status: post.status })
  }

  if (acao === 'ajuste_criativo') {
    post.etapa = 'criativo'
    post.ajusteCriativo = comentario || 'Ajuste solicitado'
    // Ajuste de LAYOUT cancela a programação: sai dos agendados e volta pra correção.
    await redis.srem('agendados', postId)
    post.status = 'corrigir'
    post.etapaDesde = agora; post.aguardandoDesde = undefined
    await redis.set(`post:${postId}`, post)
    // Notifica o responsável pela pauta: criador + squad do cliente.
    const msg = `${quem} pediu ajuste no layout: "${comentario || 'sem comentário'}". A programação foi cancelada.`
    await notificarDono(post.criadoPor, 'geral', `Ajuste de layout — ${nome}`, msg, postId)
    const cli = post.clienteId ? await redis.get<Cliente>(`cliente:${post.clienteId}`) : null
    for (const email of (cli?.squad || [])) {
      if (email && email !== post.criadoPor) await notificar(email, 'geral', `Ajuste de layout — ${nome}`, msg, postId)
    }
    return NextResponse.json({ ok: true, etapa: post.etapa, status: post.status })
  }

  return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
}

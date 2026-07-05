import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Post, Cliente, podeCliente } from '@/lib/redis'
import { notificarDono } from '@/lib/notificacoes'
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

  const { postId, acao, comentario } = await req.json()
  // acao: 'aprovar_copy' | 'ajuste_copy' | 'aprovar_criativo' | 'ajuste_criativo'
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
    if (!podeCliente(cli?.permissoes, 'aprovar')) {
      return NextResponse.json({ error: 'sem permissao para aprovar conteudo' }, { status: 403 })
    }
  }

  const agora = new Date().toISOString()
  const nome = post.clienteNome || 'Cliente'
  const quem = session.user?.name || 'Usuário'

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

  if (acao === 'ajuste_criativo') {
    post.etapa = 'criativo'
    post.ajusteCriativo = comentario || 'Ajuste solicitado'
    post.etapaDesde = agora; post.aguardandoDesde = undefined
    await redis.set(`post:${postId}`, post)
    await notificarDono(post.criadoPor, 'geral', `Ajuste de criativo — ${nome}`, `${quem} pediu ajuste no criativo: "${comentario || 'sem comentário'}".`, postId)
    return NextResponse.json({ ok: true, etapa: post.etapa })
  }

  return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
}

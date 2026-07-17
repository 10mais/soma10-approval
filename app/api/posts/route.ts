import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Post } from '@/lib/redis'
import { getPostsDoCliente, indexarPost, desindexarPost } from '@/lib/postsIndex'
import { v4 as uuid } from 'uuid'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { bloqueiaAcao } from '@/lib/permissoesGranularServer'
import { clienteSuspenso } from '@/lib/suspensao'

function gerarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Janela temporal da visão da equipe (todos os clientes): mantém posts recentes,
// agendados/futuros ou atualizados nos últimos N dias. Posts antigos só com ?tudo=1.
const JANELA_DIAS = 120
function dentroDaJanela(p: Post, cutoff: number): boolean {
  const datas = [p.dataAgendada, p.atualizadoEm, p.criadoEm].filter(Boolean).map(d => new Date(d as string).getTime()).filter(t => !isNaN(t))
  return datas.length === 0 ? true : Math.max(...datas) >= cutoff
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const role = (session.user as any).role
  let clienteId = req.nextUrl.searchParams.get('clienteId')

  // Cliente suspenso por inadimplência não acessa o próprio conteúdo.
  if (role === 'cliente' && await clienteSuspenso((session.user as any).clienteId)) {
    return NextResponse.json({ error: 'acesso suspenso' }, { status: 403 })
  }

  // Busca de UM post por id (usado pelo acompanhamento de status da publicacao)
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const p = await redis.get<Post>(`post:${id}`)
    if (!p) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
    if (role === 'cliente' && p.clienteId !== (session.user as any).clienteId) {
      return NextResponse.json({ error: 'não autorizado' }, { status: 403 })
    }
    return NextResponse.json(p)
  }

  // Cliente só pode ver os próprios posts, independente do parâmetro
  if (role === 'cliente') {
    clienteId = (session.user as any).clienteId
  }

  let filtrados: (Post | null)[]
  if (clienteId) {
    // Leitura por cliente: usa o índice por cliente (lazy). Cliente vê todo o histórico dele.
    filtrados = await getPostsDoCliente(clienteId)
  } else {
    // Visão da equipe (todos os clientes): janela de 120 dias por padrão; ?tudo=1 traz tudo.
    const ids = await redis.smembers('posts')
    const posts = ids.length > 0 ? await redis.mget<(Post | null)[]>(...ids.map(id => `post:${id}`)) : []
    filtrados = posts.filter(Boolean)
    if (req.nextUrl.searchParams.get('tudo') !== '1') {
      const cutoff = Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000
      filtrados = (filtrados as Post[]).filter(p => dentroDaJanela(p, cutoff))
    }
  }

  // Rascunhos internos não devem ser visíveis para o cliente
  if (role === 'cliente') {
    filtrados = filtrados.filter(p => !p!.rascunhoInterno)
  }

  // Posts na esteira: exclui briefing/copy/criativo do Planner, mas MANTEM aprovacao_copy
  // e aprovacao_criativo (necessarios para a tela de aprovacoes do cliente)
  filtrados = filtrados.filter(p => !p!.etapa || p!.etapa === 'pronto' || p!.etapa === 'aprovacao_copy' || p!.etapa === 'aprovacao_criativo')

  return NextResponse.json(filtrados)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'producao', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  }

  const { clienteId, clienteNome, marcoId, imagens, legenda, dataAgendada, formato, rascunhoInterno, colaboradores, capasVideo, redes, statusInicial, planoId, etapa, briefing, headline, sugestaoImagem, textoImagem, sugestaoLegenda } = await req.json()
  const redesLimpas: ('instagram' | 'facebook')[] = Array.isArray(redes)
    ? redes.filter((r: string): r is 'instagram' | 'facebook' => r === 'instagram' || r === 'facebook')
    : ['instagram', 'facebook']
  const colaboradoresLimpos = Array.isArray(colaboradores)
    ? colaboradores.map((c: string) => String(c).trim().replace(/^@/, '')).filter(Boolean).slice(0, 4)
    : []
  const post: Post = {
    id: uuid(),
    clienteId,
    clienteNome,
    ...(marcoId ? { marcoId } : {}),
    imagens,
    legenda,
    status: statusInicial === 'agendado' ? 'agendado' : statusInicial === 'aguardando_aprovacao' ? 'aguardando_aprovacao' : 'rascunho',
    formato: formato || 'feed',
    dataAgendada,
    codigo: gerarCodigo(),
    criadoPor: session.user?.name || '',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...(rascunhoInterno ? { rascunhoInterno: true } : {}),
    ...(colaboradoresLimpos.length ? { colaboradores: colaboradoresLimpos } : {}),
    ...(capasVideo && typeof capasVideo === 'object' && Object.keys(capasVideo).length ? { capasVideo } : {}),
    redes: redesLimpas.length ? redesLimpas : ['instagram', 'facebook'],
    ...(planoId ? { planoId } : {}),
    ...(etapa ? { etapa } : {}),
    ...(briefing ? { briefing } : {}),
    ...(headline ? { headline } : {}),
    ...(sugestaoImagem ? { sugestaoImagem } : {}),
    ...(textoImagem ? { textoImagem } : {}),
    ...(sugestaoLegenda ? { sugestaoLegenda } : {}),
  }

  await redis.set(`post:${post.id}`, post)
  await redis.sadd('posts', post.id)
  // Índice por cliente (otimização de leitura do portal/cliente)
  await indexarPost(post.clienteId, post.id)
  // Índice de agendados — o cron lê só este conjunto, não todos os posts
  if (post.status === 'agendado') await redis.sadd('agendados', post.id)
  // Índice de pautas por plano (esteira)
  if (planoId) await redis.sadd(`plano:${planoId}:pautas`, post.id)

  const link = `${process.env.APPROVAL_BASE_URL}/aprovar/${post.id}`
  return NextResponse.json({ ok: true, post, link })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'producao', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  }

  const { id, ...updates } = await req.json()
  const post = await redis.get<Post>(`post:${id}`)
  if (!post) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const atualizado = { ...post, ...updates, atualizadoEm: new Date().toISOString() }
  // SLA de aprovação: marca quando entra numa etapa de aprovação; limpa ao sair
  const ETAPAS_APROVACAO = ['aprovacao_copy', 'aprovacao_criativo']
  if ('etapa' in updates && updates.etapa !== post.etapa) {
    atualizado.etapaDesde = new Date().toISOString()
    if (ETAPAS_APROVACAO.includes(updates.etapa)) atualizado.aguardandoDesde = new Date().toISOString()
    else atualizado.aguardandoDesde = undefined
  }
  // Studio Fase 0 — taxa de edição: humano alterou a matéria-prima da IA?
  if (post.iaGerado && !atualizado.editadoAposIA) {
    const g = post.iaGerado
    const norm = (v: any) => (v || '').toString().trim()
    if (
      norm(atualizado.briefing) !== norm(g.briefing) ||
      norm(atualizado.headline) !== norm(g.headline) ||
      norm(atualizado.legenda) !== norm(g.legenda) ||
      norm(atualizado.sugestaoImagem) !== norm(g.sugestaoImagem) ||
      norm(atualizado.textoImagem) !== norm(g.textoImagem) ||
      norm(atualizado.formato) !== norm(g.formato)
    ) {
      atualizado.editadoAposIA = true
    }
  }
  await redis.set(`post:${id}`, atualizado)
  // Mantém o índice de agendados em dia
  if (atualizado.status === 'agendado') await redis.sadd('agendados', id)
  else await redis.srem('agendados', id)
  // Se o cliente do post mudou (raro), move no índice por cliente
  if ('clienteId' in updates && updates.clienteId !== post.clienteId) {
    await desindexarPost(post.clienteId, id)
    await indexarPost(updates.clienteId, id)
  }
  return NextResponse.json({ ok: true, post: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const role = (session.user as any).role
  if (await bloqueiaPapel(role, 'producao', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  }
  if (await bloqueiaAcao(role, 'excluir', (session.user as any).permissoesGranular)) {
    return NextResponse.json({ error: 'sem permissão para excluir' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const post = await redis.get<Post>(`post:${id}`)
  if (!post) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  // Cliente só pode excluir o próprio rascunho; equipe exclui qualquer post
  if (role === 'cliente') {
    if (post.clienteId !== (session.user as any).clienteId || post.status !== 'rascunho') {
      return NextResponse.json({ error: 'não autorizado' }, { status: 403 })
    }
  }

  await redis.del(`post:${id}`)
  await redis.srem('posts', id)
  await redis.srem('agendados', id)
  await desindexarPost(post.clienteId, id)
  if (post.planoId) await redis.srem(`plano:${post.planoId}:pautas`, id)

  return NextResponse.json({ ok: true })
}

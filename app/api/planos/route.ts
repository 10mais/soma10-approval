import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Plano, Post, Tarefa } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { desindexarPost } from '@/lib/postsIndex'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { bloqueiaAcao } from '@/lib/permissoesGranularServer'
import { clientesAtivosIds } from '@/lib/cache'
import { tarefaMaeDoPlano } from '@/lib/tarefasDaPauta'
import { podeSerFilha } from '@/lib/hierarquiaTarefas'

export const runtime = 'nodejs'

// GET /api/planos                 -> lista planos (admin/gerente: todos; cliente: os seus)
// GET /api/planos?id=...&pautas=1 -> um plano + suas pautas
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const role = (session.user as any).role
  const sessionClienteId = (session.user as any).clienteId

  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const plano = await redis.get<Plano>(`plano:${id}`)
    if (!plano) return NextResponse.json({ error: 'plano não encontrado' }, { status: 404 })
    if (role === 'cliente' && plano.clienteId !== sessionClienteId) {
      return NextResponse.json({ error: 'não autorizado' }, { status: 403 })
    }
    const pautaIds = await redis.smembers(`plano:${id}:pautas`)
    const pautas = pautaIds.length > 0 ? ((await redis.mget<(Post | null)[]>(...pautaIds.map(pid => `post:${pid}`))).filter(Boolean) as Post[]) : []
    return NextResponse.json({ plano, pautas })
  }

  const ids = await redis.smembers('planos')
  let planos = ids.length > 0 ? ((await redis.mget<(Plano | null)[]>(...ids.map(pid => `plano:${pid}`))).filter(Boolean) as Plano[]) : []
  if (role === 'cliente') planos = planos.filter(p => p.clienteId === sessionClienteId)
  else {
    // Esconde planos de cliente ARQUIVADO ou já EXCLUÍDO (órfão).
    const ativos = await clientesAtivosIds()
    planos = planos.filter(p => !p.clienteId || ativos.has(p.clienteId))
  }
  const filtroCliente = req.nextUrl.searchParams.get('clienteId')
  if (filtroCliente) planos = planos.filter(p => p.clienteId === filtroCliente)
  planos.sort((a, b) => (b.ano - a.ano) || (b.mes - a.mes) || a.clienteNome.localeCompare(b.clienteNome, 'pt'))
  return NextResponse.json(planos)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  const { clienteId, clienteNome, mes, ano, titulo } = await req.json()
  if (!clienteId || !mes || !ano) return NextResponse.json({ error: 'clienteId, mes e ano são obrigatórios' }, { status: 400 })

  const plano: Plano = {
    id: uuid(),
    clienteId,
    clienteNome: clienteNome || '',
    mes: Number(mes),
    ano: Number(ano),
    titulo: titulo || '',
    criadoPor: session.user?.name || '',
    criadoEm: new Date().toISOString(),
  }
  await redis.set(`plano:${plano.id}`, plano)
  await redis.sadd('planos', plano.id)
  // A tarefa do plano nasce junto (Social Media / Copywriter; dono, 20/10/2026). Falha aqui não
  // impede o plano: ela nasce na primeira copy aprovada (lib/tarefasDaPauta).
  await tarefaMaeDoPlano(plano.id, session.user?.name || '').catch(() => null)
  return NextResponse.json({ ok: true, plano })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  const { id, ...updates } = await req.json()
  const plano = await redis.get<Plano>(`plano:${id}`)
  if (!plano) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  // Plano criado antes de 20/10/2026 não tem a tarefa do mês: o Estúdio cria pelo botão.
  if (updates.criarTarefa) {
    const tarefaId = await tarefaMaeDoPlano(id, session.user?.name || '').catch(() => null)
    if (!tarefaId) return NextResponse.json({ error: 'Não foi possível criar a tarefa do plano.' }, { status: 500 })
    return NextResponse.json({ ok: true, tarefaId })
  }
  // Fase 4 (dono, 20/10/2026): as tarefas de pauta que nasceram SOLTAS (antes de a pauta virar
  // subtarefa) entram na tarefa do plano. O Estúdio mostra quantas e só chama depois da confirmação
  // de quem clicou. Mesma lei das subtarefas (lib/hierarquiaTarefas); responsável, prazo e anexos
  // não mudam. Uma leitura de todas as tarefas para o plano inteiro.
  if (updates.trazerTarefas) {
    if (await bloqueiaPapel((session.user as any).role, 'producao', 'editar', (session.user as any).permissoes)) {
      return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
    }
    const autor = session.user?.name || ''
    const maeId = await tarefaMaeDoPlano(id, autor).catch(() => null)
    if (!maeId) return NextResponse.json({ error: 'Não foi possível criar a tarefa do plano.' }, { status: 500 })
    const pautaIds = await redis.smembers(`plano:${id}:pautas`)
    const pautas = pautaIds.length ? ((await redis.mget<(Post | null)[]>(...pautaIds.map(x => `post:${x}`))).filter(Boolean) as Post[]) : []
    const idsTodas = await redis.smembers('tarefas')
    const todas = idsTodas.length ? ((await redis.mget<(Tarefa | null)[]>(...idsTodas.map(x => `tarefa:${x}`))).filter(Boolean) as Tarefa[]) : []
    const mae = todas.find(t => t.id === maeId)
    const daPauta = new Set(pautas.map(p => p.id))
    const candidatas = todas.filter(t => !(t as any).excluidoEm && !t.tarefaPaiId && t.id !== maeId
      && ((t.origemPostId && daPauta.has(t.origemPostId)) || pautas.some(p => p.tarefaId === t.id)))
    const agora = new Date().toISOString()
    let movidas = 0
    for (const t of candidatas) {
      if (t.clienteId && plano.clienteId && t.clienteId !== plano.clienteId) continue
      if (!podeSerFilha(t.id, maeId, todas as any).ok) continue
      await redis.set(`tarefa:${t.id}`, {
        ...t, tarefaPaiId: maeId, atualizadoEm: agora,
        atividades: [...(t.atividades || []), { id: uuid(), tipo: 'cliente' as const, descricao: `Virou subtarefa de "${mae?.titulo || 'tarefa do plano'}" (Estúdio)`, autor, criadoEm: agora }],
      })
      movidas++
    }
    return NextResponse.json({ ok: true, tarefaId: maeId, movidas, total: candidatas.length })
  }
  const camposPermitidos = ['titulo', 'mes', 'ano']
  const atualizado: any = { ...plano }
  for (const c of camposPermitidos) if (c in updates) atualizado[c] = updates[c]
  await redis.set(`plano:${id}`, atualizado)
  return NextResponse.json({ ok: true, plano: atualizado })
}

// DELETE /api/planos?id=... — exclui o plano E as pautas dele. Pautas já
// PUBLICADAS/AGENDADAS são preservadas (viram posts avulsos, desvinculados):
// histórico e programação não morrem junto com o plano. O comportamento antigo
// (despejar TODAS as pautas soltas no Planner) enchia o Planner de rascunho.
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  if (await bloqueiaPapel((session.user as any).role, 'producao', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  }
  if (await bloqueiaAcao((session.user as any).role, 'excluir', (session.user as any).permissoesGranular)) {
    return NextResponse.json({ error: 'sem permissão para excluir' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const plano = await redis.get<Plano>(`plano:${id}`)
  if (!plano) return NextResponse.json({ error: 'plano não encontrado' }, { status: 404 })

  // A tarefa do plano fica para consulta (as subtarefas do designer seguem existindo), com o registro.
  if (plano.tarefaId) {
    try {
      const mae = await redis.get<Tarefa>(`tarefa:${plano.tarefaId}`)
      if (mae) await redis.set(`tarefa:${mae.id}`, { ...mae, atualizadoEm: new Date().toISOString(), atividades: [...(mae.atividades || []), { id: uuid(), tipo: 'status' as const, descricao: 'Plano do mês excluído no Estúdio', autor: session.user?.name || '', criadoEm: new Date().toISOString() }] })
    } catch { /* registro é bônus */ }
  }
  const PRESERVAR = ['publicado', 'publicando', 'falha_publicacao', 'agendado']
  const agora = new Date().toISOString()
  const autor = session.user?.name || ''
  const pautaIds = await redis.smembers(`plano:${id}:pautas`)
  let excluidas = 0, preservadas = 0
  for (const pid of pautaIds) {
    const p = await redis.get<Post>(`post:${pid}`)
    if (!p) continue
    if (PRESERVAR.includes(p.status)) {
      await redis.set(`post:${pid}`, { ...p, planoId: undefined, etapa: undefined, atualizadoEm: agora })
      preservadas++
      continue
    }
    // Mesma limpeza do DELETE de posts: índices + vínculo com a tarefa.
    await redis.del(`post:${pid}`)
    await redis.srem('posts', pid)
    await redis.srem('agendados', pid)
    try { await desindexarPost(p.clienteId, pid) } catch { /* segue */ }
    if (p.tarefaId) {
      try {
        const t = await redis.get<Tarefa>(`tarefa:${p.tarefaId}`)
        if (t && t.origemPostId === pid) {
          await redis.set(`tarefa:${p.tarefaId}`, {
            ...t, origemPostId: undefined, atualizadoEm: agora,
            atividades: [...(t.atividades || []), { id: uuid(), tipo: 'status' as const, descricao: 'Pauta excluída junto com o plano — vínculo desfeito', autor, criadoEm: agora }],
          })
        }
      } catch { /* segue */ }
    }
    excluidas++
  }
  await redis.del(`plano:${id}:pautas`)
  await redis.del(`plano:${id}`)
  await redis.srem('planos', id)
  return NextResponse.json({ ok: true, excluidas, preservadas })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Plano, Post, Tarefa } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { desindexarPost } from '@/lib/postsIndex'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { bloqueiaAcao } from '@/lib/permissoesGranularServer'

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

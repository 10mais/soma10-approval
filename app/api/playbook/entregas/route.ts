import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Tarefa, Post, BriefingCampanha } from '@/lib/redis'

export const runtime = 'nodejs'

// Retorna as entregas vinculadas a etapas do Playbook (marcos) de um cliente:
// tarefas, posts e campanhas que possuem marcoId. O frontend agrupa por marcoId.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })

  const role = (session.user as any).role
  let clienteId = req.nextUrl.searchParams.get('clienteId') || ''
  if (role === 'cliente') clienteId = (session.user as any).clienteId // cliente so ve o proprio

  async function carregar<T>(setKey: string, prefix: string): Promise<T[]> {
    const ids = await redis.smembers(setKey)
    if (ids.length === 0) return []
    return (await redis.mget<(T | null)[]>(...ids.map(id => `${prefix}:${id}`))).filter(Boolean) as T[]
  }

  const [tarefasAll, postsAll, briefingsAll] = await Promise.all([
    carregar<Tarefa>('tarefas', 'tarefa'),
    carregar<Post>('posts', 'post'),
    carregar<BriefingCampanha>('briefings', 'briefing'),
  ])

  const filtro = (cId?: string) => !clienteId || cId === clienteId

  const tarefas = tarefasAll
    .filter(t => (t as any).marcoId && filtro(t.clienteId))
    .map(t => ({ id: t.id, marcoId: (t as any).marcoId, titulo: t.titulo, status: t.status, tipo: t.tipo, responsavelNome: t.responsavelNome, prazo: t.prazo }))

  const posts = postsAll
    .filter(p => (p as any).marcoId && filtro(p.clienteId))
    .map(p => ({ id: p.id, marcoId: (p as any).marcoId, legenda: (p.legenda || '').slice(0, 80), status: p.status, formato: p.formato, dataAgendada: p.dataAgendada, thumbnail: p.thumbnail || (p.imagens || [])[0] || '' }))

  const briefings = briefingsAll
    .filter(b => (b as any).marcoId && filtro(b.clienteId))
    .map(b => ({ id: b.id, marcoId: (b as any).marcoId, titulo: b.titulo, objetivo: b.objetivo }))

  return NextResponse.json({ tarefas, posts, briefings })
}

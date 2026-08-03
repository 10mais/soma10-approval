import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listarLogsCliente } from '@/lib/logCliente'
import { redis, Post } from '@/lib/redis'

export const runtime = 'nodejs'

// Histórico das solicitações/decisões do cliente (últimos 30 dias). Só equipe.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const clienteId = req.nextUrl.searchParams.get('clienteId') || undefined
  const postId = req.nextUrl.searchParams.get('postId') || undefined
  const logs = await listarLogsCliente({ clienteId, postId, limite: 400 })
  // Enriquece cada log com o STATUS ATUAL do criativo relacionado — a tela usa
  // isso para mostrar "Em revisão" quando o ajuste já foi refeito e reenviado ao
  // cliente (o log em si é histórico e não muda).
  const postIds = Array.from(new Set(logs.map(l => l.postId).filter(Boolean))) as string[]
  const postsArr = postIds.length ? await redis.mget<(Post | null)[]>(...postIds.map(id => `post:${id}`)) : []
  const porPost = new Map<string, { status?: string; etapa?: string }>()
  postIds.forEach((id, i) => { const p = postsArr[i]; if (p) porPost.set(id, { status: (p as any).excluidoEm ? 'excluido' : p.status, etapa: (p as any).etapa }) })
  const enriquecidos = logs.map(l => l.postId
    ? { ...l, postStatus: porPost.get(l.postId)?.status, postEtapa: porPost.get(l.postId)?.etapa, postExiste: porPost.has(l.postId) }
    : l)
  return NextResponse.json(enriquecidos)
}

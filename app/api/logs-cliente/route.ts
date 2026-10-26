import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listarLogsCliente, marcarSituacaoLog } from '@/lib/logCliente'
import { situacaoValida } from '@/lib/situacaoSolicitacao'
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
  const porPost = new Map<string, { status?: string; etapa?: string; versaoNova?: boolean }>()
  postIds.forEach((id, i) => { const p = postsArr[i]; if (p) porPost.set(id, { status: (p as any).excluidoEm ? 'excluido' : p.status, etapa: (p as any).etapa, versaoNova: !!(p as any).versaoNova }) })
  // postVersaoNova: o designer entregou a nova versão e ela espera a revisão da equipe
  // (lib/rodadaAjuste) — é a próxima ação da mesa de ajustes.
  const enriquecidos = logs.map(l => l.postId
    ? { ...l, postStatus: porPost.get(l.postId)?.status, postEtapa: porPost.get(l.postId)?.etapa, postExiste: porPost.has(l.postId), postVersaoNova: porPost.get(l.postId)?.versaoNova }
    : l)
  return NextResponse.json(enriquecidos)
}

// Concluir / descartar uma solicitação (ou reabrir com situacao: null). Só equipe — dono,
// 26/10/2026: "habilitar uma função de marcar como concluído ou descartado". A tela confirma antes.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const corpo = await req.json().catch(() => ({} as any))
  const id = String(corpo?.id || '')
  if (!id || !situacaoValida(corpo?.situacao)) return NextResponse.json({ error: 'Situação inválida.' }, { status: 400 })
  const log = await marcarSituacaoLog(id, corpo.situacao, session.user?.name || session.user?.email || '')
  if (!log) return NextResponse.json({ error: 'Solicitação não encontrada — o histórico guarda 30 dias.' }, { status: 404 })
  return NextResponse.json({ ok: true, log })
}

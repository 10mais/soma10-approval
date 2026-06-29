import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, BriefingCampanha, Tarefa } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// POST /api/briefings/relacionar { briefingId }
// Cria uma tarefa do tipo 'campanha' vinculada ao briefing. Idempotente.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { briefingId } = await req.json()
  if (!briefingId) return NextResponse.json({ error: 'briefingId obrigatório' }, { status: 400 })

  const briefing = await redis.get<BriefingCampanha>(`briefing:${briefingId}`)
  if (!briefing) return NextResponse.json({ error: 'briefing não encontrado' }, { status: 404 })

  // Ja vinculado: devolve a tarefa existente (se ainda existir)
  if (briefing.tarefaId) {
    const existente = await redis.get<Tarefa>(`tarefa:${briefing.tarefaId}`)
    if (existente) return NextResponse.json({ ok: true, jaVinculada: true, tarefa: existente })
  }

  const agora = new Date().toISOString()
  const autor = session.user?.name || ''
  const tarefa: Tarefa = {
    id: uuid(),
    titulo: (briefing.titulo || 'Campanha').toString().slice(0, 80),
    descricao: briefing.objetivo ? `Objetivo: ${briefing.objetivo}` : '',
    tipo: 'campanha',
    status: 'a_fazer',
    prioridade: 'media',
    responsavelEmail: '',
    responsavelNome: '',
    clienteId: briefing.clienteId || '',
    clienteNome: briefing.clienteNome || '',
    marcoId: briefing.marcoId || '',
    prazo: '',
    origemBriefingId: briefing.id,
    criadoPor: autor,
    criadoEm: agora,
    atualizadoEm: agora,
    atividades: [{ id: uuid(), tipo: 'criacao', descricao: 'Tarefa criada a partir do briefing de campanha', autor, criadoEm: agora }],
    comentarios: [],
  }
  await redis.set(`tarefa:${tarefa.id}`, tarefa)
  await redis.sadd('tarefas', tarefa.id)
  await redis.set(`briefing:${briefing.id}`, { ...briefing, tarefaId: tarefa.id })

  return NextResponse.json({ ok: true, tarefa })
}

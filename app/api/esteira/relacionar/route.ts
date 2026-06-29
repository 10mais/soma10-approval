import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Plano, Post, Tarefa } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Etapa da Esteira -> tipo de tarefa. As etapas de aprovacao usam o mesmo tipo da producao.
// 'pronto' nao gera tarefa: a pauta ja virou post no Planner.
function tipoPorEtapa(etapa?: string): Tarefa['tipo'] | null {
  switch (etapa) {
    case 'briefing': return 'briefing'
    case 'copy':
    case 'aprovacao_copy': return 'copy'
    case 'criativo':
    case 'aprovacao_criativo': return 'criativo'
    default: return null // 'pronto' ou sem etapa
  }
}

// POST /api/esteira/relacionar { planoId }
// Cria uma tarefa por pauta do plano (tipo = etapa), vinculada. Idempotente: pula as ja vinculadas.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const { planoId } = await req.json()
  if (!planoId) return NextResponse.json({ error: 'planoId obrigatório' }, { status: 400 })

  const plano = await redis.get<Plano>(`plano:${planoId}`)
  if (!plano) return NextResponse.json({ error: 'plano não encontrado' }, { status: 404 })

  const pautaIds = await redis.smembers(`plano:${planoId}:pautas`)
  const pautas = pautaIds.length > 0 ? ((await redis.mget<(Post | null)[]>(...pautaIds.map(pid => `post:${pid}`))).filter(Boolean) as Post[]) : []

  let criadas = 0, jaVinculadas = 0, puladas = 0
  const agora = new Date().toISOString()
  const autor = session.user?.name || ''

  for (const pauta of pautas) {
    const tipo = tipoPorEtapa(pauta.etapa)
    if (!tipo) { puladas++; continue } // pronto/sem etapa
    if (pauta.tarefaId) { jaVinculadas++; continue } // ja relacionada

    const titulo = (pauta.briefing || pauta.legenda || 'Pauta').toString().replace(/\s+/g, ' ').trim().slice(0, 80)
    const tarefa: Tarefa = {
      id: uuid(),
      titulo,
      descricao: pauta.sugestaoLegenda || pauta.briefing || '',
      tipo,
      status: 'a_fazer',
      prioridade: 'media',
      responsavelEmail: '',
      responsavelNome: '',
      clienteId: pauta.clienteId || '',
      clienteNome: pauta.clienteNome || '',
      marcoId: pauta.marcoId || '',
      prazo: pauta.dataAgendada || '',
      origemPostId: pauta.id,
      criadoPor: autor,
      criadoEm: agora,
      atualizadoEm: agora,
      atividades: [{ id: uuid(), tipo: 'criacao', descricao: `Tarefa criada a partir da pauta na Esteira (${tipo})`, autor, criadoEm: agora }],
      comentarios: [],
    }
    await redis.set(`tarefa:${tarefa.id}`, tarefa)
    await redis.sadd('tarefas', tarefa.id)
    await redis.set(`post:${pauta.id}`, { ...pauta, tarefaId: tarefa.id })
    criadas++
  }

  return NextResponse.json({ ok: true, criadas, jaVinculadas, puladas, total: pautas.length })
}

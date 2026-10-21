import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Tarefa } from '@/lib/redis'
import { clientesAtivosIds } from '@/lib/cache'
import { proximasDaPessoa } from '@/lib/proximasTarefas'

export const runtime = 'nodejs'

// As próximas tarefas de QUEM ESTÁ LOGADO — a barra do topo (app/components/BarraProximasTarefas).
// Leve de propósito: devolve só as 5 primeiras e os totais; a regra é lib/proximasTarefas.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const email = String(session.user?.email || '')

  const ids = await redis.smembers('tarefas')
  let tarefas = ids.length > 0 ? ((await redis.mget<(Tarefa | null)[]>(...ids.map(id => `tarefa:${id}`))).filter(Boolean) as Tarefa[]) : []
  // Mesma regra da lista de tarefas: cliente arquivado/excluído some (tarefa interna fica).
  const ativos = await clientesAtivosIds()
  tarefas = tarefas.filter(t => !t.clienteId || ativos.has(t.clienteId))

  return NextResponse.json(proximasDaPessoa(tarefas as any, email, Date.now(), 5))
}

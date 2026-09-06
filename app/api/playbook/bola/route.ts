import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Tarefa } from '@/lib/redis'
import { getPostsDoCliente } from '@/lib/postsIndex'
import { temModulo } from '@/lib/modulos'
import { calcularBola } from '@/lib/bolaDaVez'

export const runtime = 'nodejs'

// "De quem é a bola" do Playbook (Ball-in-court). SOMENTE LEITURA: não grava
// nada, não move etapa, não toca na esteira nem nos agendados.
//
// A conta roda no SERVIDOR de propósito. O resumo é a única coisa que desce
// para a tela — o cliente jamais recebe a lista de tarefas da equipe, que é
// exatamente o que aconteceria se o cálculo fosse no navegador.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const role = (session.user as any).role

  let clienteId = req.nextUrl.searchParams.get('clienteId') || ''
  // Cliente só enxerga o próprio, e só com o add-on — mesma trava do GET de marcos.
  if (role === 'cliente') {
    clienteId = (session.user as any).clienteId || ''
    const cli = clienteId ? await redis.get<Cliente>(`cliente:${clienteId}`) : null
    if (!temModulo(cli?.modulos, 'playbook')) return NextResponse.json({ error: 'Módulo Playbook não contratado.' }, { status: 403 })
  }
  if (!clienteId) return NextResponse.json({ error: 'clienteId obrigatório' }, { status: 400 })

  const posts = await getPostsDoCliente(clienteId).catch(() => [])

  // Tarefas do cliente. O índice por cliente existe para posts, não para
  // tarefas — aqui a varredura é a mesma que a tela de tarefas já faz.
  const idsT = await redis.smembers('tarefas').catch(() => [] as string[])
  const tarefas = idsT.length
    ? ((await redis.mget<(Tarefa | null)[]>(...idsT.map(id => `tarefa:${id}`))).filter(Boolean) as Tarefa[]).filter(t => t.clienteId === clienteId)
    : []

  const bola = calcularBola(posts as any, tarefas as any)

  // O cliente recebe só o lado dele detalhado; os títulos das tarefas internas
  // ficam de fora quando a bola é da agência.
  const paraCliente = role === 'cliente'
  return NextResponse.json({
    lado: bola.lado,
    totalCliente: bola.totalCliente,
    totalAgencia: bola.totalAgencia,
    diasParado: bola.diasParado,
    itens: paraCliente && bola.lado === 'agencia' ? [] : bola.itens.slice(0, 5),
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Marco, Cliente } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { temModulo } from '@/lib/modulos'
import { diaDoInstante } from '@/lib/datas'
import { notificarDono } from '@/lib/notificacoes'

export const runtime = 'nodejs'

// PLANO DE AÇÃO, F3 (17/11/2026): o cliente marca a entrega DELE ("Já fiz": verba liberada,
// acesso enviado, vendas do mês informadas). Só vale para entrega com responsavelTipo
// 'cliente', só no próprio plano e com o módulo Plano de entregas contratado. A equipe
// também pode marcar por ele (precisa de editar Estratégia). Quem montou o plano é avisado.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const role = (session.user as any).role
  const { marcoId, entregaId, feito } = await req.json().catch(() => ({}))
  if (typeof marcoId !== 'string' || typeof entregaId !== 'string') return NextResponse.json({ error: 'dados incompletos' }, { status: 400 })

  const marco = await redis.get<Marco>(`marco:${marcoId}`)
  if (!marco || marco.tipo !== 'semana') return NextResponse.json({ error: 'semana não encontrada' }, { status: 404 })

  if (role === 'cliente') {
    if ((session.user as any).clienteId !== marco.clienteId) return NextResponse.json({ error: 'nao autorizado' }, { status: 403 })
    const cli = await redis.get<Cliente>(`cliente:${marco.clienteId}`)
    if (!temModulo(cli?.modulos, 'playbook')) return NextResponse.json({ error: 'Módulo Plano de entregas não contratado.' }, { status: 403 })
  } else if (await bloqueiaPapel(role, 'estrategia', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  }

  const entrega = (marco.subetapas || []).find(e => e.id === entregaId)
  if (!entrega) return NextResponse.json({ error: 'entrega não encontrada' }, { status: 404 })
  if (entrega.responsavelTipo !== 'cliente') return NextResponse.json({ error: 'Esta entrega é da equipe: ela conclui pela tarefa.' }, { status: 400 })

  const concluir = feito !== false
  const agora = new Date().toISOString()
  const subetapas = (marco.subetapas || []).map(e => {
    if (e.id !== entregaId) return e
    const n = { ...e, status: (concluir ? 'concluido' : 'pendente') as typeof e.status }
    if (concluir) n.concluidaEm = diaDoInstante(agora); else delete n.concluidaEm
    return n
  })
  await redis.set(`marco:${marcoId}`, { ...marco, subetapas, atualizadoEm: agora })

  if (concluir && role === 'cliente') {
    await notificarDono(marco.criadoPor, 'geral', `${marco.clienteNome || 'Cliente'} concluiu uma entrega`, `${entrega.titulo} (plano de ação)`).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}

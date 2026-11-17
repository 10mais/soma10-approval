import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { sincronizarPlanoAcao } from '@/lib/planoAcaoSync'

export const runtime = 'nodejs'

// Plano de ação (F2): o Plano de entregas chama ao abrir um cliente com semanas.
// A regra mora em lib/planoAcaoSync (o cron de tarefas chama a mesma função).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  if (await bloqueiaPapel(role, 'estrategia', 'editar', (session.user as any).permissoes)) return NextResponse.json({ ok: true, criadas: 0, atualizadas: 0 })
  const { clienteId } = await req.json().catch(() => ({}))
  if (!clienteId || typeof clienteId !== 'string') return NextResponse.json({ error: 'clienteId obrigatório' }, { status: 400 })
  return NextResponse.json(await sincronizarPlanoAcao(clienteId, session.user?.name || 'Plano de ação'))
}

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOperacional } from '@/lib/operacional'
import { combinados } from '@/lib/planoAcao'

export const runtime = 'nodejs'

// Plano de ação (F4): os combinados (SLAs) em frases. Qualquer pessoa logada lê, inclusive o
// cliente: a lista é a mesma dos dois lados. Os números moram em config:operacional
// (Configurações > Operacional) e /api/operacional segue fechado para o cliente.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const op = await getOperacional()
  return NextResponse.json(combinados(op.sla, op.slaAprovacaoHoras))
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listarLogsCliente } from '@/lib/logCliente'

export const runtime = 'nodejs'

// Histórico das solicitações/decisões do cliente (últimos 30 dias). Só equipe.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const clienteId = req.nextUrl.searchParams.get('clienteId') || undefined
  const postId = req.nextUrl.searchParams.get('postId') || undefined
  const logs = await listarLogsCliente({ clienteId, postId, limite: 400 })
  return NextResponse.json(logs)
}

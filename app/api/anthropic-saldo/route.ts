import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSaldo, setSaldo } from '@/lib/anthropicSaldo'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  return NextResponse.json(await getSaldo())
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  const body = await req.json()
  const updates: any = {}
  if (typeof body.saldo === 'number' && body.saldo >= 0) updates.saldo = body.saldo
  if (typeof body.limite === 'number' && body.limite >= 0) updates.limite = body.limite
  const atualizado = await setSaldo(updates)
  return NextResponse.json({ ok: true, ...atualizado })
}

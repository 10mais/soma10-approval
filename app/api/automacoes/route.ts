import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { getAutomacoes, Automacoes } from '@/lib/automacoes'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json(await getAutomacoes())
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const updates = await req.json()
  const atual = await getAutomacoes()
  const novo: Automacoes = { ...atual, ...updates }
  await redis.set('config:automacoes', novo)
  return NextResponse.json({ ok: true, automacoes: novo })
}

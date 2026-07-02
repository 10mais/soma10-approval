import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { getNotifConfig } from '@/lib/notificacoes'

export const runtime = 'nodejs'

// Config GLOBAL de notificações (quais tipos o sistema envia). Admin apenas.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json(await getNotifConfig())
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { desabilitados } = await req.json()
  await redis.set('config:notificacoes', { desabilitados: Array.isArray(desabilitados) ? desabilitados : [] })
  return NextResponse.json({ ok: true })
}

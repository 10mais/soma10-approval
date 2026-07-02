import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { getNotifPrefs } from '@/lib/notificacoes'

export const runtime = 'nodejs'

// Preferências de notificação do PRÓPRIO usuário (silenciar tipos + canal push).
export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json(await getNotifPrefs(email))
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { mutados, pushDesligado } = await req.json()
  await redis.set(`notif:prefs:${email}`, { mutados: Array.isArray(mutados) ? mutados : [], pushDesligado: !!pushDesligado })
  return NextResponse.json({ ok: true })
}

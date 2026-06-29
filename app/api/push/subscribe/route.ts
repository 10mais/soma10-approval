import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { pushConfigurado } from '@/lib/webpush'

export const runtime = 'nodejs'

// GET -> diz se o push esta configurado no servidor (chaves VAPID presentes).
export async function GET() {
  return NextResponse.json({ configurado: pushConfigurado(), publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '' })
}

// POST { subscription } -> registra a inscricao de push do usuario logado.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { subscription } = await req.json()
  if (!subscription?.endpoint) return NextResponse.json({ error: 'subscription inválida' }, { status: 400 })

  await redis.sadd(`push:${email}`, JSON.stringify(subscription))
  return NextResponse.json({ ok: true })
}

// DELETE { subscription } -> remove a inscricao (ex.: usuario desativou notificacoes).
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { subscription } = await req.json().catch(() => ({}))
  if (subscription) await redis.srem(`push:${email}`, JSON.stringify(subscription))
  return NextResponse.json({ ok: true })
}

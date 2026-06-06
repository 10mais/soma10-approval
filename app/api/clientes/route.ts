import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const ids = await redis.smembers('clientes')
  const clientes = await Promise.all(ids.map(id => redis.get<Cliente>(`cliente:${id}`)))
  return NextResponse.json(clientes.filter(Boolean))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { nome, instagram, logo } = await req.json()
  const cliente: Cliente = { id: uuid(), nome, instagram, logo, criadoEm: new Date().toISOString() }

  await redis.set(`cliente:${cliente.id}`, cliente)
  await redis.sadd('clientes', cliente.id)

  return NextResponse.json({ ok: true, cliente })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { id } = await req.json()
  await redis.del(`cliente:${id}`)
  await redis.srem('clientes', id)
  return NextResponse.json({ ok: true })
}

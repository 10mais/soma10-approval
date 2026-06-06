import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Usuario } from '@/lib/redis'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const emails = await redis.smembers('usuarios')
  const usuarios = await Promise.all(emails.map(e => redis.get<Usuario>(`usuario:${e}`)))
  return NextResponse.json(usuarios.filter(Boolean).map(u => ({ ...u, senha: undefined })))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { nome, email, senha, role } = await req.json()
  const jaExiste = await redis.get(`usuario:${email}`)
  if (jaExiste) return NextResponse.json({ error: 'email já cadastrado' }, { status: 400 })

  const hash = await bcrypt.hash(senha, 10)
  const usuario: Usuario = { id: uuid(), nome, email, senha: hash, role, criadoEm: new Date().toISOString() }

  await redis.set(`usuario:${email}`, usuario)
  await redis.sadd('usuarios', email)

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { email } = await req.json()
  await redis.del(`usuario:${email}`)
  await redis.srem('usuarios', email)
  return NextResponse.json({ ok: true })
}

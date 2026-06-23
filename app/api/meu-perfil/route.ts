import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Usuario } from '@/lib/redis'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const email = (session.user as any).email
  const usuario = await redis.get<Usuario>(`usuario:${email}`)
  if (!usuario) return NextResponse.json({ error: 'nao encontrado' }, { status: 404 })
  return NextResponse.json({ nome: usuario.nome, email: usuario.email, cargo: usuario.cargo || '', foto: usuario.foto || '', role: usuario.role })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const email = (session.user as any).email
  const usuario = await redis.get<Usuario>(`usuario:${email}`)
  if (!usuario) return NextResponse.json({ error: 'nao encontrado' }, { status: 404 })

  const { nome, cargo, foto, novaSenha } = await req.json()
  if (nome) usuario.nome = nome
  if (cargo !== undefined) usuario.cargo = cargo
  if (foto !== undefined) usuario.foto = foto
  if (novaSenha && novaSenha.length >= 6) usuario.senha = await bcrypt.hash(novaSenha, 10)

  await redis.set(`usuario:${email}`, usuario)
  return NextResponse.json({ ok: true, nome: usuario.nome, cargo: usuario.cargo, foto: usuario.foto })
}

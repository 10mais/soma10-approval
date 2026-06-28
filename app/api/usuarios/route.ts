import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Usuario } from '@/lib/redis'
import { getUsuariosRaw } from '@/lib/cache'
import { revalidateTag } from 'next/cache'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'

export async function GET() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const usuarios = await getUsuariosRaw()
  return NextResponse.json(usuarios.map(u => ({ ...u, senha: undefined })))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { nome, email, senha, role, cargo, clienteId, custoHora, salarioFixo, valorPorProjeto, qtdProjetos } = await req.json()
  const jaExiste = await redis.get(`usuario:${email}`)
  if (jaExiste) return NextResponse.json({ error: 'email já cadastrado' }, { status: 400 })

  const hash = await bcrypt.hash(senha, 10)
  const usuario: Usuario = { id: uuid(), nome, email, senha: hash, role, cargo: cargo || '', custoHora: Number(custoHora) || 0, salarioFixo: Number(salarioFixo) || 0, valorPorProjeto: Number(valorPorProjeto) || 0, qtdProjetos: Number(qtdProjetos) || 0, salarioVariavel: (Number(valorPorProjeto) || 0) * (Number(qtdProjetos) || 0), ...(role === 'cliente' && clienteId ? { clienteId } : {}), criadoEm: new Date().toISOString() }

  await redis.set(`usuario:${email}`, usuario)
  await redis.sadd('usuarios', email)

  revalidateTag('usuarios')
  return NextResponse.json({ ok: true })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { email, nome, role, novaSenha, cargo, foto, clienteId, custoHora, salarioFixo, valorPorProjeto, qtdProjetos } = await req.json()
  const usuario = await redis.get<Usuario>(`usuario:${email}`)
  if (!usuario) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  if (nome) usuario.nome = nome
  if (role) usuario.role = role
  if (cargo !== undefined) usuario.cargo = cargo
  if (foto !== undefined) usuario.foto = foto
  if (clienteId !== undefined) usuario.clienteId = clienteId
  if (custoHora !== undefined) usuario.custoHora = Number(custoHora) || 0
  if (salarioFixo !== undefined) usuario.salarioFixo = Number(salarioFixo) || 0
  if (valorPorProjeto !== undefined) usuario.valorPorProjeto = Number(valorPorProjeto) || 0
  if (qtdProjetos !== undefined) usuario.qtdProjetos = Number(qtdProjetos) || 0
  // Variável = valor por projeto x quantidade de projetos (cálculo automático)
  if (valorPorProjeto !== undefined || qtdProjetos !== undefined) {
    usuario.salarioVariavel = (Number(usuario.valorPorProjeto) || 0) * (Number(usuario.qtdProjetos) || 0)
  }
  if (novaSenha) usuario.senha = await bcrypt.hash(novaSenha, 10)

  await redis.set(`usuario:${email}`, usuario)
  revalidateTag('usuarios')
  return NextResponse.json({ ok: true, usuario: { ...usuario, senha: undefined } })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { email } = await req.json()
  await redis.del(`usuario:${email}`)
  await redis.srem('usuarios', email)
  revalidateTag('usuarios')
  return NextResponse.json({ ok: true })
}

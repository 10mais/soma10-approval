import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Usuario } from '@/lib/redis'
import { revalidateTag } from 'next/cache'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const email = (session.user as any).email
  const usuario = await redis.get<Usuario>(`usuario:${email}`)
  if (!usuario) return NextResponse.json({ error: 'nao encontrado' }, { status: 404 })
  return NextResponse.json({
    nome: usuario.nome, email: usuario.email, cargo: usuario.cargo || '',
    foto: usuario.foto || '', role: usuario.role, telefone: usuario.telefone || '',
    bio: usuario.bio || '', fusoHorario: usuario.fusoHorario || 'America/Sao_Paulo',
  })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const email = (session.user as any).email
  const usuario = await redis.get<Usuario>(`usuario:${email}`)
  if (!usuario) return NextResponse.json({ error: 'nao encontrado' }, { status: 404 })

  const { nome, cargo, foto, telefone, bio, fusoHorario, senhaAtual, novaSenha, confirmarSenha } = await req.json()

  if (nome !== undefined) usuario.nome = nome
  if (cargo !== undefined) usuario.cargo = cargo
  if (foto !== undefined) usuario.foto = foto
  if (telefone !== undefined) usuario.telefone = telefone
  if (bio !== undefined) usuario.bio = bio
  if (fusoHorario !== undefined) usuario.fusoHorario = fusoHorario

  // Alteracao de senha com validacao
  if (novaSenha) {
    if (!senhaAtual) return NextResponse.json({ error: 'Informe a senha atual para alterar a senha.' }, { status: 400 })
    const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senha)
    if (!senhaCorreta) return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 })
    if (novaSenha.length < 6) return NextResponse.json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    if (novaSenha !== confirmarSenha) return NextResponse.json({ error: 'A confirmacao de senha nao confere.' }, { status: 400 })
    usuario.senha = await bcrypt.hash(novaSenha, 10)
  }

  await redis.set(`usuario:${email}`, usuario)
  revalidateTag('usuarios')
  return NextResponse.json({ ok: true })
}

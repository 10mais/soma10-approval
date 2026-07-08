import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Usuario } from '@/lib/redis'
import { revalidateTag } from 'next/cache'
import { registrarAuditoria } from '@/lib/auditoria'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

function gerarSenha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

// POST { clienteId } — RESETA a senha de login do cliente (admin). Gera uma nova,
// grava só o HASH no Usuario e devolve a senha UMA vez. Não guarda em texto plano.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { clienteId } = await req.json()
  const cliente = clienteId ? await redis.get<Cliente>(`cliente:${clienteId}`) : null
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  if (!cliente.loginEmail) return NextResponse.json({ error: 'Este cliente não tem acesso de login.' }, { status: 400 })

  const usuario = await redis.get<Usuario>(`usuario:${cliente.loginEmail}`)
  if (!usuario) return NextResponse.json({ error: 'Usuário de login do cliente não encontrado.' }, { status: 404 })

  const senha = gerarSenha()
  usuario.senha = await bcrypt.hash(senha, 10)
  await redis.set(`usuario:${cliente.loginEmail}`, usuario)

  // Garante que nenhuma senha em texto plano fique guardada no cliente.
  if ((cliente as any).loginSenha) { delete (cliente as any).loginSenha; await redis.set(`cliente:${clienteId}`, cliente) }

  revalidateTag('usuarios')
  await registrarAuditoria({ ator: session.user?.name || session.user?.email || 'admin', acao: 'senha_resetada', alvo: cliente.nome, detalhe: `Senha de login (${cliente.loginEmail}) redefinida` })
  return NextResponse.json({ ok: true, email: cliente.loginEmail, senha })
}

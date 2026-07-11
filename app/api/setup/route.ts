import { NextRequest, NextResponse } from 'next/server'
import { redis, Usuario } from '@/lib/redis'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

// Bootstrap de INSTÂNCIA NOVA: cria o PRIMEIRO admin quando o banco está vazio.
// Trava de segurança: só funciona enquanto NÃO existe nenhum usuário — depois
// disso responde 403 para sempre (na instância da agência, que já tem usuários,
// o efeito é o mesmo da antiga rota desativada). Sem isso, uma instância
// recém-provisionada (deploy + banco novos) não teria como fazer o 1º login.

export async function GET() {
  const usuarios = await redis.smembers('usuarios')
  return NextResponse.json({ disponivel: usuarios.length === 0 })
}

export async function POST(req: NextRequest) {
  const usuarios = await redis.smembers('usuarios')
  if (usuarios.length > 0) {
    return NextResponse.json({ error: 'Instância já inicializada — crie usuários pelo painel (admin).' }, { status: 403 })
  }

  const { nome, email, senha, nomeEmpresa } = await req.json().catch(() => ({} as any))
  const emailLimpo = (email || '').toString().trim().toLowerCase()
  if (!nome || !emailLimpo || !senha) return NextResponse.json({ error: 'nome, email e senha são obrigatórios' }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) return NextResponse.json({ error: 'e-mail inválido' }, { status: 400 })
  if ((senha || '').length < 8) return NextResponse.json({ error: 'a senha precisa de pelo menos 8 caracteres' }, { status: 400 })

  const usuario: Usuario = {
    nome: (nome || '').toString().slice(0, 80),
    email: emailLimpo,
    senha: await bcrypt.hash(senha, 10),
    role: 'admin',
    criadoEm: new Date().toISOString(),
  } as Usuario

  await redis.set(`usuario:${emailLimpo}`, usuario)
  await redis.sadd('usuarios', emailLimpo)
  if (nomeEmpresa) {
    await redis.set('config:agencia', { nomeAgencia: (nomeEmpresa || '').toString().slice(0, 80) })
  }
  return NextResponse.json({ ok: true, email: emailLimpo })
}

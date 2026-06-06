// Rota para criar o usuário admin inicial (usar apenas uma vez)
import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'

export async function POST(req: NextRequest) {
  const { chave } = await req.json()
  if (chave !== 'soma10-setup-2026') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const jaExiste = await redis.get('usuario:willian@grupo10mais.com.br')
  if (jaExiste) return NextResponse.json({ error: 'admin já criado' }, { status: 400 })

  const senha = await bcrypt.hash('soma10@2026', 10)
  const admin = {
    id: uuid(),
    nome: 'Willian Pires',
    email: 'willian@grupo10mais.com.br',
    senha,
    role: 'admin',
    criadoEm: new Date().toISOString(),
  }

  await redis.set(`usuario:${admin.email}`, admin)
  await redis.sadd('usuarios', admin.email)

  return NextResponse.json({ ok: true, mensagem: 'Admin criado! Email: willian@grupo10mais.com.br | Senha: soma10@2026' })
}

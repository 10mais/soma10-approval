import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Loja } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Lojas/filiais do varejo (perfil telefonia). Lista única por instância —
// padrão config:contasBancarias (PUT salva a lista inteira). GET é liberado à
// equipe (o seletor de loja precisa das lojas); escrever/remover é do admin.
const KEY = 'config:lojas'

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

export async function GET() {
  if (!(await sessaoEquipe())) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const lojas = (await redis.get<Loja[]>(KEY)) || []
  return NextResponse.json(Array.isArray(lojas) ? lojas : [])
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { lojas } = await req.json()
  if (!Array.isArray(lojas)) return NextResponse.json({ error: 'lista inválida' }, { status: 400 })
  const antigas = (await redis.get<Loja[]>(KEY)) || []
  const limpa: Loja[] = lojas
    .filter((l: any) => String(l?.nome || '').trim())
    .map((l: any) => ({
      id: l.id || uuid(),
      nome: String(l.nome).trim().slice(0, 80),
      endereco: (l.endereco || '').toString().trim().slice(0, 200) || undefined,
      ativa: l.ativa !== false,
      criadoEm: antigas.find(a => a.id === l.id)?.criadoEm || new Date().toISOString(),
    }))
  await redis.set(KEY, limpa)
  return NextResponse.json({ ok: true, lojas: limpa })
}

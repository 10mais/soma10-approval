import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, ContaBancaria } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

const KEY = 'config:contasBancarias'

// Contas bancárias (saldo manual) — base da Saúde do Caixa. Admin apenas.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const contas = (await redis.get<ContaBancaria[]>(KEY)) || []
  return NextResponse.json(Array.isArray(contas) ? contas : [])
}

// PUT salva a lista inteira (criar/editar/remover de uma vez)
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { contas } = await req.json()
  if (!Array.isArray(contas)) return NextResponse.json({ error: 'lista inválida' }, { status: 400 })
  const limpa: ContaBancaria[] = contas
    .filter((c: any) => String(c?.nome || '').trim())
    .map((c: any) => ({ id: c.id || uuid(), nome: String(c.nome).trim(), saldo: Number(c.saldo) || 0, atualizadoEm: new Date().toISOString() }))
  await redis.set(KEY, limpa)
  return NextResponse.json({ ok: true, contas: limpa })
}

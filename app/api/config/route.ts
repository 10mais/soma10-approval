import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, ConfigAgencia } from '@/lib/redis'

const PADRAO: ConfigAgencia = {
  nomeAgencia: 'Soma10Approval',
  corPrimaria: '#ffc00f',
  corSecundaria: '#111111',
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const config = await redis.get<ConfigAgencia>('config:agencia')
  return NextResponse.json(config || PADRAO)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const updates = await req.json()
  const atual = (await redis.get<ConfigAgencia>('config:agencia')) || PADRAO
  const atualizado: ConfigAgencia = { ...atual, ...updates, atualizadoEm: new Date().toISOString() }

  await redis.set('config:agencia', atualizado)
  return NextResponse.json({ ok: true, config: atualizado })
}

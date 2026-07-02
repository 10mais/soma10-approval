import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { getOperacional, OPERACIONAL_PADRAO } from '@/lib/operacional'

export const runtime = 'nodejs'

// GET: qualquer logado não-cliente (o app lê os valores). PUT: só admin.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json(await getOperacional())
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json()
  const novo = {
    slaAprovacaoHoras: Math.max(1, Number(b.slaAprovacaoHoras) || OPERACIONAL_PADRAO.slaAprovacaoHoras),
    lixeiraDias: Math.max(1, Number(b.lixeiraDias) || OPERACIONAL_PADRAO.lixeiraDias),
    saudeDias: Math.max(1, Number(b.saudeDias) || OPERACIONAL_PADRAO.saudeDias),
    prioridadePadrao: ['baixa', 'media', 'alta'].includes(b.prioridadePadrao) ? b.prioridadePadrao : OPERACIONAL_PADRAO.prioridadePadrao,
  }
  await redis.set('config:operacional', novo)
  return NextResponse.json({ ok: true, operacional: novo })
}

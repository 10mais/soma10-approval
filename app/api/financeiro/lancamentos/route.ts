import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, LancamentoFuturo } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

async function admin() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return null
  return session
}

// Lançamentos futuros (previsão de entradas/saídas). Admin apenas.
export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const ids = await redis.smembers('lancamentos')
  const lancs = ids.length ? ((await redis.mget<(LancamentoFuturo | null)[]>(...ids.map(i => `lancamento:${i}`))).filter(Boolean) as LancamentoFuturo[]) : []
  lancs.sort((a, b) => (a.data || '').localeCompare(b.data || ''))
  return NextResponse.json(lancs)
}

export async function POST(req: NextRequest) {
  const session = await admin()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json()
  if (!String(b.descricao || '').trim() || !(Number(b.valor) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(b.data || '')) {
    return NextResponse.json({ error: 'descrição, valor e data (YYYY-MM-DD) são obrigatórios' }, { status: 400 })
  }
  const l: LancamentoFuturo = {
    id: uuid(),
    tipo: b.tipo === 'saida' ? 'saida' : 'entrada',
    descricao: String(b.descricao).trim(),
    valor: Number(b.valor),
    data: b.data,
    clienteId: b.clienteId || '',
    recebido: false,
    criadoPor: session.user?.name || '',
    criadoEm: new Date().toISOString(),
  }
  await redis.set(`lancamento:${l.id}`, l)
  await redis.sadd('lancamentos', l.id)
  return NextResponse.json({ ok: true, lancamento: l })
}

export async function DELETE(req: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`lancamento:${id}`)
  await redis.srem('lancamentos', id)
  return NextResponse.json({ ok: true })
}

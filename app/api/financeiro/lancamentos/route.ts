import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, LancamentoFuturo } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Financeiro é exclusivo do admin.
async function admin() {
  const session = await getServerSession(authOptions)
  return (session?.user as any)?.role === 'admin' ? session : null
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

// Edição pontual do lançamento: o que foi vendido (procedimento/método), a
// descrição e o "já recebido". Valor e vínculo NÃO entram — mexer no valor de
// uma parcela gerada faria o caixa deixar de bater com a venda que a originou.
export async function PUT(req: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const id = String(b?.id || '')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const l = await redis.get<LancamentoFuturo>(`lancamento:${id}`)
  if (!l) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const atualizado: LancamentoFuturo = { ...l }
  if (b.procedimentos !== undefined) {
    atualizado.procedimentos = (Array.isArray(b.procedimentos) ? b.procedimentos : [])
      .map((x: unknown) => String(x || '').trim()).filter(Boolean).slice(0, 12)
  }
  if (b.descricao !== undefined) {
    const d = String(b.descricao).trim().slice(0, 200)
    if (!d) return NextResponse.json({ error: 'a descrição não pode ficar vazia' }, { status: 400 })
    atualizado.descricao = d
  }
  if (b.recebido !== undefined) atualizado.recebido = !!b.recebido
  await redis.set(`lancamento:${id}`, atualizado)
  return NextResponse.json({ ok: true, lancamento: atualizado })
}

export async function DELETE(req: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`lancamento:${id}`)
  await redis.srem('lancamentos', id)
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Despesa } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

async function ehAdmin() {
  const session = await getServerSession(authOptions)
  return (session?.user as any)?.role === 'admin' ? session : null
}

export async function GET() {
  if (!(await ehAdmin())) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const ids = await redis.smembers('despesas')
  const itens = ids.length ? ((await redis.mget<(Despesa | null)[]>(...ids.map(i => `despesa:${i}`))).filter(Boolean) as Despesa[]) : []
  itens.sort((a, b) => (b.mes || '').localeCompare(a.mes || '') || (b.criadoEm || '').localeCompare(a.criadoEm || ''))
  return NextResponse.json(itens)
}

export async function POST(req: NextRequest) {
  const session = await ehAdmin()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json()
  if (!b.descricao || !(Number(b.valor) > 0)) return NextResponse.json({ error: 'Informe descrição e valor.' }, { status: 400 })
  const hoje = new Date()
  const despesa: Despesa = {
    id: uuid(),
    descricao: String(b.descricao).trim(),
    valor: Number(b.valor) || 0,
    tipo: b.tipo === 'fixo' ? 'fixo' : 'variavel',
    categoria: b.categoria || '',
    mes: /^\d{4}-\d{2}$/.test(b.mes || '') ? b.mes : `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`,
    criadoPor: session.user?.name || '',
    criadoEm: new Date().toISOString(),
  }
  await redis.set(`despesa:${despesa.id}`, despesa)
  await redis.sadd('despesas', despesa.id)
  return NextResponse.json({ ok: true, despesa })
}

export async function PUT(req: NextRequest) {
  if (!(await ehAdmin())) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { id, ...updates } = await req.json()
  const d = await redis.get<Despesa>(`despesa:${id}`)
  if (!d) return NextResponse.json({ error: 'não encontrada' }, { status: 404 })
  const campos = ['descricao', 'valor', 'tipo', 'categoria', 'mes']
  const atual = { ...d } as any
  for (const c of campos) { if (c in updates) atual[c] = c === 'valor' ? Number(updates[c]) || 0 : updates[c] }
  await redis.set(`despesa:${id}`, atual)
  return NextResponse.json({ ok: true, despesa: atual })
}

export async function DELETE(req: NextRequest) {
  if (!(await ehAdmin())) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`despesa:${id}`)
  await redis.srem('despesas', id)
  return NextResponse.json({ ok: true })
}

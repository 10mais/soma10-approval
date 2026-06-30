import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Despesa } from '@/lib/redis'
import { papelPode } from '@/lib/permissoesPapel'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Admin sempre; gerente quando o admin liberar o Financeiro para o papel.
async function ehAdmin() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (role === 'admin') return session
  if (role === 'gerente' && await papelPode('gerente', 'financeiro')) return session
  return null
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
  const mesPadrao = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  // Pagamento único -> 1 mês; recorrente -> vários meses (lista já calculada no cliente)
  const meses: string[] = Array.isArray(b.meses) && b.meses.length
    ? b.meses.filter((m: string) => /^\d{4}-\d{2}$/.test(m))
    : [/^\d{4}-\d{2}$/.test(b.mes || '') ? b.mes : mesPadrao]

  const criadas: Despesa[] = []
  for (const m of meses) {
    const despesa: Despesa = {
      id: uuid(),
      descricao: String(b.descricao).trim(),
      valor: Number(b.valor) || 0,
      tipo: b.tipo === 'fixo' ? 'fixo' : 'variavel',
      categoria: b.categoria || '',
      mes: m,
      criadoPor: session.user?.name || '',
      criadoEm: new Date().toISOString(),
    }
    await redis.set(`despesa:${despesa.id}`, despesa)
    await redis.sadd('despesas', despesa.id)
    criadas.push(despesa)
  }
  return NextResponse.json({ ok: true, despesa: criadas[0], despesas: criadas })
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

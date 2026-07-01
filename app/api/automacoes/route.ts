import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Automacao } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

const KEY = 'config:automacoesRegras'

async function regras(): Promise<Automacao[]> {
  const r = await redis.get<Automacao[]>(KEY)
  return Array.isArray(r) ? r : []
}

// GET: lista as regras (equipe). O write exige admin.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json(await regras())
}

// POST: cria uma regra. PUT: atualiza. Ambos admin-only.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json()
  const nova: Automacao = {
    id: uuid(),
    nome: String(b.nome || 'Automação').trim(),
    ativo: b.ativo !== false,
    gatilho: String(b.gatilho || ''),
    condicoes: Array.isArray(b.condicoes) ? b.condicoes : [],
    condicaoLogica: b.condicaoLogica === 'qualquer' ? 'qualquer' : 'todas',
    alvo: b.alvo === 'selecionados' ? 'selecionados' : 'todos',
    clienteIds: Array.isArray(b.clienteIds) ? b.clienteIds : [],
    clienteIdsExcluidos: Array.isArray(b.clienteIdsExcluidos) ? b.clienteIdsExcluidos : [],
    passos: Array.isArray(b.passos) ? b.passos : [],
    criadoPor: session.user?.name || '',
    criadoEm: new Date().toISOString(),
  }
  if (!nova.gatilho) return NextResponse.json({ error: 'escolha um gatilho' }, { status: 400 })
  await redis.set(KEY, [...(await regras()), nova])
  return NextResponse.json({ ok: true, automacao: nova })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const lista = await regras()
  const i = lista.findIndex(r => r.id === b.id)
  if (i < 0) return NextResponse.json({ error: 'não encontrada' }, { status: 404 })
  lista[i] = { ...lista[i], ...b, id: lista[i].id, criadoEm: lista[i].criadoEm }
  await redis.set(KEY, lista)
  return NextResponse.json({ ok: true, automacao: lista[i] })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.set(KEY, (await regras()).filter(r => r.id !== id))
  return NextResponse.json({ ok: true })
}

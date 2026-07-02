import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Agente } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}
function ehAdmin(session: any) { return (session.user as any)?.role === 'admin' }

export async function GET() {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const ids = await redis.smembers('agentes')
  const agentes = ids.length ? ((await redis.mget<(Agente | null)[]>(...ids.map(i => `agente:${i}`))).filter(Boolean) as Agente[]) : []
  agentes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
  return NextResponse.json(agentes)
}

export async function POST(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session || !ehAdmin(session)) return NextResponse.json({ error: 'apenas admin' }, { status: 403 })
  const b = await req.json()
  if (!String(b.nome || '').trim()) return NextResponse.json({ error: 'informe o nome do agente' }, { status: 400 })
  const agora = new Date().toISOString()
  const agente: Agente = {
    id: uuid(),
    nome: String(b.nome).trim(),
    funcao: b.funcao || '',
    descricao: b.descricao || '',
    instrucoes: b.instrucoes || '',
    ferramentas: Array.isArray(b.ferramentas) ? b.ferramentas : [],
    cor: b.cor || '#7c3aed',
    ativo: b.ativo !== false,
    criadoPor: session.user?.name || '',
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`agente:${agente.id}`, agente)
  await redis.sadd('agentes', agente.id)
  return NextResponse.json({ ok: true, agente })
}

export async function PUT(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session || !ehAdmin(session)) return NextResponse.json({ error: 'apenas admin' }, { status: 403 })
  const { id, ...updates } = await req.json()
  const agente = await redis.get<Agente>(`agente:${id}`)
  if (!agente) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const campos = ['nome', 'funcao', 'descricao', 'instrucoes', 'ferramentas', 'cor', 'ativo']
  const atualizado: any = { ...agente, atualizadoEm: new Date().toISOString() }
  for (const c of campos) if (c in updates) atualizado[c] = updates[c]
  await redis.set(`agente:${id}`, atualizado)
  return NextResponse.json({ ok: true, agente: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session || !ehAdmin(session)) return NextResponse.json({ error: 'apenas admin' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`agente:${id}`)
  await redis.srem('agentes', id)
  return NextResponse.json({ ok: true })
}

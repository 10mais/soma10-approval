import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Candidatura } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { notificarAdmins } from '@/lib/notificacoes'
import { checarRate } from '@/lib/rateLimit'

export const runtime = 'nodejs'

// POST: publico (qualquer candidato envia, sem login)
export async function POST(req: NextRequest) {
  const rl = await checarRate(req, 'candidaturas', 5, 60); if (rl) return rl
  const body = await req.json()
  const nome = (body.nome || '').toString().trim()
  const email = (body.email || '').toString().trim()
  if (nome.length < 2) return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Informe um e-mail valido.' }, { status: 400 })

  const c: Candidatura = {
    id: uuid(),
    nome,
    email,
    telefone: (body.telefone || '').toString().slice(0, 40),
    vaga: (body.vaga || '').toString().slice(0, 120),
    mensagem: (body.mensagem || '').toString().slice(0, 4000),
    curriculoUrl: (body.curriculoUrl || '').toString(),
    curriculoNome: (body.curriculoNome || '').toString().slice(0, 200),
    status: 'nova',
    criadoEm: new Date().toISOString(),
  }
  await redis.set(`candidatura:${c.id}`, c)
  await redis.sadd('candidaturas', c.id)

  // Notifica a equipe (a tela de RH e so do admin, mas o aviso ajuda)
  await notificarAdmins('candidatura', 'Nova candidatura recebida', `${nome} se candidatou${c.vaga ? ` para "${c.vaga}"` : ''}.`).catch(() => {})

  return NextResponse.json({ ok: true })
}

// GET/PUT/DELETE: somente admin (RH)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const ids = await redis.smembers('candidaturas')
  const lista = ids.length > 0 ? ((await redis.mget<(Candidatura | null)[]>(...ids.map(id => `candidatura:${id}`))).filter(Boolean) as Candidatura[]) : []
  lista.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
  return NextResponse.json(lista)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const { id, status } = await req.json()
  const c = await redis.get<Candidatura>(`candidatura:${id}`)
  if (!c) return NextResponse.json({ error: 'nao encontrada' }, { status: 404 })
  if (status) c.status = status
  await redis.set(`candidatura:${id}`, c)
  return NextResponse.json({ ok: true, candidatura: c })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
  await redis.del(`candidatura:${id}`)
  await redis.srem('candidaturas', id)
  return NextResponse.json({ ok: true })
}

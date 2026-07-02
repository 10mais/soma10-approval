import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Documento } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Documentos internos da equipe (tipo Google Docs). Compartilhados com toda a
// equipe (nunca com clientes). Qualquer membro cria/edita; excluir só o autor ou admin.

async function equipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

export async function GET(req: NextRequest) {
  const session = await equipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const d = await redis.get<Documento>(`documento:${id}`)
    return d ? NextResponse.json(d) : NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  }
  const ids = await redis.smembers('documentos')
  const docs = ids.length ? ((await redis.mget<(Documento | null)[]>(...ids.map(i => `documento:${i}`))).filter(Boolean) as Documento[]) : []
  docs.sort((a, b) => new Date(b.atualizadoEm || b.criadoEm).getTime() - new Date(a.atualizadoEm || a.criadoEm).getTime())
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest) {
  const session = await equipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json()
  const agora = new Date().toISOString()
  const doc: Documento = {
    id: uuid(),
    titulo: String(b.titulo || '').slice(0, 200),
    conteudo: String(b.conteudo || '').slice(0, 500000),
    criadoPor: session.user?.email || '',
    criadoPorNome: session.user?.name || '',
    atualizadoPorNome: session.user?.name || '',
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`documento:${doc.id}`, doc)
  await redis.sadd('documentos', doc.id)
  return NextResponse.json({ ok: true, documento: doc })
}

export async function PUT(req: NextRequest) {
  const session = await equipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { id, titulo, conteudo } = await req.json()
  const doc = await redis.get<Documento>(`documento:${id}`)
  if (!doc) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const atualizado: Documento = {
    ...doc,
    ...(titulo !== undefined ? { titulo: String(titulo).slice(0, 200) } : {}),
    ...(conteudo !== undefined ? { conteudo: String(conteudo).slice(0, 500000) } : {}),
    atualizadoPorNome: session.user?.name || '',
    atualizadoEm: new Date().toISOString(),
  }
  await redis.set(`documento:${id}`, atualizado)
  return NextResponse.json({ ok: true, documento: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await equipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const doc = await redis.get<Documento>(`documento:${id}`)
  if (!doc) return NextResponse.json({ ok: true })
  const role = (session.user as any).role
  // Excluir: só o autor ou um admin
  if (role !== 'admin' && doc.criadoPor && doc.criadoPor !== session.user?.email) {
    return NextResponse.json({ error: 'só o autor ou um admin pode excluir' }, { status: 403 })
  }
  await redis.del(`documento:${id}`)
  await redis.srem('documentos', id)
  return NextResponse.json({ ok: true })
}

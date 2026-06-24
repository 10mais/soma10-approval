import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, BriefingCampanha } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })

  const ids = await redis.smembers('briefings')
  const briefings = ids.length > 0 ? ((await redis.mget<(BriefingCampanha | null)[]>(...ids.map(id => `briefing:${id}`))).filter(Boolean) as BriefingCampanha[]) : []

  const clienteId = req.nextUrl.searchParams.get('clienteId')
  const lista = (clienteId ? briefings.filter(b => b.clienteId === clienteId) : briefings)
    .sort((a, b) => new Date(b.atualizadoEm || b.criadoEm).getTime() - new Date(a.atualizadoEm || a.criadoEm).getTime())
  return NextResponse.json(lista)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })

  const body = await req.json()
  const agora = new Date().toISOString()
  const briefing: BriefingCampanha = {
    id: uuid(),
    clienteId: body.clienteId || '',
    clienteNome: body.clienteNome || '',
    titulo: body.titulo || 'Campanha sem título',
    objetivo: body.objetivo || '',
    plataformas: Array.isArray(body.plataformas) ? body.plataformas : [],
    verba: body.verba || '',
    periodo: body.periodo || '',
    publico: body.publico || '',
    oferta: body.oferta || '',
    observacoes: body.observacoes || '',
    conteudo: body.conteudo || '',
    criadoPor: session.user?.name || '',
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`briefing:${briefing.id}`, briefing)
  await redis.sadd('briefings', briefing.id)
  return NextResponse.json({ ok: true, briefing })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const briefing = await redis.get<BriefingCampanha>(`briefing:${id}`)
  if (!briefing) return NextResponse.json({ error: 'nao encontrado' }, { status: 404 })

  const campos = ['titulo', 'objetivo', 'plataformas', 'verba', 'periodo', 'publico', 'oferta', 'observacoes', 'conteudo']
  const atualizado: any = { ...briefing, atualizadoEm: new Date().toISOString() }
  for (const c of campos) { if (c in updates) atualizado[c] = updates[c] }
  await redis.set(`briefing:${id}`, atualizado)
  return NextResponse.json({ ok: true, briefing: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
  await redis.del(`briefing:${id}`)
  await redis.srem('briefings', id)
  return NextResponse.json({ ok: true })
}

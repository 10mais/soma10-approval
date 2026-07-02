import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, MapaMental, MapaNo, MapaConexao } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

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
    const m = await redis.get<MapaMental>(`mapa:${id}`)
    return m ? NextResponse.json(m) : NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  }
  const ids = await redis.smembers('mapas')
  const mapas = ids.length ? ((await redis.mget<(MapaMental | null)[]>(...ids.map(i => `mapa:${i}`))).filter(Boolean) as MapaMental[]) : []
  mapas.sort((a, b) => new Date(b.atualizadoEm || b.criadoEm).getTime() - new Date(a.atualizadoEm || a.criadoEm).getTime())
  // Lista sem os nós (leve) — só metadados
  return NextResponse.json(mapas.map(m => ({ id: m.id, titulo: m.titulo, atualizadoEm: m.atualizadoEm, criadoEm: m.criadoEm, nosQtd: (m.nos || []).length })))
}

export async function POST(req: NextRequest) {
  const session = await equipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const agora = new Date().toISOString()
  const raiz: MapaNo = { id: uuid(), texto: 'Ideia central', x: 480, y: 300, cor: '#7c3aed' }
  const mapa: MapaMental = {
    id: uuid(),
    titulo: String(b.titulo || '').slice(0, 200),
    nos: [raiz],
    conexoes: [],
    criadoPor: session.user?.email || '',
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`mapa:${mapa.id}`, mapa)
  await redis.sadd('mapas', mapa.id)
  return NextResponse.json({ ok: true, mapa })
}

export async function PUT(req: NextRequest) {
  const session = await equipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { id, titulo, nos, conexoes, layout } = await req.json()
  const mapa = await redis.get<MapaMental>(`mapa:${id}`)
  if (!mapa) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const nosSan: MapaNo[] = Array.isArray(nos) ? nos.slice(0, 500).map((n: any) => ({ id: String(n.id), texto: String(n.texto || '').slice(0, 500), x: Number(n.x) || 0, y: Number(n.y) || 0, cor: n.cor ? String(n.cor) : undefined })) : mapa.nos
  const conSan: MapaConexao[] = Array.isArray(conexoes) ? conexoes.slice(0, 1000).map((c: any) => ({ id: String(c.id), de: String(c.de), para: String(c.para) })) : mapa.conexoes
  const atualizado: MapaMental = {
    ...mapa,
    ...(titulo !== undefined ? { titulo: String(titulo).slice(0, 200) } : {}),
    ...(['mapa', 'organograma', 'lista'].includes(layout) ? { layout } : {}),
    nos: nosSan,
    conexoes: conSan,
    atualizadoEm: new Date().toISOString(),
  }
  await redis.set(`mapa:${id}`, atualizado)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await equipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`mapa:${id}`)
  await redis.srem('mapas', id)
  return NextResponse.json({ ok: true })
}

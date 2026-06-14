import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Post } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

function gerarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const role = (session.user as any).role
  let clienteId = req.nextUrl.searchParams.get('clienteId')

  // Cliente só pode ver os próprios posts, independente do parâmetro
  if (role === 'cliente') {
    clienteId = (session.user as any).clienteId
  }

  const ids = await redis.smembers('posts')
  const posts = await Promise.all(ids.map(id => redis.get<Post>(`post:${id}`)))
  let filtrados = posts.filter(Boolean).filter(p => !clienteId || p!.clienteId === clienteId)

  // Rascunhos internos não devem ser visíveis para o cliente
  if (role === 'cliente') {
    filtrados = filtrados.filter(p => !p!.rascunhoInterno)
  }

  return NextResponse.json(filtrados)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { clienteId, clienteNome, imagens, legenda, dataAgendada, formato, rascunhoInterno, colaboradores, capasVideo, redes } = await req.json()
  const redesLimpas: ('instagram' | 'facebook')[] = Array.isArray(redes)
    ? redes.filter((r: string): r is 'instagram' | 'facebook' => r === 'instagram' || r === 'facebook')
    : ['instagram', 'facebook']
  const colaboradoresLimpos = Array.isArray(colaboradores)
    ? colaboradores.map((c: string) => String(c).trim().replace(/^@/, '')).filter(Boolean).slice(0, 4)
    : []
  const post: Post = {
    id: uuid(),
    clienteId,
    clienteNome,
    imagens,
    legenda,
    status: 'rascunho',
    formato: formato || 'feed',
    dataAgendada,
    codigo: gerarCodigo(),
    criadoPor: session.user?.name || '',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...(rascunhoInterno ? { rascunhoInterno: true } : {}),
    ...(colaboradoresLimpos.length ? { colaboradores: colaboradoresLimpos } : {}),
    ...(capasVideo && typeof capasVideo === 'object' && Object.keys(capasVideo).length ? { capasVideo } : {}),
    redes: redesLimpas.length ? redesLimpas : ['instagram', 'facebook'],
  }

  await redis.set(`post:${post.id}`, post)
  await redis.sadd('posts', post.id)

  const link = `${process.env.APPROVAL_BASE_URL}/aprovar/${post.id}`
  return NextResponse.json({ ok: true, post, link })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const post = await redis.get<Post>(`post:${id}`)
  if (!post) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const atualizado = { ...post, ...updates, atualizadoEm: new Date().toISOString() }
  await redis.set(`post:${id}`, atualizado)
  return NextResponse.json({ ok: true, post: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const role = (session.user as any).role
  if (role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const post = await redis.get<Post>(`post:${id}`)
  if (!post) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  await redis.del(`post:${id}`)
  await redis.srem('posts', id)

  return NextResponse.json({ ok: true })
}

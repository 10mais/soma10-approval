import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Notificacao } from '@/lib/redis'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const ids = await redis.smembers(`notificacoes:${session.user.email}`)
  const notificacoes = (await Promise.all(ids.map(id => redis.get<Notificacao>(`notificacao:${id}`))))
    .filter(Boolean)
    .sort((a, b) => new Date(b!.criadoEm).getTime() - new Date(a!.criadoEm).getTime())

  return NextResponse.json(notificacoes)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { id, todasComoLidas } = await req.json()

  if (todasComoLidas) {
    const ids = await redis.smembers(`notificacoes:${session.user.email}`)
    const notificacoes = (await Promise.all(ids.map(nid => redis.get<Notificacao>(`notificacao:${nid}`)))).filter(Boolean) as Notificacao[]
    await Promise.all(notificacoes.filter(n => !n.lida).map(n => redis.set(`notificacao:${n.id}`, { ...n, lida: true })))
    return NextResponse.json({ ok: true })
  }

  if (id) {
    const notificacao = await redis.get<Notificacao>(`notificacao:${id}`)
    if (!notificacao || notificacao.destinatarioEmail !== session.user.email) {
      return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
    }
    await redis.set(`notificacao:${id}`, { ...notificacao, lida: true })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'parâmetros inválidos' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const email = session.user.email
  const { id, todas } = await req.json().catch(() => ({}))

  if (todas) {
    const ids = await redis.smembers(`notificacoes:${email}`)
    await Promise.all(ids.flatMap(nid => [redis.del(`notificacao:${nid}`), redis.srem(`notificacoes:${email}`, nid)]))
    return NextResponse.json({ ok: true })
  }

  if (id) {
    const notificacao = await redis.get<Notificacao>(`notificacao:${id}`)
    if (notificacao && notificacao.destinatarioEmail !== email) {
      return NextResponse.json({ error: 'não autorizado' }, { status: 403 })
    }
    await redis.del(`notificacao:${id}`)
    await redis.srem(`notificacoes:${email}`, id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'parâmetros inválidos' }, { status: 400 })
}

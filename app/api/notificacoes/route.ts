import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Notificacao } from '@/lib/redis'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const contagem = req.nextUrl.searchParams.get('contagem') === 'true'
  const ids = await redis.smembers(`notificacoes:${session.user.email}`)

  // Mensagens privadas vivem na aba Mensagens (badge próprio), não no Inbox.
  const ehInbox = (n: Notificacao | null): n is Notificacao => !!n && n.tipo !== 'mensagem_privada'

  if (contagem) {
    if (ids.length === 0) return NextResponse.json({ total: 0, naoLidas: 0 })
    const keys = ids.map(id => `notificacao:${id}`)
    const raw = await redis.mget<(Notificacao | null)[]>(...keys)
    const doInbox = raw.filter(ehInbox)
    const naoLidas = doInbox.filter(n => !n.lida).length
    return NextResponse.json({ total: doInbox.length, naoLidas })
  }

  if (ids.length === 0) return NextResponse.json([])
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50') || 50
  const keys = ids.map(id => `notificacao:${id}`)
  const raw = await redis.mget<(Notificacao | null)[]>(...keys)
  const notificacoes = raw.filter(ehInbox)
  notificacoes.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())

  return NextResponse.json(notificacoes.slice(0, limit))
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { id, todasComoLidas } = await req.json()

  if (todasComoLidas) {
    const ids = await redis.smembers(`notificacoes:${session.user.email}`)
    if (ids.length > 0) {
      const keys = ids.map(nid => `notificacao:${nid}`)
      const notificacoes = (await redis.mget<(Notificacao | null)[]>(...keys)).filter(Boolean) as Notificacao[]
      const naoLidas = notificacoes.filter(n => !n.lida)
      if (naoLidas.length > 0) await Promise.all(naoLidas.map(n => redis.set(`notificacao:${n.id}`, { ...n, lida: true })))
    }
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

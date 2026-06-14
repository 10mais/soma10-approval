import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'

export const runtime = 'nodejs'

// Retorna as Páginas/Instagram encontrados no OAuth, guardados temporariamente no Redis.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const paginas = await redis.get(`metapages:${id}`)
  if (!paginas) return NextResponse.json([])

  await redis.del(`metapages:${id}`) // uso único
  return NextResponse.json(paginas)
}

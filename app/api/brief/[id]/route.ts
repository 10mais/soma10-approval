import { NextRequest, NextResponse } from 'next/server'
import { redis, Post } from '@/lib/redis'
import { list } from '@vercel/blob'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Tenta buscar do Redis primeiro (posts novos)
    const post = await redis.get<Post>(`post:${params.id}`)
    if (post) return NextResponse.json(post)

    // Fallback: buscar do Blob (posts antigos)
    const token = process.env.BLOB_READ_WRITE_TOKEN
    const { blobs } = await list({ prefix: `briefings/${params.id}.json`, token })
    if (!blobs.length) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

    const res = await fetch(blobs[0].url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

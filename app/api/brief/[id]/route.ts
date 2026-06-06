import { NextRequest, NextResponse } from 'next/server'
import { list, head } from '@vercel/blob'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { blobs } = await list({ prefix: `briefings/${params.id}.json` })
    if (!blobs.length) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

    const res = await fetch(blobs[0].url)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'erro interno' }, { status: 500 })
  }
}

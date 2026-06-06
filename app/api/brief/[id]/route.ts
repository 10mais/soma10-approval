import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { blobs } = await list({ prefix: `briefings/${params.id}.json` })
    if (!blobs.length) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

    const res = await fetch(blobs[0].url)
    if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error('Erro ao buscar briefing:', e)
    return NextResponse.json({ error: 'erro interno' }, { status: 500 })
  }
}

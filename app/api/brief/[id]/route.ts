import { NextRequest, NextResponse } from 'next/server'
import { list, download } from '@vercel/blob'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { blobs } = await list({ prefix: `briefings/${params.id}.json` })
    if (!blobs.length) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

    const blob = await download(blobs[0].url)
    const text = await blob.text()
    return NextResponse.json(JSON.parse(text))
  } catch (e) {
    console.error('Erro ao buscar briefing:', e)
    return NextResponse.json({ error: 'erro interno' }, { status: 500 })
  }
}

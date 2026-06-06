import { NextRequest, NextResponse } from 'next/server'
import { list, getDownloadUrl } from '@vercel/blob'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { blobs } = await list({ prefix: `briefings/${params.id}.json` })
    if (!blobs.length) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

    const downloadUrl = await getDownloadUrl(blobs[0].url)
    const res = await fetch(downloadUrl)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error('Erro ao buscar briefing:', e)
    return NextResponse.json({ error: 'erro interno' }, { status: 500 })
  }
}

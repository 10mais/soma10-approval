import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = 'vercel_blob_rw_s2mVFZe3Gz5dvopb_pGDnFIY8NJW2EEjSnBkU4nSlcLzsl8'

    const { blobs } = await list({
      prefix: `briefings/${params.id}.json`,
      token,
    })

    if (!blobs.length) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

    const res = await fetch(blobs[0].url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error('Erro ao buscar briefing:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

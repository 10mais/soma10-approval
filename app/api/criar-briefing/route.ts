import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(req: NextRequest) {
  // Autenticação simples por API key
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const brief = await req.json()
  const { id } = brief

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return NextResponse.json({ error: 'armazenamento não configurado' }, { status: 500 })
  await put(`briefings/${id}.json`, JSON.stringify(brief, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    token,
  })

  const link = `${process.env.APPROVAL_BASE_URL}/aprovar/${id}`
  return NextResponse.json({ ok: true, link })
}

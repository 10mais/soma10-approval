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

  await put(`briefings/${id}.json`, JSON.stringify(brief, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  })

  const link = `${process.env.APPROVAL_BASE_URL}/aprovar/${id}`
  return NextResponse.json({ ok: true, link })
}

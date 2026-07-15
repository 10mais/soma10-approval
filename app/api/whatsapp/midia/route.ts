import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const runtime = 'nodejs'

// Proxy AUTENTICADO para mídia do WhatsApp guardada no Blob (privado OU público
// — a instância decide). Nunca expomos a URL crua do Blob: dado sensível
// (fotos/áudios de conversas — LGPD, e no perfil clínica é dado de saúde).
// O token de leitura do Blob é nosso, só o servidor o usa; quem acessa esta
// rota precisa estar logado (mesma regra do inbox — não é para clientes).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return new NextResponse('não autorizado', { status: 401 })

  const url = req.nextUrl.searchParams.get('url') || ''
  let host = ''
  try { host = new URL(url).hostname } catch { return new NextResponse('url inválida', { status: 400 }) }
  // Só repassamos para o storage de Blob da própria Vercel — evita virar proxy aberto (SSRF).
  if (!/\.vercel-storage\.com$/i.test(host)) return new NextResponse('origem não permitida', { status: 400 })

  const range = req.headers.get('range') || undefined
  let upstream: Response
  try {
    upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`, ...(range ? { Range: range } : {}) },
    })
  } catch {
    return new NextResponse('mídia indisponível', { status: 502 })
  }
  if (!upstream.ok && upstream.status !== 206) return new NextResponse('mídia indisponível', { status: 404 })

  const headers = new Headers()
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }
  headers.set('cache-control', 'private, max-age=3600')
  return new NextResponse(upstream.body, { status: upstream.status, headers })
}

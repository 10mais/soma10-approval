import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { lerBlobMidia } from '@/lib/whatsapp'

export const runtime = 'nodejs'

// Proxy AUTENTICADO para mídia do WhatsApp guardada no Blob (privado OU público
// — a instância decide). Nunca expomos a URL crua do Blob: dado sensível
// (fotos/áudios de conversas — LGPD, e no perfil clínica é dado de saúde).
// O token de leitura é do servidor; quem acessa esta rota precisa estar logado
// (mesma regra do inbox — não vale para o portal do cliente).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return new NextResponse('não autorizado', { status: 401 })

  const url = req.nextUrl.searchParams.get('url') || ''
  let host = ''
  try { host = new URL(url).hostname } catch { return new NextResponse('url inválida', { status: 400 }) }
  // Só repassamos o storage de Blob da própria Vercel — evita virar proxy aberto (SSRF).
  if (!/\.vercel-storage\.com$/i.test(host)) return new NextResponse('origem não permitida', { status: 400 })

  const r = await lerBlobMidia(url)
  if (!r) return new NextResponse('mídia indisponível', { status: 404 })

  const headers = new Headers()
  if (r.contentType) headers.set('content-type', r.contentType)
  if (r.tamanho) headers.set('content-length', String(r.tamanho))
  headers.set('cache-control', 'private, max-age=3600')
  return new NextResponse(r.stream as any, { status: 200, headers })
}

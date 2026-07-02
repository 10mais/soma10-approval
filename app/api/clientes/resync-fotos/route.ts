import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'
import { revalidateTag } from 'next/cache'
import { copiarFotoParaBlob } from '@/lib/blobFoto'

export const runtime = 'nodejs'

// Re-sincroniza as fotos de perfil dos clientes já conectados: rebusca o
// profile_picture_url no Instagram/Facebook com o token salvo e salva a foto no
// Vercel Blob (URL permanente). Corrige as logos que apontavam para a URL de CDN
// do IG (que expira e dá 403).
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const VERSION = process.env.META_API_VERSION || 'v19.0'
  const BASE = `https://graph.facebook.com/${VERSION}`
  const ids = await redis.smembers('clientes')
  const clientes = ids.length ? ((await redis.mget<(Cliente | null)[]>(...ids.map(i => `cliente:${i}`))).filter(Boolean) as Cliente[]) : []

  let atualizados = 0, semToken = 0, falhas = 0
  for (const c of clientes) {
    if (!c.metaConectado) continue
    let url: string | undefined
    try {
      if (c.instagramToken && c.instagramUserId) {
        const me = await fetch(`https://graph.instagram.com/me?fields=profile_picture_url&access_token=${c.instagramToken}`).then(r => r.json())
        url = me?.profile_picture_url
      } else if (c.facebookPageToken && c.instagramBusinessId) {
        const d = await fetch(`${BASE}/${c.instagramBusinessId}?fields=profile_picture_url&access_token=${c.facebookPageToken}`).then(r => r.json())
        url = d?.profile_picture_url
      } else { semToken++; continue }
    } catch { falhas++; continue }
    if (!url) { falhas++; continue }
    const permanente = await copiarFotoParaBlob(url, c.id)
    if (!permanente) { falhas++; continue }
    await redis.set(`cliente:${c.id}`, { ...c, logo: permanente })
    atualizados++
  }
  revalidateTag('clientes')
  return NextResponse.json({ ok: true, atualizados, semToken, falhas, total: clientes.length })
}

import { put } from '@vercel/blob'

// Baixa uma imagem externa (ex.: profile_picture_url do Instagram, que é uma
// URL de CDN temporária e expira) e salva no Vercel Blob, retornando uma URL
// PERMANENTE. Em qualquer falha, retorna undefined — o chamador decide se usa a
// URL original como fallback.
export async function copiarFotoParaBlob(url: string, nomeBase: string): Promise<string | undefined> {
  try {
    if (!url || !process.env.BLOB_READ_WRITE_TOKEN) return undefined
    const res = await fetch(url)
    if (!res.ok) return undefined
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const buf = Buffer.from(await res.arrayBuffer())
    const blob = await put(`logos/${nomeBase}-${Date.now()}.${ext}`, buf, {
      access: 'public',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return blob.url
  } catch {
    return undefined
  }
}

import { NextRequest } from 'next/server'
import { redis, Cliente } from '@/lib/redis'

export const runtime = 'nodejs'

// Proxy DEFINITIVO da foto de perfil do cliente. Resolve a melhor imagem
// disponível no SERVIDOR (evita o 403/hotlink do IG no browser), AUTO-CONSERTA
// o cliente.logo quando cai num ativo permanente (Blob) e, se nada funcionar,
// devolve um avatar SVG com a inicial — nunca uma imagem quebrada.

const EH_BLOB = (u?: string) => !!u && /\.public\.blob\.vercel-storage\.com/i.test(u)

function svgInicial(nome?: string, cor?: string): Response {
  const inicial = (nome || '?').trim().charAt(0).toUpperCase() || '?'
  const bg = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(cor || '') ? cor : '#ffc00f'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="${bg}"/><text x="100" y="100" dy="0.36em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="104" font-weight="700" fill="#111111">${inicial}</text></svg>`
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' } })
}

async function baixar(url?: string): Promise<{ buf: Buffer; mime: string } | null> {
  if (!url) return null
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    let mime = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const buf = Buffer.from(await r.arrayBuffer())
    if (!buf.length) return null
    if (!mime.startsWith('image/')) mime = 'image/jpeg'
    return { buf, mime }
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  let clienteId = sp.get('clienteId') || ''
  const token = sp.get('token') || ''
  if (!clienteId && token) clienteId = (await redis.get<string>(`aprovtoken:${token}`)) || ''
  if (!clienteId) return svgInicial('?', '#ffc00f')

  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return svgInicial('?', '#ffc00f')

  const assets = Array.isArray(cliente.assetsMarca) ? cliente.assetsMarca : []
  const assetLogo = assets.find(a => a?.categoria === 'logo')?.url
  const assetIcone = assets.find(a => a?.categoria === 'icone')?.url
  const assetQualquer = assets.find(a => a?.url)?.url
  const ref = (cliente.referenciasVisuais || []).find(Boolean)
  // Ordem: logo do cliente → ativo 'logo' → 'icone' → qualquer ativo → referência.
  const candidatos = [cliente.logo, assetLogo, assetIcone, assetQualquer, ref].filter(Boolean) as string[]

  for (const url of candidatos) {
    const img = await baixar(url)
    if (!img) continue
    // Auto-conserto: se o logo do cliente estava quebrado e a imagem boa veio de um
    // ativo PERMANENTE (Blob), grava como cliente.logo — conserta em TODO o sistema.
    if (url !== cliente.logo && EH_BLOB(url)) {
      try { await redis.set(`cliente:${clienteId}`, { ...cliente, logo: url }) } catch { /* segue */ }
    }
    return new Response(new Uint8Array(img.buf), { headers: { 'Content-Type': img.mime, 'Cache-Control': 'public, max-age=3600' } })
  }

  return svgInicial(cliente.nome, cliente.corPrimaria || '#ffc00f')
}

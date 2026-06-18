import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'

export const runtime = 'nodejs'

// Busca os vídeos mais vistos do YouTube para os termos do nicho
async function buscarYouTube(termos: string): Promise<any[]> {
  const KEY = process.env.YOUTUBE_API_KEY?.trim()
  if (!KEY) return []
  try {
    const q = encodeURIComponent(termos)
    const buscaUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&order=viewCount&maxResults=12&relevanceLanguage=pt&regionCode=BR&key=${KEY}`
    const busca = await fetch(buscaUrl).then(r => r.json())
    const ids = (busca?.items || []).map((it: any) => it.id?.videoId).filter(Boolean)
    if (!ids.length) return []
    const stUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids.join(',')}&key=${KEY}`
    const st = await fetch(stUrl).then(r => r.json())
    return (st?.items || []).map((v: any) => ({
      id: v.id,
      titulo: v.snippet?.title,
      canal: v.snippet?.channelTitle,
      thumb: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url,
      views: Number(v.statistics?.viewCount || 0),
      curtidas: Number(v.statistics?.likeCount || 0),
      comentarios: Number(v.statistics?.commentCount || 0),
      url: `https://www.youtube.com/watch?v=${v.id}`,
      publicadoEm: v.snippet?.publishedAt,
    })).sort((a: any, b: any) => b.views - a.views)
  } catch {
    return []
  }
}

// Best-effort: buscas relacionadas em alta no Google Trends (API não-oficial)
async function buscarGoogleTrends(termo: string): Promise<{ ok: boolean; relacionadas: any[] }> {
  try {
    const headers = { 'accept-language': 'pt-BR' }
    const reqExplore = encodeURIComponent(JSON.stringify({
      comparisonItem: [{ keyword: termo, geo: 'BR', time: 'now 7-d' }], category: 0, property: '',
    }))
    const exp = await fetch(`https://trends.google.com/trends/api/explore?hl=pt-BR&tz=180&req=${reqExplore}`, { headers }).then(r => r.text())
    const expJson = JSON.parse(exp.replace(/^\)\]\}'/, ''))
    const widget = (expJson?.widgets || []).find((w: any) => w.id === 'RELATED_QUERIES')
    if (!widget) return { ok: false, relacionadas: [] }
    const reqRel = encodeURIComponent(JSON.stringify(widget.request))
    const rel = await fetch(`https://trends.google.com/trends/api/widgetdata/relatedsearches?hl=pt-BR&tz=180&req=${reqRel}&token=${widget.token}`, { headers }).then(r => r.text())
    const relJson = JSON.parse(rel.replace(/^\)\]\}'/, ''))
    const lista = relJson?.default?.rankedList?.[1]?.rankedKeyword || relJson?.default?.rankedList?.[0]?.rankedKeyword || []
    return { ok: true, relacionadas: lista.slice(0, 12).map((k: any) => ({ termo: k.query, valor: k.value, link: `https://trends.google.com/trends/explore?q=${encodeURIComponent(k.query)}&geo=BR` })) }
  } catch {
    return { ok: false, relacionadas: [] }
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const clienteId = req.nextUrl.searchParams.get('clienteId') || ''
  if (!clienteId) return NextResponse.json({ error: 'clienteId é obrigatório' }, { status: 400 })

  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  const palavras = (cliente.palavrasChave || '').split(',').map(s => s.trim()).filter(Boolean)
  const segmento = (cliente.segmento || '').trim()
  const termos = [segmento, ...palavras].filter(Boolean)

  if (termos.length === 0) {
    return NextResponse.json({ semNicho: true, mensagem: 'Defina o Segmento/Nicho e palavras-chave no Brand Board para ativar o Social Listening.' })
  }

  const query = termos.slice(0, 4).join(' ')
  const termoPrincipal = segmento || palavras[0] || ''

  const [youtube, trends] = await Promise.all([
    buscarYouTube(query),
    buscarGoogleTrends(termoPrincipal),
  ])

  return NextResponse.json({
    termos,
    query,
    youtube,
    youtubeConfigurado: !!process.env.YOUTUBE_API_KEY,
    trends: trends.relacionadas,
    trendsOk: trends.ok,
  })
}

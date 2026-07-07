import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'
import { temModulo } from '@/lib/modulos'

export const runtime = 'nodejs'

// Busca os vídeos mais vistos do YouTube para os termos do nicho
// Palavras que indicam review/avaliacao — filtramos esses resultados
const REVIEW_TERMS = /review|avalia[çc][ãa]o|testei|experimentei|provei|unboxing|resenha|teste de|vale a pena\?/i

async function buscarYouTube(termos: string): Promise<any[]> {
  const KEY = process.env.YOUTUBE_API_KEY?.trim()
  if (!KEY) return []
  try {
    const q = encodeURIComponent(termos + ' #shorts')
    // videoDuration=short filtra apenas Shorts (ate 60s)
    const buscaUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&order=viewCount&maxResults=25&relevanceLanguage=pt&regionCode=BR&videoDuration=short&key=${KEY}`
    const busca = await fetch(buscaUrl).then(r => r.json())
    const ids = (busca?.items || []).map((it: any) => it.id?.videoId).filter(Boolean)
    if (!ids.length) return []
    const stUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${KEY}`
    const st = await fetch(stUrl).then(r => r.json())
    return (st?.items || [])
      .map((v: any) => ({
        id: v.id,
        titulo: v.snippet?.title,
        canal: v.snippet?.channelTitle,
        thumb: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url,
        views: Number(v.statistics?.viewCount || 0),
        curtidas: Number(v.statistics?.likeCount || 0),
        comentarios: Number(v.statistics?.commentCount || 0),
        url: `https://www.youtube.com/shorts/${v.id}`,
        publicadoEm: v.snippet?.publishedAt,
      }))
      .filter((v: any) => v.views >= 5000)
      .filter((v: any) => !REVIEW_TERMS.test(v.titulo || ''))
      .sort((a: any, b: any) => b.views - a.views)
      .slice(0, 12)
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

// Best-effort: hashtags em alta no TikTok Creative Center (API não-oficial).
// Os dados são por país (não por palavra-chave), então retornamos o top do BR
// e destacamos os que casam com os termos do nicho. Pode quebrar sem aviso.
async function buscarTikTok(termos: string[]): Promise<{ ok: boolean; hashtags: any[] }> {
  try {
    const uuid = crypto.randomUUID()
    const url = 'https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list?period=7&page=1&limit=50&country_code=BR&sort_by=popular'
    const r = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'referer': 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'pt-BR,pt;q=0.9',
        'anonymous-user-id': uuid,
        'timestamp': String(Date.now()),
      },
      cache: 'no-store',
    })
    const data = await r.json().catch(() => null)
    const lista = data?.data?.list || data?.list || []
    if (!Array.isArray(lista) || lista.length === 0) return { ok: false, hashtags: [] }

    const termosLower = termos.map(t => t.toLowerCase())
    const hashtags = lista.map((h: any) => {
      const nome = h.hashtag_name || h.name || ''
      const relevante = termosLower.some(t => t && (nome.toLowerCase().includes(t) || t.includes(nome.toLowerCase())))
      return {
        nome,
        posts: Number(h.publish_cnt || h.video_views || h.post_count || 0),
        relevante,
        url: `https://www.tiktok.com/tag/${encodeURIComponent(nome)}`,
      }
    }).filter((h: any) => h.nome)
    hashtags.sort((a: any, b: any) => (b.relevante ? 1 : 0) - (a.relevante ? 1 : 0) || b.posts - a.posts)
    return { ok: true, hashtags: hashtags.slice(0, 20) }
  } catch {
    return { ok: false, hashtags: [] }
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  // Cliente só o próprio; e só se tiver o add-on "listening" contratado.
  let clienteId = req.nextUrl.searchParams.get('clienteId') || ''
  if (role === 'cliente') clienteId = (session.user as any).clienteId || ''
  if (!clienteId) return NextResponse.json({ error: 'clienteId é obrigatório' }, { status: 400 })

  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  if (role === 'cliente' && !temModulo(cliente.modulos, 'listening')) return NextResponse.json({ error: 'Módulo Social Listening não contratado.' }, { status: 403 })

  const palavras = (cliente.palavrasChave || '').split(',').map(s => s.trim()).filter(Boolean)
  const segmento = (cliente.segmento || '').trim()
  const termos = [segmento, ...palavras].filter(Boolean)

  if (termos.length === 0) {
    return NextResponse.json({ semNicho: true, mensagem: 'Defina o Segmento/Nicho e palavras-chave no Brand Board para ativar o Social Listening.' })
  }

  const query = termos.slice(0, 4).join(' ')
  const termoPrincipal = segmento || palavras[0] || ''

  const [youtube, trends, tiktok] = await Promise.all([
    buscarYouTube(query),
    buscarGoogleTrends(termoPrincipal),
    buscarTikTok(termos),
  ])

  return NextResponse.json({
    termos,
    query,
    youtube,
    youtubeConfigurado: !!process.env.YOUTUBE_API_KEY,
    trends: trends.relacionadas,
    trendsOk: trends.ok,
    tiktok: tiktok.hashtags,
    tiktokOk: tiktok.ok,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'
import { temModulo } from '@/lib/modulos'

export const runtime = 'nodejs'

function paraTimestamp(data: string | null, fimDoDia = false) {
  if (!data) return null
  const iso = fimDoDia ? `${data}T23:59:59` : `${data}T00:00:00`
  return Math.floor(new Date(iso).getTime() / 1000)
}

async function chamarGraph(url: string) {
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data?.error) return { erro: data.error.message as string, data: null }
    return { erro: null, data }
  } catch (e: any) {
    return { erro: e?.message || 'falha de comunicação com a API do Meta', data: null }
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const role = (session.user as any).role
  const sessionClienteId = (session.user as any).clienteId

  let clienteId = req.nextUrl.searchParams.get('clienteId') || ''
  if (role === 'cliente') clienteId = sessionClienteId
  if (!clienteId) return NextResponse.json({ error: 'clienteId é obrigatório' }, { status: 400 })

  const desde = req.nextUrl.searchParams.get('desde')
  const ate = req.nextUrl.searchParams.get('ate')

  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  // Plano modular: Analytics é add-on — o cliente só acessa se tiver contratado.
  if (role === 'cliente' && !temModulo(cliente.modulos, 'analytics')) {
    return NextResponse.json({ error: 'Módulo Analytics não contratado.' }, { status: 403 })
  }

  // IMPORTANTE: usar SEMPRE as credenciais do próprio cliente. Nunca cair em uma
  // conta global de ambiente — isso faria todos os clientes mostrarem os mesmos dados.
  const VERSION = process.env.META_API_VERSION || 'v19.0'
  let BASE: string
  let TOKEN: string | undefined
  let IG_ID: string | undefined

  if (cliente.instagramConectado && cliente.instagramToken && cliente.instagramUserId) {
    // Conectado via "API com login do Instagram" (graph.instagram.com)
    BASE = 'https://graph.instagram.com/v21.0'
    TOKEN = cliente.instagramToken
    IG_ID = cliente.instagramUserId
  } else if (cliente.metaConectado && cliente.facebookPageToken && cliente.instagramBusinessId) {
    // Conectado via Página do Facebook (graph.facebook.com)
    BASE = `https://graph.facebook.com/${VERSION}`
    TOKEN = cliente.facebookPageToken
    IG_ID = cliente.instagramBusinessId
  } else {
    return NextResponse.json({
      error: 'Conta do Instagram não conectada para este cliente. Conecte as redes deste cliente para ver o desempenho.',
      conectado: false,
    }, { status: 200 })
  }

  // Janela padrão: últimos 30 dias
  const agora = Math.floor(Date.now() / 1000)
  const since = paraTimestamp(desde) || (agora - 30 * 24 * 3600)
  const until = paraTimestamp(ate, true) || agora

  // 1-4) Busca perfil, insights, demografia e midias em paralelo
  const [perfil, insightsConta, demografiaGenero, demografiaIdade, midiasRes] = await Promise.all([
    chamarGraph(`${BASE}/${IG_ID}?fields=username,name,profile_picture_url,followers_count,follows_count,media_count&access_token=${TOKEN}`),
    chamarGraph(`${BASE}/${IG_ID}/insights?metric=reach,profile_views&period=day&since=${since}&until=${until}&access_token=${TOKEN}`),
    chamarGraph(`${BASE}/${IG_ID}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=gender&access_token=${TOKEN}`),
    chamarGraph(`${BASE}/${IG_ID}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=age&access_token=${TOKEN}`),
    chamarGraph(`${BASE}/${IG_ID}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&since=${since}&until=${until}&limit=50&access_token=${TOKEN}`),
  ])
  const midias: any[] = midiasRes.data?.data || []

  // 5) Métricas por mídia (alcance, impressões, salvamentos, compartilhamentos) — melhor esforço, tolerante a falhas individuais
  const midiasComInsights = await Promise.all(midias.map(async (m) => {
    const ehVideo = m.media_type === 'VIDEO' || m.media_type === 'REELS'
    const metricas = ehVideo ? 'plays,reach,saved,shares' : 'impressions,reach,saved,shares'
    const ins = await chamarGraph(`${BASE}/${m.id}/insights?metric=${metricas}&access_token=${TOKEN}`)
    const valores: Record<string, number> = {}
    for (const item of (ins.data?.data || [])) {
      valores[item.name] = item.values?.[0]?.value ?? 0
    }
    return {
      id: m.id,
      legenda: m.caption || '',
      tipo: m.media_type,
      midiaUrl: m.media_url || m.thumbnail_url || '',
      link: m.permalink,
      publicadoEm: m.timestamp,
      curtidas: m.like_count ?? 0,
      comentarios: m.comments_count ?? 0,
      alcance: valores.reach ?? 0,
      impressoes: valores.impressions ?? valores.plays ?? 0,
      salvamentos: valores.saved ?? 0,
      compartilhamentos: valores.shares ?? 0,
    }
  }))

  const somar = (chave: string) => midiasComInsights.reduce((acc, m) => acc + (Number((m as any)[chave]) || 0), 0)

  const totais = {
    posts: midiasComInsights.length,
    curtidas: somar('curtidas'),
    comentarios: somar('comentarios'),
    alcance: somar('alcance'),
    impressoes: somar('impressoes'),
    salvamentos: somar('salvamentos'),
    compartilhamentos: somar('compartilhamentos'),
  }

  // Ranking: ordena posts por engajamento total (curtidas + comentarios + salvamentos + compartilhamentos)
  const postsRanking = [...midiasComInsights].sort((a, b) => {
    const ea = (a.curtidas + a.comentarios + a.salvamentos + a.compartilhamentos)
    const eb = (b.curtidas + b.comentarios + b.salvamentos + b.compartilhamentos)
    return eb - ea
  })

  // Periodo anterior (mesma duracao, imediatamente antes) para comparativo
  const duracaoSegundos = until - since
  const anteriorSince = since - duracaoSegundos
  const anteriorUntil = since - 1
  const midiasAntRes = await chamarGraph(
    `${BASE}/${IG_ID}/media?fields=id,like_count,comments_count&since=${anteriorSince}&until=${anteriorUntil}&limit=50&access_token=${TOKEN}`
  )
  const midiasAnt: any[] = midiasAntRes.data?.data || []
  const midiasAntComInsights = await Promise.all(midiasAnt.map(async (m) => {
    const ehVideo = m.media_type === 'VIDEO' || m.media_type === 'REELS'
    const metricas = ehVideo ? 'plays,reach,saved,shares' : 'impressions,reach,saved,shares'
    const ins = await chamarGraph(`${BASE}/${m.id}/insights?metric=${metricas}&access_token=${TOKEN}`)
    const valores: Record<string, number> = {}
    for (const item of (ins.data?.data || [])) {
      valores[item.name] = item.values?.[0]?.value ?? 0
    }
    return {
      curtidas: m.like_count ?? 0, comentarios: m.comments_count ?? 0,
      alcance: valores.reach ?? 0, impressoes: valores.impressions ?? valores.plays ?? 0,
      salvamentos: valores.saved ?? 0, compartilhamentos: valores.shares ?? 0,
    }
  }))
  const somarAnt = (chave: string) => midiasAntComInsights.reduce((acc, m) => acc + (Number((m as any)[chave]) || 0), 0)
  const totaisAnterior = {
    posts: midiasAntComInsights.length,
    curtidas: somarAnt('curtidas'), comentarios: somarAnt('comentarios'),
    alcance: somarAnt('alcance'), impressoes: somarAnt('impressoes'),
    salvamentos: somarAnt('salvamentos'), compartilhamentos: somarAnt('compartilhamentos'),
  }

  return NextResponse.json({
    conectado: true,
    instagramUsername: cliente.instagramUsername || perfil.data?.username,
    periodo: { since, until },
    periodoAnterior: { since: anteriorSince, until: anteriorUntil },
    perfil: perfil.data || null,
    erroPerfil: perfil.erro,
    insightsConta: insightsConta.data?.data || [],
    erroInsightsConta: insightsConta.erro,
    demografia: {
      genero: demografiaGenero.data?.data?.[0]?.total_value?.breakdowns?.[0]?.results || null,
      idade: demografiaIdade.data?.data?.[0]?.total_value?.breakdowns?.[0]?.results || null,
      erro: demografiaGenero.erro || demografiaIdade.erro || null,
    },
    posts: postsRanking,
    totais,
    totaisAnterior,
  })
}

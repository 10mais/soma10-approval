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
  const VERSION = process.env.META_API_VERSION || 'v21.0'
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

  // Métricas por mídia. `impressions` e `plays` foram DESCONTINUADAS pela Meta
  // (v22, valendo para todas as versões desde abril/2025; `impressions` já não
  // existia para mídia criada após 02/07/2024). Pedir uma métrica inválida
  // derruba a chamada INTEIRA — era isso que zerava alcance, salvamentos e
  // compartilhamentos junto. `views` é a substituta (jan/2025). Se a API do
  // cliente não aceitar `views`, cai para o conjunto sem ela: alcance nunca
  // mais some por tabela.
  async function insightsDaMidia(id: string): Promise<{ valores: Record<string, number>; erro: string | null }> {
    const ler = (ins: { data: any }) => { const v: Record<string, number> = {}; for (const item of (ins.data?.data || [])) v[item.name] = item.values?.[0]?.value ?? 0; return v }
    const completo = await chamarGraph(`${BASE}/${id}/insights?metric=views,reach,saved,shares&access_token=${TOKEN}`)
    if (!completo.erro) return { valores: ler(completo), erro: null }
    const basico = await chamarGraph(`${BASE}/${id}/insights?metric=reach,saved,shares&access_token=${TOKEN}`)
    return { valores: ler(basico), erro: basico.erro || completo.erro }
  }

  // Janela padrão: últimos 30 dias
  const agora = Math.floor(Date.now() / 1000)
  const since = paraTimestamp(desde) || (agora - 30 * 24 * 3600)
  const until = paraTimestamp(ate, true) || agora

  // 1-4) Busca perfil, insights, demografia e midias em paralelo
  // Conta: `profile_views` foi descontinuada (out/2024) e `impressions` também;
  // `reach` segue como série diária e `views` só existe como total do período.
  const [perfil, alcanceConta, viewsConta, demografiaGenero, demografiaIdade, midiasRes] = await Promise.all([
    chamarGraph(`${BASE}/${IG_ID}?fields=username,name,profile_picture_url,followers_count,follows_count,media_count&access_token=${TOKEN}`),
    chamarGraph(`${BASE}/${IG_ID}/insights?metric=reach&period=day&since=${since}&until=${until}&access_token=${TOKEN}`),
    chamarGraph(`${BASE}/${IG_ID}/insights?metric=views&period=day&metric_type=total_value&since=${since}&until=${until}&access_token=${TOKEN}`),
    chamarGraph(`${BASE}/${IG_ID}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=gender&access_token=${TOKEN}`),
    chamarGraph(`${BASE}/${IG_ID}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=age&access_token=${TOKEN}`),
    chamarGraph(`${BASE}/${IG_ID}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&since=${since}&until=${until}&limit=50&access_token=${TOKEN}`),
  ])
  const midias: any[] = midiasRes.data?.data || []

  // 5) Métricas por mídia (alcance, impressões, salvamentos, compartilhamentos) — melhor esforço, tolerante a falhas individuais
  const errosMidias: string[] = []
  const midiasComInsights = await Promise.all(midias.map(async (m) => {
    const { valores, erro } = await insightsDaMidia(m.id)
    if (erro) errosMidias.push(erro)
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
      impressoes: valores.views ?? 0, // "impressoes" = visualizacoes (metrica `views` da Meta); chave mantida para o PDF e as telas
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
    const { valores } = await insightsDaMidia(m.id)
    return {
      curtidas: m.like_count ?? 0, comentarios: m.comments_count ?? 0,
      alcance: valores.reach ?? 0, impressoes: valores.views ?? 0,
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
    insightsConta: [...(alcanceConta.data?.data || []), ...(viewsConta.data?.data || [])],
    erroInsightsConta: alcanceConta.erro,
    erroMidias: errosMidias[0] || null, // primeira resposta de erro da Meta nas metricas por post (para a tela explicar em vez de mostrar zero)
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

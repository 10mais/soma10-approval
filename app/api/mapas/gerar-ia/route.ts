import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, MapaMental, MapaNo, MapaConexao } from '@/lib/redis'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import { v4 as uuid } from 'uuid'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const CORES = ['#ffc00f', '#7c3aed', '#1d4ed8', '#0891b2', '#16a34a', '#ea580c', '#dc2626']
const NW = 190, NH = 110

type Raw = { texto?: string; filhos?: Raw[] }

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const KEY = process.env.ANTHROPIC_API_KEY?.trim()
  if (!KEY) return NextResponse.json({ error: 'IA não configurada (ANTHROPIC_API_KEY).' }, { status: 500 })

  const { tema } = await req.json()
  if (!String(tema || '').trim()) return NextResponse.json({ error: 'descreva o tema do mapa' }, { status: 400 })

  const system = `Você gera mapas mentais em português do Brasil. Responda APENAS com JSON válido (sem texto fora do JSON, sem crases), no formato:
{"titulo":"...","raiz":{"texto":"...","filhos":[{"texto":"...","filhos":[{"texto":"..."}]}]}}
Regras: a "raiz" é o tema central (texto curto). Gere de 4 a 6 ramos principais; cada ramo com 2 a 4 subtópicos; no máximo 3 níveis de profundidade. Textos curtos (1 a 4 palavras). Não inclua explicações.`

  let msg: any
  try {
    const client = new Anthropic({ apiKey: KEY })
    msg = await client.messages.create({
      model: 'claude-opus-4-8', max_tokens: 2500, thinking: { type: 'adaptive' }, output_config: { effort: 'low' } as any,
      system, messages: [{ role: 'user', content: `Tema: ${String(tema).slice(0, 2000)}` }],
    } as any)
    await registrarGasto(custoEstimado(msg.usage)).catch(() => {})
  } catch (e: any) {
    return NextResponse.json({ error: `Erro na IA: ${e?.message || 'desconhecido'}` }, { status: 502 })
  }

  const txt = (msg.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
  let dados: { titulo?: string; raiz?: Raw }
  try {
    const jsonStr = txt.replace(/^```(json)?/i, '').replace(/```$/i, '').trim()
    dados = JSON.parse(jsonStr.slice(jsonStr.indexOf('{'), jsonStr.lastIndexOf('}') + 1))
  } catch {
    return NextResponse.json({ error: 'A IA não retornou um mapa válido. Tente reformular.' }, { status: 502 })
  }
  if (!dados?.raiz) return NextResponse.json({ error: 'A IA não retornou a estrutura do mapa.' }, { status: 502 })

  // Converte a árvore em nós + conexões com layout de organograma (top-down)
  const nos: MapaNo[] = []
  const conexoes: MapaConexao[] = []
  let cursor = 0, total = 0
  function construir(raw: Raw, depth: number, cor: string | undefined, paiId: string | null): number {
    if (total >= 60) return cursor
    total++
    const idn = uuid()
    const ch = (raw.filhos || []).slice(0, 8)
    let x: number
    if (!ch.length || depth >= 3) { x = cursor; cursor += NW }
    else { const xs = ch.map((f, i) => construir(f, depth + 1, cor, idn)); x = (xs[0] + xs[xs.length - 1]) / 2 }
    nos.push({ id: idn, texto: String(raw.texto || '').slice(0, 200), x: x + 90, y: depth * NH + 70, cor: depth === 0 ? undefined : cor })
    if (paiId) conexoes.push({ id: uuid(), de: paiId, para: idn })
    return x
  }
  // Ramos principais ganham cores diferentes; descendentes herdam
  const raizId = uuid()
  const ramos = (dados.raiz.filhos || []).slice(0, 8)
  const xsRamos = ramos.map((r, i) => construir(r, 1, CORES[i % CORES.length], raizId))
  const xr = xsRamos.length ? (xsRamos[0] + xsRamos[xsRamos.length - 1]) / 2 : 0
  nos.unshift({ id: raizId, texto: String(dados.raiz.texto || 'Mapa').slice(0, 200), x: xr + 90, y: 70, cor: undefined })

  const agora = new Date().toISOString()
  const mapa: MapaMental = {
    id: uuid(), titulo: String(dados.titulo || dados.raiz.texto || 'Mapa (IA)').slice(0, 200),
    nos, conexoes, layout: 'organograma', criadoPor: session.user?.email || '', criadoEm: agora, atualizadoEm: agora,
  }
  await redis.set(`mapa:${mapa.id}`, mapa)
  await redis.sadd('mapas', mapa.id)
  return NextResponse.json({ ok: true, id: mapa.id })
}

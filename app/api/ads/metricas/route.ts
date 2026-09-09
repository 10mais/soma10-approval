import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, MetricaAds } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// LANÇAMENTOS de números (preenchimento MANUAL pelo gestor de tráfego — dono, 09/09/2026).
// Só entram os números CRUS: investimento, impressões, alcance, cliques, resultados e
// receita. CTR, CPC, CPM, custo por resultado e ROAS são derivados em lib/metricasAds e
// nunca gravados — número derivado que se grava é número que diverge do cru.
const INDICE = 'ads_metricas'
const NIVEIS = ['campanha', 'publico', 'anuncio']
const RE_YMD = /^\d{4}-\d{2}-\d{2}$/

function num(v: unknown): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined
  const x = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(x) && x >= 0 ? x : undefined
}
const dia = (v: unknown): string => (typeof v === 'string' && RE_YMD.test(v.slice(0, 10)) ? v.slice(0, 10) : '')

async function lista(clienteId?: string, campanhaId?: string): Promise<MetricaAds[]> {
  const ids = await redis.smembers(INDICE)
  if (!ids.length) return []
  let todas = ((await redis.mget<(MetricaAds | null)[]>(...ids.map(i => `ads_metrica:${i}`))).filter(Boolean) as MetricaAds[])
    .filter(m => !m.excluidoEm)
  if (clienteId) todas = todas.filter(m => m.clienteId === clienteId)
  if (campanhaId) todas = todas.filter(m => m.campanhaId === campanhaId)
  return todas.sort((a, b) => (b.data || '').localeCompare(a.data || ''))
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const role = (session.user as any).role
  let clienteId = req.nextUrl.searchParams.get('clienteId') || ''
  if (role === 'cliente') clienteId = (session.user as any).clienteId || ''
  return NextResponse.json(await lista(clienteId, req.nextUrl.searchParams.get('campanhaId') || ''))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const body = await req.json()
  const data = dia(body?.data)
  if (!body?.clienteId || !body?.campanhaId || !data) return NextResponse.json({ error: 'cliente, campanha e data são obrigatórios' }, { status: 400 })
  const agora = new Date().toISOString()
  const ate = dia(body?.ate)
  const metrica: MetricaAds = {
    id: uuid(),
    clienteId: body.clienteId,
    campanhaId: body.campanhaId,
    nivel: NIVEIS.includes(body?.nivel) ? body.nivel : 'campanha',
    refId: String(body?.refId || body.campanhaId).slice(0, 64),
    data,
    ...(ate && ate >= data ? { ate } : {}),
    ...(num(body.investimento) !== undefined ? { investimento: num(body.investimento) } : {}),
    ...(num(body.impressoes) !== undefined ? { impressoes: num(body.impressoes) } : {}),
    ...(num(body.alcance) !== undefined ? { alcance: num(body.alcance) } : {}),
    ...(num(body.cliques) !== undefined ? { cliques: num(body.cliques) } : {}),
    ...(num(body.resultados) !== undefined ? { resultados: num(body.resultados) } : {}),
    ...(num(body.receita) !== undefined ? { receita: num(body.receita) } : {}),
    observacao: String(body?.observacao || '').slice(0, 500),
    criadoPor: session.user?.name || '',
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`ads_metrica:${metrica.id}`, metrica)
  await redis.sadd(INDICE, metrica.id)
  return NextResponse.json({ ok: true, metrica })
}

const NUMEROS = ['investimento', 'impressoes', 'alcance', 'cliques', 'resultados', 'receita'] as const

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const { id, ...updates } = await req.json()
  const metrica = await redis.get<MetricaAds>(`ads_metrica:${id}`)
  if (!metrica) return NextResponse.json({ error: 'nao encontrada' }, { status: 404 })
  const atualizada = { ...metrica, atualizadoEm: new Date().toISOString() } as any
  for (const c of NUMEROS) if (c in updates) atualizada[c] = num(updates[c])
  if ('data' in updates && dia(updates.data)) atualizada.data = dia(updates.data)
  if ('ate' in updates) atualizada.ate = dia(updates.ate) || undefined
  if ('observacao' in updates) atualizada.observacao = String(updates.observacao || '').slice(0, 500)
  if ('restaurar' in updates) atualizada.excluidoEm = undefined
  await redis.set(`ads_metrica:${id}`, atualizada)
  return NextResponse.json({ ok: true, metrica: atualizada })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
  const metrica = await redis.get<MetricaAds>(`ads_metrica:${id}`)
  if (!metrica) return NextResponse.json({ error: 'nao encontrada' }, { status: 404 })
  await redis.set(`ads_metrica:${id}`, { ...metrica, excluidoEm: new Date().toISOString() })
  return NextResponse.json({ ok: true })
}

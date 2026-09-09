import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, CampanhaAds } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { normalizarPublicos } from '@/lib/metricasAds'

export const runtime = 'nodejs'

// CAMPANHAS de mídia paga. Público (conjunto/grupo de anúncios) e anúncio vivem DENTRO da
// campanha — mesmo padrão de `marco.subetapas`: uma escrita só, sem órfão.
const INDICE = 'ads_campanhas'

function texto(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}
function num(v: unknown): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined
  const x = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(x) ? x : undefined
}

const STATUS = ['planejada', 'ativa', 'pausada', 'encerrada']

async function lista(clienteId?: string): Promise<CampanhaAds[]> {
  const ids = await redis.smembers(INDICE)
  if (!ids.length) return []
  const todas = ((await redis.mget<(CampanhaAds | null)[]>(...ids.map(i => `ads_campanha:${i}`))).filter(Boolean) as CampanhaAds[])
    .filter(c => !c.excluidoEm)
  const filtradas = clienteId ? todas.filter(c => c.clienteId === clienteId) : todas
  return filtradas.sort((a, b) => (b.dataInicio || b.criadoEm || '').localeCompare(a.dataInicio || a.criadoEm || ''))
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const role = (session.user as any).role
  let clienteId = req.nextUrl.searchParams.get('clienteId') || ''
  if (role === 'cliente') clienteId = (session.user as any).clienteId || ''
  return NextResponse.json(await lista(clienteId))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const body = await req.json()
  if (!body?.clienteId || !texto(body?.nome)) return NextResponse.json({ error: 'cliente e nome são obrigatórios' }, { status: 400 })
  const agora = new Date().toISOString()
  const campanha: CampanhaAds = {
    id: uuid(),
    clienteId: body.clienteId,
    clienteNome: texto(body.clienteNome, 120),
    contaId: texto(body.contaId, 64),
    canal: texto(body.canal, 20) || 'meta',
    nome: texto(body.nome, 160),
    objetivo: texto(body.objetivo, 40) || 'trafego',
    ...(texto(body.tipoGoogle, 30) ? { tipoGoogle: texto(body.tipoGoogle, 30) } : {}),
    status: STATUS.includes(body.status) ? body.status : 'ativa',
    ...(texto(body.dataInicio, 30) ? { dataInicio: texto(body.dataInicio, 30) } : {}),
    ...(texto(body.dataFim, 30) ? { dataFim: texto(body.dataFim, 30) } : {}),
    ...(num(body.orcamento) !== undefined ? { orcamento: num(body.orcamento) } : {}),
    orcamentoTipo: body.orcamentoTipo === 'total' ? 'total' : 'diario',
    ...(texto(body.marcoId, 64) ? { marcoId: texto(body.marcoId, 64) } : {}),
    ...(texto(body.subetapaId, 64) ? { subetapaId: texto(body.subetapaId, 64) } : {}),
    publicos: normalizarPublicos(body.publicos),
    criadoPor: session.user?.name || '',
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`ads_campanha:${campanha.id}`, campanha)
  await redis.sadd(INDICE, campanha.id)
  return NextResponse.json({ ok: true, campanha })
}

const CAMPOS = ['contaId', 'canal', 'nome', 'objetivo', 'tipoGoogle', 'dataInicio', 'dataFim', 'orcamentoTipo', 'marcoId', 'subetapaId', 'clienteId', 'clienteNome'] as const

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const { id, ...updates } = await req.json()
  const campanha = await redis.get<CampanhaAds>(`ads_campanha:${id}`)
  if (!campanha) return NextResponse.json({ error: 'nao encontrada' }, { status: 404 })
  const atualizada = { ...campanha, atualizadoEm: new Date().toISOString() } as any
  for (const c of CAMPOS) if (c in updates) atualizada[c] = updates[c]
  if ('status' in updates && STATUS.includes(updates.status)) atualizada.status = updates.status
  if ('orcamento' in updates) atualizada.orcamento = num(updates.orcamento)
  if ('publicos' in updates) atualizada.publicos = normalizarPublicos(updates.publicos)
  if ('restaurar' in updates) atualizada.excluidoEm = undefined
  await redis.set(`ads_campanha:${id}`, atualizada)
  return NextResponse.json({ ok: true, campanha: atualizada })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
  const campanha = await redis.get<CampanhaAds>(`ads_campanha:${id}`)
  if (!campanha) return NextResponse.json({ error: 'nao encontrada' }, { status: 404 })
  await redis.set(`ads_campanha:${id}`, { ...campanha, excluidoEm: new Date().toISOString() })
  return NextResponse.json({ ok: true })
}

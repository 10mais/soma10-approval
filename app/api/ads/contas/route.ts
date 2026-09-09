import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, ContaAds } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// CONTAS DE ANÚNCIO por cliente (Métricas — dono, 09/09/2026). O gestor de tráfego cadastra;
// o cliente VÊ (decisão do dono: o cliente enxerga o investimento).
const INDICE = 'ads_contas'

async function lista(clienteId?: string): Promise<ContaAds[]> {
  const ids = await redis.smembers(INDICE)
  if (!ids.length) return []
  const todas = ((await redis.mget<(ContaAds | null)[]>(...ids.map(i => `ads_conta:${i}`))).filter(Boolean) as ContaAds[])
    .filter(c => !c.excluidoEm)
  const filtradas = clienteId ? todas.filter(c => c.clienteId === clienteId) : todas
  return filtradas.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'))
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
  if (!body?.clienteId || !String(body?.nome || '').trim()) return NextResponse.json({ error: 'cliente e nome são obrigatórios' }, { status: 400 })
  const agora = new Date().toISOString()
  const conta: ContaAds = {
    id: uuid(),
    clienteId: body.clienteId,
    clienteNome: body.clienteNome || '',
    canal: body.canal || 'meta',
    nome: String(body.nome).trim().slice(0, 120),
    identificador: String(body.identificador || '').trim().slice(0, 80),
    moeda: body.moeda || 'BRL',
    observacao: String(body.observacao || '').slice(0, 500),
    criadoPor: session.user?.name || '',
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`ads_conta:${conta.id}`, conta)
  await redis.sadd(INDICE, conta.id)
  return NextResponse.json({ ok: true, conta })
}

const CAMPOS = ['clienteId', 'clienteNome', 'canal', 'nome', 'identificador', 'moeda', 'observacao'] as const

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const { id, ...updates } = await req.json()
  const conta = await redis.get<ContaAds>(`ads_conta:${id}`)
  if (!conta) return NextResponse.json({ error: 'nao encontrada' }, { status: 404 })
  const atualizada = { ...conta, atualizadoEm: new Date().toISOString() } as any
  for (const c of CAMPOS) if (c in updates) atualizada[c] = updates[c]
  if ('restaurar' in updates) atualizada.excluidoEm = undefined
  await redis.set(`ads_conta:${id}`, atualizada)
  return NextResponse.json({ ok: true, conta: atualizada })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
  const conta = await redis.get<ContaAds>(`ads_conta:${id}`)
  if (!conta) return NextResponse.json({ error: 'nao encontrada' }, { status: 404 })
  // Soft-delete: some das telas mas volta com o Ctrl+Z (lib/desfazer) via `restaurar`.
  await redis.set(`ads_conta:${id}`, { ...conta, excluidoEm: new Date().toISOString() })
  return NextResponse.json({ ok: true })
}

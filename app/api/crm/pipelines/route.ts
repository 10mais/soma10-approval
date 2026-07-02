import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, CrmEstagio, CrmPipeline, CrmNegocio } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { garantirSetupCrm, estagiosPadrao, PIPES_KEY, ESTAGIOS_KEY } from '@/lib/crmPipelines'

export const runtime = 'nodejs'

async function autorizado() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

export async function GET() {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { pipelines } = await garantirSetupCrm()
  return NextResponse.json(pipelines)
}

// Cria um novo pipeline + suas etapas padrão.
export async function POST(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  const { nome } = await req.json()
  if (!String(nome || '').trim()) return NextResponse.json({ error: 'informe o nome do pipeline' }, { status: 400 })
  const { pipelines, estagios } = await garantirSetupCrm()
  const pipeline: CrmPipeline = { id: uuid(), nome: String(nome).trim(), ordem: (Math.max(-1, ...pipelines.map(p => p.ordem)) + 1) }
  await redis.set(PIPES_KEY, [...pipelines, pipeline])
  await redis.set(ESTAGIOS_KEY, [...estagios, ...estagiosPadrao(pipeline.id)])
  return NextResponse.json({ ok: true, pipeline })
}

// Renomeia um pipeline.
export async function PUT(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  const { id, nome } = await req.json()
  const { pipelines } = await garantirSetupCrm()
  const alvo = pipelines.find(p => p.id === id)
  if (!alvo) return NextResponse.json({ error: 'pipeline não encontrado' }, { status: 404 })
  if (!String(nome || '').trim()) return NextResponse.json({ error: 'informe o nome' }, { status: 400 })
  const novos = pipelines.map(p => p.id === id ? { ...p, nome: String(nome).trim() } : p)
  await redis.set(PIPES_KEY, novos)
  return NextResponse.json({ ok: true, pipeline: { ...alvo, nome: String(nome).trim() } })
}

// Exclui um pipeline: reatribui os negócios ao primeiro pipeline restante e remove suas etapas.
export async function DELETE(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const { pipelines, estagios } = await garantirSetupCrm()
  if (pipelines.length <= 1) return NextResponse.json({ error: 'não é possível excluir o único pipeline' }, { status: 400 })
  const padraoId = pipelines[0].id
  const destino = pipelines.find(p => p.id !== id)!
  const estagiosDestino = estagios.filter(e => (e.pipelineId || padraoId) === destino.id)
  const primeiraEtapaDestino = (estagiosDestino.find(e => !e.ganho && !e.perdido) || estagiosDestino[0])?.id || ''

  // Reatribui os negócios do pipeline excluído (inclui os "sem pipeline" se for o padrão)
  const ids = await redis.smembers('crm:negocios')
  const negocios = ids.length ? ((await redis.mget<(CrmNegocio | null)[]>(...ids.map(i => `negocio:${i}`))).filter(Boolean) as CrmNegocio[]) : []
  for (const n of negocios) {
    if ((n.pipelineId || padraoId) === id) {
      await redis.set(`negocio:${n.id}`, { ...n, pipelineId: destino.id, estagioId: primeiraEtapaDestino, atualizadoEm: new Date().toISOString() })
    }
  }

  await redis.set(PIPES_KEY, pipelines.filter(p => p.id !== id))
  await redis.set(ESTAGIOS_KEY, estagios.filter(e => (e.pipelineId || padraoId) !== id))
  return NextResponse.json({ ok: true })
}

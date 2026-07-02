import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, CrmEstagio } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { garantirSetupCrm, ESTAGIOS_KEY } from '@/lib/crmPipelines'
import { bloqueiaPapel } from '@/lib/permissoesPapel'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { estagios } = await garantirSetupCrm()
  return NextResponse.json(estagios)
}

// PUT salva as etapas de UM pipeline (mesma regra do CRM), preservando as dos demais.
// Mantém pelo menos 1 ganho e 1 perdido no pipeline editado.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  const body = await req.json()
  const { pipelines, estagios: todos } = await garantirSetupCrm()
  const pipelineId = String(body.pipelineId || pipelines[0].id)
  let lista: CrmEstagio[] = Array.isArray(body.estagios)
    ? body.estagios.map((e: any, i: number) => ({ id: String(e.id || uuid()), nome: String(e.nome || 'Estágio'), ordem: typeof e.ordem === 'number' ? e.ordem : i, pipelineId, ...(e.ganho ? { ganho: true } : {}), ...(e.perdido ? { perdido: true } : {}) }))
    : []
  if (!lista.some(e => e.ganho)) lista.push({ id: uuid(), nome: 'Ganho', ordem: lista.length, ganho: true, pipelineId })
  if (!lista.some(e => e.perdido)) lista.push({ id: uuid(), nome: 'Perdido', ordem: lista.length, perdido: true, pipelineId })
  lista.sort((a, b) => a.ordem - b.ordem)
  // Mantém as etapas dos outros pipelines intactas
  const outros = todos.filter(e => (e.pipelineId || pipelines[0].id) !== pipelineId)
  await redis.set(ESTAGIOS_KEY, [...outros, ...lista])
  return NextResponse.json({ ok: true, estagios: lista })
}

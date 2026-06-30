import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, CrmNegocio, CrmEstagio, CrmAtividade } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

async function autorizado() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

async function estagios(): Promise<CrmEstagio[]> {
  const t = await redis.get<CrmEstagio[]>('crm:estagios')
  return Array.isArray(t) ? t : []
}

function atividade(tipo: CrmAtividade['tipo'], texto: string, autor: string): CrmAtividade {
  return { id: uuid(), tipo, texto, autor, criadoEm: new Date().toISOString() }
}

export async function GET(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const n = await redis.get<CrmNegocio>(`negocio:${id}`)
    return n ? NextResponse.json(n) : NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  }
  const ids = await redis.smembers('crm:negocios')
  const negocios = ids.length ? ((await redis.mget<(CrmNegocio | null)[]>(...ids.map(i => `negocio:${i}`))).filter(Boolean) as CrmNegocio[]) : []
  negocios.sort((a, b) => new Date(b.atualizadoEm || b.criadoEm).getTime() - new Date(a.atualizadoEm || a.criadoEm).getTime())
  return NextResponse.json(negocios)
}

export async function POST(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json()
  if (!String(b.titulo || '').trim()) return NextResponse.json({ error: 'informe o título' }, { status: 400 })

  const ests = await estagios()
  const estagioId = b.estagioId || (ests.find(e => !e.ganho && !e.perdido)?.id) || ests[0]?.id || ''
  const agora = new Date().toISOString()
  const autor = session.user?.name || ''
  const negocio: CrmNegocio = {
    id: uuid(),
    titulo: String(b.titulo).trim(),
    valor: Number(b.valor) || 0,
    estagioId,
    status: 'aberto',
    dono: b.dono || (session.user as any)?.email || '',
    donoNome: b.donoNome || autor,
    contatoId: b.contatoId || '',
    origem: b.origem || '',
    previsaoFechamento: b.previsaoFechamento || '',
    descricao: b.descricao || '',
    empresa: b.empresa || '', segmento: b.segmento || '', faturamentoEstimado: b.faturamentoEstimado || '',
    instagram: b.instagram || '', dores: b.dores || '', solucoes: b.solucoes || '',
    handoff: b.handoff || {},
    atividades: [atividade('criacao', 'Negócio criado', autor)],
    criadoPor: autor, criadoEm: agora, atualizadoEm: agora,
  }
  await redis.set(`negocio:${negocio.id}`, negocio)
  await redis.sadd('crm:negocios', negocio.id)
  return NextResponse.json({ ok: true, negocio })
}

export async function PUT(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { id, ...updates } = await req.json()
  const negocio = await redis.get<CrmNegocio>(`negocio:${id}`)
  if (!negocio) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const autor = session.user?.name || ''
  const atividades = [...(negocio.atividades || [])]
  const atualizado: any = { ...negocio, atualizadoEm: new Date().toISOString() }

  // Adicionar atividade à timeline (nota/ligacao/email/reuniao/whatsapp)
  if (updates.novaAtividade?.texto) {
    atividades.push(atividade(updates.novaAtividade.tipo || 'nota', String(updates.novaAtividade.texto), autor))
  }

  // Mudança de estágio (kanban) — registra na timeline e ajusta status terminal
  if (updates.estagioId && updates.estagioId !== negocio.estagioId) {
    const ests = await estagios()
    const novo = ests.find(e => e.id === updates.estagioId)
    atualizado.estagioId = updates.estagioId
    atividades.push(atividade('estagio', `Movido para "${novo?.nome || 'estágio'}"`, autor))
    if (novo?.ganho) { atualizado.status = 'ganho'; atividades.push(atividade('ganho', 'Negócio ganho', autor)) }
    else if (novo?.perdido) { atualizado.status = 'perdido'; atividades.push(atividade('perdido', 'Negócio perdido', autor)) }
    else atualizado.status = 'aberto'
  }

  const campos = ['titulo', 'valor', 'dono', 'donoNome', 'contatoId', 'origem', 'probabilidade', 'previsaoFechamento', 'proximoFollowUp', 'motivoPerdido', 'descricao', 'handoff', 'status', 'clienteId', 'templateId', 'empresa', 'segmento', 'faturamentoEstimado', 'instagram', 'dores', 'solucoes']
  for (const c of campos) if (c in updates) atualizado[c] = updates[c]
  atualizado.atividades = atividades

  await redis.set(`negocio:${id}`, atualizado)
  return NextResponse.json({ ok: true, negocio: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`negocio:${id}`)
  await redis.srem('crm:negocios', id)
  return NextResponse.json({ ok: true })
}

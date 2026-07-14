import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Excursao, MotoristaExcursao } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Excursões (turismo): uma saída com ônibus, motoristas, valor do pacote e inclusos.
// Equipe lê; escrita exige CRM/editar.

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

async function carregarTodas(): Promise<Excursao[]> {
  const ids = await redis.smembers('excursoes')
  if (!ids.length) return []
  return (await redis.mget<(Excursao | null)[]>(...ids.map(i => `excursao:${i}`))).filter(Boolean) as Excursao[]
}

function limparMotoristas(arr: any): MotoristaExcursao[] {
  if (!Array.isArray(arr)) return []
  return arr.map((m: any) => ({
    nome: String(m?.nome || '').trim().slice(0, 80),
    cpf: (m?.cpf || '').toString().slice(0, 20) || undefined,
    cnh: (m?.cnh || '').toString().slice(0, 20) || undefined,
  })).filter(m => m.nome).slice(0, 6)
}
function limparInclusos(arr: any): string[] {
  if (!Array.isArray(arr)) return []
  return arr.map((s: any) => String(s).trim().slice(0, 120)).filter(Boolean).slice(0, 40)
}
const dataOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

export async function GET(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const e = await redis.get<Excursao>(`excursao:${id}`)
    return e ? NextResponse.json(e) : NextResponse.json({ error: 'não encontrada' }, { status: 404 })
  }
  const excursoes = (await carregarTodas()).sort((a, b) => (a.dataIda || '').localeCompare(b.dataIda || ''))
  return NextResponse.json({ excursoes })
}

export async function POST(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const titulo = String(b.titulo || '').trim()
  const dataIda = String(b.dataIda || '')
  if (!titulo) return NextResponse.json({ error: 'informe o título da excursão' }, { status: 400 })
  if (!dataOk(dataIda)) return NextResponse.json({ error: 'informe a data de ida' }, { status: 400 })

  const agora = new Date().toISOString()
  const excursao: Excursao = {
    id: uuid(),
    titulo: titulo.slice(0, 140),
    roteiro: (b.roteiro || '').toString().slice(0, 500) || undefined,
    dataIda,
    dataVolta: dataOk(String(b.dataVolta || '')) ? String(b.dataVolta) : undefined,
    onibusId: (b.onibusId || '').toString() || undefined,
    motoristas: limparMotoristas(b.motoristas),
    valorPacote: Math.max(0, Number(b.valorPacote) || 0),
    descontoPadrao: b.descontoPadrao ? Math.max(0, Number(b.descontoPadrao)) : undefined,
    inclusos: limparInclusos(b.inclusos),
    status: ['planejada', 'aberta', 'realizada', 'cancelada'].includes(b.status) ? b.status : 'aberta',
    observacoes: (b.observacoes || '').toString().slice(0, 800) || undefined,
    criadoPor: session.user?.name || session.user?.email || undefined,
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`excursao:${excursao.id}`, excursao)
  await redis.sadd('excursoes', excursao.id)
  return NextResponse.json({ ok: true, excursao })
}

export async function PUT(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const atual = await redis.get<Excursao>(`excursao:${b.id}`)
  if (!atual) return NextResponse.json({ error: 'não encontrada' }, { status: 404 })
  const e: Excursao = { ...atual }
  if (b.titulo !== undefined) e.titulo = String(b.titulo).trim().slice(0, 140)
  if (b.roteiro !== undefined) e.roteiro = String(b.roteiro).slice(0, 500) || undefined
  if (b.dataIda !== undefined && dataOk(String(b.dataIda))) e.dataIda = String(b.dataIda)
  if (b.dataVolta !== undefined) e.dataVolta = dataOk(String(b.dataVolta)) ? String(b.dataVolta) : undefined
  if (b.onibusId !== undefined) e.onibusId = String(b.onibusId) || undefined
  if (b.motoristas !== undefined) e.motoristas = limparMotoristas(b.motoristas)
  if (b.valorPacote !== undefined) e.valorPacote = Math.max(0, Number(b.valorPacote) || 0)
  if (b.descontoPadrao !== undefined) e.descontoPadrao = b.descontoPadrao ? Math.max(0, Number(b.descontoPadrao)) : undefined
  if (b.inclusos !== undefined) e.inclusos = limparInclusos(b.inclusos)
  if (b.status !== undefined && ['planejada', 'aberta', 'realizada', 'cancelada'].includes(b.status)) e.status = b.status
  if (b.observacoes !== undefined) e.observacoes = String(b.observacoes).slice(0, 800) || undefined
  e.atualizadoEm = new Date().toISOString()
  await redis.set(`excursao:${e.id}`, e)
  return NextResponse.json({ ok: true, excursao: e })
}

export async function DELETE(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`excursao:${id}`)
  await redis.srem('excursoes', id)
  return NextResponse.json({ ok: true })
}

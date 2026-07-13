import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, EsperaItem } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Lista de espera da Agenda: paciente que quer horário mas ainda não tem.
// Entra aqui, sai quando vira agendamento (a UI agenda e remove) ou desiste.

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

export async function GET() {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const ids = await redis.smembers('esperas')
  const itens = ids.length ? ((await redis.mget<(EsperaItem | null)[]>(...ids.map(i => `espera:${i}`))).filter(Boolean) as EsperaItem[]) : []
  itens.sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()) // ordem de chegada
  return NextResponse.json({ itens })
}

export async function POST(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'producao', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const nome = (b.pacienteNome || '').toString().trim()
  if (!nome) return NextResponse.json({ error: 'informe o nome do paciente' }, { status: 400 })
  const item: EsperaItem = {
    id: uuid(),
    pacienteNome: nome.slice(0, 120),
    pacienteTelefone: (b.pacienteTelefone || '').toString().slice(0, 30) || undefined,
    contatoId: (b.contatoId || '').toString() || undefined,
    servico: (b.servico || '').toString().slice(0, 80) || undefined,
    profissionalEmail: (b.profissionalEmail || '').toString() || undefined,
    observacoes: (b.observacoes || '').toString().slice(0, 400) || undefined,
    criadoEm: new Date().toISOString(),
    criadoPor: session.user?.name || session.user?.email || undefined,
  }
  await redis.set(`espera:${item.id}`, item)
  await redis.sadd('esperas', item.id)
  return NextResponse.json({ ok: true, item })
}

export async function DELETE(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'producao', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`espera:${id}`)
  await redis.srem('esperas', id)
  return NextResponse.json({ ok: true })
}

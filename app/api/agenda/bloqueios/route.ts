import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { Bloqueio, horaParaMin } from '@/lib/agenda'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Bloqueios/compromissos da profissional (Agenda): faixas em que ela não atende.
// Pontual (data+duração) ou recorrente (dias da semana + faixa de horário).
// Equipe apenas; escrita exige permissão de produção/editar.

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

export async function GET() {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const ids = await redis.smembers('bloqueios')
  const bloqueios = ids.length
    ? ((await redis.mget<(Bloqueio | null)[]>(...ids.map(i => `bloqueio:${i}`))).filter(Boolean) as Bloqueio[])
    : []
  return NextResponse.json({ bloqueios })
}

const HHMM = /^\d{1,2}:\d{2}$/

export async function POST(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'producao', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }

  const b = await req.json()
  const profissionalEmail = (b.profissionalEmail || '').toString().trim()
  if (!profissionalEmail) return NextResponse.json({ error: 'informe o profissional' }, { status: 400 })

  const recorrente = !!b.recorrente
  const novo: Bloqueio = {
    id: uuid(),
    profissionalEmail,
    profissionalNome: (b.profissionalNome || profissionalEmail).toString().slice(0, 80),
    titulo: (b.titulo || '').toString().slice(0, 80) || undefined,
    recorrente,
    criadoEm: new Date().toISOString(),
    criadoPor: session.user?.name || session.user?.email || undefined,
  }

  if (recorrente) {
    const dias = Array.isArray(b.diasSemana)
      ? Array.from(new Set(b.diasSemana.map(Number).filter((n: number) => n >= 0 && n <= 6))).sort() as number[]
      : []
    if (!dias.length) return NextResponse.json({ error: 'escolha ao menos um dia da semana' }, { status: 400 })
    const hi = (b.horaInicio || '').toString(), hf = (b.horaFim || '').toString()
    if (!HHMM.test(hi) || !HHMM.test(hf)) return NextResponse.json({ error: 'horário inválido' }, { status: 400 })
    if (horaParaMin(hf) <= horaParaMin(hi)) return NextResponse.json({ error: 'a hora final deve ser depois da inicial' }, { status: 400 })
    novo.diasSemana = dias
    novo.horaInicio = hi
    novo.horaFim = hf
    if (b.ate && /^\d{4}-\d{2}-\d{2}$/.test(b.ate)) novo.ate = b.ate
  } else {
    const dataInicio = (b.dataInicio || '').toString()
    if (isNaN(new Date(dataInicio).getTime())) return NextResponse.json({ error: 'data/hora inválida' }, { status: 400 })
    novo.dataInicio = dataInicio
    novo.duracaoMin = Math.min(1440, Math.max(5, Number(b.duracaoMin) || 60))
  }

  await redis.set(`bloqueio:${novo.id}`, novo)
  await redis.sadd('bloqueios', novo.id)
  return NextResponse.json({ ok: true, bloqueio: novo })
}

export async function DELETE(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'producao', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`bloqueio:${id}`)
  await redis.srem('bloqueios', id)
  return NextResponse.json({ ok: true })
}

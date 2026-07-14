import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Onibus } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { layoutPorId } from '@/lib/layoutsOnibus'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Frota de ônibus (turismo). Equipe lê; escrita exige CRM/editar.

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

async function carregarTodos(): Promise<Onibus[]> {
  const ids = await redis.smembers('onibus')
  if (!ids.length) return []
  return (await redis.mget<(Onibus | null)[]>(...ids.map(i => `onibus:${i}`))).filter(Boolean) as Onibus[]
}

export async function GET() {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const onibus = (await carregarTodos()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
  return NextResponse.json({ onibus })
}

export async function POST(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const nome = String(b.nome || '').trim()
  const layoutId = String(b.layoutId || '').trim()
  if (!nome) return NextResponse.json({ error: 'informe o nome do ônibus' }, { status: 400 })
  if (!layoutPorId(layoutId)) return NextResponse.json({ error: 'layout de poltronas inválido' }, { status: 400 })

  const agora = new Date().toISOString()
  const onibus: Onibus = {
    id: uuid(),
    nome: nome.slice(0, 80),
    placa: (b.placa || '').toString().slice(0, 12) || undefined,
    layoutId,
    amenidades: Array.isArray(b.amenidades) ? b.amenidades.map((a: any) => String(a).slice(0, 40)).filter(Boolean).slice(0, 20) : undefined,
    ativo: b.ativo !== false,
    observacoes: (b.observacoes || '').toString().slice(0, 500) || undefined,
    criadoPor: session.user?.name || session.user?.email || undefined,
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`onibus:${onibus.id}`, onibus)
  await redis.sadd('onibus', onibus.id)
  return NextResponse.json({ ok: true, onibus })
}

export async function PUT(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const atual = await redis.get<Onibus>(`onibus:${b.id}`)
  if (!atual) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  if (b.layoutId !== undefined && !layoutPorId(String(b.layoutId))) {
    return NextResponse.json({ error: 'layout de poltronas inválido' }, { status: 400 })
  }
  const atualizado: Onibus = { ...atual }
  if (b.nome !== undefined) atualizado.nome = String(b.nome).trim().slice(0, 80)
  if (b.placa !== undefined) atualizado.placa = String(b.placa).slice(0, 12) || undefined
  if (b.layoutId !== undefined) atualizado.layoutId = String(b.layoutId)
  if (Array.isArray(b.amenidades)) atualizado.amenidades = b.amenidades.map((a: any) => String(a).slice(0, 40)).filter(Boolean).slice(0, 20)
  if (b.ativo !== undefined) atualizado.ativo = !!b.ativo
  if (b.observacoes !== undefined) atualizado.observacoes = String(b.observacoes).slice(0, 500) || undefined
  atualizado.atualizadoEm = new Date().toISOString()
  await redis.set(`onibus:${atualizado.id}`, atualizado)
  return NextResponse.json({ ok: true, onibus: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`onibus:${id}`)
  await redis.srem('onibus', id)
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Excursao, Onibus } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { Reserva, Passageiro, poltronasOcupadas, poltronasEmConflito, valorTotalReserva } from '@/lib/reservas'
import { layoutPorId, poltronaExiste } from '@/lib/layoutsOnibus'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Reservas de excursão. Regra crítica: JAMAIS duas pessoas na mesma poltrona.
// Equipe lê; escrita exige CRM/editar.

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

async function carregarTodas(): Promise<Reserva[]> {
  const ids = await redis.smembers('reservas')
  if (!ids.length) return []
  return (await redis.mget<(Reserva | null)[]>(...ids.map(i => `reserva:${i}`))).filter(Boolean) as Reserva[]
}

function limparPassageiros(arr: any): Passageiro[] {
  if (!Array.isArray(arr)) return []
  return arr.map((p: any) => ({
    nome: String(p?.nome || '').trim().slice(0, 120),
    cpf: (p?.cpf || '').toString().slice(0, 20) || undefined,
    nascimento: /^\d{4}-\d{2}-\d{2}$/.test(String(p?.nascimento || '')) ? String(p.nascimento) : undefined,
    poltrona: (p?.poltrona || '').toString().trim() || undefined,
  })).filter(p => p.nome).slice(0, 60)
}

// Valida assentos: existem no layout do ônibus da excursão e não conflitam com
// outras reservas ( nem repetem dentro da própria). Retorna erro (string) ou null.
async function validarPoltronas(excursao: Excursao, passageiros: Passageiro[], reservaId?: string): Promise<string | null> {
  const pedidas = passageiros.map(p => p.poltrona).filter(Boolean) as string[]
  if (!pedidas.length) return null // reserva sem poltrona definida ainda é permitida
  // Assentos existem no layout?
  if (excursao.onibusId) {
    const onibus = await redis.get<Onibus>(`onibus:${excursao.onibusId}`)
    const layout = onibus && layoutPorId(onibus.layoutId)
    if (layout) {
      const inexistente = pedidas.find(n => !poltronaExiste(layout, n))
      if (inexistente) return `Poltrona ${inexistente} não existe no layout do ônibus.`
    }
  }
  const ocupadas = poltronasOcupadas(await carregarTodas(), excursao.id, reservaId)
  const conflitos = poltronasEmConflito(pedidas, ocupadas)
  if (conflitos.length) return `Poltrona(s) já ocupada(s) ou repetida(s): ${conflitos.join(', ')}.`
  return null
}

export async function GET(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const r = await redis.get<Reserva>(`reserva:${id}`)
    return r ? NextResponse.json(r) : NextResponse.json({ error: 'não encontrada' }, { status: 404 })
  }
  const excursaoId = req.nextUrl.searchParams.get('excursaoId')
  let lista = await carregarTodas()
  if (excursaoId) lista = lista.filter(r => r.excursaoId === excursaoId)
  lista.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
  return NextResponse.json({ reservas: lista })
}

export async function POST(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const excursao = await redis.get<Excursao>(`excursao:${b.excursaoId}`)
  if (!excursao) return NextResponse.json({ error: 'excursão não encontrada' }, { status: 400 })
  const contratanteNome = String(b.contratanteNome || '').trim()
  if (!contratanteNome) return NextResponse.json({ error: 'informe o contratante' }, { status: 400 })
  const passageiros = limparPassageiros(b.passageiros)
  if (!passageiros.length) return NextResponse.json({ error: 'informe ao menos um passageiro' }, { status: 400 })

  const erro = await validarPoltronas(excursao, passageiros)
  if (erro) return NextResponse.json({ error: erro, conflito: true }, { status: 409 })

  const agora = new Date().toISOString()
  const desconto = Math.max(0, Number(b.desconto) || 0)
  const reserva: Reserva = {
    id: uuid(),
    excursaoId: excursao.id,
    contatoId: (b.contatoId || '').toString() || undefined,
    contratanteNome: contratanteNome.slice(0, 120),
    passageiros,
    vendedorEmail: (b.vendedorEmail || '').toString() || undefined,
    vendedorNome: (b.vendedorNome || '').toString().slice(0, 80) || undefined,
    desconto: desconto || undefined,
    cupomId: (b.cupomId || '').toString() || undefined,
    observacoes: (b.observacoes || '').toString().slice(0, 800) || undefined,
    status: ['pre-reserva', 'confirmada', 'cancelada'].includes(b.status) ? b.status : 'pre-reserva',
    criadoPor: session.user?.name || session.user?.email || undefined,
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`reserva:${reserva.id}`, reserva)
  await redis.sadd('reservas', reserva.id)
  await redis.sadd(`excursao:${excursao.id}:reservas`, reserva.id)
  const valorTotal = valorTotalReserva(passageiros.length, excursao.valorPacote, desconto)
  return NextResponse.json({ ok: true, reserva, valorTotal })
}

export async function PUT(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const atual = await redis.get<Reserva>(`reserva:${b.id}`)
  if (!atual) return NextResponse.json({ error: 'não encontrada' }, { status: 404 })

  // Link público de seleção de poltrona (token + mapa reverso O(1)).
  if (b.gerarLink) {
    const token = atual.token || uuid().replace(/-/g, '').slice(0, 20)
    const atualizado = { ...atual, token }
    await redis.set(`reserva:${atual.id}`, atualizado)
    await redis.set(`reservatoken:${token}`, atual.id)
    return NextResponse.json({ ok: true, token, reserva: atualizado })
  }
  if (b.revogarLink) {
    if (atual.token) await redis.del(`reservatoken:${atual.token}`)
    const atualizado = { ...atual, token: undefined }
    await redis.set(`reserva:${atual.id}`, atualizado)
    return NextResponse.json({ ok: true, reserva: atualizado })
  }

  const r: Reserva = { ...atual }
  if (b.contratanteNome !== undefined) r.contratanteNome = String(b.contratanteNome).trim().slice(0, 120)
  if (b.contatoId !== undefined) r.contatoId = String(b.contatoId) || undefined
  if (b.vendedorEmail !== undefined) r.vendedorEmail = String(b.vendedorEmail) || undefined
  if (b.vendedorNome !== undefined) r.vendedorNome = String(b.vendedorNome).slice(0, 80) || undefined
  if (b.desconto !== undefined) r.desconto = Math.max(0, Number(b.desconto) || 0) || undefined
  if (b.cupomId !== undefined) r.cupomId = String(b.cupomId) || undefined
  if (b.observacoes !== undefined) r.observacoes = String(b.observacoes).slice(0, 800) || undefined
  if (b.status !== undefined && ['pre-reserva', 'confirmada', 'cancelada'].includes(b.status)) r.status = b.status
  if (b.financeiro !== undefined) r.financeiro = b.financeiro
  if (b.passageiros !== undefined) {
    const passageiros = limparPassageiros(b.passageiros)
    const excursao = await redis.get<Excursao>(`excursao:${r.excursaoId}`)
    if (excursao) {
      const erro = await validarPoltronas(excursao, passageiros, r.id)
      if (erro) return NextResponse.json({ error: erro, conflito: true }, { status: 409 })
    }
    r.passageiros = passageiros
  }
  r.atualizadoEm = new Date().toISOString()
  await redis.set(`reserva:${r.id}`, r)
  return NextResponse.json({ ok: true, reserva: r })
}

export async function DELETE(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const r = await redis.get<Reserva>(`reserva:${id}`)
  await redis.del(`reserva:${id}`)
  await redis.srem('reservas', id)
  if (r) await redis.srem(`excursao:${r.excursaoId}:reservas`, id)
  return NextResponse.json({ ok: true })
}

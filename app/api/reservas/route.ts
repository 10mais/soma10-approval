import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Viagem, Veiculo } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { Reserva, Passageiro, poltronasOcupadas, poltronasEmConflito } from '@/lib/reservas'
import { valorDaReserva } from '@/lib/pacoteViagem'
import { poltronaExiste } from '@/lib/layoutVeiculo'
import { passageiroSalvavel } from '@/lib/manifesto'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Reservas de viagem. Regra crítica: JAMAIS duas pessoas na mesma poltrona.
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

const ymd = (s: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : undefined)

// Os dados do passageiro viram a LISTA do DAER/ANTT (ou a internacional), então
// são gravados por inteiro. A POLTRONA é opcional DE PROPÓSITO: o passageiro é
// cadastrado na venda; o assento é atribuído depois (a viagem pode nem ter veículo
// ainda). Exigir poltrona aqui trancava a reserva num beco sem saída.
function limparPassageiros(arr: any): Passageiro[] {
  if (!Array.isArray(arr)) return []
  return arr.map((p: any) => ({
    nome: String(p?.nome || '').trim().slice(0, 120),
    cpf: (p?.cpf || '').toString().slice(0, 20) || undefined,
    rg: (p?.rg || '').toString().slice(0, 20) || undefined,
    rgOrgao: (p?.rgOrgao || '').toString().slice(0, 20) || undefined,
    nascimento: ymd(p?.nascimento),
    passaporte: (p?.passaporte || '').toString().slice(0, 20) || undefined,
    passaporteValidade: ymd(p?.passaporteValidade),
    nacionalidade: (p?.nacionalidade || '').toString().slice(0, 40) || undefined,
    poltrona: (p?.poltrona || '').toString().trim() || undefined,
  })).filter(passageiroSalvavel).slice(0, 60)
}

// Valida assentos: existem no layout do ônibus da viagem e não conflitam com
// outras reservas ( nem repetem dentro da própria). Retorna erro (string) ou null.
async function validarPoltronas(viagem: Viagem, passageiros: Passageiro[], reservaId?: string): Promise<string | null> {
  const pedidas = passageiros.map(p => p.poltrona).filter(Boolean) as string[]
  if (!pedidas.length) return null // reserva sem poltrona definida ainda é permitida
  // Assentos existem no croqui do veículo?
  if (viagem.veiculoId) {
    const veiculo = await redis.get<Veiculo>(`veiculo:${viagem.veiculoId}`)
    const layout = veiculo?.layout
    if (layout) {
      const inexistente = pedidas.find(n => !poltronaExiste(layout, n))
      if (inexistente) return `Poltrona ${inexistente} não existe no croqui do veículo.`
    }
  }
  const ocupadas = poltronasOcupadas(await carregarTodas(), viagem.id, reservaId)
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
  const viagemId = req.nextUrl.searchParams.get('viagemId')
  let lista = await carregarTodas()
  if (viagemId) lista = lista.filter(r => r.viagemId === viagemId)
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
  const viagem = await redis.get<Viagem>(`viagem:${b.viagemId}`)
  if (!viagem) return NextResponse.json({ error: 'viagem não encontrada' }, { status: 400 })
  const contratanteNome = String(b.contratanteNome || '').trim()
  if (!contratanteNome) return NextResponse.json({ error: 'informe o contratante' }, { status: 400 })
  const passageiros = limparPassageiros(b.passageiros)
  if (!passageiros.length) return NextResponse.json({ error: 'informe ao menos um passageiro' }, { status: 400 })

  const erro = await validarPoltronas(viagem, passageiros)
  if (erro) return NextResponse.json({ error: erro, conflito: true }, { status: 409 })

  const agora = new Date().toISOString()
  const desconto = Math.max(0, Number(b.desconto) || 0)
  const reserva: Reserva = {
    id: uuid(),
    viagemId: viagem.id,
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
  await redis.sadd(`viagem:${viagem.id}:reservas`, reserva.id)
  const valorTotal = valorDaReserva(viagem, passageiros, desconto)
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
    const viagem = await redis.get<Viagem>(`viagem:${r.viagemId}`)
    if (viagem) {
      const erro = await validarPoltronas(viagem, passageiros, r.id)
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
  if (r) await redis.srem(`viagem:${r.viagemId}:reservas`, id)
  return NextResponse.json({ ok: true })
}

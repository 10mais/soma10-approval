import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Veiculo, CondicaoVeiculo, TipoVeiculo, ManutencaoVeiculo, DocumentoVeiculo, Excursao } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { LayoutVeiculo, validarLayout, layoutVazio, numerosPoltronas } from '@/lib/layoutVeiculo'
import { Reserva, poltronasOcupadas } from '@/lib/reservas'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// FROTA (turismo). Equipe lê; escrita exige CRM/editar.
// Cada veículo carrega o próprio croqui — a capacidade é contada dele, nunca
// digitada, para não divergir do mapa de poltronas das reservas.

const CONDICOES: CondicaoVeiculo[] = ['disponivel', 'ocupado', 'manutencao', 'excluido']
const TIPOS: TipoVeiculo[] = ['onibus', 'micro', 'van', 'carro']
const TIPOS_MANUT = ['preventiva', 'corretiva', 'revisao', 'pneu', 'oleo', 'outro']
const TIPOS_DOC = ['licenciamento', 'seguro', 'antt', 'outro']

const ymd = (s: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : undefined)
const hoje = () => new Date().toISOString().slice(0, 10)

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

async function carregarTodos(): Promise<Veiculo[]> {
  const ids = await redis.smembers('veiculos')
  if (!ids.length) return []
  return (await redis.mget<(Veiculo | null)[]>(...ids.map(i => `veiculo:${i}`))).filter(Boolean) as Veiculo[]
}

function limparManutencoes(arr: any, autor?: string): ManutencaoVeiculo[] {
  if (!Array.isArray(arr)) return []
  return arr.map((m: any) => ({
    id: String(m?.id || uuid()),
    data: ymd(m?.data) || hoje(),
    tipo: TIPOS_MANUT.includes(m?.tipo) ? m.tipo : 'outro',
    km: Number.isFinite(Number(m?.km)) && Number(m?.km) > 0 ? Number(m.km) : undefined,
    oficina: (m?.oficina || '').toString().trim().slice(0, 80) || undefined,
    custo: Number.isFinite(Number(m?.custo)) && Number(m?.custo) > 0 ? Number(m.custo) : undefined,
    descricao: (m?.descricao || '').toString().trim().slice(0, 500) || undefined,
    proximaData: ymd(m?.proximaData),
    proximoKm: Number.isFinite(Number(m?.proximoKm)) && Number(m?.proximoKm) > 0 ? Number(m.proximoKm) : undefined,
    criadoPor: (m?.criadoPor || autor || '').toString().slice(0, 80) || undefined,
    criadoEm: m?.criadoEm || new Date().toISOString(),
  })).slice(0, 300) as ManutencaoVeiculo[]
}

function limparDocumentos(arr: any): DocumentoVeiculo[] {
  if (!Array.isArray(arr)) return []
  return arr.map((d: any) => ({
    id: String(d?.id || uuid()),
    tipo: TIPOS_DOC.includes(d?.tipo) ? d.tipo : 'outro',
    numero: (d?.numero || '').toString().trim().slice(0, 40) || undefined,
    vencimento: ymd(d?.vencimento) || '',
    observacoes: (d?.observacoes || '').toString().trim().slice(0, 200) || undefined,
  })).filter((d: DocumentoVeiculo) => d.vencimento).slice(0, 50) as DocumentoVeiculo[]
}

// Poltronas VENDIDAS deste veículo em viagem que ainda não terminou. Apagar ou
// renumerar uma delas deixaria o passageiro sem assento — o croqui é a fonte da
// verdade do mapa de reservas.
async function poltronasVendidas(veiculoId: string): Promise<Map<string, string>> {
  const vendidas = new Map<string, string>() // poltrona -> título da viagem
  const ids = await redis.smembers('excursoes')
  if (!ids.length) return vendidas
  const excursoes = (await redis.mget<(Excursao | null)[]>(...ids.map(i => `excursao:${i}`))).filter(Boolean) as Excursao[]
  const ativas = excursoes.filter(e =>
    e.veiculoId === veiculoId && e.status !== 'cancelada' && (e.dataVolta || e.dataIda) >= hoje()
  )
  if (!ativas.length) return vendidas

  const rIds = await redis.smembers('reservas')
  if (!rIds.length) return vendidas
  const reservas = (await redis.mget<(Reserva | null)[]>(...rIds.map(i => `reserva:${i}`))).filter(Boolean) as Reserva[]
  for (const e of ativas) {
    for (const n of Array.from(poltronasOcupadas(reservas, e.id))) if (!vendidas.has(n)) vendidas.set(n, e.titulo)
  }
  return vendidas
}

export async function GET(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  // ?id= devolve o veículo + as poltronas já vendidas, para o editor de croqui
  // travar o que não pode ser apagado/renumerado (o PUT recusaria com 409).
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const veiculo = await redis.get<Veiculo>(`veiculo:${id}`)
    if (!veiculo) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
    const vendidas = await poltronasVendidas(id)
    return NextResponse.json({ veiculo, poltronasVendidas: Array.from(vendidas.keys()) })
  }

  const veiculos = (await carregarTodos()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
  return NextResponse.json({ veiculos })
}

export async function POST(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const nome = String(b.nome || '').trim()
  if (!nome) return NextResponse.json({ error: 'informe o nome do veículo' }, { status: 400 })

  const layout: LayoutVeiculo = b.layout || layoutVazio()
  const erros = validarLayout(layout)
  if (erros.length) return NextResponse.json({ error: erros.join(' '), erros }, { status: 400 })

  const agora = new Date().toISOString()
  const autor = session.user?.name || session.user?.email || undefined
  const veiculo: Veiculo = {
    id: uuid(),
    nome: nome.slice(0, 80),
    tipo: TIPOS.includes(b.tipo) ? b.tipo : 'onibus',
    placa: (b.placa || '').toString().trim().slice(0, 12) || undefined,
    layout,
    condicao: CONDICOES.includes(b.condicao) ? b.condicao : 'disponivel',
    amenidades: Array.isArray(b.amenidades) ? b.amenidades.map((a: any) => String(a).slice(0, 40)).filter(Boolean).slice(0, 20) : undefined,
    manutencoes: limparManutencoes(b.manutencoes, autor),
    documentos: limparDocumentos(b.documentos),
    observacoes: (b.observacoes || '').toString().slice(0, 500) || undefined,
    criadoPor: autor,
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`veiculo:${veiculo.id}`, veiculo)
  await redis.sadd('veiculos', veiculo.id)
  return NextResponse.json({ ok: true, veiculo })
}

export async function PUT(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const atual = await redis.get<Veiculo>(`veiculo:${b.id}`)
  if (!atual) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const v: Veiculo = { ...atual }
  if (b.nome !== undefined) {
    const nome = String(b.nome).trim()
    if (!nome) return NextResponse.json({ error: 'informe o nome do veículo' }, { status: 400 })
    v.nome = nome.slice(0, 80)
  }
  if (b.tipo !== undefined) v.tipo = TIPOS.includes(b.tipo) ? b.tipo : v.tipo
  if (b.placa !== undefined) v.placa = String(b.placa).trim().slice(0, 12) || undefined
  if (b.condicao !== undefined && CONDICOES.includes(b.condicao)) v.condicao = b.condicao
  if (Array.isArray(b.amenidades)) v.amenidades = b.amenidades.map((a: any) => String(a).slice(0, 40)).filter(Boolean).slice(0, 20)
  if (b.manutencoes !== undefined) v.manutencoes = limparManutencoes(b.manutencoes, session.user?.name || session.user?.email || undefined)
  if (b.documentos !== undefined) v.documentos = limparDocumentos(b.documentos)
  if (b.observacoes !== undefined) v.observacoes = String(b.observacoes).slice(0, 500) || undefined

  if (b.layout !== undefined) {
    const layout: LayoutVeiculo = b.layout
    const erros = validarLayout(layout)
    if (erros.length) return NextResponse.json({ error: erros.join(' '), erros }, { status: 400 })

    // Trava: poltrona vendida em viagem que ainda não terminou não pode sumir do croqui.
    const antes = new Set(numerosPoltronas(atual.layout || layoutVazio()))
    const depois = new Set(numerosPoltronas(layout))
    const sumiram = Array.from(antes).filter(n => !depois.has(n))
    if (sumiram.length) {
      const vendidas = await poltronasVendidas(atual.id)
      const conflitos = sumiram.filter(n => vendidas.has(n)).map(n => ({ poltrona: n, viagem: vendidas.get(n)! }))
      if (conflitos.length) {
        const txt = conflitos.map(c => `${c.poltrona} (${c.viagem})`).join(', ')
        return NextResponse.json({
          error: `Não dá para remover ou renumerar poltrona já vendida: ${txt}. Cancele a reserva antes de mexer no croqui.`,
          conflitos,
        }, { status: 409 })
      }
    }
    v.layout = layout
  }

  v.atualizadoEm = new Date().toISOString()
  await redis.set(`veiculo:${v.id}`, v)
  return NextResponse.json({ ok: true, veiculo: v })
}

export async function DELETE(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  // Veículo com poltrona vendida em viagem ativa não some — vira 'excluido' na tela.
  const vendidas = await poltronasVendidas(String(id))
  if (vendidas.size) {
    return NextResponse.json({
      error: 'Este veículo tem reserva em viagem que ainda não aconteceu. Use a condição "Excluído" para tirá-lo de circulação sem perder o histórico.',
    }, { status: 409 })
  }
  await redis.del(`veiculo:${id}`)
  await redis.srem('veiculos', id)
  return NextResponse.json({ ok: true })
}

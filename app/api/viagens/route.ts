import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Viagem, MotoristaViagem, ParadaRoteiro, TipoViagem, PacoteViagem, Veiculo } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { copiarPacoteParaViagem } from '@/lib/pacoteViagem'
import { normalizarLayout, poltronaExiste, LayoutVeiculo } from '@/lib/layoutVeiculo'
import { Reserva, poltronasOcupadas } from '@/lib/reservas'
import { v4 as uuid } from 'uuid'

// Tira a CÓPIA do croqui do veículo. A viagem não lê o croqui ao vivo: reformar o
// carro não pode mudar o mapa de quem já comprou.
async function snapDoVeiculo(veiculoId?: string): Promise<LayoutVeiculo | undefined> {
  if (!veiculoId) return undefined
  const v = await redis.get<Veiculo>(`veiculo:${veiculoId}`)
  return v ? normalizarLayout(v.layout) : undefined
}

// Poltronas já vendidas nesta viagem (reservas não canceladas).
async function vendidasNaViagem(viagemId: string): Promise<string[]> {
  const ids = await redis.smembers('reservas')
  if (!ids.length) return []
  const reservas = (await redis.mget<(Reserva | null)[]>(...ids.map(i => `reserva:${i}`))).filter(Boolean) as Reserva[]
  return Array.from(poltronasOcupadas(reservas, viagemId))
}

export const runtime = 'nodejs'

// VIAGENS (turismo): uma saída com veículo, motoristas, valor e inclusos.
// Equipe lê; escrita exige CRM/editar.
//
// Dois negócios: 'pacote' cobra POR CLIENTE (× passageiros, com mapa de poltronas)
// e 'fretamento' é o veículo inteiro por valor FECHADO. Ver lib/pacoteViagem.ts.

const STATUS = ['planejada', 'aberta', 'realizada', 'cancelada']
const TIPOS: TipoViagem[] = ['pacote', 'fretamento']

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

async function carregarTodas(): Promise<Viagem[]> {
  const ids = await redis.smembers('viagens')
  if (!ids.length) return []
  return (await redis.mget<(Viagem | null)[]>(...ids.map(i => `viagem:${i}`))).filter(Boolean) as Viagem[]
}

function limparMotoristas(arr: any): MotoristaViagem[] {
  if (!Array.isArray(arr)) return []
  return arr.map((m: any) => ({
    nome: String(m?.nome || '').trim().slice(0, 80),
    cpf: (m?.cpf || '').toString().slice(0, 20) || undefined,
    cnh: (m?.cnh || '').toString().slice(0, 20) || undefined,
    email: (m?.email || '').toString().slice(0, 120) || undefined,
  })).filter(m => m.nome).slice(0, 6)
}
function limparInclusos(arr: any): string[] {
  if (!Array.isArray(arr)) return []
  return arr.map((s: any) => String(s).trim().slice(0, 120)).filter(Boolean).slice(0, 40)
}
const dataOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
const horaOk = (s: string) => /^\d{2}:\d{2}$/.test(s)
function limparParadas(arr: any): ParadaRoteiro[] {
  if (!Array.isArray(arr)) return []
  return arr.map((p: any) => ({
    id: String(p?.id || uuid()),
    data: dataOk(String(p?.data || '')) ? String(p.data) : '',
    hora: horaOk(String(p?.hora || '')) ? String(p.hora) : undefined,
    titulo: String(p?.titulo || '').trim().slice(0, 120),
    local: (p?.local || '').toString().slice(0, 120) || undefined,
    tipo: (p?.tipo || '').toString().slice(0, 20) || undefined,
    observacoes: (p?.observacoes || '').toString().slice(0, 300) || undefined,
  })).filter(p => p.data && p.titulo).slice(0, 100)
}

export async function GET(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const v = await redis.get<Viagem>(`viagem:${id}`)
    return v ? NextResponse.json(v) : NextResponse.json({ error: 'não encontrada' }, { status: 404 })
  }
  const viagens = (await carregarTodas()).sort((a, b) => (a.dataIda || '').localeCompare(b.dataIda || ''))
  return NextResponse.json({ viagens })
}

export async function POST(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const dataIda = String(b.dataIda || '')
  if (!dataOk(dataIda)) return NextResponse.json({ error: 'informe a data de ida' }, { status: 400 })
  const tipo: TipoViagem = TIPOS.includes(b.tipo) ? b.tipo : 'pacote'

  // Nascer de um pacote = COPIAR o modelo (com o roteiro já em datas reais). O
  // que vier no corpo tem prioridade: a tela pode ter ajustado antes de salvar.
  let doPacote: Partial<Viagem> = {}
  if (tipo === 'pacote' && b.pacoteId) {
    const pacote = await redis.get<PacoteViagem>(`pacoteviagem:${b.pacoteId}`)
    if (!pacote) return NextResponse.json({ error: 'pacote não encontrado' }, { status: 400 })
    doPacote = copiarPacoteParaViagem(pacote as any, dataIda, () => uuid()) as Partial<Viagem>
  }

  const titulo = String(b.titulo ?? doPacote.titulo ?? '').trim()
  if (!titulo) return NextResponse.json({ error: 'informe o título da viagem' }, { status: 400 })
  if (tipo === 'fretamento' && !String(b.contratante || '').trim()) {
    return NextResponse.json({ error: 'no fretamento, informe quem contratou o veículo' }, { status: 400 })
  }

  const agora = new Date().toISOString()
  const viagem: Viagem = {
    id: uuid(),
    titulo: titulo.slice(0, 140),
    tipo,
    pacoteId: tipo === 'pacote' ? (b.pacoteId || undefined) : undefined,
    roteiro: (b.roteiro ?? doPacote.roteiro ?? '').toString().slice(0, 500) || undefined,
    internacional: !!b.internacional,
    dataIda,
    dataVolta: dataOk(String(b.dataVolta || '')) ? String(b.dataVolta) : (doPacote.dataVolta || undefined),
    horaSaida: horaOk(String(b.horaSaida || '')) ? String(b.horaSaida) : undefined,
    horaRetorno: horaOk(String(b.horaRetorno || '')) ? String(b.horaRetorno) : undefined,
    veiculoId: (b.veiculoId || '').toString() || undefined,
    layoutSnap: await snapDoVeiculo((b.veiculoId || '').toString() || undefined),
    motoristas: limparMotoristas(b.motoristas),
    // Fretamento não cobra por cliente: valorPacote fica zerado de propósito.
    valorPacote: tipo === 'fretamento' ? 0 : Math.max(0, Number(b.valorPacote ?? doPacote.valorPacote) || 0),
    precos: tipo === 'fretamento' ? undefined : (b.precos ?? doPacote.precos),
    hoteis: b.hoteis ?? doPacote.hoteis ?? [],
    valorFechado: tipo === 'fretamento' ? Math.max(0, Number(b.valorFechado) || 0) : undefined,
    contratante: tipo === 'fretamento' ? String(b.contratante).trim().slice(0, 140) : undefined,
    descontoPadrao: b.descontoPadrao ? Math.max(0, Number(b.descontoPadrao)) : undefined,
    inclusos: b.inclusos !== undefined ? limparInclusos(b.inclusos) : (doPacote.inclusos || []),
    paradas: b.paradas !== undefined ? limparParadas(b.paradas) : (doPacote.paradas || []),
    status: STATUS.includes(b.status) ? b.status : 'aberta',
    observacoes: (b.observacoes ?? doPacote.observacoes ?? '').toString().slice(0, 800) || undefined,
    criadoPor: session.user?.name || session.user?.email || undefined,
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`viagem:${viagem.id}`, viagem)
  await redis.sadd('viagens', viagem.id)
  return NextResponse.json({ ok: true, viagem })
}

export async function PUT(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const atual = await redis.get<Viagem>(`viagem:${b.id}`)
  if (!atual) return NextResponse.json({ error: 'não encontrada' }, { status: 404 })
  const v: Viagem = { ...atual }
  if (b.titulo !== undefined) v.titulo = String(b.titulo).trim().slice(0, 140)
  if (b.tipo !== undefined && TIPOS.includes(b.tipo)) v.tipo = b.tipo
  if (b.roteiro !== undefined) v.roteiro = String(b.roteiro).slice(0, 500) || undefined
  if (b.internacional !== undefined) v.internacional = !!b.internacional
  if (b.dataIda !== undefined && dataOk(String(b.dataIda))) v.dataIda = String(b.dataIda)
  if (b.dataVolta !== undefined) v.dataVolta = dataOk(String(b.dataVolta)) ? String(b.dataVolta) : undefined
  if (b.horaSaida !== undefined) v.horaSaida = horaOk(String(b.horaSaida)) ? String(b.horaSaida) : undefined
  if (b.horaRetorno !== undefined) v.horaRetorno = horaOk(String(b.horaRetorno)) ? String(b.horaRetorno) : undefined
  // Trocar o veículo re-tira o snapshot. Se a poltrona já vendida não existir no
  // croqui novo, RECUSA: o passageiro compraria um assento que sumiu.
  if (b.veiculoId !== undefined) {
    const novoId = String(b.veiculoId) || undefined
    if (novoId !== atual.veiculoId) {
      const snap = await snapDoVeiculo(novoId)
      const vendidas = await vendidasNaViagem(atual.id)
      if (snap && vendidas.length) {
        const somem = vendidas.filter(n => !poltronaExiste(snap, n))
        if (somem.length) {
          return NextResponse.json({
            error: `Este veículo não tem a(s) poltrona(s) ${somem.join(', ')}, que já está(ão) vendida(s) nesta viagem. Cancele essas reservas antes de trocar o veículo.`,
          }, { status: 409 })
        }
      }
      v.veiculoId = novoId
      v.layoutSnap = snap
    }
  }
  // Re-tirar o snapshot de propósito: veículo reformado depois que a viagem foi
  // montada, e o dono quer o croqui novo (só passa se nada vendido sumir).
  if (b.resnaparCroqui && v.veiculoId) {
    const snap = await snapDoVeiculo(v.veiculoId)
    const vendidas = await vendidasNaViagem(atual.id)
    const somem = snap ? vendidas.filter(n => !poltronaExiste(snap, n)) : []
    if (somem.length) {
      return NextResponse.json({ error: `O croqui novo não tem a(s) poltrona(s) ${somem.join(', ')}, já vendida(s). Cancele essas reservas antes.` }, { status: 409 })
    }
    v.layoutSnap = snap
  }
  if (b.motoristas !== undefined) v.motoristas = limparMotoristas(b.motoristas)
  if (b.valorPacote !== undefined) v.valorPacote = Math.max(0, Number(b.valorPacote) || 0)
  if (b.precos !== undefined) v.precos = b.precos || undefined
  if (b.hoteis !== undefined) v.hoteis = Array.isArray(b.hoteis) ? b.hoteis : []
  if (b.valorFechado !== undefined) v.valorFechado = Math.max(0, Number(b.valorFechado) || 0)
  if (b.contratante !== undefined) v.contratante = String(b.contratante).trim().slice(0, 140) || undefined
  if (b.descontoPadrao !== undefined) v.descontoPadrao = b.descontoPadrao ? Math.max(0, Number(b.descontoPadrao)) : undefined
  if (b.inclusos !== undefined) v.inclusos = limparInclusos(b.inclusos)
  if (b.paradas !== undefined) v.paradas = limparParadas(b.paradas)
  if (b.status !== undefined && STATUS.includes(b.status)) v.status = b.status
  if (b.observacoes !== undefined) v.observacoes = String(b.observacoes).slice(0, 800) || undefined

  // Coerência do tipo: virar fretamento zera o valor por cliente e exige
  // contratante; virar pacote descarta o valor fechado. Sem isto, um campo do
  // tipo antigo fica pendurado e o valor da reserva sai errado.
  if (v.tipo === 'fretamento') {
    if (!v.contratante) return NextResponse.json({ error: 'no fretamento, informe quem contratou o veículo' }, { status: 400 })
    v.valorPacote = 0
    v.pacoteId = undefined
    v.precos = undefined
  } else {
    v.valorFechado = undefined
    v.contratante = undefined
  }

  v.atualizadoEm = new Date().toISOString()
  await redis.set(`viagem:${v.id}`, v)
  return NextResponse.json({ ok: true, viagem: v })
}

export async function DELETE(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`viagem:${id}`)
  await redis.srem('viagens', id)
  return NextResponse.json({ ok: true })
}

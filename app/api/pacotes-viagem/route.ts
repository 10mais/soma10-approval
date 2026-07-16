import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, PacoteViagem, ParadaModelo, HotelPacote, PrecosViagem, FormaPagamento, DespesaViagem } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { diasENoites } from '@/lib/pacoteViagem'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// PACOTES DE VIAGEM (turismo): o modelo reutilizável que a Viagem copia.
// Equipe lê; escrita exige CRM/editar.
//
// ⚠️ Rota separada de `/api/pacotes` DE PROPÓSITO — aquela é pacote de TRATAMENTO
// da clínica (sessões/saldo). Nomes iguais, negócios diferentes.
//
// O roteiro daqui é em DIA RELATIVO (1 = dia da ida): o mesmo pacote sai em julho
// e em dezembro. A conversão para data real acontece ao criar a viagem.

const horaOk = (s: string) => /^\d{2}:\d{2}$/.test(s)
const ymd = (s: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : undefined)
const hhmm = (s: any) => (horaOk(String(s || '')) ? String(s) : undefined)
const FORMAS: FormaPagamento[] = ['pix', 'cartao', 'boleto', 'dinheiro', 'transferencia']

function limparHoteis(arr: any): HotelPacote[] {
  if (!Array.isArray(arr)) return []
  return arr.map((h: any) => ({
    id: String(h?.id || uuid()),
    nome: String(h?.nome || '').trim().slice(0, 120),
    checkinDia: Number.isFinite(Number(h?.checkinDia)) && Number(h?.checkinDia) >= 1 ? Math.floor(Number(h.checkinDia)) : undefined,
    checkinHora: hhmm(h?.checkinHora),
    checkoutDia: Number.isFinite(Number(h?.checkoutDia)) && Number(h?.checkoutDia) >= 1 ? Math.floor(Number(h.checkoutDia)) : undefined,
    checkoutHora: hhmm(h?.checkoutHora),
  })).filter((h: HotelPacote) => h.nome).slice(0, 20)
}

// Só a TABELA de preço. Entrada/parcelas do corpo são ignoradas de propósito:
// negociação é da Reserva (por contratante), não do produto.
function limparPrecos(o: any): PrecosViagem | undefined {
  if (!o || typeof o !== 'object') return undefined
  const n = (v: any) => (v === undefined || v === null || v === '' ? undefined : Math.max(0, Number(v) || 0))
  const p: PrecosViagem = {
    valorCrianca: n(o.valorCrianca),
    valorMeia: n(o.valorMeia),
    formasAceitas: Array.isArray(o.formasAceitas) ? o.formasAceitas.filter((f: any) => FORMAS.includes(f)) : undefined,
  }
  return Object.values(p).some(v => v !== undefined && !(Array.isArray(v) && !v.length)) ? p : undefined
}

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

async function carregarTodos(): Promise<PacoteViagem[]> {
  const ids = await redis.smembers('pacotesviagem')
  if (!ids.length) return []
  return (await redis.mget<(PacoteViagem | null)[]>(...ids.map(i => `pacoteviagem:${i}`))).filter(Boolean) as PacoteViagem[]
}

function limparRoteiro(arr: any): ParadaModelo[] {
  if (!Array.isArray(arr)) return []
  return arr.map((p: any) => ({
    id: String(p?.id || uuid()),
    dia: Math.max(1, Math.floor(Number(p?.dia) || 1)),
    hora: horaOk(String(p?.hora || '')) ? String(p.hora) : undefined,
    titulo: String(p?.titulo || '').trim().slice(0, 120),
    local: (p?.local || '').toString().slice(0, 120) || undefined,
    tipo: (p?.tipo || '').toString().slice(0, 20) || undefined,
    observacoes: (p?.observacoes || '').toString().slice(0, 300) || undefined,
  })).filter((p: ParadaModelo) => p.titulo).slice(0, 100)
}
function limparLista(arr: any, max = 40): string[] {
  if (!Array.isArray(arr)) return []
  return arr.map((s: any) => String(s).trim().slice(0, 120)).filter(Boolean).slice(0, max)
}
const numOpc = (v: any) => (v === undefined || v === null || v === '' ? undefined : Math.max(0, Number(v) || 0))
// Passageiros/margens: inteiro ≥ 1 e % ≥ 0. Vazio = não usa a precificação.
const intOpc = (v: any) => { const n = numOpc(v); return n !== undefined && n >= 1 ? Math.floor(n) : undefined }

// Despesas previstas (precificação/break-even). Linha sem descrição E sem valor
// é lixo de formulário — cai fora.
function limparDespesas(arr: any): DespesaViagem[] {
  if (!Array.isArray(arr)) return []
  return arr.map((d: any) => ({
    id: String(d?.id || uuid()),
    descricao: String(d?.descricao || '').trim().slice(0, 120),
    valor: Math.max(0, Number(d?.valor) || 0),
  })).filter((d: DespesaViagem) => d.descricao || d.valor > 0).slice(0, 60)
}

export async function GET(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const p = await redis.get<PacoteViagem>(`pacoteviagem:${id}`)
    return p ? NextResponse.json(p) : NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  }
  const pacotes = (await carregarTodos()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
  return NextResponse.json({ pacotes })
}

export async function POST(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const nome = String(b.nome || '').trim()
  if (!nome) return NextResponse.json({ error: 'informe o nome do pacote' }, { status: 400 })

  // Dias/noites são CALCULADOS das datas de referência — nunca do que veio no
  // corpo. Deixar digitar geraria "3 dias" numa viagem de 20 a 25/07.
  const dataIdaRef = ymd(b.dataIdaRef)
  const dataVoltaRef = ymd(b.dataVoltaRef)
  const dn = diasENoites(dataIdaRef, dataVoltaRef)

  const agora = new Date().toISOString()
  const pacote: PacoteViagem = {
    id: uuid(),
    nome: nome.slice(0, 140),
    destino: (b.destino || '').toString().slice(0, 140) || undefined,
    dataIdaRef,
    dataVoltaRef,
    horaSaida: hhmm(b.horaSaida),
    horaRetorno: hhmm(b.horaRetorno),
    dias: dn.dias,
    noites: dn.noites,
    valorBase: Math.max(0, Number(b.valorBase) || 0),
    precos: limparPrecos(b.precos),
    inclusos: limparLista(b.inclusos),
    roteiroPadrao: limparRoteiro(b.roteiroPadrao),
    hoteis: limparHoteis(b.hoteis),
    despesas: limparDespesas(b.despesas),
    passageirosPrevistos: intOpc(b.passageirosPrevistos),
    margemAceitavel: numOpc(b.margemAceitavel),
    margemIdeal: numOpc(b.margemIdeal),
    observacoes: (b.observacoes || '').toString().slice(0, 800) || undefined,
    ativo: b.ativo !== false,
    criadoPor: session.user?.name || session.user?.email || undefined,
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`pacoteviagem:${pacote.id}`, pacote)
  await redis.sadd('pacotesviagem', pacote.id)
  return NextResponse.json({ ok: true, pacote })
}

export async function PUT(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const atual = await redis.get<PacoteViagem>(`pacoteviagem:${b.id}`)
  if (!atual) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const p: PacoteViagem = { ...atual }
  if (b.nome !== undefined) {
    const nome = String(b.nome).trim()
    if (!nome) return NextResponse.json({ error: 'informe o nome do pacote' }, { status: 400 })
    p.nome = nome.slice(0, 140)
  }
  if (b.destino !== undefined) p.destino = String(b.destino).slice(0, 140) || undefined
  if (b.dataIdaRef !== undefined) p.dataIdaRef = ymd(b.dataIdaRef)
  if (b.dataVoltaRef !== undefined) p.dataVoltaRef = ymd(b.dataVoltaRef)
  if (b.horaSaida !== undefined) p.horaSaida = hhmm(b.horaSaida)
  if (b.horaRetorno !== undefined) p.horaRetorno = hhmm(b.horaRetorno)
  // Recalcula sempre: dias/noites nunca vêm do corpo (ver POST).
  const dn = diasENoites(p.dataIdaRef, p.dataVoltaRef)
  p.dias = dn.dias
  p.noites = dn.noites
  if (b.valorBase !== undefined) p.valorBase = Math.max(0, Number(b.valorBase) || 0)
  if (b.precos !== undefined) p.precos = limparPrecos(b.precos)
  if (b.inclusos !== undefined) p.inclusos = limparLista(b.inclusos)
  if (b.roteiroPadrao !== undefined) p.roteiroPadrao = limparRoteiro(b.roteiroPadrao)
  if (b.hoteis !== undefined) p.hoteis = limparHoteis(b.hoteis)
  if (b.despesas !== undefined) p.despesas = limparDespesas(b.despesas)
  if (b.passageirosPrevistos !== undefined) p.passageirosPrevistos = intOpc(b.passageirosPrevistos)
  if (b.margemAceitavel !== undefined) p.margemAceitavel = numOpc(b.margemAceitavel)
  if (b.margemIdeal !== undefined) p.margemIdeal = numOpc(b.margemIdeal)
  if (b.observacoes !== undefined) p.observacoes = String(b.observacoes).slice(0, 800) || undefined
  if (b.ativo !== undefined) p.ativo = !!b.ativo
  p.atualizadoEm = new Date().toISOString()
  await redis.set(`pacoteviagem:${p.id}`, p)
  // Sem propagação para as viagens: elas COPIARAM o modelo. Corrigir o preço aqui
  // não pode reescrever viagem já vendida.
  return NextResponse.json({ ok: true, pacote: p })
}

export async function DELETE(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  // Viagens que nasceram deste pacote continuam inteiras (copiaram tudo); só
  // perdem o ponteiro de origem. Por isso excluir aqui é seguro.
  await redis.del(`pacoteviagem:${id}`)
  await redis.srem('pacotesviagem', id)
  return NextResponse.json({ ok: true })
}

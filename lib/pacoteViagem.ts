// Pacote de viagem (modelo) → Viagem (saída real), e o valor de uma reserva.
// Puro, client-safe, testável — mesma convenção de lib/reservas.ts.
//
// Duas regras que, se erradas, cobram o valor errado do cliente:
//
// 1. DIA RELATIVO → DATA REAL. O modelo guarda "Dia 1, Dia 2" porque o mesmo
//    pacote sai em julho e em dezembro. Dia 1 = data da ida.
// 2. FRETAMENTO ≠ PACOTE. Pacote cobra POR CLIENTE (× passageiros); fretamento é
//    o veículo inteiro por um valor FECHADO. Aplicar a regra do pacote num
//    fretamento de 40 lugares cobraria 40× o combinado.
//
// Tipos estruturais (não importa lib/redis, que abre conexão no import).

export type ParadaModeloLite = {
  id: string
  dia: number
  hora?: string
  titulo: string
  local?: string
  tipo?: string
  observacoes?: string
}

export type ParadaRoteiroLite = {
  id: string
  data: string // YYYY-MM-DD
  hora?: string
  titulo: string
  local?: string
  tipo?: string
  observacoes?: string
}

export type HotelLite = {
  id: string
  nome: string
  checkinDia?: number
  checkinHora?: string
  checkoutDia?: number
  checkoutHora?: string
}

// Tabela de preço do produto. Entrada/parcelamento são NEGOCIAÇÃO e vivem em
// Reserva.financeiro (por contratante) — ver lib/financeiroReserva.
export type PrecosLite = {
  valorCrianca?: number
  valorMeia?: number
  formasAceitas?: string[]
}

// Despesa prevista (combustível, pedágio…) — alimenta o break-even em
// lib/precificacaoViagem. A viagem COPIA as despesas do pacote e ajusta as suas.
export type DespesaLite = {
  id: string
  descricao: string
  valor: number
}

export type PacoteLite = {
  id: string
  nome: string
  destino?: string
  dataIdaRef?: string
  dataVoltaRef?: string
  horaSaida?: string
  horaRetorno?: string
  dias?: number
  valorBase: number
  precos?: PrecosLite
  inclusos?: string[]
  roteiroPadrao?: ParadaModeloLite[]
  hoteis?: HotelLite[]
  despesas?: DespesaLite[]
  passageirosPrevistos?: number
  observacoes?: string
}

export type ViagemLite = {
  tipo?: 'pacote' | 'fretamento'
  valorPacote?: number
  precos?: PrecosLite
  valorFechado?: number
}

export type PaxLite = { faixa?: 'adulto' | 'crianca' | 'meia' }

// A matemática de data mora em lib/datas (casa canônica). Reexportado porque a
// tela e os testes já importam `somarDias` daqui.
export { somarDias } from './datas'
import { somarDias, diasEntre, ehData } from './datas'

// Data de volta sugerida: dias=3 a partir de 20/07 → 22/07 (ida conta como dia 1).
export function dataVoltaSugerida(dataIda: string, dias?: number): string | undefined {
  if (!ehData(dataIda) || !dias || dias < 1) return undefined
  return somarDias(dataIda, dias - 1)
}

// ── Dia relativo ↔ data real ─────────────────────────────────────────────────
// A tela mostra CALENDÁRIO (data de verdade); o pacote guarda DIA RELATIVO. É o
// que concilia as duas coisas: preencher data é natural, e guardar relativo é o
// que faz o mesmo pacote sair em julho e em dezembro sem recadastro.

// Dia 1 = data da ida. Sem ida de referência não há âncora — devolve ''.
export function diaParaData(dataIda: string | undefined, dia: number | undefined): string {
  if (!ehData(dataIda) || !dia || dia < 1) return ''
  return somarDias(dataIda!, dia - 1)
}

// Volta da data escolhida para o dia relativo. Data antes da ida seria dia < 1:
// devolve undefined em vez de inventar dia zero ou negativo.
export function dataParaDia(dataIda: string | undefined, data: string | undefined): number | undefined {
  if (!ehData(dataIda) || !ehData(data)) return undefined
  const dias = diasEntre(dataIda!, data!)
  return dias < 0 ? undefined : dias + 1
}

// Dias e noites a partir das datas — o dono preenche ida/volta e o sistema conta.
// A IDA CONTA COMO DIA 1 (20→22/07 = 3 dias, 2 noites), que é como o mercado
// anuncia "3 dias / 2 noites". Volta antes da ida = inválido, devolve nada.
export function diasENoites(dataIda?: string, dataVolta?: string): { dias?: number; noites?: number } {
  if (!ehData(dataIda)) return {}
  if (!ehData(dataVolta)) return { dias: 1, noites: 0 } // bate-volta
  const noites = diasEntre(dataIda!, dataVolta!)
  if (noites < 0) return {}
  return { dias: noites + 1, noites }
}

// Roteiro do modelo → paradas com data real. Dia 1 = ida.
// `id` novo por parada: a viagem é dona das suas paradas (editar uma não pode
// mexer no modelo, e duas viagens do mesmo pacote não podem colidir de id).
export function materializarRoteiro(
  roteiroPadrao: ParadaModeloLite[] | undefined,
  dataIda: string,
  novoId: (i: number) => string,
): ParadaRoteiroLite[] {
  if (!roteiroPadrao?.length || !ehData(dataIda)) return []
  return roteiroPadrao
    .filter(p => Number.isFinite(p.dia) && p.dia >= 1)
    .sort((a, b) => a.dia - b.dia || (a.hora || '').localeCompare(b.hora || ''))
    .map((p, i) => ({
      id: novoId(i),
      data: somarDias(dataIda, p.dia - 1),
      ...(p.hora ? { hora: p.hora } : {}),
      titulo: p.titulo,
      ...(p.local ? { local: p.local } : {}),
      ...(p.tipo ? { tipo: p.tipo } : {}),
      ...(p.observacoes ? { observacoes: p.observacoes } : {}),
    }))
}

// O que a Viagem herda ao nascer de um pacote. COPIA — não é vínculo vivo.
export type CopiaDoPacote = {
  titulo: string
  roteiro?: string
  dataVolta?: string
  horaSaida?: string
  horaRetorno?: string
  valorPacote: number
  precos?: PrecosLite
  inclusos: string[]
  hoteis: HotelLite[]
  despesas: DespesaLite[]
  paradas: ParadaRoteiroLite[]
  pacoteId: string
  observacoes?: string
}

export function copiarPacoteParaViagem(pacote: PacoteLite, dataIda: string, novoId: (i: number) => string): CopiaDoPacote {
  const volta = dataVoltaSugerida(dataIda, pacote.dias)
  return {
    titulo: pacote.nome,
    ...(pacote.destino ? { roteiro: pacote.destino } : {}),
    ...(volta ? { dataVolta: volta } : {}),
    ...(pacote.horaSaida ? { horaSaida: pacote.horaSaida } : {}),
    ...(pacote.horaRetorno ? { horaRetorno: pacote.horaRetorno } : {}),
    valorPacote: pacote.valorBase || 0,
    // Cópia profunda dos preços: mexer no valor da viagem não pode voltar no modelo.
    ...(pacote.precos ? { precos: { ...pacote.precos, formasAceitas: [...(pacote.precos.formasAceitas || [])] } } : {}),
    inclusos: [...(pacote.inclusos || [])],
    hoteis: (pacote.hoteis || []).map(h => ({ ...h })),
    despesas: (pacote.despesas || []).map(d => ({ ...d })),
    paradas: materializarRoteiro(pacote.roteiroPadrao, dataIda, novoId),
    pacoteId: pacote.id,
    ...(pacote.observacoes ? { observacoes: pacote.observacoes } : {}),
  }
}

// Preço de UM passageiro, pela faixa dele. Criança/meia sem valor próprio caem no
// valor de adulto — é o comportamento seguro: cobra o cheio em vez de dar de graça
// por um campo que ninguém preencheu.
export function precoDaFaixa(viagem: ViagemLite, faixa?: string): number {
  const adulto = viagem?.valorPacote || 0
  if (faixa === 'crianca') return viagem?.precos?.valorCrianca ?? adulto
  if (faixa === 'meia') return viagem?.precos?.valorMeia ?? adulto
  return adulto
}

// Valor de UMA reserva. Dois cortes moram aqui:
//  1. FRETAMENTO x PACOTE — fretamento é valor FECHADO, o nº de passageiros não
//     multiplica nada. Errar isso cobra 40× num ônibus de 40 lugares.
//  2. FAIXA — no pacote, cada passageiro custa pelo que ele é (adulto/criança/
//     meia). Somar × valor único cobraria criança como adulto.
// Aceita a lista de passageiros OU só a quantidade (nesse caso, todos adultos).
export function valorDaReserva(viagem: ViagemLite, passageiros: PaxLite[] | number, desconto = 0): number {
  if (viagem?.tipo === 'fretamento') return Math.max(0, (viagem.valorFechado || 0) - (desconto || 0))
  const bruto = typeof passageiros === 'number'
    ? (passageiros || 0) * (viagem?.valorPacote || 0)
    : (passageiros || []).reduce((s, p) => s + precoDaFaixa(viagem, p?.faixa), 0)
  return Math.max(0, bruto - (desconto || 0))
}

// Fretamento não vende poltrona: o contratante leva o veículo inteiro. A tela usa
// isto para esconder o mapa, e as regras de unicidade de poltrona ficam inertes.
export function vendePoltrona(viagem: ViagemLite): boolean {
  return viagem?.tipo !== 'fretamento'
}

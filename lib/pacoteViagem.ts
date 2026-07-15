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

export type PrecosLite = {
  valorCrianca?: number
  valorMeia?: number
  entrada?: number
  parcelas?: number
  valorParcela?: number
  formasAceitas?: string[]
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
  observacoes?: string
}

export type ViagemLite = {
  tipo?: 'pacote' | 'fretamento'
  valorPacote?: number
  precos?: PrecosLite
  valorFechado?: number
}

export type PaxLite = { faixa?: 'adulto' | 'crianca' | 'meia' }

const ehData = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

// Soma dias a uma data YYYY-MM-DD. Meia-noite local nos dois lados: usar UTC aqui
// erraria o dia em fuso negativo (o Brasil inteiro).
export function somarDias(ymd: string, dias: number): string {
  const d = new Date(ymd + 'T00:00')
  d.setDate(d.getDate() + dias)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// Data de volta sugerida: dias=3 a partir de 20/07 → 22/07 (ida conta como dia 1).
export function dataVoltaSugerida(dataIda: string, dias?: number): string | undefined {
  if (!ehData(dataIda) || !dias || dias < 1) return undefined
  return somarDias(dataIda, dias - 1)
}

// Dias e noites a partir das datas — o dono preenche ida/volta e o sistema conta.
// A IDA CONTA COMO DIA 1 (20→22/07 = 3 dias, 2 noites), que é como o mercado
// anuncia "3 dias / 2 noites". Volta antes da ida = inválido, devolve nada.
export function diasENoites(dataIda?: string, dataVolta?: string): { dias?: number; noites?: number } {
  if (!ehData(dataIda)) return {}
  if (!ehData(dataVolta)) return { dias: 1, noites: 0 } // bate-volta
  const noites = Math.round((new Date(dataVolta! + 'T00:00').getTime() - new Date(dataIda! + 'T00:00').getTime()) / 86400000)
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

// "R$ 500 + 10x de R$ 120" — o que a equipe fala ao cliente. Devolve '' quando o
// pacote não tem parcelamento configurado.
export function resumoParcelamento(p?: PrecosLite): string {
  if (!p) return ''
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const partes: string[] = []
  if (p.entrada) partes.push(`${brl(p.entrada)} de entrada`)
  if (p.parcelas && p.parcelas > 1 && p.valorParcela) partes.push(`${p.parcelas}x de ${brl(p.valorParcela)}`)
  else if (p.parcelas && p.parcelas > 1) partes.push(`em ${p.parcelas}x`)
  return partes.join(' + ')
}

// Fretamento não vende poltrona: o contratante leva o veículo inteiro. A tela usa
// isto para esconder o mapa, e as regras de unicidade de poltrona ficam inertes.
export function vendePoltrona(viagem: ViagemLite): boolean {
  return viagem?.tipo !== 'fretamento'
}

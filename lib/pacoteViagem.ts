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

export type PacoteLite = {
  id: string
  nome: string
  destino?: string
  dias?: number
  valorBase: number
  inclusos?: string[]
  roteiroPadrao?: ParadaModeloLite[]
  observacoes?: string
}

export type ViagemLite = {
  tipo?: 'pacote' | 'fretamento'
  valorPacote?: number
  valorFechado?: number
}

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
  valorPacote: number
  inclusos: string[]
  paradas: ParadaRoteiroLite[]
  pacoteId: string
  observacoes?: string
}

export function copiarPacoteParaViagem(pacote: PacoteLite, dataIda: string, novoId: (i: number) => string): CopiaDoPacote {
  return {
    titulo: pacote.nome,
    ...(pacote.destino ? { roteiro: pacote.destino } : {}),
    ...(dataVoltaSugerida(dataIda, pacote.dias) ? { dataVolta: dataVoltaSugerida(dataIda, pacote.dias)! } : {}),
    valorPacote: pacote.valorBase || 0,
    inclusos: [...(pacote.inclusos || [])],
    paradas: materializarRoteiro(pacote.roteiroPadrao, dataIda, novoId),
    pacoteId: pacote.id,
    ...(pacote.observacoes ? { observacoes: pacote.observacoes } : {}),
  }
}

// Valor de UMA reserva. É aqui que fretamento se separa de pacote.
// Fretamento: valor FECHADO da viagem, o nº de passageiros não multiplica nada.
// Pacote: valor por cliente × passageiros. Nunca negativo.
export function valorDaReserva(viagem: ViagemLite, numPax: number, desconto = 0): number {
  const bruto = viagem?.tipo === 'fretamento'
    ? (viagem.valorFechado || 0)
    : (numPax || 0) * (viagem?.valorPacote || 0)
  return Math.max(0, bruto - (desconto || 0))
}

// Fretamento não vende poltrona: o contratante leva o veículo inteiro. A tela usa
// isto para esconder o mapa, e as regras de unicidade de poltrona ficam inertes.
export function vendePoltrona(viagem: ViagemLite): boolean {
  return viagem?.tipo !== 'fretamento'
}

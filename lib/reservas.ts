// Reservas de viagem (client-safe, puro, testável). Uma Reserva pertence a uma
// Viagem, é feita por um contratante (contato) e agrupa N passageiros — cada um
// com sua POLTRONA nominal. Regra de ouro: JAMAIS dois passageiros na mesma
// poltrona de uma viagem (nem entre reservas, nem dentro da mesma reserva).
// O financeiro (parcelas/pagamentos) vive em `lib/financeiroReserva.ts`.

import { FinanceiroReserva } from './financeiroReserva'

export type Passageiro = {
  nome: string
  cpf?: string
  nascimento?: string   // YYYY-MM-DD
  poltrona?: string     // número da poltrona no layout do ônibus
}

export type StatusReserva = 'pre-reserva' | 'confirmada' | 'cancelada'

export type Reserva = {
  id: string
  viagemId: string
  contatoId?: string        // contratante (CrmContato)
  contratanteNome: string
  passageiros: Passageiro[]  // pode incluir o próprio contratante + acompanhantes
  vendedorEmail?: string
  vendedorNome?: string
  desconto?: number
  cupomId?: string
  observacoes?: string
  status: StatusReserva
  financeiro?: FinanceiroReserva
  token?: string           // link público p/ o cliente escolher poltrona (reservatoken:{token})
  criadoPor?: string
  criadoEm: string
  atualizadoEm: string
}

// Reserva ocupa a agenda de poltronas? (canceladas liberam os assentos.)
export function ocupaPoltrona(status?: StatusReserva): boolean {
  return status !== 'cancelada'
}

// Poltronas já ocupadas numa viagem (todas as reservas que ocupam, ignorando
// opcionalmente uma reserva — usado ao EDITAR a própria reserva).
export function poltronasOcupadas(reservas: Reserva[], viagemId: string, ignorarReservaId?: string): Set<string> {
  const set = new Set<string>()
  for (const r of reservas) {
    if (r.viagemId !== viagemId || !ocupaPoltrona(r.status)) continue
    if (ignorarReservaId && r.id === ignorarReservaId) continue
    for (const p of r.passageiros) if (p.poltrona) set.add(p.poltrona)
  }
  return set
}

// Poltronas EM CONFLITO das poltronas pedidas: já ocupadas por outra reserva OU
// repetidas dentro da própria lista. Vazio = pode reservar.
export function poltronasEmConflito(pedidas: string[], ocupadas: Set<string>): string[] {
  const conflitos: string[] = []
  const vistas = new Set<string>()
  for (const p of pedidas) {
    if (!p) continue
    if (ocupadas.has(p) || vistas.has(p)) conflitos.push(p)
    vistas.add(p)
  }
  return conflitos
}

// Valor bruto: nº de passageiros × valor do pacote − desconto (nunca negativo).
export function valorTotalReserva(numPax: number, valorPacote: number, desconto = 0): number {
  return Math.max(0, (numPax || 0) * (valorPacote || 0) - (desconto || 0))
}

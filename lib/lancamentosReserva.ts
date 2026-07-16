// Venda concretizada → Financeiro. Puro, client-safe, testável.
//
// A VENDA do turismo é a RESERVA: o valor combinado vira parcelas/pagamentos em
// Reserva.financeiro (lib/financeiroReserva). Este módulo traduz esse financeiro
// em LANÇAMENTOS do Financeiro geral (aba Financeiro/Rentabilidade) — cada
// parcela vira uma entrada prevista (recebida quando paga) e cada pagamento
// avulso vira uma entrada recebida.
//
// IDs DETERMINÍSTICOS (reserva + parcela): a rota /api/reservas re-sincroniza a
// cada salvamento — mesmo id = sobrescreve em vez de duplicar, e o que sumiu da
// reserva é removido do financeiro.
//
// Reserva CANCELADA: as parcelas pendentes somem da previsão (não vão entrar),
// mas o que JÁ FOI PAGO continua no financeiro — o dinheiro entrou de verdade.

import type { ParcelaReserva, PagamentoReserva } from './financeiroReserva'

export type ReservaFinanceiroLite = {
  id: string
  contratanteNome: string
  status?: string // 'pre-reserva' | 'confirmada' | 'cancelada'
  financeiro?: {
    parcelas?: ParcelaReserva[]
    pagamentos?: PagamentoReserva[]
  }
}

export type LancamentoReserva = {
  id: string
  tipo: 'entrada'
  descricao: string
  valor: number
  data: string // YYYY-MM-DD
  recebido: boolean
  reservaId: string
}

const ehData = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

export function lancamentosDaReserva(reserva: ReservaFinanceiroLite, tituloViagem: string): LancamentoReserva[] {
  const f = reserva?.financeiro
  if (!f) return []
  const cancelada = reserva.status === 'cancelada'
  const quem = `${reserva.contratanteNome || 'Reserva'} — ${tituloViagem || 'Viagem'}`
  const out: LancamentoReserva[] = []

  const parcelas = (f.parcelas || []).filter(p => Number(p?.valor) > 0 && ehData(p?.vencimento))
  for (const p of parcelas) {
    const paga = p.status === 'pago'
    if (cancelada && !paga) continue // parcela que não vai mais entrar
    out.push({
      id: `res-${reserva.id}-${p.id}`,
      tipo: 'entrada',
      descricao: `${quem} (parcela ${p.numero}/${parcelas.length})`,
      valor: Math.round(p.valor * 100) / 100,
      data: paga && ehData(p.pagoEm) ? p.pagoEm! : p.vencimento,
      recebido: paga,
      reservaId: reserva.id,
    })
  }

  for (const pg of f.pagamentos || []) {
    if (!(Number(pg?.valor) > 0) || !ehData(pg?.data)) continue
    out.push({
      id: `res-${reserva.id}-pg-${pg.id}`,
      tipo: 'entrada',
      descricao: `${quem} (pagamento${pg.nota ? ` — ${pg.nota}` : ''})`,
      valor: Math.round(pg.valor * 100) / 100,
      data: pg.data,
      recebido: true, // pagamento avulso é registro de dinheiro que JÁ entrou
      reservaId: reserva.id,
    })
  }

  return out
}

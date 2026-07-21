// Financeiro de uma reserva de viagem (client-safe, puro, testável).
//
// O MOTOR vive em `lib/financeiroContrato.ts` — parcela, vencimento, pagamento e
// saldo não têm nada de viagem: são os mesmos de um contrato de assessoria de
// cidadania parcelado. Aqui ficam só os nomes com sufixo "Reserva", que o módulo
// de turismo já usa em tela e em banco. Duas cópias das contas de DINHEIRO
// divergiriam no pior lugar possível.

export { METODOS, totalPago, saldoDevedor, quitado, gerarParcelas } from './financeiroContrato'
export type { MetodoPagamento, StatusParcela } from './financeiroContrato'

import type { Parcela, Pagamento, FinanceiroContrato } from './financeiroContrato'

export type ParcelaReserva = Parcela
export type PagamentoReserva = Pagamento
export type FinanceiroReserva = FinanceiroContrato

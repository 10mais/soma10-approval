// Financeiro de uma reserva de excursão (client-safe, puro, testável).
// Parcelamento flexível por método + pagamentos manuais que abatem o saldo devedor
// (o cliente pode ir pagando sem valor fixo). Saldo nunca fica negativo.

export type MetodoPagamento = 'dinheiro' | 'pix' | 'transferencia' | 'cartao' | 'boleto' | 'cheque'

// Todos os métodos aceitam parcelamento (nº de vezes) — cartão, boleto, cheque,
// pix, transferência e dinheiro parcelados.
export const METODOS: { key: MetodoPagamento; label: string }[] = [
  { key: 'dinheiro', label: 'Dinheiro' },
  { key: 'pix', label: 'Pix' },
  { key: 'transferencia', label: 'Transferência' },
  { key: 'cartao', label: 'Cartão' },
  { key: 'boleto', label: 'Boleto' },
  { key: 'cheque', label: 'Cheque' },
]

export type StatusParcela = 'pendente' | 'pago'

export type ParcelaReserva = {
  id: string
  numero: number          // 1 = entrada
  valor: number
  vencimento: string      // YYYY-MM-DD
  metodo?: MetodoPagamento
  status: StatusParcela
  pagoEm?: string
}

export type PagamentoReserva = {
  id: string
  data: string            // YYYY-MM-DD
  valor: number
  metodo?: MetodoPagamento
  nota?: string
}

export type FinanceiroReserva = {
  valorTotal: number      // bruto − desconto (fonte: lib/reservas valorTotalReserva)
  parcelas: ParcelaReserva[]
  pagamentos: PagamentoReserva[]  // pagamentos avulsos que abatem o saldo
}

// Total já recebido = parcelas marcadas pagas + pagamentos avulsos.
export function totalPago(f: Pick<FinanceiroReserva, 'parcelas' | 'pagamentos'>): number {
  const p1 = (f.parcelas || []).filter(p => p.status === 'pago').reduce((s, p) => s + (p.valor || 0), 0)
  const p2 = (f.pagamentos || []).reduce((s, p) => s + (p.valor || 0), 0)
  return Math.round((p1 + p2) * 100) / 100
}

export function saldoDevedor(f: FinanceiroReserva): number {
  return Math.max(0, Math.round(((f.valorTotal || 0) - totalPago(f)) * 100) / 100)
}

export function quitado(f: FinanceiroReserva): boolean {
  return saldoDevedor(f) <= 0.005
}

// Soma `meses` a uma data YYYY-MM-DD sem depender de fuso (ajusta fim de mês).
function addMeses(ymd: string, meses: number): string {
  const [y, m, d] = (ymd || '').split('-').map(Number)
  if (!y || !m) return ymd
  const total = (m - 1) + meses
  const ny = y + Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12 + 1
  const ultimoDia = new Date(Date.UTC(ny, nm, 0)).getUTCDate() // nº de dias do mês destino
  const nd = Math.min(d || 1, ultimoDia)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${ny}-${p(nm)}-${p(nd)}`
}

// Gera N parcelas mensais iguais a partir de `primeiroVencimento`; a diferença de
// centavos (para o total fechar exato) vai na 1ª parcela.
export function gerarParcelas(valorTotal: number, vezes: number, primeiroVencimento: string, metodo?: MetodoPagamento): ParcelaReserva[] {
  const n = Math.max(1, Math.floor(vezes) || 1)
  const total = Math.max(0, Math.round((valorTotal || 0) * 100) / 100)
  const base = Math.floor((total / n) * 100) / 100
  const ajuste = Math.round((total - base * n) * 100) / 100
  const parcelas: ParcelaReserva[] = []
  for (let i = 0; i < n; i++) {
    parcelas.push({
      id: `p${i + 1}`,
      numero: i + 1,
      valor: i === 0 ? Math.round((base + ajuste) * 100) / 100 : base,
      vencimento: addMeses(primeiroVencimento, i),
      metodo,
      status: 'pendente',
    })
  }
  return parcelas
}

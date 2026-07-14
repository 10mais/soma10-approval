import { describe, it, expect } from 'vitest'
import { gerarParcelas, totalPago, saldoDevedor, quitado, FinanceiroReserva } from '@/lib/financeiroReserva'

// Financeiro da reserva: parcelas fecham o total exato e o saldo devedor abate
// pagamentos (parcelas pagas + avulsos). Erro de centavo aqui = caixa não bate.

describe('gerarParcelas', () => {
  it('N parcelas somam exatamente o total; ajuste de centavo na 1ª', () => {
    const ps = gerarParcelas(1000, 3, '2026-01-10')
    expect(ps.length).toBe(3)
    const soma = ps.reduce((s, p) => s + p.valor, 0)
    expect(Math.round(soma * 100) / 100).toBe(1000)
    expect(ps[0].valor).toBeCloseTo(333.34, 2) // 333.34 + 333.33 + 333.33
    expect(ps[1].valor).toBeCloseTo(333.33, 2)
  })
  it('vencimentos são mensais a partir do 1º (sem deslocar por fuso)', () => {
    const ps = gerarParcelas(300, 3, '2026-01-31')
    expect(ps.map(p => p.vencimento)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']) // ajusta fim de mês
  })
  it('1 parcela = valor cheio; vezes inválido cai em 1', () => {
    expect(gerarParcelas(500, 1, '2026-05-01')[0].valor).toBe(500)
    expect(gerarParcelas(500, 0, '2026-05-01').length).toBe(1)
  })
})

describe('saldo devedor e pagamentos', () => {
  const f = (over: Partial<FinanceiroReserva> = {}): FinanceiroReserva => ({
    valorTotal: 1000,
    parcelas: gerarParcelas(1000, 2, '2026-01-10'),
    pagamentos: [],
    ...over,
  })

  it('sem pagamentos, saldo = total', () => {
    expect(saldoDevedor(f())).toBe(1000)
    expect(quitado(f())).toBe(false)
  })
  it('parcela paga abate o saldo', () => {
    const x = f()
    x.parcelas[0].status = 'pago'
    expect(totalPago(x)).toBe(500)
    expect(saldoDevedor(x)).toBe(500)
  })
  it('pagamento avulso (sem valor fixo) abate o saldo', () => {
    const x = f({ pagamentos: [{ id: 'a', data: '2026-02-01', valor: 250 }] })
    expect(totalPago(x)).toBe(250)
    expect(saldoDevedor(x)).toBe(750)
  })
  it('quitado quando pagamentos ≥ total (saldo nunca negativo)', () => {
    const x = f({ pagamentos: [{ id: 'a', data: '2026-02-01', valor: 1200 }] })
    expect(saldoDevedor(x)).toBe(0)
    expect(quitado(x)).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import {
  parcelasVencidas, proximaParcela, totalVencido, gerarParcelas, addMeses,
  type FinanceiroContrato,
} from '@/lib/financeiroContrato'

const HOJE = '2026-07-21'

const fin = (parcelas: any[]): FinanceiroContrato => ({ valorTotal: 0, parcelas, pagamentos: [] })
const p = (numero: number, vencimento: string, status: 'pendente' | 'pago' = 'pendente', valor = 100) =>
  ({ id: `p${numero}`, numero, valor, vencimento, status })

describe('parcelasVencidas', () => {
  it('pega só o que venceu ANTES de hoje e não foi pago', () => {
    const f = fin([p(1, '2026-06-10'), p(2, '2026-07-10', 'pago'), p(3, '2026-08-10')])
    expect(parcelasVencidas(f, HOJE).map(x => x.numero)).toEqual([1])
  })
  it('vencimento HOJE ainda não está vencido', () => {
    expect(parcelasVencidas(fin([p(1, HOJE)]), HOJE)).toHaveLength(0)
  })
  it('parcela paga nunca aparece, mesmo vencida', () => {
    expect(parcelasVencidas(fin([p(1, '2020-01-01', 'pago')]), HOJE)).toHaveLength(0)
  })
  it('sem parcelas não quebra', () => {
    expect(parcelasVencidas(fin([]), HOJE)).toEqual([])
  })
})

describe('proximaParcela', () => {
  it('é a pendente mais próxima, hoje inclusive', () => {
    const f = fin([p(3, '2026-09-10'), p(2, '2026-08-10'), p(1, '2026-06-10')])
    expect(proximaParcela(f, HOJE)?.numero).toBe(2)
  })
  it('vencendo hoje conta como próxima', () => {
    expect(proximaParcela(fin([p(1, HOJE)]), HOJE)?.numero).toBe(1)
  })
  it('tudo pago ou tudo vencido devolve null', () => {
    expect(proximaParcela(fin([p(1, '2026-08-10', 'pago')]), HOJE)).toBeNull()
    expect(proximaParcela(fin([p(1, '2026-01-10')]), HOJE)).toBeNull()
  })
})

describe('totalVencido', () => {
  it('soma só as vencidas em aberto', () => {
    const f = fin([p(1, '2026-05-10', 'pendente', 150), p(2, '2026-06-10', 'pago', 150), p(3, '2026-06-20', 'pendente', 99.9)])
    expect(totalVencido(f, HOJE)).toBe(249.9)
  })
  it('nada vencido = 0', () => {
    expect(totalVencido(fin([p(1, '2026-12-10')]), HOJE)).toBe(0)
  })
})

// O contrato de cidadania é parcelado em muitas vezes e o total precisa fechar
// EXATO: centavo perdido em 12x vira divergência com o que o cliente assinou.
describe('gerarParcelas (contrato)', () => {
  it('12x de um valor que não divide redondo fecha o total exato', () => {
    const ps = gerarParcelas(15000, 12, '2026-08-05')
    expect(ps).toHaveLength(12)
    const soma = Math.round(ps.reduce((s, x) => s + x.valor, 0) * 100) / 100
    expect(soma).toBe(15000)
  })
  it('sobra de centavos vai na primeira parcela', () => {
    const ps = gerarParcelas(100, 3, '2026-08-05')
    expect(ps[0].valor).toBeGreaterThanOrEqual(ps[1].valor)
    expect(Math.round(ps.reduce((s, x) => s + x.valor, 0) * 100) / 100).toBe(100)
  })
  it('vencimentos caminham de mês em mês', () => {
    const ps = gerarParcelas(300, 3, '2026-08-05')
    expect(ps.map(x => x.vencimento)).toEqual(['2026-08-05', '2026-09-05', '2026-10-05'])
  })
})

describe('addMeses', () => {
  it('dia 31 cai no último dia do mês curto', () => {
    expect(addMeses('2026-01-31', 1)).toBe('2026-02-28')
  })
  it('atravessa o ano', () => {
    expect(addMeses('2026-11-15', 3)).toBe('2027-02-15')
  })
})

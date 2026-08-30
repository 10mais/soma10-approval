import { describe, it, expect } from 'vitest'
import { somaPartes, validarPartes, gerarParcelas, somarMeses, resumoPagamento, PartePagamento } from '@/lib/pagamentoGanho'

// Aqui a venda vira dinheiro no caixa. Erro de centavo, parcela a mais ou data
// errada não aparece na tela — aparece na conciliação, semanas depois.

const FORMAS = ['pix', 'dinheiro', 'debito', 'credito', 'boleto', 'outro']

describe('soma e validação das partes', () => {
  it('soma as partes com precisão de centavo', () => {
    expect(somaPartes([{ forma: 'pix', valor: 1000.1 }, { forma: 'credito', valor: 2000.2 }])).toBe(3000.3)
  })

  it('aceita entrada + parcelado quando fecha o total', () => {
    const partes: PartePagamento[] = [{ forma: 'dinheiro', valor: 1000 }, { forma: 'credito', valor: 5000, parcelas: 6 }]
    expect(validarPartes(partes, 6000, FORMAS)).toBeNull()
  })

  it('não deixa fechar quando a soma não bate com a venda', () => {
    expect(validarPartes([{ forma: 'pix', valor: 500 }], 6000, FORMAS)).toMatch(/Faltam/)
    expect(validarPartes([{ forma: 'pix', valor: 7000 }], 6000, FORMAS)).toMatch(/a mais/)
  })

  it('tolera 1 centavo de arredondamento', () => {
    expect(validarPartes([{ forma: 'pix', valor: 6000.01 }], 6000, FORMAS)).toBeNull()
    expect(validarPartes([{ forma: 'pix', valor: 6000.05 }], 6000, FORMAS)).not.toBeNull()
  })

  it('exige forma válida e valor positivo em cada parte', () => {
    expect(validarPartes([{ forma: '', valor: 100 }], 100, FORMAS)).toMatch(/forma de pagamento/)
    expect(validarPartes([{ forma: 'cheque', valor: 100 }], 100, FORMAS)).toMatch(/forma de pagamento/)
    expect(validarPartes([{ forma: 'pix', valor: 0 }], 100, FORMAS)).toMatch(/maior que zero/)
  })

  it('parcelamento é só do crédito, de 1 a 36', () => {
    expect(validarPartes([{ forma: 'credito', valor: 100, parcelas: 0 }], 100, FORMAS)).toMatch(/1 a 36/)
    expect(validarPartes([{ forma: 'credito', valor: 100, parcelas: 37 }], 100, FORMAS)).toMatch(/1 a 36/)
    expect(validarPartes([{ forma: 'pix', valor: 100, parcelas: 3 }], 100, FORMAS)).toMatch(/Só o cartão de crédito/)
  })

  it('sem nenhuma forma não lança nada', () => {
    expect(validarPartes([], 100, FORMAS)).toMatch(/ao menos uma/)
  })
})

describe('parcelas geradas (o que entra no caixa)', () => {
  it('forma à vista vira UMA entrada na data da venda', () => {
    const p = gerarParcelas([{ forma: 'pix', valor: 3000 }], '2026-08-10')
    expect(p).toEqual([{ data: '2026-08-10', valor: 3000, forma: 'pix' }])
  })

  it('crédito em 6x vira 6 entradas mensais', () => {
    const p = gerarParcelas([{ forma: 'credito', valor: 6000, parcelas: 6 }], '2026-08-10')
    expect(p).toHaveLength(6)
    expect(p.map(x => x.data)).toEqual(['2026-08-10', '2026-09-10', '2026-10-10', '2026-11-10', '2026-12-10', '2027-01-10'])
    expect(p.every(x => x.valor === 1000)).toBe(true)
    expect(p[3].parcela).toBe(4)
    expect(p[3].totalParcelas).toBe(6)
  })

  it('a soma das parcelas é EXATAMENTE o valor da venda (centavo vai na primeira)', () => {
    const p = gerarParcelas([{ forma: 'credito', valor: 1000, parcelas: 3 }], '2026-08-10')
    expect(p.map(x => x.valor)).toEqual([333.34, 333.33, 333.33])
    expect(Math.round(p.reduce((s, x) => s + x.valor, 0) * 100)).toBe(100000)
  })

  it('entrada + parcelado gera as duas coisas', () => {
    const p = gerarParcelas([{ forma: 'dinheiro', valor: 1000 }, { forma: 'credito', valor: 5000, parcelas: 5 }], '2026-08-10')
    expect(p).toHaveLength(6)
    expect(p[0]).toEqual({ data: '2026-08-10', valor: 1000, forma: 'dinheiro' })
    expect(p.slice(1).every(x => x.forma === 'credito' && x.valor === 1000)).toBe(true)
  })

  it('a soma das entradas sempre fecha com o total pago', () => {
    for (const [valor, n] of [[6000, 6], [999.99, 7], [1234.56, 12], [50, 3]] as [number, number][]) {
      const p = gerarParcelas([{ forma: 'credito', valor, parcelas: n }], '2026-01-31')
      expect(Math.round(p.reduce((s, x) => s + x.valor, 0) * 100)).toBe(Math.round(valor * 100))
    }
  })
})

describe('datas das parcelas', () => {
  it('vira o mês sem escorregar para o dia 3', () => {
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(somarMeses('2026-01-31', 2)).toBe('2026-03-31')
    expect(somarMeses('2026-08-31', 1)).toBe('2026-09-30')
  })

  it('ano vira certo', () => {
    expect(somarMeses('2026-12-15', 1)).toBe('2027-01-15')
    expect(somarMeses('2026-12-15', 13)).toBe('2028-01-15')
  })

  it('parcelamento longo a partir do fim do mês não repete data', () => {
    const datas = gerarParcelas([{ forma: 'credito', valor: 1200, parcelas: 12 }], '2026-01-31').map(p => p.data)
    expect(new Set(datas).size).toBe(12)
  })
})

describe('resumo para a tela', () => {
  it('descreve a composição do pagamento', () => {
    const r = resumoPagamento(
      [{ forma: 'dinheiro', valor: 1000 }, { forma: 'credito', valor: 5000, parcelas: 6 }],
      f => (f === 'credito' ? 'Cartão de crédito' : 'Dinheiro'),
    )
    expect(r).toContain('Dinheiro')
    expect(r).toContain('Cartão de crédito 6x')
    expect(r).toContain('+')
  })
})

import { describe, it, expect } from 'vitest'
import { custoTotal, breakEvenPorPassageiro, precosSugeridos, resultadoPrevisto } from '@/lib/precificacaoViagem'

// A conta de abrir a venda: custo → break-even por passageiro → preço mínimo/
// aceitável/ideal. Errado aqui = viagem vendida no prejuízo.

describe('custoTotal', () => {
  it('soma e ignora linha em branco/inválida', () => {
    expect(custoTotal([{ valor: 1000 }, { valor: 350.5 }])).toBe(1350.5)
    expect(custoTotal([{ valor: 1000 }, { valor: undefined }, { valor: NaN as any }, { valor: -50 }])).toBe(1000)
    expect(custoTotal([])).toBe(0)
    expect(custoTotal(undefined)).toBe(0)
  })
})

describe('breakEvenPorPassageiro', () => {
  it('rateia o custo pelos passageiros', () => {
    expect(breakEvenPorPassageiro([{ valor: 4000 }], 40)).toBe(100)
  })

  it('sem custo ou sem passageiros não há conta (undefined, não zero)', () => {
    expect(breakEvenPorPassageiro([], 40)).toBeUndefined()
    expect(breakEvenPorPassageiro([{ valor: 4000 }], 0)).toBeUndefined()
    expect(breakEvenPorPassageiro([{ valor: 4000 }], undefined)).toBeUndefined()
  })
})

describe('precosSugeridos', () => {
  it('mínimo empata; aceitável e ideal aplicam a margem sobre o custo', () => {
    expect(precosSugeridos(100)).toEqual({ minimo: 100, aceitavel: 120, ideal: 135 })
    expect(precosSugeridos(100, 10, 50)).toEqual({ minimo: 100, aceitavel: 110, ideal: 150 })
  })

  it('arredonda a centavos', () => {
    expect(precosSugeridos(4000 / 43)!.minimo).toBe(93.02)
  })

  it('sem break-even não sugere; margem negativa não desconta', () => {
    expect(precosSugeridos(undefined)).toBeUndefined()
    expect(precosSugeridos(0)).toBeUndefined()
    expect(precosSugeridos(100, -20, -10)).toEqual({ minimo: 100, aceitavel: 100, ideal: 100 })
  })
})

describe('resultadoPrevisto', () => {
  it('receita = passageiros × unitário; resultado desconta o custo', () => {
    const r = resultadoPrevisto([{ valor: 4000 }], 40, 150)
    expect(r).toEqual({ receita: 6000, custo: 4000, resultado: 2000, margem: 33.33 })
  })

  it('fretamento: passageiros=1 e unitário=valor fechado', () => {
    const r = resultadoPrevisto([{ valor: 4000 }], 1, 5500)
    expect(r.resultado).toBe(1500)
  })

  it('prejuízo sai negativo; sem receita não há margem', () => {
    const r = resultadoPrevisto([{ valor: 4000 }], 40, 80)
    expect(r.resultado).toBe(-800)
    expect(resultadoPrevisto([{ valor: 4000 }], 0, 150).margem).toBeUndefined()
  })
})

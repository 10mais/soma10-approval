import { describe, it, expect } from 'vitest'
import { valorNaContagem } from '@/lib/useCountUp'

describe('valorNaContagem — o número que conta até o valor (produção do time, 15/11/2026)', () => {
  it('começa no ponto de partida e termina exatamente no alvo', () => {
    expect(valorNaContagem(0, 7, 0)).toBe(0)
    expect(valorNaContagem(0, 7, 1)).toBe(7)
    expect(valorNaContagem(5, 2, 1)).toBe(2)
  })
  it('anda rápido no começo e devagar no fim (ease-out)', () => {
    const meio = valorNaContagem(0, 100, 0.5)
    expect(meio).toBeGreaterThan(50)
    expect(meio).toBeLessThan(100)
  })
  it('instante fora de 0..1 não passa do alvo nem volta antes da partida', () => {
    expect(valorNaContagem(0, 10, 2)).toBe(10)
    expect(valorNaContagem(0, 10, -1)).toBe(0)
  })
  it('descendo também funciona (vaga liberada)', () => {
    expect(valorNaContagem(3, 0, 0.5)).toBeGreaterThanOrEqual(0)
    expect(valorNaContagem(3, 0, 0.5)).toBeLessThan(3)
  })
})

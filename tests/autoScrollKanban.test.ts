import { describe, it, expect } from 'vitest'
import { direcaoScroll } from '@/lib/autoScrollKanban'

// Quadro ocupando de x=100 a x=900, com faixa sensível de 90px em cada borda.
const ESQ = 100, DIR = 900, BORDA = 90

describe('direcaoScroll', () => {
  it('cursor no meio não rola', () => {
    expect(direcaoScroll(500, ESQ, DIR, BORDA)).toBe(0)
  })
  it('encostando na borda direita rola para a direita', () => {
    expect(direcaoScroll(880, ESQ, DIR, BORDA)).toBe(1)
  })
  it('encostando na borda esquerda rola para a esquerda', () => {
    expect(direcaoScroll(120, ESQ, DIR, BORDA)).toBe(-1)
  })
  it('exatamente no limite da faixa ainda não rola', () => {
    expect(direcaoScroll(DIR - BORDA, ESQ, DIR, BORDA)).toBe(0)
    expect(direcaoScroll(ESQ + BORDA, ESQ, DIR, BORDA)).toBe(0)
  })
  it('fora do quadro mantém a direção da borda mais próxima', () => {
    expect(direcaoScroll(2000, ESQ, DIR, BORDA)).toBe(1)
    expect(direcaoScroll(-50, ESQ, DIR, BORDA)).toBe(-1)
  })
  it('quadro estreito (bordas se sobrepõem) prioriza a direita, não trava em 0', () => {
    // 100..250 com borda 90: as duas faixas se cruzam. O importante é decidir.
    expect(direcaoScroll(200, 100, 250, 90)).toBe(1)
  })
})

import { describe, it, expect } from 'vitest'
import { deveFecharFolha, eixoDoGesto, acaoDoDeslize, deslocamentoComResistencia, puxadaVisivel, devePuxarAtualizar, LIMITE_PUXAR } from '@/lib/gestos'

// Mudança 2 (21/11/2026): os gestos do celular decidem igual em toda tela.

describe('fechar a folha arrastando', () => {
  it('passou de 30% da altura fecha; pouco não fecha', () => {
    expect(deveFecharFolha(200, 600, 800)).toBe(true)
    expect(deveFecharFolha(60, 600, 800)).toBe(false)
  })
  it('gesto rápido fecha mesmo curto; para cima nunca fecha', () => {
    expect(deveFecharFolha(50, 600, 60)).toBe(true)
    expect(deveFecharFolha(-200, 600, 60)).toBe(false)
  })
  it('folha baixa ainda exige 80px', () => {
    expect(deveFecharFolha(70, 200, 800)).toBe(false)
    expect(deveFecharFolha(90, 200, 800)).toBe(true)
  })
})

describe('eixo do gesto', () => {
  it('parado não decide; lado vence só com folga', () => {
    expect(eixoDoGesto(4, 3)).toBeNull()
    expect(eixoDoGesto(40, 10)).toBe('horizontal')
    expect(eixoDoGesto(20, 18)).toBe('vertical') // diagonal = rolagem da lista
    expect(eixoDoGesto(2, 40)).toBe('vertical')
  })
})

describe('deslizar o cartão', () => {
  it('passou do limite para um lado', () => {
    expect(acaoDoDeslize(150, 340)).toBe('direita')
    expect(acaoDoDeslize(-150, 340)).toBe('esquerda')
    expect(acaoDoDeslize(60, 340)).toBeNull()
  })
  it('cartão estreito ainda pede 72px', () => {
    expect(acaoDoDeslize(70, 100)).toBeNull()
    expect(acaoDoDeslize(75, 100)).toBe('direita')
  })
  it('resistência depois do limite', () => {
    expect(deslocamentoComResistencia(50, 100)).toBe(50)
    expect(deslocamentoComResistencia(200, 100)).toBe(135)
    expect(deslocamentoComResistencia(-200, 100)).toBe(-135)
  })
})

describe('puxar para atualizar', () => {
  it('a puxada visível é metade do dedo, com teto', () => {
    expect(puxadaVisivel(-10)).toBe(0)
    expect(puxadaVisivel(100)).toBe(50)
    expect(puxadaVisivel(1000)).toBe(110)
  })
  it(`dispara a partir de ${LIMITE_PUXAR}px visíveis`, () => {
    expect(devePuxarAtualizar(120)).toBe(false)
    expect(devePuxarAtualizar(140)).toBe(true)
  })
})

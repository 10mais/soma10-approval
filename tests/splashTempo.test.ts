import { describe, it, expect } from 'vitest'
import { tempoRestante, tetoRestante, podeSair, SPLASH_COM_REGRA_MS, SPLASH_SEM_REGRA_MS, SPLASH_TETO_MS } from '@/lib/splashTempo'

const T0 = 1_000_000

describe('splashTempo — relógio único da tela de abertura', () => {
  it('com regra espera 5s; sem regra 1,2s', () => {
    expect(tempoRestante(T0, T0, true)).toBe(SPLASH_COM_REGRA_MS)
    expect(tempoRestante(T0, T0, false)).toBe(SPLASH_SEM_REGRA_MS)
  })

  it('a segunda instância continua de onde a primeira parou (não recomeça do zero)', () => {
    // A splash remonta 3s depois de aberta: faltam 2s, não 5s.
    expect(tempoRestante(T0, T0 + 3000, true)).toBe(2000)
    expect(tempoRestante(T0, T0 + 9000, true)).toBe(0)
  })

  it('não sai antes do tempo mínimo, mesmo com o pai pronto', () => {
    expect(podeSair({ inicio: T0, agora: T0 + 1000, temRegra: true, pronto: true })).toBe(false)
    expect(podeSair({ inicio: T0, agora: T0 + 5000, temRegra: true, pronto: true })).toBe(true)
  })

  it('não sai enquanto o pai não está pronto (dentro do teto)', () => {
    expect(podeSair({ inicio: T0, agora: T0 + 6000, temRegra: true, pronto: false })).toBe(false)
  })

  it('sem saber ainda se há regra, espera (dentro do teto)', () => {
    expect(podeSair({ inicio: T0, agora: T0 + 6000, temRegra: undefined, pronto: true })).toBe(false)
  })

  it('TETO: passados 12s a splash sai aconteça o que acontecer (incidente 07/09)', () => {
    expect(tetoRestante(T0, T0 + SPLASH_TETO_MS)).toBe(0)
    expect(podeSair({ inicio: T0, agora: T0 + SPLASH_TETO_MS, temRegra: undefined, pronto: false })).toBe(true)
    expect(podeSair({ inicio: T0, agora: T0 + SPLASH_TETO_MS + 1, temRegra: true, pronto: false })).toBe(true)
  })
})

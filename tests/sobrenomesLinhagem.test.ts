import { describe, it, expect } from 'vitest'
import { sobrenomesOrdenados, temListaSobrenomes } from '@/lib/sobrenomesLinhagem'

describe('sobrenomesOrdenados', () => {
  it('ordena alfabeticamente ignorando acento e caixa', () => {
    expect(sobrenomesOrdenados(['Muller', 'Anders', 'lunkes'])).toEqual(['Anders', 'lunkes', 'Muller'])
  })
  it('remove duplicata e espaço sobrando', () => {
    expect(sobrenomesOrdenados([' Lunkes ', 'Lunkes', ''])).toEqual(['Lunkes'])
  })
  it('lista vazia continua vazia', () => {
    expect(sobrenomesOrdenados([])).toEqual([])
  })
})

describe('temListaSobrenomes', () => {
  it('falso enquanto ninguém preencheu (campo vira texto livre)', () => {
    expect(temListaSobrenomes([])).toBe(false)
    expect(temListaSobrenomes(['  ', ''])).toBe(false)
  })
  it('verdadeiro com pelo menos um sobrenome (campo vira dropdown)', () => {
    expect(temListaSobrenomes(['Lunkes'])).toBe(true)
  })
})

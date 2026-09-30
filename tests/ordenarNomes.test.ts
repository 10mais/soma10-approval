import { describe, it, expect } from 'vitest'
import { ordenarPorNome } from '@/lib/ordenarNomes'

describe('pessoas em ordem alfabética (seletores de responsável)', () => {
  it('Ana primeiro, Willian por último — como o dono pediu', () => {
    const lista = [{ nome: 'Willian Pires' }, { nome: 'Ana Turcato' }, { nome: 'Felipe Dutra' }, { nome: 'Bruna' }]
    expect(ordenarPorNome(lista).map(u => u.nome)).toEqual(['Ana Turcato', 'Bruna', 'Felipe Dutra', 'Willian Pires'])
  })

  it('sem diferenciar maiúscula nem acento', () => {
    const lista = [{ nome: 'bruno' }, { nome: 'Álvaro' }, { nome: 'Carla' }, { nome: 'Ana' }]
    expect(ordenarPorNome(lista).map(u => u.nome)).toEqual(['Álvaro', 'Ana', 'bruno', 'Carla'])
  })

  it('quem não tem nome entra pelo e-mail; lista original intacta; vazia não quebra', () => {
    const lista = [{ nome: 'Zeca', email: 'z@x' }, { email: 'bia@x' }]
    expect(ordenarPorNome(lista).map(u => u.email)).toEqual(['bia@x', 'z@x'])
    expect(lista[0].nome).toBe('Zeca')
    expect(ordenarPorNome(undefined)).toEqual([])
  })
})

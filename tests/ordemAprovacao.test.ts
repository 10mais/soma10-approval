import { describe, it, expect } from 'vitest'
import { ordenarPorDataDePostagem } from '@/lib/ordemAprovacao'

describe('ordem dos materiais na aprovação — postagem mais próxima primeiro', () => {
  it('ordena pela data de postagem, não pela data de criação', () => {
    const lista = [
      { id: 'out', dataAgendada: '2026-10-15T12:00:00.000Z', criadoEm: '2026-09-01T00:00:00.000Z' },
      { id: 'amanha', dataAgendada: '2026-09-29T12:00:00.000Z', criadoEm: '2026-09-20T00:00:00.000Z' },
      { id: 'semana', dataAgendada: '2026-10-03T12:00:00.000Z', criadoEm: '2026-09-10T00:00:00.000Z' },
    ]
    expect(ordenarPorDataDePostagem(lista).map(x => x.id)).toEqual(['amanha', 'semana', 'out'])
  })

  it('data que já passou (atrasado) vem no topo; sem data vai para o fim', () => {
    const lista = [
      { id: 'sem-data', criadoEm: '2026-09-01T00:00:00.000Z' },
      { id: 'futuro', dataAgendada: '2026-10-01T12:00:00.000Z' },
      { id: 'atrasado', dataAgendada: '2026-09-20T12:00:00.000Z' },
      { id: 'data-torta', dataAgendada: 'ontem', criadoEm: '2026-09-02T00:00:00.000Z' },
    ]
    expect(ordenarPorDataDePostagem(lista).map(x => x.id)).toEqual(['atrasado', 'futuro', 'sem-data', 'data-torta'])
  })

  it('mesma data: quem foi criado antes vem antes; não altera a lista original', () => {
    const lista = [
      { id: 'b', dataAgendada: '2026-10-01T12:00:00.000Z', criadoEm: '2026-09-15T00:00:00.000Z' },
      { id: 'a', dataAgendada: '2026-10-01T12:00:00.000Z', criadoEm: '2026-09-10T00:00:00.000Z' },
    ]
    expect(ordenarPorDataDePostagem(lista).map(x => x.id)).toEqual(['a', 'b'])
    expect(lista.map(x => x.id)).toEqual(['b', 'a'])
  })
})

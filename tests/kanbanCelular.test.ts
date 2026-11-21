import { describe, it, expect } from 'vitest'
import { acoesDoGesto, colunaVizinha } from '@/lib/kanbanCelular'

const COLS = [
  { key: 'a_fazer', label: 'A fazer' }, { key: 'em_andamento', label: 'Em andamento' }, { key: 'em_ajuste', label: 'Em ajuste' },
  { key: 'em_revisao', label: 'Em revisão' }, { key: 'concluido', label: 'Concluído' }, { key: 'descartado', label: 'Descartado' },
]

describe('gesto de deslizar no Kanban do celular', () => {
  it('na revisão: direita aprova, esquerda pede ajuste', () => {
    const g = acoesDoGesto('em_revisao', COLS)
    expect(g.direita).toEqual({ status: 'concluido', rotulo: 'Aprovar', tom: 'ok' })
    expect(g.esquerda).toEqual({ status: 'em_ajuste', rotulo: 'Pedir ajuste', tom: 'ajuste' })
  })
  it('nas outras: avança e volta uma coluna', () => {
    expect(acoesDoGesto('em_andamento', COLS)).toMatchObject({ direita: { status: 'em_ajuste' }, esquerda: { status: 'a_fazer' } })
    expect(acoesDoGesto('a_fazer', COLS).esquerda).toBeUndefined()
  })
  it('concluído não avança para descartado; descartado não tem gesto', () => {
    expect(acoesDoGesto('concluido', COLS).direita).toBeUndefined()
    expect(acoesDoGesto('descartado', COLS)).toEqual({})
  })
  it('status fora das colunas não tem gesto', () => {
    expect(acoesDoGesto('xyz', COLS)).toEqual({})
  })
})

describe('trocar de coluna deslizando a lista', () => {
  it('anda uma e para nas pontas', () => {
    expect(colunaVizinha('em_andamento', COLS, 'direita')).toBe('em_ajuste')
    expect(colunaVizinha('a_fazer', COLS, 'esquerda')).toBe('a_fazer')
    expect(colunaVizinha('descartado', COLS, 'direita')).toBe('descartado')
    expect(colunaVizinha('nao-existe', COLS, 'direita')).toBe('a_fazer')
  })
})

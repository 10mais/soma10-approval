import { describe, it, expect } from 'vitest'
import { condBate, avaliarCondicoes, escopoBate } from '@/lib/automacoesCondicoes'

// Alto risco: um erro aqui dispara automações erradas (spam ao cliente) ou deixa
// de disparar as certas. Regras são puras — testáveis de forma determinística.

const cond = (campo: string, operador: string, valor?: string) => ({ campo, operador, valor } as any)
const regra = (r: any) => r as any

describe('condBate (operadores)', () => {
  it('preenchido / vazio', () => {
    expect(condBate(cond('nome', 'preenchido'), { nome: 'Ana' })).toBe(true)
    expect(condBate(cond('nome', 'preenchido'), { nome: '' })).toBe(false)
    expect(condBate(cond('nome', 'preenchido'), {})).toBe(false)
    expect(condBate(cond('nome', 'vazio'), {})).toBe(true)
    expect(condBate(cond('nome', 'vazio'), { nome: 'Ana' })).toBe(false)
  })

  it('igual / diferente são case-insensitive', () => {
    expect(condBate(cond('status', 'igual', 'Ganho'), { status: 'ganho' })).toBe(true)
    expect(condBate(cond('status', 'igual', 'Ganho'), { status: 'perdido' })).toBe(false)
    expect(condBate(cond('status', 'diferente', 'Ganho'), { status: 'perdido' })).toBe(true)
    expect(condBate(cond('status', 'diferente', 'Ganho'), { status: 'GANHO' })).toBe(false)
  })

  it('contem (substring case-insensitive)', () => {
    expect(condBate(cond('titulo', 'contem', 'promo'), { titulo: 'Campanha PROMO de verão' })).toBe(true)
    expect(condBate(cond('titulo', 'contem', 'promo'), { titulo: 'Newsletter' })).toBe(false)
  })

  it('maior / menor (numérico)', () => {
    expect(condBate(cond('valor', 'maior', '100'), { valor: 150 })).toBe(true)
    expect(condBate(cond('valor', 'maior', '100'), { valor: 50 })).toBe(false)
    expect(condBate(cond('valor', 'menor', '100'), { valor: 50 })).toBe(true)
    expect(condBate(cond('valor', 'menor', '100'), { valor: 150 })).toBe(false)
  })

  it('operador desconhecido não bloqueia (default true)', () => {
    expect(condBate(cond('x', 'inexistente', 'y'), { x: 'z' })).toBe(true)
  })
})

describe('avaliarCondicoes (todas / qualquer)', () => {
  it('sem condições sempre passa', () => {
    expect(avaliarCondicoes(regra({ condicoes: [] }), {})).toBe(true)
    expect(avaliarCondicoes(regra({}), {})).toBe(true)
  })

  it('padrão = TODAS (every)', () => {
    const r = regra({ condicoes: [cond('a', 'igual', 'x'), cond('b', 'preenchido')] })
    expect(avaliarCondicoes(r, { a: 'x', b: 'ok' })).toBe(true)
    expect(avaliarCondicoes(r, { a: 'x', b: '' })).toBe(false) // uma falha derruba
  })

  it('QUALQUER (some)', () => {
    const r = regra({ condicaoLogica: 'qualquer', condicoes: [cond('a', 'igual', 'x'), cond('b', 'preenchido')] })
    expect(avaliarCondicoes(r, { a: 'nao', b: 'ok' })).toBe(true) // basta uma
    expect(avaliarCondicoes(r, { a: 'nao', b: '' })).toBe(false)
  })
})

describe('escopoBate (alvo do cliente)', () => {
  it('selecionados: só os clienteIds da regra', () => {
    const r = regra({ alvo: 'selecionados', clienteIds: ['c1', 'c2'] })
    expect(escopoBate(r, { clienteId: 'c1' })).toBe(true)
    expect(escopoBate(r, { clienteId: 'c9' })).toBe(false)
    expect(escopoBate(r, {})).toBe(false) // sem cliente no ctx
  })

  it('todos: passa, exceto os excluídos', () => {
    const r = regra({ alvo: 'todos', clienteIdsExcluidos: ['c3'] })
    expect(escopoBate(r, { clienteId: 'c1' })).toBe(true)
    expect(escopoBate(r, { clienteId: 'c3' })).toBe(false)
    expect(escopoBate(r, {})).toBe(true) // sem cliente = escopo geral
  })
})

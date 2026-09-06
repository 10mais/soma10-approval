import { describe, it, expect } from 'vitest'
import { regraDoDia, normalizarConfig, configVazia, MESES_PT } from '@/lib/regrasDoMes'

const set = new Date('2026-09-04T09:00:00').getTime()
const cfg = normalizarConfig({ meses: [
  null, null, null, null, null, null, null, null,
  { nome: 'Entregar antes do prazo', frases: ['Frase A', 'Frase B', 'Frase C'] },
  null, null, null,
] })

describe('regraDoDia', () => {
  it('pega a regra do mês corrente e a frase pelo dia', () => {
    const r = regraDoDia(cfg, set)
    expect(r?.mes).toBe('setembro')
    expect(r?.nome).toBe('Entregar antes do prazo')
    expect(r?.frase).toBe('Frase A') // dia 4 -> (4-1) % 3 = 0
  })

  it('a frase muda de um dia para o outro e gira quando acabam', () => {
    const d5 = set + 86400000, d7 = set + 3 * 86400000
    expect(regraDoDia(cfg, d5)?.frase).toBe('Frase B')
    expect(regraDoDia(cfg, d7)?.frase).toBe('Frase A')
  })

  it('mês sem regra cadastrada devolve null (a Home não mostra o bloco)', () => {
    const out = new Date('2026-10-10T09:00:00').getTime()
    expect(regraDoDia(cfg, out)).toBeNull()
    expect(regraDoDia(configVazia(), set)).toBeNull()
  })

  it('regra sem frases ainda mostra o nome, sem frase', () => {
    const c = normalizarConfig({ meses: Array.from({ length: 12 }, (_, i) => i === 8 ? { nome: 'Só o nome' } : null) })
    const r = regraDoDia(c, set)
    expect(r?.nome).toBe('Só o nome')
    expect(r?.frase).toBeUndefined()
  })
})

describe('normalizarConfig', () => {
  it('sempre devolve 12 slots, mesmo com entrada torta', () => {
    expect(normalizarConfig(undefined).meses).toHaveLength(12)
    expect(normalizarConfig({ meses: [{ nome: 'Jan' }] }).meses).toHaveLength(12)
    expect(normalizarConfig({ meses: 'x' }).meses.every(m => m === null)).toBe(true)
  })

  it('apara espaços e descarta frase vazia; nome vazio vira slot nulo', () => {
    const c = normalizarConfig({ meses: [{ nome: '  Foco  ', frases: ['  a ', '', 3, ' b'] }, { nome: '   ' }] })
    expect(c.meses[0]).toEqual({ nome: 'Foco', frases: ['a', 'b'] })
    expect(c.meses[1]).toBeNull()
  })

  it('MESES_PT cobre o ano', () => {
    expect(MESES_PT).toHaveLength(12)
    expect(MESES_PT[0]).toBe('janeiro')
  })
})

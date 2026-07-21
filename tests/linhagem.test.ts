import { describe, it, expect } from 'vitest'
import {
  ordenarLinhagem, ascendenteLinhagem, resumoLinhagem, geracoesFaltando,
  sanitizarLinhagem, type PessoaLinhagem,
} from '@/lib/linhagem'

// id determinístico nos testes (a rota passa uuid)
let seq = 0
const idFake = () => `id-${++seq}`

const p = (over: Partial<PessoaLinhagem> & { id: string; nome: string; geracao: number }): PessoaLinhagem => over

describe('ordenarLinhagem', () => {
  it('ordena da base (0) ao topo', () => {
    const arr = [p({ id: 'c', nome: 'Bisavô', geracao: 3 }), p({ id: 'a', nome: 'Requerente', geracao: 0 }), p({ id: 'b', nome: 'Avô', geracao: 2 })]
    expect(ordenarLinhagem(arr).map(x => x.nome)).toEqual(['Requerente', 'Avô', 'Bisavô'])
  })
  it('empate de geração é estável (ordem de entrada)', () => {
    const arr = [p({ id: 'x', nome: 'Filho A', geracao: 0 }), p({ id: 'y', nome: 'Filho B', geracao: 0 })]
    expect(ordenarLinhagem(arr).map(x => x.nome)).toEqual(['Filho A', 'Filho B'])
  })
  it('não muta o array original', () => {
    const arr = [p({ id: 'b', nome: 'B', geracao: 1 }), p({ id: 'a', nome: 'A', geracao: 0 })]
    ordenarLinhagem(arr)
    expect(arr[0].id).toBe('b')
  })
})

describe('ascendenteLinhagem', () => {
  it('vazia = null', () => {
    expect(ascendenteLinhagem([])).toBeNull()
  })
  it('sem marcação: o de maior geração', () => {
    const arr = [p({ id: 'a', nome: 'Requerente', geracao: 0 }), p({ id: 'b', nome: 'Avô', geracao: 2 })]
    expect(ascendenteLinhagem(arr)?.nome).toBe('Avô')
  })
  it('marcação vence a geração', () => {
    const arr = [p({ id: 'a', nome: 'Requerente', geracao: 0 }), p({ id: 'b', nome: 'Pai (imigrante)', geracao: 1, ascendente: true }), p({ id: 'c', nome: 'Avô BR', geracao: 2 })]
    expect(ascendenteLinhagem(arr)?.nome).toBe('Pai (imigrante)')
  })
})

describe('resumoLinhagem', () => {
  it('conta total, gerações e ascendente', () => {
    const arr = [p({ id: 'a', nome: 'Requerente', geracao: 0 }), p({ id: 'b', nome: 'Pai', geracao: 1 }), p({ id: 'c', nome: 'Avô LUX', geracao: 2, ascendente: true })]
    const r = resumoLinhagem(arr)
    expect(r.total).toBe(3)
    expect(r.geracoes).toBe(3)
    expect(r.temAscendente).toBe(true)
    expect(r.ascendenteNome).toBe('Avô LUX')
  })
  it('vazia = zeros e sem ascendente', () => {
    const r = resumoLinhagem([])
    expect(r).toEqual({ total: 0, geracoes: 0, temAscendente: false, ascendenteNome: '' })
  })
})

describe('sanitizarLinhagem', () => {
  it('descarta nó sem nome (lixo de formulário)', () => {
    const out = sanitizarLinhagem([{ nome: 'Ana', geracao: 0 }, { nome: '   ', geracao: 1 }, {}], idFake)
    expect(out).toHaveLength(1)
    expect(out[0].nome).toBe('Ana')
  })
  it('gera id quando falta e preserva o existente', () => {
    const out = sanitizarLinhagem([{ id: 'meu-id', nome: 'Ana', geracao: 0 }, { nome: 'Beto', geracao: 1 }], idFake)
    expect(out[0].id).toBe('meu-id')
    expect(out[1].id).toMatch(/^id-\d+$/)
  })
  it('só o PRIMEIRO ascendente marcado sobrevive', () => {
    const out = sanitizarLinhagem([
      { nome: 'A', geracao: 0, ascendente: true },
      { nome: 'B', geracao: 1, ascendente: true },
    ], idFake)
    expect(out[0].ascendente).toBe(true)
    expect(out[1].ascendente).toBeUndefined()
  })
  it('geração inválida ou negativa vira 0', () => {
    const out = sanitizarLinhagem([{ nome: 'A', geracao: -5 }, { nome: 'B', geracao: 'xis' }], idFake)
    expect(out[0].geracao).toBe(0)
    expect(out[1].geracao).toBe(0)
  })
  it('sexo fora de M/F é descartado', () => {
    const out = sanitizarLinhagem([{ nome: 'A', geracao: 0, sexo: 'X' }, { nome: 'B', geracao: 1, sexo: 'F' }], idFake)
    expect(out[0].sexo).toBeUndefined()
    expect(out[1].sexo).toBe('F')
  })
  it('entrada que não é lista vira lista vazia', () => {
    expect(sanitizarLinhagem(undefined, idFake)).toEqual([])
    expect(sanitizarLinhagem('nada', idFake)).toEqual([])
  })
  it('limita o tamanho da árvore', () => {
    const grande = Array.from({ length: 60 }, (_, i) => ({ nome: `P${i}`, geracao: i }))
    expect(sanitizarLinhagem(grande, idFake)).toHaveLength(40)
  })
})

describe('geracoesFaltando', () => {
  it('cadeia contígua não tem lacuna', () => {
    const arr = [p({ id: 'a', nome: 'A', geracao: 0 }), p({ id: 'b', nome: 'B', geracao: 1 }), p({ id: 'c', nome: 'C', geracao: 2 })]
    expect(geracoesFaltando(arr)).toEqual([])
  })
  it('aponta a geração ausente no meio', () => {
    const arr = [p({ id: 'a', nome: 'Requerente', geracao: 0 }), p({ id: 'c', nome: 'Bisavô', geracao: 3 })]
    expect(geracoesFaltando(arr)).toEqual([1, 2])
  })
  it('vazia = sem lacuna', () => {
    expect(geracoesFaltando([])).toEqual([])
  })
})

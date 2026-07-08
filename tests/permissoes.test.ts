import { describe, it, expect } from 'vitest'
import { podeNivel, normalizaNivel } from '@/lib/permissoesCatalogo'

// Segurança: um erro aqui deixa alguém ver/editar/excluir o que não devia.

describe('normalizaNivel (retrocompatibilidade do formato)', () => {
  it('boolean antigo vira os 3 níveis iguais', () => {
    expect(normalizaNivel(true)).toEqual({ ver: true, editar: true, excluir: true })
    expect(normalizaNivel(false)).toEqual({ ver: false, editar: false, excluir: false })
  })

  it('objeto novo passa direto; vazio/indefinido vira {}', () => {
    expect(normalizaNivel({ ver: true })).toEqual({ ver: true })
    expect(normalizaNivel(undefined)).toEqual({})
    expect(normalizaNivel(null)).toEqual({})
  })
})

describe('podeNivel (nível efetivo por papel)', () => {
  it('admin sempre pode tudo, inclusive financeiro', () => {
    expect(podeNivel('admin', 'clientes', 'excluir')).toBe(true)
    expect(podeNivel('admin', 'financeiro', 'ver')).toBe(true)
  })

  it('financeiro é exclusivo do admin', () => {
    expect(podeNivel('gerente', 'financeiro', 'ver')).toBe(false)
    expect(podeNivel('usuario', 'financeiro', 'ver')).toBe(false)
  })

  it('papéis fora de gerente/usuario não têm acesso por este modelo', () => {
    expect(podeNivel('vendas', 'producao', 'ver')).toBe(false)
    expect(podeNivel('cliente', 'producao', 'ver')).toBe(false)
    expect(podeNivel(undefined, 'producao', 'ver')).toBe(false)
  })

  it('usa o padrão do papel quando não há override', () => {
    // gerente: produção tudo liberado; clientes tudo bloqueado
    expect(podeNivel('gerente', 'producao', 'excluir')).toBe(true)
    expect(podeNivel('gerente', 'clientes', 'ver')).toBe(false)
    // usuario: produção ver/editar sim, excluir não; estratégia nada
    expect(podeNivel('usuario', 'producao', 'editar')).toBe(true)
    expect(podeNivel('usuario', 'producao', 'excluir')).toBe(false)
    expect(podeNivel('usuario', 'estrategia', 'ver')).toBe(false)
  })

  it('override do usuário vence o padrão (liga e desliga)', () => {
    expect(podeNivel('usuario', 'producao', 'excluir', { producao: { excluir: true } })).toBe(true)
    expect(podeNivel('usuario', 'producao', 'ver', { producao: { ver: false } })).toBe(false)
  })

  it('config do papel vence o padrão, mas perde para o override do usuário', () => {
    const configPapel = { usuario: { estrategia: { ver: true } } }
    expect(podeNivel('usuario', 'estrategia', 'ver', undefined, configPapel)).toBe(true)
    expect(podeNivel('usuario', 'estrategia', 'ver', { estrategia: { ver: false } }, configPapel)).toBe(false)
  })

  it('aceita o formato antigo (boolean) no override do usuário', () => {
    expect(podeNivel('usuario', 'producao', 'excluir', { producao: true })).toBe(true)
  })
})

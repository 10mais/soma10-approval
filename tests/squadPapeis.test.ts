import { describe, it, expect } from 'vitest'
import { PAPEIS_SQUAD, squadCompleto, limparSquadPapeis, labelDoPapel } from '@/lib/squadPapeis'

describe('PAPEIS_SQUAD', () => {
  it('tem os quatro papéis, com chave única', () => {
    const chaves = PAPEIS_SQUAD.map(p => p.chave)
    expect(chaves.sort()).toEqual(['designer', 'gestor_operacao', 'gestor_projetos', 'gestor_trafego'])
    expect(new Set(chaves).size).toBe(4)
  })

  it('todo papel tem label e descrição', () => {
    for (const p of PAPEIS_SQUAD) {
      expect(p.label.trim()).not.toBe('')
      expect(p.descricao.trim()).not.toBe('')
    }
  })

  it('labelDoPapel devolve a chave crua quando não conhece', () => {
    expect(labelDoPapel('designer')).toBe('Designer')
    expect(labelDoPapel('inventado')).toBe('inventado')
  })
})

describe('squadCompleto', () => {
  it('junta os papéis com a lista manual', () => {
    const r = squadCompleto({ designer: 'ana@x.com', gestor_trafego: 'marco@x.com' }, ['extra@x.com'])
    expect(r).toEqual(['ana@x.com', 'marco@x.com', 'extra@x.com'])
  })

  it('papéis vêm primeiro, na ordem do catálogo', () => {
    const r = squadCompleto({ gestor_trafego: 'trafego@x.com', gestor_projetos: 'gp@x.com' })
    expect(r).toEqual(['gp@x.com', 'trafego@x.com']) // gp antes de tráfego, como no catálogo
  })

  it('a mesma pessoa em dois papéis aparece uma vez só', () => {
    const r = squadCompleto({ designer: 'ana@x.com', gestor_operacao: 'ana@x.com' }, ['ana@x.com'])
    expect(r).toEqual(['ana@x.com'])
  })

  it('ignora vazio, espaço e undefined', () => {
    expect(squadCompleto({ designer: '  ' } as any, ['', '  ', undefined as any])).toEqual([])
    expect(squadCompleto(undefined, undefined)).toEqual([])
  })

  it('apara espaços das pontas', () => {
    expect(squadCompleto({ designer: ' ana@x.com ' })).toEqual(['ana@x.com'])
  })

  it('quem está só na lista manual continua no squad — papel não é requisito', () => {
    expect(squadCompleto({}, ['estagiario@x.com'])).toEqual(['estagiario@x.com'])
  })
})

describe('limparSquadPapeis', () => {
  it('mantém só as quatro chaves conhecidas', () => {
    const r = limparSquadPapeis({ designer: 'a@x.com', chefe: 'b@x.com', __proto__: 'c' })
    expect(r).toEqual({ designer: 'a@x.com' })
  })

  it('descarta valor que não é string ou está vazio', () => {
    expect(limparSquadPapeis({ designer: 123, gestor_projetos: '', gestor_operacao: '   ' })).toEqual({})
  })

  it('sobrevive a lixo', () => {
    expect(limparSquadPapeis(null)).toEqual({})
    expect(limparSquadPapeis('texto')).toEqual({})
  })
})

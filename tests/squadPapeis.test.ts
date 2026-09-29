import { describe, it, expect } from 'vitest'
import { PAPEIS_SQUAD, squadCompleto, limparSquadPapeis, labelDoPapel, squadsDaPessoa } from '@/lib/squadPapeis'

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

describe('squadsDaPessoa — em quais squads a pessoa está (tela Equipe)', () => {
  const clientes = [
    { id: 'c1', nome: 'Universal', squad: ['ana@10mais.com.br', 'bia@10mais.com.br'], squadPapeis: { designer: 'Ana@10mais.com.br' } },
    { id: 'c2', nome: 'Clínica Norah', squad: ['ana@10mais.com.br'] },
    { id: 'c3', nome: 'Arquivado', squad: ['ana@10mais.com.br'], arquivado: true },
    { id: 'c4', nome: 'Beta', squadPapeis: { gestor_trafego: 'ana@10mais.com.br', gestor_projetos: 'ana@10mais.com.br' } },
    { id: 'c5', nome: 'Outro', squad: ['caio@10mais.com.br'] },
  ]

  it('acha pela lista E pelos papéis, sem diferenciar maiúscula, em ordem alfabética', () => {
    const r = squadsDaPessoa('ANA@10mais.com.br', clientes)
    expect(r.map(x => x.clienteNome)).toEqual(['Beta', 'Clínica Norah', 'Universal'])
  })

  it('traz os papéis que a pessoa ocupa (vazio quando está só na lista)', () => {
    const r = squadsDaPessoa('ana@10mais.com.br', clientes)
    expect(r.find(x => x.clienteId === 'c1')?.papeis).toEqual(['designer'])
    expect(r.find(x => x.clienteId === 'c2')?.papeis).toEqual([])
    expect(r.find(x => x.clienteId === 'c4')?.papeis).toEqual(['gestor_projetos', 'gestor_trafego'])
  })

  it('ignora cliente arquivado; quem não está em squad nenhum volta vazio', () => {
    expect(squadsDaPessoa('ana@10mais.com.br', clientes).some(x => x.clienteId === 'c3')).toBe(false)
    expect(squadsDaPessoa('ninguem@10mais.com.br', clientes)).toEqual([])
    expect(squadsDaPessoa('', clientes)).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import { migrarPlaybook, juntar, faseDoDia, PlaybookAntigo } from '@/lib/bibliotecaMigrar'
import { vazia, BibliotecaVendas } from '@/lib/bibliotecaVendas'

// A migração roda uma vez, em cima de dado real, e o que ela perder ninguém
// recupera: o roteiro do DÉCADA na Norah foi refinado À MÃO pelo dono.

const antigo: PlaybookAntigo = {
  roteiro: 'MÉTODO DÉCADA — fase 1: acolhimento...',
  cadencia: [
    { id: 'c1', dia: 0, canal: 'whatsapp', titulo: 'Primeiro contato', script: 'Oi {nome}!' },
    { id: 'c2', dia: 3, canal: 'whatsapp', titulo: 'Prova social', script: 'Olha o resultado...' },
    { id: 'c3', dia: 6, canal: 'whatsapp', titulo: 'Última tentativa', script: 'Não quero insistir...' },
  ],
  reaquecimento: [{ id: 'r1', quando: 'Procedimento vencendo', titulo: 'Manutenção', script: 'Oi {primeiro}...' }],
}

describe('migrarPlaybook', () => {
  it('preserva o roteiro refinado INTEIRO (não pica em pedaços inventados)', () => {
    const r = migrarPlaybook(antigo)
    expect(r.roteiros).toHaveLength(1)
    expect(r.roteiros[0].perguntas[0].contexto).toBe(antigo.roteiro)
  })

  it('traz toda a cadência, sem perder passo', () => {
    const r = migrarPlaybook(antigo)
    expect(r.cadencias[0].mensagens).toHaveLength(3)
    expect(r.cadencias[0].mensagens.map(m => m.titulo)).toEqual(['Primeiro contato', 'Prova social', 'Última tentativa'])
  })

  it('o DIA não some — vira contexto da mensagem', () => {
    const r = migrarPlaybook(antigo)
    expect(r.cadencias[0].mensagens[1].contexto).toContain('Dia 3')
    expect(r.cadencias[0].mensagens[1].contexto).toContain('whatsapp')
  })

  it('traz o reaquecimento para a trilha de Leads', () => {
    const r = migrarPlaybook(antigo)
    expect(r.leads[0].mensagens[0].texto).toBe('Oi {primeiro}...')
    expect(r.leads[0].mensagens[0].contexto).toBe('Procedimento vencendo')
  })

  it('playbook ausente ou vazio não vira lixo na tela', () => {
    for (const v of [null, undefined, {}, { roteiro: '   ', cadencia: [], reaquecimento: [] }]) {
      const r = migrarPlaybook(v as any)
      expect(r.cadencias).toHaveLength(0)
      expect(r.roteiros).toHaveLength(0)
      expect(r.leads).toHaveLength(0)
    }
  })

  it('passo só com título (sem script) não é descartado', () => {
    const r = migrarPlaybook({ cadencia: [{ titulo: 'Ligar', dia: 1 }] })
    expect(r.cadencias[0].mensagens).toHaveLength(1)
  })
})

describe('faseDoDia', () => {
  it('o primeiro passo é sempre abordagem, mesmo com dia alto', () => {
    expect(faseDoDia(9, 0)).toBe('abordagem')
  })
  it('vai de qualificação a fechamento conforme o dia avança', () => {
    expect(faseDoDia(0, 1)).toBe('qualificacao')
    expect(faseDoDia(2, 2)).toBe('interesse')
    expect(faseDoDia(5, 3)).toBe('agendamento')
    expect(faseDoDia(9, 4)).toBe('fechamento')
  })
})

describe('juntar', () => {
  const seed: BibliotecaVendas = {
    ...vazia(),
    cadencias: [{ id: 's1', nome: 'Social Media', mensagens: [] }],
    roteiros: [{ id: 's2', nome: 'Clínica', perguntas: [] }],
    reaquecimento: { leads: [{ id: 's3', nome: 'Base fria', quando: 'x', mensagens: [] }], clientes: [] },
  }

  it('o MIGRADO vem primeiro — é o que a equipe usa hoje', () => {
    const r = juntar(seed, migrarPlaybook(antigo))
    expect(r.cadencias[0].nome).toBe('Playbook anterior')
    expect(r.cadencias[1].nome).toBe('Social Media')
    expect(r.reaquecimento.leads[0].nome).toBe('Playbook anterior')
  })

  it('sem playbook antigo, fica só o seed do nicho', () => {
    const r = juntar(seed, migrarPlaybook(null))
    expect(r.cadencias).toHaveLength(1)
    expect(r.cadencias[0].nome).toBe('Social Media')
  })

  it('objeções vêm só do seed (o playbook antigo não tinha essa seção)', () => {
    const r = juntar({ ...seed, objecoes: [{ id: 'o1', nome: 'Preço', respostas: [] }] }, migrarPlaybook(antigo))
    expect(r.objecoes).toHaveLength(1)
  })
})

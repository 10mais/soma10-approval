import { describe, it, expect } from 'vitest'
import { apareceNoPlanner, dataDePostagem, ordenarPorPostagem } from '@/lib/plannerFiltro'

// Cada caso aqui é uma regressão que JÁ aconteceu em produção. Se um destes
// quebrar, material real está sumindo da tela do dono.
describe('apareceNoPlanner', () => {
  it('mostra o criativo em aprovação (regressão 2026-07-15: "2 criativos em aprovação e não aparecem")', () => {
    expect(apareceNoPlanner({ status: 'aguardando_aprovacao', etapa: 'aprovacao_criativo' })).toBe(true)
  })

  it('mostra o criativo em aprovação que voltou em ajuste', () => {
    expect(apareceNoPlanner({ status: 'corrigir', etapa: 'aprovacao_criativo' })).toBe(true)
  })

  it('mostra rascunho avulso (regressão 2026-07-14: rascunho sumia ao ser salvo)', () => {
    expect(apareceNoPlanner({ status: 'rascunho' })).toBe(true)
  })

  it('mostra rascunho INTERNO para a equipe — quem barra o cliente é a API, não este filtro', () => {
    expect(apareceNoPlanner({ status: 'rascunho', rascunhoInterno: true })).toBe(true)
  })

  it('mostra post em ajuste', () => {
    expect(apareceNoPlanner({ status: 'corrigir' })).toBe(true)
  })

  it('mostra post agendado e publicado', () => {
    expect(apareceNoPlanner({ status: 'agendado' })).toBe(true)
    expect(apareceNoPlanner({ status: 'publicado', etapa: 'pronto' })).toBe(true)
  })

  it('mostra pauta da esteira que chegou em pronto', () => {
    expect(apareceNoPlanner({ status: 'agendado', etapa: 'pronto', planoId: 'plano-1' })).toBe(true)
  })

  it('esconde a pauta que ainda não tem arte (aprovacao_copy vive no Studio)', () => {
    expect(apareceNoPlanner({ status: 'aguardando_aprovacao', etapa: 'aprovacao_copy' })).toBe(false)
  })

  it('mantém como histórico o publicado com etapa presa numa etapa antiga', () => {
    expect(apareceNoPlanner({ status: 'publicado', etapa: 'aprovacao_copy' })).toBe(true)
    expect(apareceNoPlanner({ status: 'falha_publicacao', etapa: 'aprovacao_copy' })).toBe(true)
  })
})

describe('ordem do Planner — por DATA DE POSTAGEM, não por quem foi mexido por último', () => {
  it('dataDePostagem prefere a data agendada e ignora atualizadoEm', () => {
    expect(dataDePostagem({ dataAgendada: '2026-10-05T11:30:00Z', criadoEm: '2026-09-01T00:00:00Z', atualizadoEm: '2026-09-09T11:29:00Z' })).toBe('2026-10-05T11:30:00Z')
    expect(dataDePostagem({ criadoEm: '2026-09-01T00:00:00Z', atualizadoEm: '2026-09-09T11:29:00Z' })).toBe('2026-09-01T00:00:00Z')
    expect(dataDePostagem({})).toBe('')
  })

  it('a peça mexida agora NÃO pula para o topo: quem manda é a data de postagem', () => {
    const agendadoFuturo = { id: 'out', dataAgendada: '2026-10-05T11:30:00Z', atualizadoEm: '2026-09-01T00:00:00Z' }
    const emAprovacao = { id: 'aprov', criadoEm: '2026-09-09T11:29:00Z', atualizadoEm: '2026-09-09T23:00:00Z' }
    const agendadoSetembro = { id: 'set', dataAgendada: '2026-09-28T11:30:00Z', atualizadoEm: '2026-09-09T22:00:00Z' }
    const publicadoAgosto = { id: 'ago', dataAgendada: '2026-08-13T17:30:00Z', atualizadoEm: '2026-09-09T21:00:00Z' }
    const ordem = ordenarPorPostagem([emAprovacao, publicadoAgosto, agendadoFuturo, agendadoSetembro]).map(p => p.id)
    expect(ordem).toEqual(['out', 'set', 'aprov', 'ago'])
  })

  it('sem data nenhuma vai para o fim e a lista original não é mexida', () => {
    const lista = [{ id: 'sem' }, { id: 'com', dataAgendada: '2026-09-01T00:00:00Z' }]
    expect(ordenarPorPostagem(lista).map(p => p.id)).toEqual(['com', 'sem'])
    expect(lista.map(p => p.id)).toEqual(['sem', 'com'])
  })
})

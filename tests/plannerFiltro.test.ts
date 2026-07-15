import { describe, it, expect } from 'vitest'
import { apareceNoPlanner } from '@/lib/plannerFiltro'

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

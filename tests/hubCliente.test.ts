import { describe, it, expect } from 'vitest'
import { resumoDoCliente } from '@/lib/hubCliente'

// A página inicial do hub do cliente mostra estes números na cara da equipe.
// Um "0 aguardando" errado esconde um cliente parado; um "atrasada" errado
// acusa alguém sem motivo.

const AGORA = new Date(2026, 8, 6, 12, 0).getTime() // domingo 06/09/2026
const em = (dia: number, hora = 10) => new Date(2026, 8, dia, hora).toISOString()

describe('resumoDoCliente — posts', () => {
  it('conta aguardando cliente, em produção, prontos e publicados no mês', () => {
    const r = resumoDoCliente({ agora: AGORA, posts: [
      { id: 'a', etapa: 'aprovacao_copy', aguardandoDesde: em(1) },
      { id: 'b', etapa: 'aprovacao_criativo', aguardandoDesde: em(3) },
      { id: 'c', etapa: 'copy' },
      { id: 'd', etapa: 'pronto' },
      { id: 'e', status: 'publicado', dataAgendada: em(2) },
      { id: 'f', status: 'publicado', dataAgendada: new Date(2026, 6, 2).toISOString() },
      { id: 'g', etapa: 'aprovacao_copy', excluidoEm: em(1) },
    ] })
    expect(r.posts.aguardandoCliente).toBe(2)
    expect(r.posts.aguardando.map(i => i.id)).toEqual(['a', 'b']) // mais antigo primeiro
    expect(r.posts.emProducao).toBe(1)
    expect(r.posts.prontos).toBe(1)
    expect(r.posts.publicadosMes).toBe(1)
  })
  it('próximas publicações = programadas nos 7 dias, em ordem', () => {
    const r = resumoDoCliente({ agora: AGORA, posts: [
      { id: 'b', status: 'agendado', dataAgendada: em(9) },
      { id: 'a', status: 'agendado', dataAgendada: em(7) },
      { id: 'longe', status: 'agendado', dataAgendada: em(20) },
      { id: 'passou', status: 'agendado', dataAgendada: em(1) },
    ] })
    expect(r.posts.proximasPublicacoes.map(i => i.id)).toEqual(['a', 'b'])
  })
})

describe('resumoDoCliente — tarefas', () => {
  it('abertas e atrasadas; atrasadas vêm primeiro, depois por prazo', () => {
    const r = resumoDoCliente({ agora: AGORA, tarefas: [
      { id: 'sem', titulo: 'Sem prazo', status: 'a_fazer' },
      { id: 'prox', titulo: 'Próxima', status: 'em_andamento', prazo: em(10) },
      { id: 'atr', titulo: 'Atrasada', status: 'a_fazer', prazo: em(2), responsavelNome: 'Ana' },
      { id: 'ok', titulo: 'Feita', status: 'concluido', prazo: em(2) },
    ] })
    expect(r.tarefas.abertas).toBe(3)
    expect(r.tarefas.atrasadas).toBe(1)
    expect(r.tarefas.lista.map(i => i.id)).toEqual(['atr', 'prox', 'sem'])
    expect(r.tarefas.lista[0].detalhe).toBe('Ana · atrasada')
  })
  it('prazo de hoje não é atraso', () => {
    const r = resumoDoCliente({ agora: AGORA, tarefas: [{ id: 'h', titulo: 'Hoje', status: 'a_fazer', prazo: em(6, 0) }] })
    expect(r.tarefas.atrasadas).toBe(0)
  })
})

describe('resumoDoCliente — playbook e studio', () => {
  it('etapas: total, concluídas, em andamento e atrasadas', () => {
    const r = resumoDoCliente({ agora: AGORA, marcos: [
      { id: '1', titulo: 'Onboarding', status: 'concluido' },
      { id: '2', titulo: 'Lançamento', status: 'em_andamento', dataFim: em(1) },
      { id: '3', titulo: 'Futuro', status: 'planejado', dataFim: em(30) },
      { id: '4', titulo: 'Cancelado', status: 'cancelado', dataFim: em(1) },
    ] })
    expect(r.playbook.total).toBe(4)
    expect(r.playbook.concluidas).toBe(1)
    expect(r.playbook.emAndamento.map(m => m.id)).toEqual(['2'])
    expect(r.playbook.atrasadas).toBe(1)
  })
  it('plano do mês atual e pautas por etapa', () => {
    const r = resumoDoCliente({ agora: AGORA,
      planos: [{ id: 'p9', mes: 9, ano: 2026 }, { id: 'p8', mes: 8, ano: 2026 }],
      posts: [
        { id: 'a', planoId: 'p9', etapa: 'copy' },
        { id: 'b', planoId: 'p9', etapa: 'copy' },
        { id: 'c', planoId: 'p9', etapa: 'pronto' },
        { id: 'd', planoId: 'p8', etapa: 'pronto' },
      ] })
    expect(r.studio.planoDoMes?.id).toBe('p9')
    expect(r.studio.pautasDoMes).toBe(3)
    expect(r.studio.porEtapa).toEqual({ copy: 2, pronto: 1 })
  })
  it('sem plano no mês: zero pautas, sem quebrar', () => {
    const r = resumoDoCliente({ agora: AGORA })
    expect(r.studio.planoDoMes).toBeUndefined()
    expect(r.studio.pautasDoMes).toBe(0)
  })
})

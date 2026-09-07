import { describe, it, expect } from 'vitest'
import { resumoDaPessoa, ordenarPorUrgencia, fmtMinutos } from '@/lib/hubPessoa'

// O card do colaborador é o que cada pessoa abre para saber "o que está
// assinalado para mim". Errar o grupo (atrasada x hoje) muda a prioridade do
// dia de alguém; errar as horas mexe em custo por cliente.

const AGORA = new Date(2026, 8, 7, 11, 0).getTime() // segunda 07/09/2026
const em = (dia: number, hora = 9) => new Date(2026, 8, dia, hora).toISOString()
const EU = 'ana@10mais.com.br'

describe('resumoDaPessoa — grupos por prazo', () => {
  it('só tarefas do e-mail; abertas por atrasadas / hoje / semana / depois / sem prazo', () => {
    const r = resumoDaPessoa({ email: EU, agora: AGORA, tarefas: [
      { id: 'atr', titulo: 'Atrasada', status: 'a_fazer', prazo: em(5), responsavelEmail: EU },
      { id: 'hoje', titulo: 'Hoje', status: 'em_andamento', prazo: em(7, 23), responsavelEmail: EU },
      { id: 'sem', titulo: 'Semana', status: 'a_fazer', prazo: em(12), responsavelEmail: EU },
      { id: 'dep', titulo: 'Depois', status: 'a_fazer', prazo: em(25), responsavelEmail: EU },
      { id: 'np', titulo: 'Sem prazo', status: 'em_revisao', responsavelEmail: EU },
      { id: 'outro', titulo: 'De outro', status: 'a_fazer', prazo: em(5), responsavelEmail: 'x@10mais.com.br' },
      { id: 'feita', titulo: 'Feita', status: 'concluido', prazo: em(5), responsavelEmail: EU, concluidoEm: em(6) },
    ] })
    expect(r.abertas).toBe(5)
    expect(r.atrasadas.map(t => t.id)).toEqual(['atr'])
    expect(r.hoje.map(t => t.id)).toEqual(['hoje'])
    expect(r.semana.map(t => t.id)).toEqual(['sem'])
    expect(r.depois.map(t => t.id)).toEqual(['dep'])
    expect(r.semPrazo.map(t => t.id)).toEqual(['np'])
  })
  it('e-mail compara sem diferenciar maiúsculas', () => {
    const r = resumoDaPessoa({ email: 'Ana@10mais.com.br', agora: AGORA, tarefas: [{ id: 'a', titulo: 'A', status: 'a_fazer', responsavelEmail: EU }] })
    expect(r.abertas).toBe(1)
  })
  it('ordena por prazo e, no empate, por prioridade', () => {
    const lista = [
      { id: 'b', titulo: 'B', status: 'a_fazer', prazo: em(10), prioridade: 'baixa' },
      { id: 'u', titulo: 'U', status: 'a_fazer', prazo: em(10), prioridade: 'urgente' },
      { id: 'c', titulo: 'C', status: 'a_fazer', prazo: em(8), prioridade: 'baixa' },
      { id: 'n', titulo: 'N', status: 'a_fazer' },
    ].sort(ordenarPorUrgencia)
    expect(lista.map(t => t.id)).toEqual(['c', 'u', 'b', 'n'])
  })
})

describe('resumoDaPessoa — últimos 7 dias e clientes', () => {
  it('concluídas nos últimos 7 dias, mais recentes primeiro; antigas ficam de fora', () => {
    const r = resumoDaPessoa({ email: EU, agora: AGORA, tarefas: [
      { id: 'a', titulo: 'A', status: 'concluido', responsavelEmail: EU, concluidoEm: em(2) },
      { id: 'b', titulo: 'B', status: 'concluido', responsavelEmail: EU, concluidoEm: em(6) },
      { id: 'velha', titulo: 'V', status: 'concluido', responsavelEmail: EU, concluidoEm: new Date(2026, 7, 1).toISOString() },
    ] })
    expect(r.concluidas7d.map(t => t.id)).toEqual(['b', 'a'])
  })
  it('minutos apontados contam em qualquer tarefa, só os da pessoa e só dos últimos 7 dias', () => {
    const r = resumoDaPessoa({ email: EU, agora: AGORA, tarefas: [
      { id: 'x', titulo: 'De outro', status: 'a_fazer', responsavelEmail: 'x@10mais.com.br', apontamentos: [
        { usuarioEmail: EU, minutos: 90, data: em(4) },
        { usuarioEmail: 'x@10mais.com.br', minutos: 60, data: em(4) },
        { usuarioEmail: EU, minutos: 45, data: new Date(2026, 7, 1).toISOString() },
      ] },
    ] })
    expect(r.minutos7d).toBe(90)
    expect(fmtMinutos(90)).toBe('1h30')
  })
  it('por cliente (tarefas abertas) e a lista de clientes = explícitos + inferidos', () => {
    const r = resumoDaPessoa({ email: EU, agora: AGORA, clientesResponsavel: ['c9'], tarefas: [
      { id: '1', titulo: 'A', status: 'a_fazer', responsavelEmail: EU, clienteId: 'c1', clienteNome: 'GL' },
      { id: '2', titulo: 'B', status: 'a_fazer', responsavelEmail: EU, clienteId: 'c1', clienteNome: 'GL' },
      { id: '3', titulo: 'C', status: 'a_fazer', responsavelEmail: EU },
      { id: '4', titulo: 'D', status: 'concluido', responsavelEmail: EU, clienteId: 'c2' },
    ] })
    expect(r.porCliente).toEqual([{ clienteId: 'c1', clienteNome: 'GL', abertas: 2 }, { clienteId: '', clienteNome: 'Interno', abertas: 1 }])
    expect(r.clientes.sort()).toEqual(['c1', 'c9'])
  })
})

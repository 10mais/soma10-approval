import { describe, it, expect } from 'vitest'
import { visaoDoCliente, textoResumoSemana } from '@/lib/planoAcao'
import type { SubEtapa } from '@/lib/subetapas'

// F3 do plano de ação (17/11/2026): o cliente vê a semana, o andamento e o que depende dele;
// a equipe copia o resumo da semana para o WhatsApp.

const e = (id: string, extra: Partial<SubEtapa> = {}): SubEtapa => ({ id, titulo: id, status: 'pendente', ...extra })
const ANA = { responsavelTipo: 'equipe' as const, responsavelNome: 'Ana Turcato', responsavelEmail: 'ana@x' }
const CLI = { responsavelTipo: 'cliente' as const, responsavelNome: 'Cliente' }
const hoje = '2026-11-17'

const marcos = [
  { id: 'm4', tipo: 'semana', dataInicio: '2026-11-09', foco: 'Prova social', subetapas: [
    e('Anúncio de rádio', { ...ANA, status: 'concluido', dataFim: '2026-11-13' }),
    e('Briefing de fotos', { ...ANA, dataFim: '2026-11-13' }),
    e('Fotos dos pacientes', { ...CLI, dataFim: '2026-11-12' }),
  ] },
  { id: 'm5', tipo: 'semana', dataInicio: '2026-11-16', foco: 'Ativar campanhas', subetapas: [
    e('Planejamento de campanhas', { ...ANA, status: 'em_andamento', dataFim: '2026-11-18' }),
    e('Post Gilberto', { dataFim: '2026-11-20' }),
    e('Verba liberada', { ...CLI, dataFim: '2026-11-19' }),
    e('Post antigo pronto', { ...ANA, status: 'concluido', dataFim: '2026-11-16' }),
  ] },
  { id: 'm6', tipo: 'semana', dataInicio: '2026-11-23', foco: 'Plano de dezembro', subetapas: [
    e('Plano de dezembro', { responsavelTipo: 'equipe', responsavelNome: 'Théo Grassel', dataFim: '2026-11-27' }),
    e('Aprovar plano de dezembro', { ...CLI, dataFim: '2026-11-28' }),
  ] },
  { id: 'm7', tipo: 'semana', dataInicio: '2026-11-30', foco: 'Relatório', subetapas: [e('Vendas de novembro', { ...CLI, dataFim: '2026-12-04' })] },
]

describe('visão do cliente', () => {
  const v = visaoDoCliente(marcos, hoje)!
  it('semana atual com foco e andamento real', () => {
    expect(v).toMatchObject({ numero: 2, total: 4, foco: 'Ativar campanhas', segunda: '2026-11-16', domingo: '2026-11-22' })
    expect(v.previstas).toBe(10)
    expect(v.concluidas).toBe(2)
    expect(v.pct).toBe(20)
  })
  it('"depende de você": só do cliente, abertas, até a próxima semana, atrasada primeiro', () => {
    expect(v.dependeDeVoce.map(x => [x.titulo, x.situacao])).toEqual([
      ['Fotos dos pacientes', 'atrasado'], ['Verba liberada', 'previsto'], ['Aprovar plano de dezembro', 'previsto'],
    ])
    expect(v.dependeDeVoce.every(x => x.quem === 'Você')).toBe(true)
  })
  it('nesta semana: a equipe, com o primeiro nome; entregue vai para o fim', () => {
    expect(v.nestaSemana.map(x => [x.titulo, x.situacao, x.quem])).toEqual([
      ['Planejamento de campanhas', 'em_andamento', 'Ana'], ['Post Gilberto', 'previsto', 'Equipe'], ['Post antigo pronto', 'entregue', 'Ana'],
    ])
  })
  it('semana passada: só o que foi entregue', () => {
    expect(v.semanaPassada.map(x => x.titulo)).toEqual(['Anúncio de rádio'])
  })
  it('próxima semana com o foco e os itens', () => {
    expect(v.proxima).toEqual({ numero: 3, foco: 'Plano de dezembro', entregas: ['Plano de dezembro', 'Aprovar plano de dezembro'] })
  })
  it('primeira semana não tem semana passada; última não tem próxima', () => {
    expect(visaoDoCliente(marcos, hoje, 1)?.semanaPassada).toEqual([])
    expect(visaoDoCliente(marcos, hoje, 4)?.proxima).toBeUndefined()
  })
  it('a resposta não carrega e-mail de ninguém', () => {
    expect(JSON.stringify(v)).not.toContain('@')
  })
})

describe('resumo da semana para o WhatsApp', () => {
  const v = visaoDoCliente(marcos, hoje)!
  const t = textoResumoSemana(v, 'Angelo Cortez')
  it('abre com o primeiro nome, a semana e o período', () => {
    expect(t.split('\n')[0]).toBe('Olá, Angelo! Resumo da semana 2 de 4 (16/11 a 22/11).')
  })
  it('foco, andamento e as três listas, sem emoji', () => {
    expect(t).toContain('Foco da semana: Ativar campanhas')
    expect(t).toContain('Andamento do plano: 20% (2 de 10 entregas)')
    expect(t).toContain('Entregue na semana passada:\n• Anúncio de rádio')
    expect(t).toContain('• Planejamento de campanhas (até 18/11)')
    expect(t).not.toContain('Post antigo pronto') // já entregue não entra em "a equipe entrega"
    expect(t).toContain('Precisamos de você:\n• Fotos dos pacientes (até 12/11)')
    expect(/[\uD83C-\uDBFF][\uDC00-\uDFFF]|[☀-➿]/.test(t)).toBe(false) // emoji (o tsconfig não aceita a flag u)
  })
  it('seção vazia não aparece', () => {
    const t1 = textoResumoSemana(visaoDoCliente(marcos, hoje, 1)!)
    expect(t1).not.toContain('semana passada')
    expect(t1.startsWith('Olá! ')).toBe(true)
  })
})

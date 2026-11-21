import { describe, it, expect } from 'vitest'
import { statusDaEntrega, statusDaEtapa, janelaDoPeriodo, moverPeriodo, posicao, mesesDaJanela, marcasDaJanela, roadmapDoCliente, faixasPorStatus, faixasPorMes, resumoDosClientes, type MarcoRoad } from '@/lib/roadmapEntregas'
import type { SubEtapa } from '@/lib/subetapas'

// Mudança 3 (21/11/2026): Linha do tempo do Plano de entregas.
const hoje = '2026-11-21'
const e = (id: string, extra: Partial<SubEtapa> = {}): SubEtapa => ({ id, titulo: id, status: 'pendente', ...extra })
const M = (id: string, extra: Partial<MarcoRoad> = {}): MarcoRoad => ({ id, clienteId: 'c1', titulo: id, dataInicio: '2026-11-01', ...extra })

describe('status da entrega (calculado, nunca o digitado)', () => {
  it('todas as etapas feitas = entregue, mesmo com status manual antigo', () => {
    expect(statusDaEntrega(M('a', { status: 'planejado', subetapas: [e('1', { status: 'concluido' })] }), hoje)).toBe('concluido')
  })
  it('etapa com prazo vencido = atrasado', () => {
    expect(statusDaEntrega(M('a', { subetapas: [e('1', { dataFim: '2026-11-10' }), e('2', { status: 'concluido' })] }), hoje)).toBe('atrasado')
  })
  it('sem etapas: fim passado = atrasado; começou = em andamento; futuro = a seguir', () => {
    expect(statusDaEntrega(M('a', { dataInicio: '2026-10-01', dataFim: '2026-10-31' }), hoje)).toBe('atrasado')
    expect(statusDaEntrega(M('a', { dataInicio: '2026-11-10', dataFim: '2026-12-10' }), hoje)).toBe('andamento')
    expect(statusDaEntrega(M('a', { dataInicio: '2026-12-01', dataFim: '2026-12-20' }), hoje)).toBe('a_fazer')
  })
  it('marco concluído à mão sem etapas = entregue; recesso não atrasa', () => {
    expect(statusDaEntrega(M('a', { status: 'concluido', dataFim: '2026-10-01' }), hoje)).toBe('concluido')
    expect(statusDaEtapa(e('1', { dataFim: '2026-11-01' }), hoje, true)).not.toBe('atrasado')
  })
})

describe('período', () => {
  it('janelas alinhadas ao calendário', () => {
    expect(janelaDoPeriodo('mes', '2026-11-21')).toMatchObject({ inicio: '2026-11-01', fim: '2026-11-30', dias: 30, rotulo: 'Novembro 2026' })
    expect(janelaDoPeriodo('trimestre', '2026-11-21')).toMatchObject({ inicio: '2026-10-01', fim: '2026-12-31', rotulo: '4º trimestre 2026' })
    expect(janelaDoPeriodo('semestre', '2026-03-05')).toMatchObject({ inicio: '2026-01-01', fim: '2026-06-30', rotulo: '1º semestre 2026' })
    expect(janelaDoPeriodo('ano', '2026-11-21')).toMatchObject({ inicio: '2026-01-01', fim: '2026-12-31', dias: 365 })
  })
  it('andar períodos atravessa o ano', () => {
    expect(moverPeriodo('trimestre', '2026-11-21', 1)).toBe('2027-02-01')
    expect(moverPeriodo('mes', '2026-01-15', -1)).toBe('2025-12-01')
  })
  it('posição em % presa nas pontas', () => {
    const j = janelaDoPeriodo('mes', '2026-11-01')
    expect(posicao(j, '2026-11-01')).toBe(0)
    expect(Math.round(posicao(j, '2026-11-16'))).toBe(50)
    expect(posicao(j, '2027-01-01')).toBe(100)
  })
  it('cabeçalho: meses no trimestre, semanas no mês', () => {
    expect(mesesDaJanela(janelaDoPeriodo('trimestre', '2026-11-01')).map(m => m.rotulo)).toEqual(['out', 'nov', 'dez'])
    expect(marcasDaJanela(janelaDoPeriodo('mes', '2026-11-01')).map(m => m.rotulo)).toEqual(['01/11', '08/11', '15/11', '22/11', '29/11'])
  })
})

describe('linha do tempo de um cliente', () => {
  const j = janelaDoPeriodo('trimestre', hoje)
  const marcos = [
    M('Onboarding', { dataInicio: '2026-10-01', dataFim: '2026-10-15', subetapas: [e('k', { status: 'concluido', dataFim: '2026-10-10' })] }),
    M('Landing page', { dataInicio: '2026-10-20', dataFim: '2026-11-15', subetapas: [e('lp', { dataFim: '2026-11-15' }), e('lp2', { status: 'concluido', dataFim: '2026-11-01' })] }),
    M('Campanhas', { dataInicio: '2026-11-10', dataFim: '2026-12-15' }),
    M('Janeiro', { dataInicio: '2027-01-05', dataFim: '2027-01-30' }),
    M('Cancelado', { status: 'cancelado', dataInicio: '2026-11-01', dataFim: '2026-11-30' }),
    M('w1', { tipo: 'semana', dataInicio: '2026-11-16', dataFim: '2026-11-22', foco: 'Ativar campanhas', subetapas: [e('v', { dataFim: '2026-11-19' }), e('r', { status: 'concluido', dataFim: '2026-11-17' })] }),
    M('w0', { tipo: 'semana', dataInicio: '2026-11-09', dataFim: '2026-11-15', subetapas: [e('x', { dataFim: '2026-11-13' })] }),
  ]
  const r = roadmapDoCliente(marcos, j, hoje)
  it('só o que cruza o período; cancelado fica de fora; semanas viram uma faixa', () => {
    expect(r.faixas.map(f => f.titulo)).toEqual(['Onboarding', 'Landing page', 'Plano por semanas', 'Campanhas'])
    expect(r.faixas.find(f => f.id === 'semanas')!.segmentos).toHaveLength(2)
  })
  it('contadores: cada marco conta 1, cada entrega da semana conta 1', () => {
    expect(r.contadores).toEqual({ concluido: 2, andamento: 1, atrasado: 3, a_fazer: 0 }) // a entrega v (19/11) já venceu
    expect(r.total).toBe(6)
    expect(r.pctEntregue).toBe(33)
  })
  it('progresso e etapas como pontos na faixa', () => {
    const lp = r.faixas.find(f => f.titulo === 'Landing page')!
    expect(lp.status).toBe('atrasado')
    expect(lp.pct).toBe(50)
    expect(lp.etapas.map(p => [p.id, p.status])).toEqual([['lp', 'atrasado'], ['lp2', 'concluido']])
  })
  it('linha do hoje dentro do período', () => {
    expect(r.hoje).not.toBeNull()
    expect(roadmapDoCliente(marcos, janelaDoPeriodo('mes', '2027-03-01'), hoje).hoje).toBeNull()
  })
  it('cards: atrasado primeiro, entregue por último', () => {
    expect(faixasPorStatus(r).map(g => [g.status, g.faixas.length])).toEqual([['atrasado', 2], ['andamento', 1], ['a_fazer', 0], ['concluido', 1]])
  })
  it('celular: agrupado pelo mês em que termina', () => {
    expect(faixasPorMes(r).map(g => g.rotulo)).toEqual(['Outubro 2026', 'Novembro 2026', 'Dezembro 2026'])
  })
})

describe('todos os clientes', () => {
  const j = janelaDoPeriodo('trimestre', hoje)
  const marcos = [
    M('ok', { clienteId: 'a', clienteNome: 'Casa Pampa', status: 'concluido', dataInicio: '2026-10-01', dataFim: '2026-10-10' }),
    M('atraso1', { clienteId: 'b', clienteNome: 'Dr. Angelo', dataInicio: '2026-10-01', dataFim: '2026-10-30' }),
    M('atraso2', { clienteId: 'b', clienteNome: 'Dr. Angelo', dataInicio: '2026-10-01', dataFim: '2026-11-10' }),
    M('segue', { clienteId: 'b', clienteNome: 'Dr. Angelo', dataInicio: '2026-12-01', dataFim: '2026-12-20' }),
    M('fora', { clienteId: 'c', clienteNome: 'Sem nada no período', dataInicio: '2025-01-01', dataFim: '2025-02-01' }),
  ]
  const l = resumoDosClientes(marcos, j, hoje)
  it('quem tem atraso primeiro; cliente sem nada no período some', () => {
    expect(l.map(x => x.clienteNome)).toEqual(['Dr. Angelo', 'Casa Pampa'])
  })
  it('próxima entrega aberta: a mais urgente', () => {
    expect(l[0].proximo).toEqual({ titulo: 'atraso1', dia: '2026-10-30', status: 'atrasado' })
    expect(l[1].proximo).toBeUndefined()
    expect(l[1].pctEntregue).toBe(100)
  })
  it('nome do cadastro vence o gravado no marco', () => {
    expect(resumoDosClientes(marcos, j, hoje, { a: 'Casa Pampa Móveis' }).find(x => x.clienteId === 'a')?.clienteNome).toBe('Casa Pampa Móveis')
  })
})

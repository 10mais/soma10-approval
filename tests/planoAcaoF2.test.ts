import { describe, it, expect } from 'vitest'
import { ehReuniao, tipoTarefaDaFrente, entregasParaCriarTarefa, reconciliarEntregas, visaoDaSemana, textoRelogio, type TarefaLigada } from '@/lib/planoAcao'
import type { SubEtapa } from '@/lib/subetapas'

// F2 do plano de ação (17/11/2026): a entrega da equipe nasce com a tarefa e o status volta
// da tarefa; a visão da equipe responde "o que sai esta semana e quem está atrasado?".

const e = (id: string, extra: Partial<SubEtapa> = {}): SubEtapa => ({ id, titulo: id, status: 'pendente', ...extra })
const ANA = { responsavelTipo: 'equipe' as const, responsavelNome: 'Ana Turcato', responsavelEmail: 'ana@10mais.com' }

describe('quais entregas viram tarefa', () => {
  const hoje = '2026-11-17'
  const semanas = [
    { id: 'w4', subetapas: [e('atrasada', { ...ANA, dataFim: '2026-11-13' }), e('feita', { ...ANA, status: 'concluido', dataFim: '2026-11-13' })] },
    { id: 'w5', subetapas: [
      e('perto', { ...ANA, dataFim: '2026-11-20' }),
      e('ja-ligada', { ...ANA, dataFim: '2026-11-20', vinculo: { tipo: 'tarefa', id: 't9' } }),
      e('Reunião semanal (17/11)', { ...ANA, dataFim: '2026-11-17' }),
      e('do-cliente', { responsavelTipo: 'cliente', responsavelNome: 'Cliente', dataFim: '2026-11-18' }),
      e('so-nome', { responsavelTipo: 'equipe', responsavelNome: 'Fulano', dataFim: '2026-11-18' }),
      e('sem-prazo', { ...ANA }),
    ] },
    { id: 'w8', subetapas: [e('longe', { ...ANA, dataFim: '2026-12-11' })] },
    { id: 'w11', recesso: true, subetapas: [e('recesso', { ...ANA, dataFim: '2026-11-20' })] },
  ]
  it('só a equipe com e-mail, sem tarefa, aberta, com prazo dentro de 14 dias (atrasada entra)', () => {
    expect(entregasParaCriarTarefa(semanas, hoje).map(x => x.entrega.id)).toEqual(['atrasada', 'perto'])
  })
  it('janela maior pega a semana mais longe', () => {
    expect(entregasParaCriarTarefa(semanas, hoje, 30).map(x => x.entrega.id)).toContain('longe')
  })
  it('reunião fica na agenda', () => {
    expect(ehReuniao('Reunião semanal (20/10)')).toBe(true)
    expect(ehReuniao('reuniao de kickoff')).toBe(true)
    expect(ehReuniao('Ata da reunião')).toBe(false)
  })
  it('tipo da tarefa pela frente', () => {
    expect(tipoTarefaDaFrente('videos')).toBe('video')
    expect(tipoTarefaDaFrente('trafego')).toBe('campanha')
    expect(tipoTarefaDaFrente(undefined)).toBe('tarefa')
  })
})

describe('status volta da tarefa', () => {
  const dia = (iso?: string) => (iso || '').slice(0, 10)
  const ligadas = new Map<string, TarefaLigada>([
    ['t1', { id: 't1', status: 'concluido', concluidoEm: '2026-11-16T15:00:00.000Z' }],
    ['t2', { id: 't2', status: 'em_revisao' }],
    ['t3', { id: 't3', status: 'a_fazer', responsavelEmail: 'theo@10mais.com', responsavelNome: 'Théo Grassel' }],
    ['t4', { id: 't4', status: 'descartado' }],
  ])
  const entregas = [
    e('a', { ...ANA, vinculo: { tipo: 'tarefa', id: 't1' } }),
    e('b', { ...ANA, vinculo: { tipo: 'tarefa', id: 't2' } }),
    e('c', { ...ANA, vinculo: { tipo: 'tarefa', id: 't3' } }),
    e('d', { ...ANA, status: 'em_andamento', vinculo: { tipo: 'tarefa', id: 't4' } }),
    e('e', { ...ANA, vinculo: { tipo: 'tarefa', id: 'sumiu' } }),
    e('f', { ...ANA, status: 'concluido' }),
  ]
  const r = reconciliarEntregas(entregas, ligadas, dia)
  it('concluída leva o dia da conclusão; em revisão vira em andamento', () => {
    expect(r.entregas[0]).toMatchObject({ status: 'concluido', concluidaEm: '2026-11-16' })
    expect(r.entregas[1].status).toBe('em_andamento')
  })
  it('trocar o responsável na tarefa troca na entrega', () => {
    expect(r.entregas[2]).toMatchObject({ status: 'pendente', responsavelEmail: 'theo@10mais.com', responsavelNome: 'Théo Grassel' })
  })
  it('tarefa descartada ou sumida não mexe; sem vínculo fica como está', () => {
    expect(r.entregas[3].status).toBe('em_andamento')
    expect(r.entregas[4]).toBe(entregas[4])
    expect(r.entregas[5]).toBe(entregas[5])
    expect(r.mudou).toBe(true)
  })
  it('nada mudou = não grava', () => {
    expect(reconciliarEntregas(r.entregas, ligadas, dia).mudou).toBe(false)
  })
  it('tarefa reaberta tira a conclusão', () => {
    const reaberta = reconciliarEntregas([e('x', { status: 'concluido', concluidaEm: '2026-11-10', vinculo: { tipo: 'tarefa', id: 'r' } })], new Map([['r', { id: 'r', status: 'em_ajuste' }]]), dia)
    expect(reaberta.entregas[0].status).toBe('em_andamento')
    expect(reaberta.entregas[0].concluidaEm).toBeUndefined()
  })
})

describe('visão da semana (equipe)', () => {
  const hoje = '2026-11-17'
  const marcos = [
    { id: 'm4', tipo: 'semana', dataInicio: '2026-11-09', foco: 'Prova social', subetapas: [
      e('briefing', { ...ANA, frente: 'social_media', dataFim: '2026-11-13' }),
      e('radio', { ...ANA, frente: 'social_media', status: 'concluido', dataFim: '2026-11-13' }),
    ] },
    { id: 'm1', tipo: 'semana', dataInicio: '2026-10-19', foco: 'Onboarding', subetapas: [e('kickoff', { ...ANA, status: 'concluido', dataFim: '2026-10-23' })] },
    { id: 'm5', tipo: 'semana', dataInicio: '2026-11-16', foco: 'Ativar campanhas', subetapas: [
      e('reuniao', { ...ANA, frente: 'consultoria', dataFim: '2026-11-17' }),
      e('gilberto', { frente: 'social_media', dataFim: '2026-11-16' }),
      e('campanhas', { ...ANA, frente: 'trafego', dataFim: '2026-11-20' }),
      e('verba', { responsavelTipo: 'cliente', responsavelNome: 'Cliente', frente: 'trafego', dataFim: '2026-11-19' }),
    ] },
    { id: 'm6', tipo: 'semana', dataInicio: '2026-11-23', foco: 'Plano de dezembro', subetapas: [e('plano-dez')] },
    { id: 'm7', tipo: 'semana', dataInicio: '2026-11-30', foco: 'Relatório', subetapas: [] },
    { id: 'm8', tipo: 'semana', dataInicio: '2026-12-07', foco: 'Captação', subetapas: [] },
    { id: 'outro', dataInicio: '2026-11-01', titulo: 'Marco comum', subetapas: [e('x')] },
  ]
  const v = visaoDaSemana(marcos, hoje)!

  it('abre na semana atual com número, período e foco', () => {
    expect(v).toMatchObject({ numero: 5, total: 8, segunda: '2026-11-16', domingo: '2026-11-22', foco: 'Ativar campanhas', marcoId: 'm5' })
  })
  it('frente com atraso sobe; dentro dela, o mais urgente primeiro', () => {
    expect(v.grupos.map(g => g.rotulo)).toEqual(['Social media', 'Consultoria', 'Tráfego'])
    expect(v.grupos[2].entregas.map(x => x.id)).toEqual(['verba', 'campanhas'])
    expect(v.grupos[1].entregas[0].relogio.estado).toBe('vence_hoje')
  })
  it('atrasadas de semanas anteriores aparecem à parte', () => {
    expect(v.atrasadasAntes.map(x => [x.id, x.semana])).toEqual([['briefing', 4]])
  })
  it('três destaques: atrasadas, sem responsável, esperando o cliente', () => {
    expect(v.destaques).toEqual({ atrasadas: 2, semDono: 1, doCliente: 1 })
  })
  it('as duas próximas semanas, curtas', () => {
    expect(v.proximas.map(p => p.numero)).toEqual([6, 7])
  })
  it('navega para outra semana pelo número', () => {
    expect(visaoDaSemana(marcos, hoje, 1)?.foco).toBe('Onboarding')
    expect(visaoDaSemana(marcos, hoje, 99)?.numero).toBe(5) // número que não existe: semana atual
  })
  it('progresso do plano inteiro, sem o marco comum', () => {
    expect(v.progresso).toMatchObject({ previstas: 8, concluidas: 2 })
  })
  it('% no prazo não conta contra o que vence hoje e ainda não saiu', () => {
    // vencidas: briefing (13/11, aberta), radio (13/11, feita), kickoff (23/10, feita), gilberto (16/11, aberta) = 4
    // a reunião vence hoje e está aberta: fica fora
    expect(v.progresso.vencidas).toBe(4)
    expect(v.progresso.pctNoPrazo).toBe(50)
  })
  it('sem semanas, sem visão', () => {
    expect(visaoDaSemana([{ id: 'x', dataInicio: '2026-11-01' }], hoje)).toBeNull()
  })
  it('texto do relógio', () => {
    expect(textoRelogio({ estado: 'atrasada', dias: 3 })).toBe('atrasada há 3 dias')
    expect(textoRelogio({ estado: 'atrasada', dias: 1 })).toBe('atrasada há 1 dia')
    expect(textoRelogio({ estado: 'no_prazo', dias: 1 })).toBe('vence amanhã')
    expect(textoRelogio({ estado: 'vence_hoje', dias: 0 })).toBe('vence hoje')
  })
})

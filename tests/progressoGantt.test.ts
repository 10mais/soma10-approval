import { describe, it, expect } from 'vitest'
import { duracaoDias, ordenarPorDuracao, progressoTempo, textoTempo, progressoTarefas, pctConclusaoEtapa, pctConclusaoMarco } from '@/lib/progressoGantt'

const HOJE = new Date('2026-09-10T15:00:00Z').getTime() // 10/09/2026

describe('progressoGantt — o mais longo em cima, conclusão por tarefas, tempo em dias', () => {
  it('duração conta os dois extremos e nunca é zero', () => {
    expect(duracaoDias('2026-09-08', '2026-09-08')).toBe(1)
    expect(duracaoDias('2026-09-08', '2026-09-10')).toBe(3)
    expect(duracaoDias('2026-09-08T00:00:00.000Z', '2026-09-30T00:00:00.000Z')).toBe(23)
    expect(duracaoDias('2026-09-08')).toBe(1)
  })

  it('ordena do mais longo para o mais curto; empate vai pela data e depois pela ordem original', () => {
    const itens = [
      { id: 'curto', ini: '2026-09-01', fim: '2026-09-03' },
      { id: 'longo', ini: '2026-09-05', fim: '2026-10-05' },
      { id: 'set', ini: '2026-09-01', fim: '2026-09-10' },
      { id: 'out', ini: '2026-10-01', fim: '2026-10-10' }, // mesma duração de "set", começa depois
    ]
    const ordenado = ordenarPorDuracao(itens, i => ({ ini: i.ini, fim: i.fim }))
    expect(ordenado.map(i => i.id)).toEqual(['longo', 'set', 'out', 'curto'])
    // estabilidade: mesma duração e mesma data mantêm a ordem de entrada
    const iguais = [{ id: 'a', ini: '2026-09-01', fim: '2026-09-05' }, { id: 'b', ini: '2026-09-01', fim: '2026-09-05' }]
    expect(ordenarPorDuracao(iguais, i => ({ ini: i.ini, fim: i.fim })).map(i => i.id)).toEqual(['a', 'b'])
  })

  it('tempo: percentual percorrido, dias que faltam e frase em português', () => {
    const emCurso = progressoTempo('2026-09-08', '2026-09-18', HOJE)
    expect(emCurso).toMatchObject({ diasTotais: 11, diasRestantes: 8, comecou: true, venceu: false })
    expect(emCurso.pct).toBe(18)
    expect(textoTempo(emCurso)).toBe('faltam 8 dias')

    const vence = progressoTempo('2026-09-01', '2026-09-10', HOJE)
    expect(textoTempo(vence)).toBe('vence hoje')
    expect(vence.venceu).toBe(false)

    const atrasado = progressoTempo('2026-09-01', '2026-09-07', HOJE)
    expect(atrasado).toMatchObject({ diasRestantes: -3, venceu: true })
    expect(atrasado.pct).toBe(100)
    expect(textoTempo(atrasado)).toBe('3 dias de atraso')

    const futuro = progressoTempo('2026-09-14', '2026-09-20', HOJE)
    expect(futuro).toMatchObject({ comecou: false, pct: 0 })
    expect(textoTempo(futuro)).toBe('começa em 4 dias')
    expect(textoTempo(progressoTempo('2026-09-11', '2026-09-20', HOJE))).toBe('começa amanhã')
    expect(textoTempo(progressoTempo('2026-09-01', '2026-09-11', HOJE))).toBe('falta 1 dia')
  })

  it('tarefas: cada concluída é um check; descartada sai da conta', () => {
    expect(progressoTarefas([{ status: 'concluido' }, { status: 'a_fazer' }, { status: 'descartado' }])).toEqual({ feitas: 1, total: 2, pct: 50 })
    expect(progressoTarefas([])).toEqual({ feitas: 0, total: 0, pct: 0 })
    expect(progressoTarefas(undefined).total).toBe(0)
  })

  it('etapa: tarefas mandam; sem tarefas vale o KPI; sem os dois, o status', () => {
    const etapa = { status: 'em_andamento', kpiMeta: 10, kpiAtual: 9 }
    expect(pctConclusaoEtapa(etapa, [{ status: 'concluido' }, { status: 'em_andamento' }, { status: 'a_fazer' }, { status: 'concluido' }])).toBe(50)
    expect(pctConclusaoEtapa(etapa, [])).toBe(90)
    expect(pctConclusaoEtapa({ status: 'em_andamento' }, [])).toBe(50)
    expect(pctConclusaoEtapa({ status: 'concluido' }, undefined)).toBe(100)
    expect(pctConclusaoEtapa({}, [])).toBe(0)
  })

  it('marco: média das etapas (com as tarefas de cada uma); sem etapas, as tarefas do marco', () => {
    const marco = { status: 'em_andamento', subetapas: [{ id: 's1', status: 'concluido' }, { id: 's2', status: 'pendente' }] }
    const semTarefas = () => []
    expect(pctConclusaoMarco(marco, semTarefas, [])).toBe(50)
    const comTarefas = (id: string) => (id === 's2' ? [{ status: 'concluido' }, { status: 'a_fazer' }] : [])
    expect(pctConclusaoMarco(marco, comTarefas, [])).toBe(75) // s1 100 (status) + s2 50 (tarefas)
    expect(pctConclusaoMarco({ status: 'em_andamento' }, semTarefas, [{ status: 'concluido' }, { status: 'a_fazer' }, { status: 'a_fazer' }, { status: 'a_fazer' }])).toBe(25)
    expect(pctConclusaoMarco({ status: 'em_andamento' }, semTarefas, [])).toBe(50)
    expect(pctConclusaoMarco({ status: 'concluido' }, semTarefas, undefined)).toBe(100)
  })
})

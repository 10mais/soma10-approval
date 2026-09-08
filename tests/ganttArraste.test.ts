import { describe, it, expect } from 'vitest'
import { deslocarData, diasEntre, pxParaDias, aplicarArraste, janelaParaCaber, rotulosMeses, colunasFimDeSemana, rotuloPeriodo, MS_DIA } from '@/lib/ganttArraste'

const marco = {
  dataInicio: '2026-09-08T00:00:00.000Z', dataFim: '2026-09-30T00:00:00.000Z',
  subetapas: [
    { id: 's1', titulo: 'Setembro', status: 'pendente' as const, dataInicio: '2026-09-08', dataFim: '2026-09-15' },
    { id: 's2', titulo: 'Sem datas', status: 'pendente' as const },
  ],
}

describe('ganttArraste — mover e redimensionar barras em dias inteiros', () => {
  it('deslocarData preserva o formato (YYYY-MM-DD e ISO) e ignora zero', () => {
    expect(deslocarData('2026-09-08', 7)).toBe('2026-09-15')
    expect(deslocarData('2026-09-30', 1)).toBe('2026-10-01')
    expect(deslocarData('2026-09-08T00:00:00.000Z', -8)).toBe('2026-08-31T00:00:00.000Z')
    expect(deslocarData('2026-09-08', 0)).toBe('2026-09-08')
    expect(deslocarData(undefined, 3)).toBeUndefined()
    expect(diasEntre('2026-09-08', '2026-09-15T00:00:00.000Z')).toBe(7)
  })

  it('pixels viram dias arredondados', () => {
    expect(pxParaDias(41, 40)).toBe(1)
    expect(pxParaDias(-61, 40)).toBe(-2)
    expect(pxParaDias(10, 0)).toBe(0)
  })

  it('mover o marco leva início, fim e as etapas com data; etapa sem data fica como está', () => {
    const p = aplicarArraste(marco, { tipo: 'mover', dias: 7 })!
    expect(p.dataInicio).toBe('2026-09-15T00:00:00.000Z')
    expect(p.dataFim).toBe('2026-10-07T00:00:00.000Z')
    expect(p.subetapas![0]).toMatchObject({ dataInicio: '2026-09-15', dataFim: '2026-09-22' })
    expect(p.subetapas![1]).toEqual(marco.subetapas[1])
    expect(aplicarArraste(marco, { tipo: 'mover', dias: 0 })).toBeNull()
  })

  it('puxar as pontas do marco não mexe nas etapas e nunca cruza a outra ponta', () => {
    expect(aplicarArraste(marco, { tipo: 'inicio', dias: 3 })).toEqual({ dataInicio: '2026-09-11T00:00:00.000Z' })
    expect(aplicarArraste(marco, { tipo: 'inicio', dias: 40 })).toEqual({ dataInicio: '2026-09-30T00:00:00.000Z' })
    expect(aplicarArraste(marco, { tipo: 'fim', dias: -5 })).toEqual({ dataFim: '2026-09-25T00:00:00.000Z' })
    expect(aplicarArraste(marco, { tipo: 'fim', dias: -60 })).toEqual({ dataFim: '2026-09-08T00:00:00.000Z' })
    // marco sem fim: puxar a ponta cria o fim a partir do início
    expect(aplicarArraste({ dataInicio: '2026-09-08T00:00:00.000Z' }, { tipo: 'fim', dias: 10 })).toEqual({ dataFim: '2026-09-18T00:00:00.000Z' })
  })

  it('etapa: mover/redimensionar grava YYYY-MM-DD; sem datas herda as do marco; antes do marco estende o marco', () => {
    const p = aplicarArraste(marco, { tipo: 'mover', subId: 's1', dias: 2 })!
    expect(p.subetapas![0]).toMatchObject({ dataInicio: '2026-09-10', dataFim: '2026-09-17' })
    expect(p.dataInicio).toBeUndefined()
    const herda = aplicarArraste(marco, { tipo: 'fim', subId: 's2', dias: -10 })!
    expect(herda.subetapas![1]).toMatchObject({ dataInicio: '2026-09-08', dataFim: '2026-09-20' })
    const antes = aplicarArraste(marco, { tipo: 'mover', subId: 's1', dias: -3 })!
    expect(antes.subetapas![0]).toMatchObject({ dataInicio: '2026-09-05', dataFim: '2026-09-12' })
    expect(antes.dataInicio).toBe('2026-09-05T00:00:00.000Z')
    const trava = aplicarArraste(marco, { tipo: 'inicio', subId: 's1', dias: 30 })!
    expect(trava.subetapas![0]).toMatchObject({ dataInicio: '2026-09-15', dataFim: '2026-09-15' })
    expect(aplicarArraste(marco, { tipo: 'mover', subId: 'nao-existe', dias: 2 })).toBeNull()
  })

  it('janelaParaCaber cobre marcos e etapas com folga; vazio cai em 30 dias ao redor de hoje', () => {
    const j = janelaParaCaber([marco, { dataInicio: '2026-11-01', subetapas: [{ id: 'x', titulo: 'x', status: 'pendente', dataFim: '2026-12-15' }] }])
    expect(j.inicioMs).toBeLessThan(new Date('2026-09-08T00:00:00Z').getTime())
    expect(j.inicioMs + j.dias * MS_DIA).toBeGreaterThan(new Date('2026-12-15T00:00:00Z').getTime())
    expect(janelaParaCaber([]).dias).toBe(30)
  })

  it('eixo: meses, fins de semana e rótulo do período', () => {
    const ini = new Date(2026, 8, 20).getTime() // 20/09/2026 (domingo)
    const meses = rotulosMeses(ini, 30)
    expect(meses.map(m => m.txt)).toEqual(['set/2026', 'out/2026'])
    expect(meses[0].pct).toBe(0)
    expect(meses[1].pct).toBeCloseTo((11 / 30) * 100, 5)
    const fds = colunasFimDeSemana(ini, 14)
    expect(fds.map(f => Math.round(f.pct))).toEqual([Math.round((6 / 14) * 100), Math.round((13 / 14) * 100)])
    expect(fds[1].larguraPct).toBeCloseTo((1 / 14) * 100, 5)
    expect(colunasFimDeSemana(ini, 200)).toEqual([])
    expect(rotuloPeriodo('2026-09-08', '2026-10-01T00:00:00.000Z')).toBe('08/09 – 01/10')
    expect(rotuloPeriodo('2026-09-08', '2026-09-08')).toBe('08/09')
  })
})

import { describe, it, expect } from 'vitest'
import {
  metaVazia, normalizaMeta, distribuirAnual, totalAno, metaIntervalo,
  intervaloMes, intervaloTrimestre, intervaloAno, intervaloSemana,
  dataDoGanho, realizadoNoIntervalo, progresso,
} from '@/lib/metas'

// A meta é uma promessa de número: se a soma dos meses não fechar com o ano, ou
// se uma venda de agosto for parar em outubro, o painel vira ficção.

const meta2026 = { ano: 2026, meses: [10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000] }

describe('definição da meta', () => {
  it('meta vazia tem 12 meses zerados', () => {
    const m = metaVazia(2026)
    expect(m.meses).toHaveLength(12)
    expect(totalAno(m)).toBe(0)
  })

  it('distribuir o anual fecha EXATAMENTE com o total (a sobra vai em dezembro)', () => {
    for (const total of [120000, 100000, 99999.99, 7, 0]) {
      const meses = distribuirAnual(total)
      expect(meses).toHaveLength(12)
      expect(totalAno({ ano: 2026, meses })).toBeCloseTo(total, 2)
    }
    // 100.000 / 12 não é redondo: onze meses iguais e dezembro com a sobra
    const m = distribuirAnual(100000)
    expect(m[0]).toBe(8333.33)
    expect(m[11]).toBe(8333.37)
  })

  it('meta do banco corrompida não derruba a tela nem inventa número', () => {
    const m = normalizaMeta({ meses: ['abc', -5, null, 1000] }, 2026)
    expect(m.meses).toHaveLength(12)
    expect(m.meses[0]).toBe(0)
    expect(m.meses[1]).toBe(0)
    expect(m.meses[3]).toBe(1000)
    expect(normalizaMeta(undefined, 2026).meses.every(v => v === 0)).toBe(true)
  })
})

describe('recortes (ano, trimestre, mês, semana)', () => {
  it('o ano é a soma dos meses', () => {
    const [de, ate] = intervaloAno(2026)
    expect(metaIntervalo(meta2026, de, ate)).toBe(120000)
  })

  it('o trimestre é a soma exata dos seus 3 meses — sem erro de proporção', () => {
    const meta = { ano: 2026, meses: [10000, 20000, 30000, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
    const [de, ate] = intervaloTrimestre(2026, 0)
    expect(metaIntervalo(meta, de, ate)).toBe(60000)
    expect(metaIntervalo(meta, ...intervaloTrimestre(2026, 1))).toBe(0)
  })

  it('o mês devolve o valor cheio daquele mês', () => {
    const meta = { ano: 2026, meses: [0, 0, 0, 0, 0, 0, 31000, 0, 0, 0, 0, 0] }
    expect(metaIntervalo(meta, ...intervaloMes(2026, 6))).toBe(31000)
  })

  it('a semana é a fatia proporcional aos dias do mês', () => {
    // julho tem 31 dias; uma semana inteira dentro dele = 7/31 da meta do mês
    const meta = { ano: 2026, meses: [0, 0, 0, 0, 0, 0, 31000, 0, 0, 0, 0, 0] }
    const [de, ate] = intervaloSemana(new Date(2026, 6, 15))
    expect(metaIntervalo(meta, de, ate)).toBeCloseTo(7000, 2)
  })

  it('semana que cruza a virada do mês soma os DOIS meses', () => {
    // 30 dias em junho (meta 30.000 = 1.000/dia) e 31 em julho (31.000 = 1.000/dia)
    const meta = { ano: 2026, meses: [0, 0, 0, 0, 0, 30000, 31000, 0, 0, 0, 0, 0] }
    const [de, ate] = intervaloSemana(new Date(2026, 5, 30)) // semana de 29/06 a 05/07
    expect(metaIntervalo(meta, de, ate)).toBeCloseTo(7000, 2)
  })

  it('a semana vai de segunda a domingo', () => {
    const [seg, dom] = intervaloSemana(new Date(2026, 7, 29)) // sábado
    expect(seg.getDay()).toBe(1)
    expect(dom.getDay()).toBe(0)
    expect(dom.getDate() - seg.getDate()).toBe(6)
  })
})

describe('realizado — de onde vem o número', () => {
  it('a venda pertence à data em que foi GANHA, não à última edição', () => {
    // ganho em agosto, editado em outubro: continua sendo faturamento de agosto
    expect(dataDoGanho({ fechadoEm: '2026-08-10T12:00:00.000Z', atualizadoEm: '2026-10-02T09:00:00.000Z' })).toBe('2026-08-10T12:00:00.000Z')
  })

  it('negócio antigo (sem fechadoEm) cai na atividade "ganho" da timeline', () => {
    const n = {
      atualizadoEm: '2026-10-02T09:00:00.000Z',
      atividades: [{ tipo: 'estagio', criadoEm: '2026-08-01T10:00:00.000Z' }, { tipo: 'ganho', criadoEm: '2026-08-10T10:00:00.000Z' }],
    }
    expect(dataDoGanho(n)).toBe('2026-08-10T10:00:00.000Z')
  })

  it('sem nenhuma pista, usa a última atualização (e nunca quebra)', () => {
    expect(dataDoGanho({ atualizadoEm: '2026-08-10T10:00:00.000Z' })).toBe('2026-08-10T10:00:00.000Z')
    expect(dataDoGanho({})).toBe('')
  })

  const negocios = [
    { id: '1', valor: 3000, status: 'ganho', fechadoEm: '2026-08-05T10:00:00.000Z', pipelineId: 'p1' },
    { id: '2', valor: 2000, status: 'ganho', fechadoEm: '2026-08-20T10:00:00.000Z', pipelineId: 'p2' },
    { id: '3', valor: 9000, status: 'aberto', fechadoEm: '2026-08-21T10:00:00.000Z', pipelineId: 'p1' },
    { id: '4', valor: 5000, status: 'perdido', fechadoEm: '2026-08-22T10:00:00.000Z', pipelineId: 'p1' },
    { id: '5', valor: 7000, status: 'ganho', fechadoEm: '2026-09-02T10:00:00.000Z', pipelineId: 'p1' },
    { id: '6', valor: 1000, status: 'ganho', pipelineId: 'p1' }, // sem data nenhuma
  ]

  it('soma só o que foi ganho DENTRO do intervalo', () => {
    const r = realizadoNoIntervalo(negocios, ...intervaloMes(2026, 7))
    expect(r.valor).toBe(5000)
    expect(r.qtd).toBe(2)
    expect(r.negocios.map(n => n.id)).toEqual(['2', '1']) // mais recente primeiro
  })

  it('em aberto e perdido não contam — só dinheiro fechado', () => {
    const r = realizadoNoIntervalo(negocios, ...intervaloMes(2026, 7))
    expect(r.negocios.some(n => n.id === '3' || n.id === '4')).toBe(false)
  })

  it('dá para medir a meta de um funil só', () => {
    expect(realizadoNoIntervalo(negocios, ...intervaloMes(2026, 7), 'p1').valor).toBe(3000)
    expect(realizadoNoIntervalo(negocios, ...intervaloMes(2026, 7), 'p2').valor).toBe(2000)
  })
})

describe('progresso do período', () => {
  const [de, ate] = intervaloMes(2026, 7) // agosto: 31 dias

  it('quanto falta, em R$ e em %', () => {
    const p = progresso(10000, 4000, de, ate, new Date(2026, 7, 15))
    expect(p.falta).toBe(6000)
    expect(p.pct).toBe(40)
    expect(p.excedente).toBe(0)
  })

  it('passar da meta é excedente — "falta" nunca fica negativo', () => {
    const p = progresso(10000, 12000, de, ate, new Date(2026, 7, 31))
    expect(p.falta).toBe(0)
    expect(p.excedente).toBe(2000)
    expect(p.situacao).toBe('batida')
  })

  it('diz onde a régua DEVERIA estar hoje e projeta o fechamento', () => {
    // dia 15 de 31: deveria ter ~48% da meta
    const p = progresso(31000, 10000, de, ate, new Date(2026, 7, 15))
    expect(p.diasDecorridos).toBe(15)
    expect(p.diasTotais).toBe(31)
    expect(p.esperadoAteHoje).toBe(15000)
    expect(p.projecao).toBeCloseTo(20666.67, 1)
    expect(p.situacao).toBe('atrasado')
  })

  it('no ritmo tem folga de 5% para os dois lados', () => {
    expect(progresso(31000, 15000, de, ate, new Date(2026, 7, 15)).situacao).toBe('no_ritmo')
    expect(progresso(31000, 20000, de, ate, new Date(2026, 7, 15)).situacao).toBe('adiantado')
  })

  it('mês futuro não conta dias decorridos (nem projeta do nada)', () => {
    const p = progresso(10000, 0, de, ate, new Date(2026, 6, 1))
    expect(p.diasDecorridos).toBe(0)
    expect(p.esperadoAteHoje).toBe(0)
    expect(p.projecao).toBe(0)
  })

  it('mês passado conta o período inteiro, não mais que isso', () => {
    const p = progresso(10000, 8000, de, ate, new Date(2026, 11, 1))
    expect(p.diasDecorridos).toBe(31)
    expect(p.esperadoAteHoje).toBe(10000)
  })

  it('sem meta definida não divide por zero nem acusa atraso', () => {
    const p = progresso(0, 5000, de, ate, new Date(2026, 7, 15))
    expect(p.semMeta).toBe(true)
    expect(p.pct).toBe(0)
    expect(p.falta).toBe(0)
    expect(p.situacao).toBe('sem_meta')
  })
})

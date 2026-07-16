import { describe, it, expect } from 'vitest'
import {
  periodoDaViagem, periodos, inicioDaSemana, semanasDoMes,
  segmentosDoMes, faixasNaSemana, listaPorMes, reguaGantt, linhasGantt, marcosDeMes,
  type ViagemCal,
} from '@/lib/calendarioViagens'

// A viagem ATRAVESSA dias: 27/07 → 02/08 cruza a semana E o mês. Errar o recorte
// esconde saída do dono; errar o empilhamento desenha uma viagem por cima da outra
// e some com uma delas.

const v = (id: string, dataIda: string, dataVolta?: string, titulo = 'Viagem ' + id): ViagemCal =>
  ({ id, titulo, dataIda, dataVolta })

describe('periodoDaViagem', () => {
  it('usa ida e volta', () => {
    expect(periodoDaViagem(v('1', '2026-07-27', '2026-08-02'))).toMatchObject({ inicio: '2026-07-27', fim: '2026-08-02' })
  })

  it('sem volta é bate-volta — 1 dia, não barra infinita', () => {
    expect(periodoDaViagem(v('1', '2026-07-27'))).toMatchObject({ inicio: '2026-07-27', fim: '2026-07-27' })
  })

  it('volta ANTES da ida vira bate-volta, não barra negativa', () => {
    expect(periodoDaViagem(v('1', '2026-07-27', '2026-07-20'))).toMatchObject({ inicio: '2026-07-27', fim: '2026-07-27' })
  })

  it('sem ida não entra no calendário', () => {
    expect(periodoDaViagem(v('1', ''))).toBeNull()
    expect(periodos([v('1', ''), v('2', '2026-07-27')])).toHaveLength(1)
  })
})

describe('semanas', () => {
  it('a semana começa na SEGUNDA', () => {
    expect(inicioDaSemana('2026-07-29')).toBe('2026-07-27') // quarta → segunda
    expect(inicioDaSemana('2026-07-27')).toBe('2026-07-27') // segunda → ela mesma
    expect(inicioDaSemana('2026-08-02')).toBe('2026-07-27') // domingo → segunda anterior
  })

  it('semanasDoMes cobre o mês inteiro, com 7 dias por linha', () => {
    const s = semanasDoMes(2026, 6) // julho/2026
    expect(s.every(x => x.length === 7)).toBe(true)
    expect(s[0]).toContain('2026-07-01')
    expect(s[s.length - 1]).toContain('2026-07-31')
  })

  it('inclui os dias vizinhos que completam a primeira e a última semana', () => {
    const s = semanasDoMes(2026, 6) // 01/07/2026 é quarta
    expect(s[0][0]).toBe('2026-06-29') // segunda de junho
    expect(s[s.length - 1]).toContain('2026-08-02') // domingo de agosto
  })

  it('mês que começa na segunda não ganha semana fantasma antes', () => {
    const s = semanasDoMes(2026, 5) // junho/2026 começa numa segunda
    expect(s[0][0]).toBe('2026-06-01')
  })
})

describe('segmentosDoMes — a barra que atravessa', () => {
  it('viagem de uma semana só vira UM segmento', () => {
    const s = segmentosDoMes([v('1', '2026-07-28', '2026-07-30')], 2026, 6)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ col: 1, span: 3, comecaAqui: true, terminaAqui: true })
  })

  it('viagem que CRUZA a virada de semana vira DOIS segmentos', () => {
    // 15/07 (qua) a 21/07 (ter): semana 13-19 e semana 20-26
    const s = segmentosDoMes([v('1', '2026-07-15', '2026-07-21')], 2026, 6)
    expect(s).toHaveLength(2)
    expect(s[0]).toMatchObject({ col: 2, span: 5, comecaAqui: true, terminaAqui: false })
    expect(s[1]).toMatchObject({ col: 0, span: 2, comecaAqui: false, terminaAqui: true })
    // 27/07 (seg) a 02/08 (dom) = a semana inteira, um segmento só
    expect(segmentosDoMes([v('1', '2026-07-27', '2026-08-02')], 2026, 6)).toHaveLength(1)
  })

  it('a grade do mês para na última semana dele — o resto é problema de agosto', () => {
    // 30/07 (qui) a 04/08 (ter). A grade de julho vai até 02/08 (dom); a semana de
    // 03/08 pertence a agosto. Julho mostra o pedaço até 02/08, sem "terminaAqui".
    const s = segmentosDoMes([v('1', '2026-07-30', '2026-08-04')], 2026, 6)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ col: 3, span: 4, comecaAqui: true, terminaAqui: false })
  })

  it('viagem do mês ANTERIOR aparece recortada, sem "comecaAqui"', () => {
    // 28/06 (dom) a 02/07: a grade de julho começa na segunda 29/06, então o
    // começo real fica fora — a barra entra pela coluna 0, cortada.
    const s = segmentosDoMes([v('1', '2026-06-28', '2026-07-02')], 2026, 6)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ col: 0, comecaAqui: false, terminaAqui: true })
  })

  it('a MESMA viagem aparece em julho e em agosto, cada mês com o seu pedaço', () => {
    const viagem = v('1', '2026-07-30', '2026-08-04')
    const julho = segmentosDoMes([viagem], 2026, 6)
    const agosto = segmentosDoMes([viagem], 2026, 7)
    expect(julho.length).toBeGreaterThan(0)
    expect(agosto.length).toBeGreaterThan(0)
    expect(julho.some(s => s.comecaAqui)).toBe(true)
    expect(agosto.some(s => s.terminaAqui)).toBe(true)
  })

  it('viagem fora do mês não entra', () => {
    expect(segmentosDoMes([v('1', '2026-03-10', '2026-03-12')], 2026, 6)).toEqual([])
  })

  it('bate-volta ocupa uma coluna', () => {
    const s = segmentosDoMes([v('1', '2026-07-15')], 2026, 6)
    expect(s).toHaveLength(1)
    expect(s[0].span).toBe(1)
  })
})

describe('empilhamento — duas viagens no mesmo dia não podem sumir', () => {
  it('viagens que se sobrepõem vão para faixas diferentes', () => {
    const s = segmentosDoMes([v('1', '2026-07-14', '2026-07-16'), v('2', '2026-07-15', '2026-07-17')], 2026, 6)
    const faixas = s.map(x => x.faixa)
    expect(new Set(faixas).size).toBe(2)
  })

  it('viagens que NÃO se cruzam dividem a mesma faixa', () => {
    const s = segmentosDoMes([v('1', '2026-07-14', '2026-07-15'), v('2', '2026-07-17', '2026-07-18')], 2026, 6)
    expect(s.every(x => x.faixa === 0)).toBe(true)
  })

  it('encostar conta como cruzar — uma termina no dia em que a outra começa', () => {
    const s = segmentosDoMes([v('1', '2026-07-14', '2026-07-16'), v('2', '2026-07-16', '2026-07-18')], 2026, 6)
    expect(new Set(s.map(x => x.faixa)).size).toBe(2)
  })

  it('três sobrepostas geram três faixas', () => {
    const s = segmentosDoMes([
      v('1', '2026-07-14', '2026-07-18'), v('2', '2026-07-15', '2026-07-17'), v('3', '2026-07-16', '2026-07-16'),
    ], 2026, 6)
    expect(new Set(s.map(x => x.faixa)).size).toBe(3)
    expect(faixasNaSemana(s, s[0].semana)).toBe(3)
  })

  it('é determinístico — a ordem de entrada não muda o desenho', () => {
    const a = segmentosDoMes([v('1', '2026-07-14', '2026-07-16'), v('2', '2026-07-15', '2026-07-17')], 2026, 6)
    const b = segmentosDoMes([v('2', '2026-07-15', '2026-07-17'), v('1', '2026-07-14', '2026-07-16')], 2026, 6)
    const chave = (s: typeof a) => s.map(x => `${x.id}:${x.faixa}:${x.col}`).sort().join('|')
    expect(chave(a)).toBe(chave(b))
  })

  it('faixasNaSemana é 0 na semana sem viagem', () => {
    expect(faixasNaSemana([], 0)).toBe(0)
  })
})

describe('listaPorMes', () => {
  it('agrupa por mês e ordena pela ida', () => {
    const g = listaPorMes([v('2', '2026-08-05'), v('1', '2026-07-27'), v('3', '2026-07-10')])
    expect(g.map(x => x.mes)).toEqual(['2026-07', '2026-08'])
    expect(g[0].viagens.map(x => x.id)).toEqual(['3', '1'])
  })

  it('viagem sem ida fica fora da lista', () => {
    expect(listaPorMes([v('1', '')])).toEqual([])
  })
})

describe('gantt', () => {
  const tres = [v('1', '2026-07-27', '2026-08-02'), v('2', '2026-07-30', '2026-07-31'), v('3', '2026-08-10', '2026-08-12')]

  it('a régua vai do começo da primeira ao fim da última', () => {
    expect(reguaGantt(tres)).toEqual({ inicio: '2026-07-27', fim: '2026-08-12', dias: 17 })
  })

  it('sem viagem não há régua', () => {
    expect(reguaGantt([])).toBeNull()
    expect(linhasGantt([])).toEqual([])
  })

  it('cada linha sai posicionada pelo offset e com a duração', () => {
    const l = linhasGantt(tres)
    expect(l.map(x => x.id)).toEqual(['1', '2', '3']) // ordenado pela ida
    expect(l[0]).toMatchObject({ offset: 0, duracao: 7 })
    expect(l[1]).toMatchObject({ offset: 3, duracao: 2 })
    expect(l[2]).toMatchObject({ offset: 14, duracao: 3 })
  })

  it('bate-volta tem duração 1 — barra visível, não zero', () => {
    expect(linhasGantt([v('1', '2026-07-27')])[0].duracao).toBe(1)
  })

  it('marcosDeMes rotula onde cada mês começa na régua', () => {
    const m = marcosDeMes('2026-07-27', 17)
    expect(m).toEqual([{ offset: 0, rotulo: 'jul 2026' }, { offset: 5, rotulo: 'ago 2026' }])
  })

  it('marcosDeMes atravessa o ano', () => {
    expect(marcosDeMes('2026-12-30', 5).map(x => x.rotulo)).toEqual(['dez 2026', 'jan 2027'])
  })

  it('marcosDeMes com entrada inválida não quebra', () => {
    expect(marcosDeMes('', 10)).toEqual([])
    expect(marcosDeMes('2026-07-27', 0)).toEqual([])
  })
})

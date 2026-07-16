import { describe, it, expect } from 'vitest'
import {
  somarDias, dataVoltaSugerida, diasENoites, diaParaData, dataParaDia, materializarRoteiro, copiarPacoteParaViagem,
  valorDaReserva, precoDaFaixa, vendePoltrona,
  type PacoteLite, type ParadaModeloLite,
} from '@/lib/pacoteViagem'

// Duas regras que cobram errado se quebrarem: (1) dia relativo → data real (o mesmo
// pacote sai em julho e dezembro); (2) fretamento é valor FECHADO, pacote é por
// cliente — aplicar a regra do pacote num fretamento cobraria 40× o combinado.

const id = (i: number) => `p${i}`

describe('somarDias', () => {
  it('soma dentro do mês', () => {
    expect(somarDias('2026-07-15', 0)).toBe('2026-07-15')
    expect(somarDias('2026-07-15', 3)).toBe('2026-07-18')
  })

  it('atravessa mês, ano e fevereiro sem escorregar', () => {
    expect(somarDias('2026-07-31', 1)).toBe('2026-08-01')
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-02-28', 1)).toBe('2026-03-01') // 2026 não é bissexto
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29') // 2028 é
  })

  it('anda para trás', () => {
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('dataVoltaSugerida', () => {
  it('a ida conta como dia 1', () => {
    expect(dataVoltaSugerida('2026-07-20', 3)).toBe('2026-07-22')
    expect(dataVoltaSugerida('2026-07-20', 1)).toBe('2026-07-20') // bate-volta
  })

  it('sem duração ou com data inválida, não sugere', () => {
    expect(dataVoltaSugerida('2026-07-20', undefined)).toBeUndefined()
    expect(dataVoltaSugerida('2026-07-20', 0)).toBeUndefined()
    expect(dataVoltaSugerida('20/07/2026', 3)).toBeUndefined()
  })
})

describe('materializarRoteiro', () => {
  const roteiro: ParadaModeloLite[] = [
    { id: 'm2', dia: 2, hora: '09:00', titulo: 'Cataratas', local: 'Foz', tipo: 'passeio' },
    { id: 'm1', dia: 1, hora: '22:00', titulo: 'Embarque', tipo: 'embarque' },
    { id: 'm3', dia: 3, titulo: 'Retorno' },
  ]

  it('Dia 1 é a ida e os demais caminham a partir dela', () => {
    const r = materializarRoteiro(roteiro, '2026-07-20', id)
    expect(r.map(p => p.data)).toEqual(['2026-07-20', '2026-07-21', '2026-07-22'])
    expect(r.map(p => p.titulo)).toEqual(['Embarque', 'Cataratas', 'Retorno'])
  })

  it('o MESMO pacote serve julho e dezembro', () => {
    expect(materializarRoteiro(roteiro, '2026-12-30', id).map(p => p.data))
      .toEqual(['2026-12-30', '2026-12-31', '2027-01-01'])
  })

  it('ordena por dia e depois por hora', () => {
    const r = materializarRoteiro([
      { id: 'b', dia: 1, hora: '18:00', titulo: 'Jantar' },
      { id: 'a', dia: 1, hora: '08:00', titulo: 'Café' },
    ], '2026-07-20', id)
    expect(r.map(p => p.titulo)).toEqual(['Café', 'Jantar'])
  })

  it('dá id NOVO — a viagem é dona das paradas dela', () => {
    const r = materializarRoteiro(roteiro, '2026-07-20', id)
    expect(r.map(p => p.id)).toEqual(['p0', 'p1', 'p2'])
    expect(r.some(p => p.id === 'm1')).toBe(false)
  })

  it('descarta dia inválido em vez de gerar data absurda', () => {
    const r = materializarRoteiro([
      { id: 'x', dia: 0, titulo: 'Zero' },
      { id: 'y', dia: -3, titulo: 'Negativo' },
      { id: 'z', dia: 1, titulo: 'Válido' },
    ], '2026-07-20', id)
    expect(r).toHaveLength(1)
    expect(r[0].titulo).toBe('Válido')
  })

  it('sem roteiro ou com ida inválida, devolve vazio', () => {
    expect(materializarRoteiro(undefined, '2026-07-20', id)).toEqual([])
    expect(materializarRoteiro([], '2026-07-20', id)).toEqual([])
    expect(materializarRoteiro(roteiro, '', id)).toEqual([])
  })

  it('não carrega campo opcional vazio para a parada', () => {
    const r = materializarRoteiro([{ id: 'm', dia: 1, titulo: 'Só título' }], '2026-07-20', id)
    expect(r[0]).toEqual({ id: 'p0', data: '2026-07-20', titulo: 'Só título' })
  })
})

describe('copiarPacoteParaViagem', () => {
  const pacote: PacoteLite = {
    id: 'pac1', nome: 'Foz do Iguaçu 3 dias', destino: 'Foz do Iguaçu/PR', dias: 3,
    valorBase: 1200, inclusos: ['Hospedagem', 'Café'],
    roteiroPadrao: [{ id: 'm1', dia: 1, titulo: 'Embarque' }, { id: 'm2', dia: 3, titulo: 'Retorno' }],
    observacoes: 'Levar documento',
  }

  it('a viagem NASCE com os dados do modelo, já em datas reais', () => {
    const c = copiarPacoteParaViagem(pacote, '2026-07-20', id)
    expect(c.titulo).toBe('Foz do Iguaçu 3 dias')
    expect(c.roteiro).toBe('Foz do Iguaçu/PR')
    expect(c.dataVolta).toBe('2026-07-22')
    expect(c.valorPacote).toBe(1200)
    expect(c.inclusos).toEqual(['Hospedagem', 'Café'])
    expect(c.paradas.map(p => p.data)).toEqual(['2026-07-20', '2026-07-22'])
    expect(c.pacoteId).toBe('pac1')
  })

  it('é CÓPIA — mexer na viagem não contamina o pacote', () => {
    const c = copiarPacoteParaViagem(pacote, '2026-07-20', id)
    c.inclusos.push('Seguro')
    expect(pacote.inclusos).toEqual(['Hospedagem', 'Café'])
  })

  it('pacote mínimo não quebra', () => {
    const c = copiarPacoteParaViagem({ id: 'p', nome: 'Simples', valorBase: 0 }, '2026-07-20', id)
    expect(c.valorPacote).toBe(0)
    expect(c.inclusos).toEqual([])
    expect(c.paradas).toEqual([])
    expect(c.dataVolta).toBeUndefined()
  })
})

describe('diasENoites — o dono preenche datas, o sistema conta', () => {
  it('a IDA conta como dia 1 — 20 a 22/07 = 3 dias, 2 noites', () => {
    expect(diasENoites('2026-07-20', '2026-07-22')).toEqual({ dias: 3, noites: 2 })
  })

  it('mesmo dia = bate-volta: 1 dia, 0 noites', () => {
    expect(diasENoites('2026-07-20', '2026-07-20')).toEqual({ dias: 1, noites: 0 })
  })

  it('sem volta assume bate-volta', () => {
    expect(diasENoites('2026-07-20')).toEqual({ dias: 1, noites: 0 })
  })

  it('atravessa mês e ano', () => {
    expect(diasENoites('2026-12-30', '2027-01-02')).toEqual({ dias: 4, noites: 3 })
  })

  it('volta ANTES da ida é inválido — não inventa número negativo', () => {
    expect(diasENoites('2026-07-22', '2026-07-20')).toEqual({})
  })

  it('data mal formada não quebra', () => {
    expect(diasENoites('', '2026-07-22')).toEqual({})
    expect(diasENoites('20/07/2026', '22/07/2026')).toEqual({})
  })
})

describe('diaParaData / dataParaDia — a tela mostra calendário, o pacote guarda dia', () => {
  it('Dia 1 é a ida; Dia 3 é ida+2', () => {
    expect(diaParaData('2026-07-27', 1)).toBe('2026-07-27')
    expect(diaParaData('2026-07-27', 3)).toBe('2026-07-29')
    expect(diaParaData('2026-07-27', 7)).toBe('2026-08-02') // atravessa o mês
  })

  it('volta da data para o dia relativo', () => {
    expect(dataParaDia('2026-07-27', '2026-07-27')).toBe(1)
    expect(dataParaDia('2026-07-27', '2026-07-29')).toBe(3)
    expect(dataParaDia('2026-07-27', '2026-08-02')).toBe(7)
  })

  it('ida e volta são inversas uma da outra (é o que mantém o pacote reutilizável)', () => {
    for (const dia of [1, 2, 5, 10, 40]) {
      expect(dataParaDia('2026-12-28', diaParaData('2026-12-28', dia))).toBe(dia)
    }
  })

  it('data ANTES da ida não vira dia zero nem negativo', () => {
    expect(dataParaDia('2026-07-27', '2026-07-26')).toBeUndefined()
  })

  it('sem âncora ou com data inválida, não inventa', () => {
    expect(diaParaData(undefined, 1)).toBe('')
    expect(diaParaData('2026-07-27', 0)).toBe('')
    expect(diaParaData('27/07/2026', 1)).toBe('')
    expect(dataParaDia(undefined, '2026-07-27')).toBeUndefined()
    expect(dataParaDia('2026-07-27', '')).toBeUndefined()
  })
})

describe('precoDaFaixa', () => {
  const v = { tipo: 'pacote' as const, valorPacote: 1000, precos: { valorCrianca: 500, valorMeia: 700 } }

  it('cobra pela faixa do passageiro', () => {
    expect(precoDaFaixa(v, 'adulto')).toBe(1000)
    expect(precoDaFaixa(v, 'crianca')).toBe(500)
    expect(precoDaFaixa(v, 'meia')).toBe(700)
  })

  it('sem faixa = adulto (é o que a base antiga toda é)', () => {
    expect(precoDaFaixa(v, undefined)).toBe(1000)
  })

  it('faixa SEM valor próprio cai no adulto — cobra o cheio em vez de dar de graça', () => {
    expect(precoDaFaixa({ tipo: 'pacote', valorPacote: 1000 }, 'crianca')).toBe(1000)
    expect(precoDaFaixa({ tipo: 'pacote', valorPacote: 1000, precos: {} }, 'meia')).toBe(1000)
  })

  it('valor de criança ZERO é respeitado (colo não paga), não vira adulto', () => {
    expect(precoDaFaixa({ tipo: 'pacote', valorPacote: 1000, precos: { valorCrianca: 0 } }, 'crianca')).toBe(0)
  })
})

describe('valorDaReserva — fretamento × pacote', () => {
  it('PACOTE cobra por cliente', () => {
    expect(valorDaReserva({ tipo: 'pacote', valorPacote: 1200 }, 3)).toBe(3600)
    expect(valorDaReserva({ tipo: 'pacote', valorPacote: 1200 }, 3, 600)).toBe(3000)
  })

  it('soma POR FAIXA quando recebe a lista de passageiros', () => {
    const v = { tipo: 'pacote' as const, valorPacote: 1000, precos: { valorCrianca: 500, valorMeia: 700 } }
    expect(valorDaReserva(v, [{ faixa: 'adulto' }, { faixa: 'crianca' }])).toBe(1500)
    expect(valorDaReserva(v, [{ faixa: 'adulto' }, { faixa: 'adulto' }, { faixa: 'meia' }])).toBe(2700)
    expect(valorDaReserva(v, [{ faixa: 'adulto' }, { faixa: 'crianca' }], 200)).toBe(1300)
  })

  it('lista sem faixa = todos adultos', () => {
    expect(valorDaReserva({ tipo: 'pacote', valorPacote: 1000 }, [{}, {}])).toBe(2000)
  })

  it('fretamento ignora a lista inteira — valor fechado', () => {
    expect(valorDaReserva({ tipo: 'fretamento', valorFechado: 8000 }, [{ faixa: 'crianca' }, { faixa: 'adulto' }])).toBe(8000)
  })

  it('lista vazia não cobra nada', () => {
    expect(valorDaReserva({ tipo: 'pacote', valorPacote: 1000 }, [])).toBe(0)
  })

  it('FRETAMENTO é valor FECHADO — passageiro NÃO multiplica', () => {
    expect(valorDaReserva({ tipo: 'fretamento', valorFechado: 8000 }, 40)).toBe(8000)
    expect(valorDaReserva({ tipo: 'fretamento', valorFechado: 8000 }, 1)).toBe(8000)
    expect(valorDaReserva({ tipo: 'fretamento', valorFechado: 8000 }, 40, 500)).toBe(7500)
  })

  it('fretamento ignora valorPacote se ele estiver preenchido por engano', () => {
    expect(valorDaReserva({ tipo: 'fretamento', valorFechado: 8000, valorPacote: 1200 }, 40)).toBe(8000)
  })

  it('sem tipo, trata como pacote (base antiga é toda por cliente)', () => {
    expect(valorDaReserva({ valorPacote: 1000 }, 2)).toBe(2000)
  })

  it('nunca negativo', () => {
    expect(valorDaReserva({ tipo: 'pacote', valorPacote: 100 }, 1, 999)).toBe(0)
    expect(valorDaReserva({ tipo: 'fretamento', valorFechado: 100 }, 10, 999)).toBe(0)
  })

  it('campos ausentes viram zero em vez de NaN', () => {
    expect(valorDaReserva({ tipo: 'fretamento' }, 10)).toBe(0)
    expect(valorDaReserva({ tipo: 'pacote' }, 10)).toBe(0)
    expect(valorDaReserva({} as any, 0)).toBe(0)
  })
})

describe('vendePoltrona', () => {
  it('fretamento não vende poltrona — o contratante leva o veículo inteiro', () => {
    expect(vendePoltrona({ tipo: 'fretamento' })).toBe(false)
  })

  it('pacote vende, e a base antiga (sem tipo) também', () => {
    expect(vendePoltrona({ tipo: 'pacote' })).toBe(true)
    expect(vendePoltrona({})).toBe(true)
  })
})

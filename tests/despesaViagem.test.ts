import { describe, it, expect } from 'vitest'
import {
  TIPOS_DESPESA, rotuloTipo, tipoValido, valorEfetivo, fechamento,
  semComprovante, semResponsavel, porTipo, resultadoReal, ordenarPorData, sanitizarDespesas,
  type DespesaLancada,
} from '@/lib/despesaViagem'
import { custoTotal } from '@/lib/precificacaoViagem'

// Uma viagem da Deny meio rodada: hotel pago com nota, combustível pago sem
// nota, pedágio ainda só orçado e uma borracharia que ninguém previu.
const viagem = (): DespesaLancada[] => [
  { id: '1', descricao: 'Hospedagem Gramado', tipo: 'hospedagem', valor: 4000, valorReal: 4200, data: '2026-07-12', responsavel: 'ana@deny', comprovante: 'https://blob/nota1.pdf' },
  { id: '2', descricao: 'Combustível', tipo: 'combustivel', valor: 2500, valorReal: 2800, data: '2026-07-10', responsavel: 'joao@deny' },
  { id: '3', descricao: 'Pedágio ida e volta', tipo: 'pedagio', valor: 600 },
  { id: '4', descricao: 'Borracharia na BR-116', tipo: 'manutencao', valorReal: 380, data: '2026-07-11', extra: true, comprovante: 'https://blob/nota4.jpg' },
]

describe('o rótulo do tipo mora em um lugar só', () => {
  it('cada tipo do catálogo tem rótulo e nenhum rótulo repete', () => {
    const rotulos = TIPOS_DESPESA.map(t => t.rotulo)
    for (const t of TIPOS_DESPESA) expect(t.rotulo.trim()).not.toBe('')
    expect(new Set(rotulos).size).toBe(rotulos.length)
    expect(new Set(TIPOS_DESPESA.map(t => t.tipo)).size).toBe(TIPOS_DESPESA.length)
  })

  it('tipo desconhecido, em branco ou ausente cai em Outro em vez de quebrar', () => {
    expect(rotuloTipo('combustivel')).toBe('Combustível')
    expect(rotuloTipo('pedagio')).toBe('Pedágio')
    expect(rotuloTipo('abastecimento')).toBe('Outro')
    expect(rotuloTipo('')).toBe('Outro')
    expect(rotuloTipo(undefined)).toBe('Outro')
    expect(tipoValido('hospedagem')).toBe(true)
    expect(tipoValido('hotel')).toBe(false)
  })
})

describe('o realizado manda quando existe', () => {
  it('com gasto lançado vale o gasto; sem gasto, vale o orçado', () => {
    expect(valorEfetivo({ valor: 600 })).toBe(600)
    expect(valorEfetivo({ valor: 600, valorReal: 740 })).toBe(740)
    // Gastou MENOS do que orçou: a economia conta, não o orçamento.
    expect(valorEfetivo({ valor: 600, valorReal: 410 })).toBe(410)
  })

  it('zero, vazio e texto no realizado não apagam o orçado', () => {
    expect(valorEfetivo({ valor: 600, valorReal: 0 })).toBe(600)
    expect(valorEfetivo({ valor: 600, valorReal: undefined })).toBe(600)
    expect(valorEfetivo({ valor: 600, valorReal: NaN as any })).toBe(600)
    expect(valorEfetivo({ valor: 600, valorReal: '' as any })).toBe(600)
    expect(valorEfetivo(undefined)).toBe(0)
    expect(valorEfetivo({})).toBe(0)
  })
})

describe('fechamento: orçado x gasto', () => {
  it('soma os dois lados e diz quanto estourou', () => {
    const f = fechamento(viagem())
    expect(f.previsto).toBe(7100)          // 4000 + 2500 + 600 (a borracharia não estava no orçamento)
    expect(f.realizado).toBe(7380)         // 4200 + 2800 + 380
    expect(f.efetivo).toBe(7980)           // 7380 + 600 de pedágio que falta pagar
    expect(f.aPagar).toBe(600)
    expect(f.extras).toBe(380)
    expect(f.diferenca).toBe(880)          // 7980 − 7100
    expect(f.lancadas).toBe(3)
    expect(f.pendentes).toBe(1)
  })

  it('viagem só orçada: gasto zero, nada estourou, tudo a pagar', () => {
    const f = fechamento([{ valor: 1000 }, { valor: 500 }])
    expect(f.previsto).toBe(1500)
    expect(f.realizado).toBe(0)
    expect(f.efetivo).toBe(1500)
    expect(f.aPagar).toBe(1500)
    expect(f.diferenca).toBe(0)
    expect(f.pendentes).toBe(2)
  })

  it('gastou menos do que orçou: a diferença fica NEGATIVA', () => {
    const f = fechamento([{ valor: 1000, valorReal: 820 }])
    expect(f.diferenca).toBe(-180)
    expect(f.aPagar).toBe(0)
  })

  it('lista vazia ou ausente devolve zeros em vez de NaN', () => {
    for (const entrada of [undefined, [] as DespesaLancada[]]) {
      const f = fechamento(entrada)
      expect(f).toEqual({ previsto: 0, realizado: 0, efetivo: 0, aPagar: 0, extras: 0, diferenca: 0, lancadas: 0, pendentes: 0 })
    }
  })

  it('linha em branco do formulário não vira NaN', () => {
    const f = fechamento([{ descricao: '', valor: undefined }, { valor: 100 }])
    expect(f.previsto).toBe(100)
    expect(f.efetivo).toBe(100)
  })

  it('extra marcado mas sem gasto lançado ainda não conta como extra pago', () => {
    const f = fechamento([{ descricao: 'Pode aparecer', extra: true, valor: 0 }])
    expect(f.extras).toBe(0)
    expect(f.pendentes).toBe(1)
  })

  it('o previsto continua igual ao custoTotal que já calculava o break-even', () => {
    // Garantia de que a mudança não mexeu na conta antiga da precificação.
    expect(fechamento(viagem()).previsto).toBe(custoTotal(viagem()))
  })
})

describe('cobranças antes de fechar o mês', () => {
  it('gasto sem nota aparece; orçamento ainda não pago, não', () => {
    const faltando = semComprovante(viagem())
    expect(faltando.map(d => d.id)).toEqual(['2'])
  })

  it('comprovante só com espaço conta como ausente', () => {
    expect(semComprovante([{ valorReal: 10, comprovante: '   ' }]).length).toBe(1)
    expect(semComprovante([{ valorReal: 10, comprovante: 'https://blob/x' }]).length).toBe(0)
  })

  it('gasto sem responsável aparece', () => {
    expect(semResponsavel(viagem()).map(d => d.id)).toEqual(['4'])
    expect(semResponsavel([{ valorReal: 10, responsavel: ' ' }]).length).toBe(1)
    expect(semResponsavel([{ valor: 10 }]).length).toBe(0)
  })
})

describe('onde o dinheiro foi', () => {
  it('soma por categoria, da maior para a menor', () => {
    const linhas = porTipo(viagem())
    expect(linhas.map(l => l.tipo)).toEqual(['hospedagem', 'combustivel', 'pedagio', 'manutencao'])
    expect(linhas[0]).toEqual({ tipo: 'hospedagem', rotulo: 'Hospedagem', previsto: 4000, realizado: 4200, efetivo: 4200 })
    expect(linhas[2]).toEqual({ tipo: 'pedagio', rotulo: 'Pedágio', previsto: 600, realizado: 0, efetivo: 600 })
  })

  it('tipo em branco ou inválido soma em Outro, não cria categoria nova', () => {
    const linhas = porTipo([{ valor: 100 }, { tipo: 'abastecimento', valor: 50 }, { tipo: 'outro', valor: 25 }])
    expect(linhas.length).toBe(1)
    expect(linhas[0].tipo).toBe('outro')
    expect(linhas[0].previsto).toBe(175)
  })

  it('categoria sem valor nenhum não entra na lista', () => {
    expect(porTipo([{ tipo: 'guia', descricao: 'A definir' }])).toEqual([])
  })
})

describe('resultado real da viagem', () => {
  it('receita menos custo efetivo, com margem sobre a receita', () => {
    const r = resultadoReal(viagem(), 12000)
    expect(r.custo).toBe(7980)
    expect(r.resultado).toBe(4020)
    expect(r.margem).toBe(33.5)
  })

  it('sem receita não inventa margem (dividir por zero daria Infinity)', () => {
    const r = resultadoReal(viagem(), 0)
    expect(r.resultado).toBe(-7980)
    expect(r.margem).toBeUndefined()
  })
})

// A rota de viagens RECONSTRÓI cada despesa campo a campo antes de gravar. Este
// bloco é a garantia de "não perder nada": o que a tela manda tem de chegar
// inteiro no Redis, e o que já estava gravado tem de voltar igual.
describe('o que sobrevive ao salvar (whitelist do servidor)', () => {
  let n = 0
  const novoId = () => `novo${++n}`

  it('a despesa completa chega inteira, campo por campo', () => {
    n = 0
    const [d] = sanitizarDespesas([{
      id: 'x', descricao: 'Hospedagem', tipo: 'hospedagem', valor: 4000, valorReal: 4200,
      data: '2026-07-12', responsavel: 'Ana', comprovante: 'https://blob/nota.pdf', extra: true,
    }], novoId)
    expect(d).toEqual({
      id: 'x', descricao: 'Hospedagem', tipo: 'hospedagem', valor: 4000, valorReal: 4200,
      data: '2026-07-12', responsavel: 'Ana', comprovante: 'https://blob/nota.pdf', extra: true,
    })
  })

  it('despesa ANTIGA (só descrição e valor) volta idêntica, sem campo novo grudado', () => {
    n = 0
    const antiga = { id: 'a1', descricao: 'Pedágio', valor: 600 }
    expect(sanitizarDespesas([antiga], novoId)).toEqual([antiga])
  })

  it('o gasto extra sem orçado NÃO é apagado na gravação', () => {
    n = 0
    // Era este o risco: o filtro antigo olhava só descrição e valor previsto.
    const r = sanitizarDespesas([{ id: 'e1', valorReal: 380, data: '2026-07-11', extra: true }], novoId)
    expect(r.length).toBe(1)
    expect(r[0].valorReal).toBe(380)
    expect(r[0].extra).toBe(true)
  })

  it('linha totalmente vazia continua sendo descartada', () => {
    n = 0
    expect(sanitizarDespesas([{ descricao: '  ', valor: 0, valorReal: 0 }], novoId)).toEqual([])
  })

  it('despesa sem id ganha um, e o id que veio é respeitado', () => {
    n = 0
    const r = sanitizarDespesas([{ descricao: 'A', valor: 1 }, { id: 'meu', descricao: 'B', valor: 2 }], novoId)
    expect(r[0].id).toBe('novo1')
    expect(r[1].id).toBe('meu')
  })

  it('lixo não entra: tipo inventado, data torta, valor negativo e texto gigante', () => {
    n = 0
    const [d] = sanitizarDespesas([{
      id: 'z', descricao: 'x'.repeat(400), tipo: 'abastecimento', valor: -50, valorReal: 'muito' as any,
      data: '12/07/2026', responsavel: ' '.repeat(10), comprovante: '  ',
    }], novoId)
    expect(d.tipo).toBeUndefined()        // tipo fora do catálogo não é gravado
    expect(d.data).toBeUndefined()        // só YYYY-MM-DD entra
    expect(d.valor).toBe(0)               // negativo vira 0, não some
    expect(d.valorReal).toBeUndefined()
    expect(d.responsavel).toBeUndefined() // só espaço = ausente
    expect(d.comprovante).toBeUndefined()
    expect(d.descricao.length).toBe(120)
  })

  it('entrada que não é lista devolve lista vazia em vez de explodir', () => {
    for (const lixo of [undefined, null, 'texto', 42, {}]) {
      expect(sanitizarDespesas(lixo as any, novoId)).toEqual([])
    }
  })

  it('o teto de 60 linhas continua valendo', () => {
    n = 0
    const muitas = Array.from({ length: 80 }, (_, i) => ({ descricao: `d${i}`, valor: 1 }))
    expect(sanitizarDespesas(muitas, novoId).length).toBe(60)
  })

  it('salvar duas vezes seguidas não muda nada (ida e volta estável)', () => {
    n = 0
    const uma = sanitizarDespesas(viagem(), novoId)
    const duas = sanitizarDespesas(uma, novoId)
    expect(duas).toEqual(uma)
    // E a conta continua a mesma depois do round-trip.
    expect(fechamento(duas)).toEqual(fechamento(viagem()))
  })
})

describe('ordem de leitura', () => {
  it('mais recente primeiro; o que ainda não aconteceu vai para o fim', () => {
    expect(ordenarPorData(viagem()).map(d => d.id)).toEqual(['1', '4', '2', '3'])
  })

  it('duas linhas sem data ficam em ordem de descrição', () => {
    const r = ordenarPorData([{ descricao: 'Pedágio' }, { descricao: 'Almoço' }])
    expect(r.map(d => d.descricao)).toEqual(['Almoço', 'Pedágio'])
  })

  it('não mexe no array original', () => {
    const original = viagem()
    const antes = original.map(d => d.id)
    ordenarPorData(original)
    expect(original.map(d => d.id)).toEqual(antes)
  })
})

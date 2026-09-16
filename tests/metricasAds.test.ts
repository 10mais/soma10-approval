import { describe, it, expect } from 'vitest'
import { normalizarPublicos, serieDoPeriodo, somar, derivados, resultadoDoObjetivo, variacao, variacaoBoa, objetivoDe, objetivosDoCanal, cobreDia, noPeriodo, fmtDinheiro, fmtPct, OBJETIVOS } from '@/lib/metricasAds'

describe('metricasAds — o objetivo decide o nome do resultado e do custo', () => {
  it('campanha de MENSAGENS fala em conversas iniciadas e custo por mensagem', () => {
    const s = somar([{ investimento: 300, resultados: 12, impressoes: 5000, cliques: 100 }])
    const r = resultadoDoObjetivo('mensagens', s)
    expect(r.valor).toBe(12)
    expect(r.rotulo).toBe('conversas iniciadas')
    expect(r.custo).toBe(25) // 300 / 12
    expect(r.custoLabel).toBe('Custo por mensagem')
  })

  it('campanha de VISITAS AO PERFIL fala em visitas e custo por visita (singular quando é 1)', () => {
    const um = resultadoDoObjetivo('visitas_perfil', somar([{ investimento: 8, resultados: 1 }]))
    expect(um.rotulo).toBe('visita ao perfil')
    expect(um.custo).toBe(8)
    const varios = resultadoDoObjetivo('visitas_perfil', somar([{ investimento: 200, resultados: 40 }]))
    expect(varios.rotulo).toBe('visitas ao perfil')
    expect(varios.custo).toBe(5)
  })

  it('reconhecimento não conta resultado: a entrega é o alcance e o custo é por mil impressões', () => {
    const r = resultadoDoObjetivo('reconhecimento', somar([{ investimento: 100, alcance: 8000, impressoes: 20000 }]))
    expect(r.valor).toBe(8000)
    expect(r.rotulo).toBe('pessoas alcançadas')
    expect(r.custo).toBe(5) // 100 / 20000 * 1000
    expect(r.custoLabel).toBe('Custo por mil impressões')
  })

  it('objetivo desconhecido não quebra: vira "resultado" genérico', () => {
    const o = objetivoDe('inventado')
    expect(o.resultado.plural).toBe('resultados')
    expect(resultadoDoObjetivo(undefined, somar([{ investimento: 10, resultados: 2 }])).custo).toBe(5)
  })

  it('cada canal só oferece os objetivos que existem nele', () => {
    const meta = objetivosDoCanal('meta').map(o => o.chave)
    expect(meta).toContain('visitas_perfil')
    expect(meta).toContain('mensagens')
    expect(meta).not.toContain('ligacoes')
    expect(objetivosDoCanal('google').map(o => o.chave)).toContain('ligacoes')
    expect(objetivosDoCanal('google').map(o => o.chave)).not.toContain('visitas_perfil')
    expect(OBJETIVOS.every(o => o.canais.length > 0)).toBe(true)
  })

  it('soma e derivados: nada de dividir por zero, nada de número inventado', () => {
    const s = somar([
      { investimento: 100, impressoes: 10000, alcance: 4000, cliques: 200, resultados: 10, receita: 500 },
      { investimento: 50, impressoes: 5000, alcance: 2000, cliques: 50, resultados: 5, receita: 250 },
    ])
    expect(s).toEqual({ investimento: 150, impressoes: 15000, alcance: 6000, cliques: 250, resultados: 15, receita: 750, visualizacoesPagina: 0, adicoesCarrinho: 0, checkouts: 0, compras: 0 })
    const d = derivados(s)
    expect(d.ctr).toBeCloseTo(1.6667, 3)
    expect(d.cpc).toBe(0.6)
    expect(d.cpm).toBe(10)
    expect(d.custoPorResultado).toBe(10)
    expect(d.roas).toBe(5)
    expect(d.frequencia).toBe(2.5)
    const vazio = derivados(somar([]))
    expect([vazio.ctr, vazio.cpc, vazio.cpm, vazio.custoPorResultado, vazio.roas, vazio.frequencia]).toEqual([null, null, null, null, null, null])
    expect(somar([{ investimento: '12,50' as any }]).investimento).toBe(12.5)
  })

  it('variação: cair é bom no custo, subir é bom no resultado; sem base anterior não inventa', () => {
    expect(variacao(150, 100)).toBe(50)
    expect(variacao(80, 100)).toBe(-20)
    expect(variacao(10, 0)).toBeNull()
    expect(variacaoBoa('custo', -20)).toBe(true)
    expect(variacaoBoa('custo', 20)).toBe(false)
    expect(variacaoBoa('resultado', 20)).toBe(true)
    expect(variacaoBoa('resultado', null)).toBeNull()
    expect(variacaoBoa('resultado', 0)).toBeNull()
  })

  it('período: lançamento de um dia e lançamento que cobre a semana', () => {
    const semana = { data: '2026-09-07', ate: '2026-09-13' }
    expect(cobreDia(semana, '2026-09-09')).toBe(true)
    expect(cobreDia(semana, '2026-09-14')).toBe(false)
    expect(cobreDia({ data: '2026-09-09' }, '2026-09-09')).toBe(true)
    expect(cobreDia({ data: 'ontem' }, '2026-09-09')).toBe(false)
    const lista = [{ data: '2026-08-31' }, { data: '2026-09-01' }, { data: '2026-09-30' }, { data: '2026-10-01' }]
    expect(noPeriodo(lista, '2026-09-01', '2026-09-30')).toEqual([{ data: '2026-09-01' }, { data: '2026-09-30' }])
  })

  it('formatação em pt-BR', () => {
    expect(fmtDinheiro(1234.5)).toBe('R$ 1.234,50') // sempre em Real, com centavo (dono, 16/09)
    expect(fmtDinheiro(8.5)).toBe('R$ 8,50') // custo por resultado precisa do centavo
    expect(fmtDinheiro(null)).toBe('—')
    expect(fmtPct(1.6667)).toBe('1,7%')
    expect(fmtPct(null)).toBe('—')
  })
})

describe('normalizarPublicos — a estrutura da campanha entra limpa', () => {
  it('título manda: público e anúncio sem título somem; ids ganham valor estável', () => {
    const r = normalizarPublicos([
      { titulo: '  Mulheres 25-45 · Santo Ângelo  ', descricao: 'Interesse em gastronomia', anuncios: [{ titulo: 'Massa artesanal', textoPrincipal: 'Vem provar', cta: 'Saiba mais' }, { titulo: '' }] },
      { titulo: '' },
      { naoTemTitulo: true },
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ id: 'pub-1', titulo: 'Mulheres 25-45 · Santo Ângelo', descricao: 'Interesse em gastronomia' })
    expect(r[0].anuncios).toHaveLength(1)
    expect(r[0].anuncios![0]).toMatchObject({ id: 'an-1-1', titulo: 'Massa artesanal', cta: 'Saiba mais', status: 'ativo' })
  })

  it('palavras-chave do Google: correspondência desconhecida vira ampla e termo vazio sai', () => {
    const r = normalizarPublicos([{ titulo: 'Restaurante', palavrasChave: [
      { termo: 'restaurante italiano', correspondencia: 'exata' },
      { termo: 'massa fresca', correspondencia: 'inventada' },
      { termo: 'grátis', correspondencia: 'negativa' },
      { termo: '   ' },
    ] }])
    expect(r[0].palavrasChave).toEqual([
      { termo: 'restaurante italiano', correspondencia: 'exata' },
      { termo: 'massa fresca', correspondencia: 'ampla' },
      { termo: 'grátis', correspondencia: 'negativa' },
    ])
  })

  it('ids que já existem são preservados (editar não embaralha o histórico de métricas)', () => {
    const r = normalizarPublicos([{ id: 'p-abc', titulo: 'Público', anuncios: [{ id: 'a-xyz', titulo: 'Anúncio', status: 'pausado' }] }])
    expect(r[0].id).toBe('p-abc')
    expect(r[0].anuncios![0]).toMatchObject({ id: 'a-xyz', status: 'pausado' })
    expect(normalizarPublicos(null)).toEqual([])
  })
})

describe('serieDoPeriodo — o gráfico de evolução', () => {
  it('agrupa por SEMANA (segunda a domingo) dentro do período', () => {
    const s = serieDoPeriodo([
      { data: '2026-09-01', investimento: 100, resultados: 5 },  // semana de 31/08
      { data: '2026-09-03', investimento: 50, resultados: 2 },   // mesma semana
      { data: '2026-09-08', investimento: 200, resultados: 9 },  // semana de 07/09
      { data: '2026-08-30', investimento: 999, resultados: 99 }, // fora do período
    ], '2026-09-01', '2026-09-30')
    expect(s).toEqual([
      { inicio: '2026-08-31', rotulo: '31/08', investimento: 150, resultados: 7 },
      { inicio: '2026-09-07', rotulo: '07/09', investimento: 200, resultados: 9 },
    ])
  })

  it('período longo agrupa por MÊS; sem lançamento devolve vazio', () => {
    const s = serieDoPeriodo([
      { data: '2026-07-10', investimento: 300, resultados: 10 },
      { data: '2026-07-28', investimento: 200, resultados: 6 },
      { data: '2026-09-02', investimento: 400, resultados: 20 },
    ], '2026-07-01', '2026-10-31')
    expect(s.map(b => [b.rotulo, b.investimento])).toEqual([['jul', 500], ['set', 400]])
    expect(serieDoPeriodo([], '2026-09-01', '2026-09-30')).toEqual([])
  })
})

// Dono, 16/09: vírgula nos centavos, editar o que foi lançado, funil de vendas e o período
// de análise escrito no painel.
import { funilDeVendas, comComprasDoObjetivo, camposDoLancamento, formatarEntradaInteiro, campoParaNumero, numeroParaCampo, rotuloIntervalo, fmtRoas, CAMPOS_NUMERICOS } from '@/lib/metricasAds'
import { formatarEntradaMoeda } from '@/lib/moeda'

describe('lançamento — a vírgula é o centavo', () => {
  it('dinheiro digitado com vírgula vira o número certo (o bug de 16/09)', () => {
    expect(campoParaNumero('moeda', formatarEntradaMoeda('1250,75'))).toBe(1250.75)
    expect(campoParaNumero('moeda', '1.250,75')).toBe(1250.75)
    expect(campoParaNumero('moeda', 'R$ 89,9')).toBe(89.9)
    expect(campoParaNumero('moeda', '1200')).toBe(1200)
    expect(campoParaNumero('moeda', '0,50')).toBe(0.5)
  })

  it('contagem ignora centavo e aceita o ponto de milhar', () => {
    expect(formatarEntradaInteiro('12345')).toBe('12.345')
    expect(formatarEntradaInteiro('12,7')).toBe('12')
    expect(formatarEntradaInteiro('abc')).toBe('')
    expect(campoParaNumero('inteiro', '12.345')).toBe(12345)
  })

  it('vazio é "não informado", não zero; zero digitado continua sendo zero', () => {
    expect(campoParaNumero('moeda', '')).toBeNull()
    expect(campoParaNumero('inteiro', '   ')).toBeNull()
    expect(campoParaNumero('inteiro', '0')).toBe(0)
  })

  it('editar: o número gravado volta para o campo no formato do Real e ida-e-volta não muda o valor', () => {
    expect(numeroParaCampo('moeda', 1234.5)).toBe('1.234,50')
    expect(numeroParaCampo('moeda', 0.5)).toBe('0,50')
    expect(numeroParaCampo('inteiro', 12345)).toBe('12.345')
    expect(numeroParaCampo('moeda', undefined)).toBe('')
    for (const v of [0.01, 9.9, 1234.56, 1000000]) expect(campoParaNumero('moeda', numeroParaCampo('moeda', v))).toBe(v)
  })
})

describe('funil de vendas', () => {
  it('taxas de carrinho→checkout e checkout→compra, custo por venda, ticket médio e ROAS', () => {
    const f = funilDeVendas(somar([{ investimento: 1000, cliques: 2000, visualizacoesPagina: 1500, adicoesCarrinho: 200, checkouts: 80, compras: 40, receita: 6000 }]))
    expect(f.temDados).toBe(true)
    expect(f.taxaCarrinhoCheckout).toBe(40)
    expect(f.taxaCheckoutCompra).toBe(50)
    expect(f.taxaCarrinhoCompra).toBe(20)
    expect(f.taxaCliqueCompra).toBe(2)
    expect(f.custoPorVenda).toBe(25)
    expect(f.ticketMedio).toBe(150)
    expect(f.roas).toBe(6)
    expect(f.custoPorCarrinho).toBe(5)
    expect(f.etapas.map(e => e.taxaDaAnterior)).toEqual([null, (200 / 1500) * 100, 40, 50])
  })

  it('etapa sem número não vira 0%: a seguinte compara com a última preenchida', () => {
    const f = funilDeVendas(somar([{ adicoesCarrinho: 100, compras: 25 }]))
    expect(f.etapas.find(e => e.chave === 'checkouts')!.taxaDaAnterior).toBeNull()
    expect(f.etapas.find(e => e.chave === 'compras')!.taxaDaAnterior).toBe(25)
    expect(funilDeVendas(somar([{ investimento: 100, resultados: 5 }])).temDados).toBe(false)
  })

  it('campanha de VENDAS: o resultado é a compra (não se digita duas vezes)', () => {
    expect(comComprasDoObjetivo({ resultados: 12 }, 'vendas').compras).toBe(12)
    expect(comComprasDoObjetivo({ resultados: 12, compras: 10 }, 'vendas').compras).toBe(10)
    expect(comComprasDoObjetivo({ resultados: 12 }, 'mensagens').compras).toBeUndefined()
    expect(camposDoLancamento('vendas').funil.map(c => c.k)).not.toContain('compras')
    expect(camposDoLancamento('trafego').funil.map(c => c.k)).toContain('compras')
  })

  it('campos: investimento e receita são dinheiro; o resto é contagem; reconhecimento não pede resultado', () => {
    const { principais, funil } = camposDoLancamento('mensagens')
    expect(principais.find(c => c.k === 'resultados')!.label).toBe('Conversas iniciadas')
    expect([...principais, ...funil].filter(c => c.tipo === 'moeda').map(c => c.k)).toEqual(['investimento', 'receita'])
    expect(camposDoLancamento('reconhecimento').principais.map(c => c.k)).not.toContain('resultados')
    const todos = [...principais, ...funil].map(c => c.k)
    expect(todos.every(k => (CAMPOS_NUMERICOS as readonly string[]).includes(k))).toBe(true)
  })

  it('soma inclui os campos do funil e o ROAS sai em "vezes"', () => {
    expect(somar([{ checkouts: 3 }, { checkouts: '4' as any }]).checkouts).toBe(7)
    expect(fmtRoas(4.256)).toBe('4,26x')
    expect(fmtRoas(null)).toBe('—')
  })
})

describe('período de análise escrito', () => {
  it('"01/09/2026 a 30/09/2026"; um dia só não repete a data', () => {
    expect(rotuloIntervalo('2026-09-01', '2026-09-30')).toBe('01/09/2026 a 30/09/2026')
    expect(rotuloIntervalo('2026-09-15', '2026-09-15')).toBe('15/09/2026')
    expect(rotuloIntervalo('', '2026-09-30')).toBe('')
  })
})

import { lancamentosDoFunil, periodoDeComparacao } from '@/lib/metricasAds'

describe('funil só com as campanhas que têm funil', () => {
  it('gasto da campanha de mensagens fica fora do custo por venda e do ROAS', () => {
    const objetivos: Record<string, string> = { loja: 'vendas', zap: 'mensagens' }
    const lista = [
      { campanhaId: 'loja', investimento: 1000, resultados: 40, adicoesCarrinho: 200, receita: 6000 },
      { campanhaId: 'zap', investimento: 540, resultados: 21 },
    ]
    const f = funilDeVendas(somar(lancamentosDoFunil(lista, id => objetivos[id])))
    expect(f.custoPorVenda).toBe(25)
    expect(f.roas).toBe(6)
    expect(lancamentosDoFunil([{ campanhaId: 'zap', investimento: 10 }], id => objetivos[id])).toEqual([])
  })
})

describe('período de comparação', () => {
  it('mês compara com o mês anterior inteiro, inclusive na virada do ano', () => {
    expect(periodoDeComparacao('2026-09-01', '2026-09-30', true)).toEqual({ de: '2026-08-01', ate: '2026-08-31' })
    expect(periodoDeComparacao('2026-03-01', '2026-03-31', true)).toEqual({ de: '2026-02-01', ate: '2026-02-28' })
    expect(periodoDeComparacao('2026-01-01', '2026-01-31', true)).toEqual({ de: '2025-12-01', ate: '2025-12-31' })
  })
  it('intervalo personalizado compara com os mesmos dias logo antes', () => {
    expect(periodoDeComparacao('2026-09-08', '2026-09-14', false)).toEqual({ de: '2026-09-01', ate: '2026-09-07' })
  })
})

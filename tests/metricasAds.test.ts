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
    expect(s).toEqual({ investimento: 150, impressoes: 15000, alcance: 6000, cliques: 250, resultados: 15, receita: 750 })
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
    expect(fmtDinheiro(1234.5)).toBe('R$ 1.235') // acima de 100 arredonda: centavo não muda decisão
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

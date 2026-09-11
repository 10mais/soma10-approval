import { describe, it, expect } from 'vitest'
import { metricasBarra, scrollDoCursor, esquerdaCentradaEm, pegouOCursor, LARGURA_MINIMA } from '@/lib/barraArraste'

describe('metricasBarra', () => {
  it('sem transbordo não mostra barra (o funil cabe na tela)', () => {
    expect(metricasBarra({ scrollWidth: 800, clientWidth: 800, trilho: 800, scrollLeft: 0 }).visivel).toBe(false)
  })

  it('o cursor ocupa a mesma fração que a tela ocupa do funil', () => {
    // Metade do conteúdo visível => cursor com metade do trilho.
    const m = metricasBarra({ scrollWidth: 1600, clientWidth: 800, trilho: 800, scrollLeft: 0 })
    expect(m.visivel).toBe(true)
    expect(m.largura).toBe(400)
    expect(m.esquerda).toBe(0)
  })

  it('no fim do funil o cursor encosta no fim do trilho', () => {
    const m = metricasBarra({ scrollWidth: 1600, clientWidth: 800, trilho: 800, scrollLeft: 800 })
    expect(m.esquerda).toBe(m.largura === 400 ? 400 : m.esquerda)
    expect(m.esquerda + m.largura).toBe(800)
  })

  it('funil MUITO largo não gera cursor invisível — vale a largura mínima', () => {
    // 20 colunas: a fração daria ~8px, impossível de pegar (e de ver).
    const m = metricasBarra({ scrollWidth: 20000, clientWidth: 800, trilho: 800, scrollLeft: 0 })
    expect(m.largura).toBe(LARGURA_MINIMA)
  })

  it('trilho menor que a largura mínima não estoura o trilho', () => {
    const m = metricasBarra({ scrollWidth: 5000, clientWidth: 30, trilho: 30, scrollLeft: 0 })
    expect(m.largura).toBeLessThanOrEqual(30)
  })

  it('scrollLeft além do fim não empurra o cursor para fora', () => {
    const m = metricasBarra({ scrollWidth: 1600, clientWidth: 800, trilho: 800, scrollLeft: 99999 })
    expect(m.esquerda + m.largura).toBeLessThanOrEqual(800)
  })
})

describe('scrollDoCursor', () => {
  const quadro = { scrollWidth: 1600, clientWidth: 800, trilho: 800, largura: 400 }

  it('cursor na esquerda = começo do funil', () => {
    expect(scrollDoCursor(0, quadro)).toBe(0)
  })

  it('cursor no fim do curso = fim do funil', () => {
    expect(scrollDoCursor(400, quadro)).toBe(800)
  })

  it('ida e volta batem (metade do curso = metade do transbordo)', () => {
    const scroll = scrollDoCursor(200, quadro)
    expect(scroll).toBe(400)
    expect(metricasBarra({ ...quadro, scrollLeft: scroll }).esquerda).toBe(200)
  })

  it('arrastar além da ponta apenas encosta no fim, não passa', () => {
    expect(scrollDoCursor(5000, quadro)).toBe(800)
    expect(scrollDoCursor(-5000, quadro)).toBe(0)
  })

  it('sem transbordo não rola nada', () => {
    expect(scrollDoCursor(100, { scrollWidth: 800, clientWidth: 800, trilho: 800, largura: 800 })).toBe(0)
  })
})

describe('clique no trilho', () => {
  it('leva o cursor centrado no ponto clicado', () => {
    expect(esquerdaCentradaEm(500, { trilho: 800, largura: 400 })).toBe(300)
  })

  it('clique perto das pontas não joga o cursor para fora', () => {
    expect(esquerdaCentradaEm(10, { trilho: 800, largura: 400 })).toBe(0)
    expect(esquerdaCentradaEm(790, { trilho: 800, largura: 400 })).toBe(400)
  })

  it('pegar em cima do cursor não é clique no trilho', () => {
    const m = { esquerda: 300, largura: 400 }
    expect(pegouOCursor(350, m)).toBe(true)
    expect(pegouOCursor(299, m)).toBe(false)
    expect(pegouOCursor(701, m)).toBe(false)
  })
})

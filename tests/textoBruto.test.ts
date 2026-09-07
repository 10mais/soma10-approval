import { describe, it, expect } from 'vitest'
import { paragrafar, resumir } from '@/lib/textoBruto'

const BRUTO = 'Transformar resinas plásticas em produtos que ofereçam alto padrão de qualidade e reciclar plásticos pós-consumo seguindo o modelo da economia circular, visando a sustentabilidade do negócio. Posicionamento A Universal Plásticos ocupa um lugar que poucas empresas têm coragem de ocupar: o da verdade inconveniente. Num mercado onde "sustentabilidade" virou selo decorativo e manchete fácil, a Universal escolhe o caminho mais difícil — o dos dados, da ciência e do debate honesto. Não defendemos o plástico. Defendemos a inteligência. Tom de Voz Provocador, mas sem arrogância. Direto, mas sem agressividade. Nunca defensivo. Nunca vítima. Sempre educador. Narrativas Centrais 1. O problema não é o material — é o descarte Plástico não tem pernas, não tem asas e não tem nadadeiras. 2. Reciclar é indústria Reciclagem não é boa vontade, é logística.'

describe('textoBruto — documento colado num campo só vira blocos', () => {
  it('descobre cabeçalhos colados ao corpo e itens numerados', () => {
    const b = paragrafar(BRUTO)
    const tipos = b.map(x => x.tipo)
    const titulos = b.filter(x => x.tipo === 'titulo').map(x => x.texto)
    expect(titulos).toEqual(['Posicionamento', 'Tom de Voz', 'Narrativas Centrais'])
    expect(b[0]).toEqual({ tipo: 'paragrafo', texto: expect.stringMatching(/^Transformar resinas.*negócio\.$/) })
    expect(b.filter(x => x.tipo === 'item').map(x => x.texto.slice(0, 14))).toEqual(['1. O problema ', '2. Reciclar é '])
    // ordem: parágrafo, título, parágrafo(s), título, parágrafo, título, item, item
    expect(tipos[1]).toBe('titulo')
    expect(tipos[tipos.length - 1]).toBe('item')
  })

  it('respeita quebras de linha quando existem e não inventa títulos', () => {
    const b = paragrafar('Primeira linha do texto.\n\nSegunda linha, outro parágrafo.\nTerceira.')
    expect(b).toEqual([
      { tipo: 'paragrafo', texto: 'Primeira linha do texto.' },
      { tipo: 'paragrafo', texto: 'Segunda linha, outro parágrafo.' },
      { tipo: 'paragrafo', texto: 'Terceira.' },
    ])
  })

  it('cabeçalho sozinho na linha (com dois-pontos) vira título', () => {
    const b = paragrafar('Missão:\nLevar saúde a todos.\nValores\nÉtica. Cuidado.')
    expect(b.map(x => x.tipo)).toEqual(['titulo', 'paragrafo', 'titulo', 'paragrafo'])
    expect(b[0].texto).toBe('Missão')
  })

  it('parágrafo gigante sem estrutura é quebrado em grupos de frases', () => {
    const frase = 'Esta é uma frase de tamanho médio para o teste do agrupador. '
    const b = paragrafar(frase.repeat(14))
    expect(b.length).toBeGreaterThan(1)
    expect(b.every(x => x.tipo === 'paragrafo' && x.texto.length <= 380)).toBe(true)
  })

  it('texto curto e vazio', () => {
    expect(paragrafar('')).toEqual([])
    expect(paragrafar(null)).toEqual([])
    expect(paragrafar('Só uma frase.')).toEqual([{ tipo: 'paragrafo', texto: 'Só uma frase.' }])
  })

  it('não confunde "Público" no meio da frase com cabeçalho', () => {
    const b = paragrafar('Falamos com o público jovem. O Público é exigente e a marca responde.')
    expect(b.every(x => x.tipo === 'paragrafo')).toBe(true)
  })

  it('resumo corta em fim de frase e avisa que cortou', () => {
    const r = resumir(BRUTO, 240)
    expect(r.cortado).toBe(true)
    expect(r.texto.length).toBeLessThanOrEqual(240)
    expect(/[.!?…]$/.test(r.texto)).toBe(true)
    expect(resumir('Curto.', 240)).toEqual({ texto: 'Curto.', cortado: false })
  })
})

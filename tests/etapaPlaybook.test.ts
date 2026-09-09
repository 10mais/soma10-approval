import { describe, it, expect } from 'vitest'
import { opcoesEtapas, separarValor, juntarValor, rotuloEtapa } from '@/lib/etapaPlaybook'

const marcos = [
  { id: 'm1', titulo: 'Produção de conteúdo', subetapas: [
    { id: 's1', titulo: 'Conteúdos setembro' },
    { id: 's2', titulo: 'Conteúdos outubro' },
    { id: 'sx', titulo: '   ' }, // sem título: não vira opção
  ] },
  { id: 'm2', titulo: 'Tráfego pago' }, // sem etapas
]

describe('etapaPlaybook — o seletor mostra o marco E as etapas de dentro', () => {
  it('cada marco vira um grupo com "o marco inteiro" e uma opção por etapa', () => {
    const g = opcoesEtapas(marcos)
    expect(g).toHaveLength(2)
    expect(g[0].titulo).toBe('Produção de conteúdo')
    expect(g[0].opcoes.map(o => o.valor)).toEqual(['m1', 'm1::s1', 'm1::s2'])
    expect(g[0].opcoes[0].rotulo).toBe('Produção de conteúdo (o marco inteiro)')
    expect(g[0].opcoes[1]).toEqual({ valor: 'm1::s1', rotulo: 'Conteúdos setembro', ehMarco: false })
  })

  it('marco sem etapas aparece sozinho, sem o sufixo "(o marco inteiro)"', () => {
    const g = opcoesEtapas(marcos)
    expect(g[1].opcoes).toEqual([{ valor: 'm2', rotulo: 'Tráfego pago', ehMarco: true }])
    expect(opcoesEtapas([])).toEqual([])
  })

  it('valor composto vai e volta', () => {
    expect(separarValor('m1::s2')).toEqual({ marcoId: 'm1', subetapaId: 's2' })
    expect(separarValor('m1')).toEqual({ marcoId: 'm1', subetapaId: '' })
    expect(separarValor('')).toEqual({ marcoId: '', subetapaId: '' })
    expect(juntarValor('m1', 's2')).toBe('m1::s2')
    expect(juntarValor('m1')).toBe('m1')
    expect(juntarValor('')).toBe('')
  })

  it('rótulo escrito: "Marco › Etapa"; vínculo perdido não inventa nome', () => {
    expect(rotuloEtapa(marcos, 'm1', 's1')).toBe('Produção de conteúdo › Conteúdos setembro')
    expect(rotuloEtapa(marcos, 'm1')).toBe('Produção de conteúdo')
    expect(rotuloEtapa(marcos, 'm1', 'apagada')).toBe('Produção de conteúdo')
    expect(rotuloEtapa(marcos, 'sumiu')).toBe('')
    expect(rotuloEtapa(marcos)).toBe('')
  })
})

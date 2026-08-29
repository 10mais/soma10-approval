import { describe, it, expect } from 'vitest'
import { formatarEntradaMoeda, parseMoeda, moedaParaCampo } from '@/lib/moeda'

// O campo de meta virou dinheiro na tela. Se a máscara e a leitura discordarem,
// o dono digita 1,2 milhão e salva 12 mil — e só descobre pelo gráfico.

describe('digitando', () => {
  it('põe o ponto de milhar conforme se digita', () => {
    expect(formatarEntradaMoeda('1')).toBe('1')
    expect(formatarEntradaMoeda('12')).toBe('12')
    expect(formatarEntradaMoeda('1200')).toBe('1.200')
    expect(formatarEntradaMoeda('1200000')).toBe('1.200.000')
  })

  it('NÃO é máscara de centavos: 1200000 é um milhão e duzentos mil', () => {
    expect(parseMoeda(formatarEntradaMoeda('1200000'))).toBe(1200000)
  })

  it('centavo só quando a pessoa escreve a vírgula', () => {
    expect(formatarEntradaMoeda('1200,')).toBe('1.200,')
    expect(formatarEntradaMoeda('1200,5')).toBe('1.200,5')
    expect(formatarEntradaMoeda('1200,50')).toBe('1.200,50')
    expect(formatarEntradaMoeda('1200,509')).toBe('1.200,50') // 3ª casa não entra
  })

  it('ignora letras, R$ e pontos digitados (colar de fora funciona)', () => {
    expect(formatarEntradaMoeda('R$ 1.200.000,50')).toBe('1.200.000,50')
    expect(formatarEntradaMoeda('abc')).toBe('')
    expect(formatarEntradaMoeda('12a3')).toBe('123')
  })

  it('só a PRIMEIRA vírgula vale', () => {
    expect(formatarEntradaMoeda('1,2,3')).toBe('1,23')
  })

  it('zero à esquerda não fica, mas "0," continua digitável', () => {
    expect(formatarEntradaMoeda('0007')).toBe('7')
    expect(formatarEntradaMoeda('0,')).toBe('0,')
    expect(formatarEntradaMoeda('0,99')).toBe('0,99')
  })

  it('apagar tudo deixa o campo VAZIO (não "0")', () => {
    expect(formatarEntradaMoeda('')).toBe('')
    expect(formatarEntradaMoeda('   ')).toBe('')
  })
})

describe('lendo o que foi digitado', () => {
  it('devolve número de verdade', () => {
    expect(parseMoeda('1.200.000')).toBe(1200000)
    expect(parseMoeda('1.200.000,50')).toBe(1200000.5)
    expect(parseMoeda('0,99')).toBe(0.99)
  })

  it('campo vazio ou lixo é zero, nunca NaN', () => {
    for (const v of ['', '   ', 'abc', 'R$', null, undefined]) expect(parseMoeda(v as any)).toBe(0)
  })

  it('número já numérico passa direto', () => {
    expect(parseMoeda(1500.25)).toBe(1500.25)
    expect(parseMoeda(NaN)).toBe(0)
  })
})

describe('abrindo o formulário de novo', () => {
  it('o valor salvo volta formatado', () => {
    expect(moedaParaCampo(1200000)).toBe('1.200.000')
    expect(moedaParaCampo(1200000.5)).toBe('1.200.000,50')
  })

  it('zero volta VAZIO — campo com 0 escrito parece preenchido', () => {
    expect(moedaParaCampo(0)).toBe('')
    expect(moedaParaCampo(undefined)).toBe('')
  })

  it('ida e volta não perde valor', () => {
    for (const v of [1200000, 8333.33, 0.99, 50]) {
      expect(parseMoeda(moedaParaCampo(v))).toBeCloseTo(v, 2)
    }
  })
})

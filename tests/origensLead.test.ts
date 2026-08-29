import { describe, it, expect } from 'vitest'
import { normalizaOrigem, pizzaOrigens, fatiaPath, fatiaUnica, ORIGENS_CLINICA, SEM_ORIGEM } from '@/lib/origensLead'

// O gráfico de origem vira decisão de investimento em mídia. Se a soma mentir
// (grafia diferente virando duas fatias, ausência de dado escondida dentro de
// "Outros", ângulos que não fecham 360°), a decisão sai errada.

describe('normalizaOrigem', () => {
  it('cai sempre na lista fechada', () => {
    for (const bruta of ['Indicação', 'INDICACAO', ' indicado ', 'Ex-paciente', 'link na bio', 'Tráfego pago', 'Instagram', 'Google Ads', 'qualquer coisa']) {
      const o = normalizaOrigem(bruta)
      expect(ORIGENS_CLINICA).toContain(o as any)
    }
  })

  it('junta as grafias antigas da clínica no mesmo balde', () => {
    expect(normalizaOrigem('Ex-paciente')).toBe('Recorrente')
    expect(normalizaOrigem('ex paciente')).toBe('Recorrente')
    expect(normalizaOrigem('retorno')).toBe('Recorrente')
    expect(normalizaOrigem('Tráfego pago')).toBe('Meta Ads')
    expect(normalizaOrigem('Facebook Ads')).toBe('Meta Ads')
    expect(normalizaOrigem('Instagram')).toBe('Orgânico')
    expect(normalizaOrigem('Tráfego orgânico')).toBe('Orgânico')
    expect(normalizaOrigem('link na bio')).toBe('Link da bio')
  })

  it('"Google Ads" é Google, não Meta Ads', () => {
    expect(normalizaOrigem('Google Ads')).toBe('Google')
    expect(normalizaOrigem('google meu negócio')).toBe('Google')
  })

  it('desconhecido vira Outros; vazio não vira nada', () => {
    expect(normalizaOrigem('Panfleto na rua')).toBe('Outros')
    expect(normalizaOrigem('')).toBe('')
    expect(normalizaOrigem('   ')).toBe('')
    expect(normalizaOrigem(undefined)).toBe('')
  })
})

describe('pizzaOrigens', () => {
  const base = [
    { origem: 'Indicação' }, { origem: 'indicacao' }, { origem: 'Indicado' },
    { origem: 'Meta Ads' }, { origem: 'Tráfego pago' },
    { origem: 'Panfleto' },
    { origem: '' }, { origem: undefined },
  ]

  it('conta o total e agrupa as grafias numa fatia só', () => {
    const { total, fatias } = pizzaOrigens(base)
    expect(total).toBe(8)
    expect(fatias.find(f => f.nome === 'Indicação')!.qtd).toBe(3)
    expect(fatias.find(f => f.nome === 'Meta Ads')!.qtd).toBe(2)
  })

  it('sem origem é fatia PRÓPRIA — não entra em Outros', () => {
    const { fatias } = pizzaOrigens(base)
    expect(fatias.find(f => f.nome === SEM_ORIGEM)!.qtd).toBe(2)
    expect(fatias.find(f => f.nome === 'Outros')!.qtd).toBe(1)
  })

  it('as quantidades somam o total e os ângulos fecham 360', () => {
    const { total, fatias } = pizzaOrigens(base)
    expect(fatias.reduce((s, f) => s + f.qtd, 0)).toBe(total)
    expect(fatias.reduce((s, f) => s + f.pct, 0)).toBeCloseTo(100, 6)
    expect(fatias[0].anguloInicio).toBe(0)
    expect(fatias[fatias.length - 1].anguloFim).toBeCloseTo(360, 6)
    // cada fatia começa onde a anterior terminou (sem buraco nem sobreposição)
    fatias.forEach((f, i) => { if (i > 0) expect(f.anguloInicio).toBeCloseTo(fatias[i - 1].anguloFim, 6) })
  })

  it('Outros e Sem origem vão para o fim, mesmo sendo maioria', () => {
    const { fatias } = pizzaOrigens([
      { origem: 'Panfleto' }, { origem: 'Panfleto' }, { origem: 'Panfleto' },
      { origem: '' }, { origem: '' }, { origem: '' }, { origem: '' },
      { origem: 'Google' },
    ])
    expect(fatias.map(f => f.nome)).toEqual(['Google', 'Outros', SEM_ORIGEM])
  })

  it('lista vazia não desenha nada (e não divide por zero)', () => {
    expect(pizzaOrigens([])).toEqual({ total: 0, fatias: [] })
  })

  it('cada fatia tem cor', () => {
    for (const f of pizzaOrigens(base).fatias) expect(f.cor).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('desenho', () => {
  it('o caminho da fatia é um arco fechado', () => {
    const d = fatiaPath(60, 60, 55, 33, 0, 90)
    expect(d.startsWith('M ')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect(d).not.toMatch(/NaN|undefined/)
  })

  it('fatia maior que meia volta usa o arco grande', () => {
    expect(fatiaPath(60, 60, 55, 33, 0, 200)).toMatch(/A 55 55 0 1 1/)
    expect(fatiaPath(60, 60, 55, 33, 0, 100)).toMatch(/A 55 55 0 0 1/)
  })

  it('canal único vira anel (o arco de 360 não desenha)', () => {
    expect(fatiaUnica(pizzaOrigens([{ origem: 'Google' }, { origem: 'google' }]).fatias)).toBe(true)
    expect(fatiaUnica(pizzaOrigens([{ origem: 'Google' }, { origem: 'Indicação' }]).fatias)).toBe(false)
  })
})

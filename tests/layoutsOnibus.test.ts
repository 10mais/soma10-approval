import { describe, it, expect } from 'vitest'
import { LAYOUTS, layoutPorId, totalPoltronas, numerosPoltronas, poltronaExiste } from '@/lib/layoutsOnibus'

// Layouts de ônibus: a numeração das poltronas é a base das reservas (assento
// nominal). Números duplicados ou inexistentes quebrariam a unicidade de poltrona.

describe('layouts de ônibus', () => {
  it('todo layout tem números ÚNICOS cobrindo 1..total (ordem do croqui é irregular)', () => {
    for (const l of LAYOUTS) {
      const nums = l.poltronas.map(p => p.numero)
      expect(new Set(nums).size, `layout ${l.id}: números duplicados`).toBe(nums.length)
      // conjunto = {1..total} (posições seguem o croqui, não são sequenciais por fileira)
      expect(new Set(nums)).toEqual(new Set(Array.from({ length: nums.length }, (_, i) => String(i + 1))))
    }
  })

  it('carros da Deny têm os totais dos croquis (2023=40, 2021=43)', () => {
    expect(totalPoltronas(layoutPorId('carro-2023')!)).toBe(40)
    expect(totalPoltronas(layoutPorId('carro-2021')!)).toBe(43)
  })

  it('cada poltrona tem andar/fileira/coluna válidos e o andar bate com o layout', () => {
    for (const l of LAYOUTS) {
      for (const p of l.poltronas) {
        expect(p.andar).toBeGreaterThanOrEqual(1)
        expect(p.andar).toBeLessThanOrEqual(l.andares)
        expect(p.fileira).toBeGreaterThanOrEqual(1)
        expect(p.coluna).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('helpers: layoutPorId, total, números e existência', () => {
    const l = layoutPorId('carro-2023')!
    expect(l).toBeTruthy()
    expect(totalPoltronas(l)).toBe(l.poltronas.length)
    expect(numerosPoltronas(l)).toContain('1')
    expect(poltronaExiste(l, '1')).toBe(true)
    expect(poltronaExiste(l, '999')).toBe(false)
    expect(layoutPorId('inexistente')).toBeNull()
    expect(layoutPorId(null)).toBeNull()
  })
})

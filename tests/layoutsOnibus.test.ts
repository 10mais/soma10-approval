import { describe, it, expect } from 'vitest'
import { LAYOUTS, layoutPorId, totalPoltronas, numerosPoltronas, poltronaExiste } from '@/lib/layoutsOnibus'

// Layouts de ônibus: a numeração das poltronas é a base das reservas (assento
// nominal). Números duplicados ou inexistentes quebrariam a unicidade de poltrona.

describe('layouts de ônibus', () => {
  it('todo preset tem números de poltrona ÚNICOS e sequenciais', () => {
    for (const l of LAYOUTS) {
      const nums = l.poltronas.map(p => p.numero)
      expect(new Set(nums).size, `layout ${l.id}: números duplicados`).toBe(nums.length)
      // sequencial de 1..total
      expect(nums).toEqual(Array.from({ length: nums.length }, (_, i) => String(i + 1)))
    }
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
    const l = layoutPorId('dd-leito-2x1')!
    expect(l).toBeTruthy()
    expect(totalPoltronas(l)).toBe(l.poltronas.length)
    expect(numerosPoltronas(l)).toContain('1')
    expect(poltronaExiste(l, '1')).toBe(true)
    expect(poltronaExiste(l, '999')).toBe(false)
    expect(layoutPorId('inexistente')).toBeNull()
    expect(layoutPorId(null)).toBeNull()
  })
})

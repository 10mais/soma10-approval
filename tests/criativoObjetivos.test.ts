import { describe, it, expect } from 'vitest'
import { OBJETIVOS, objetivoDef, objetivoLabel } from '@/lib/criativoObjetivos'

// Taxonomia de objetivo do criativo (motor novo). Guarda contra: chave duplicada,
// objetivo sem rótulo/dica e campo de brief inválido apontado por um objetivo.

const CAMPOS_VALIDOS = ['cta', 'oferta', 'preco', 'dataEvento', 'horaEvento', 'localEvento', 'legal', 'whatsapp']

describe('criativoObjetivos', () => {
  it('não tem chaves duplicadas', () => {
    const keys = OBJETIVOS.map(o => o.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('todo objetivo tem label e dica', () => {
    for (const o of OBJETIVOS) {
      expect(o.label.length).toBeGreaterThan(2)
      expect(o.dica.length).toBeGreaterThan(5)
    }
  })

  it('só aponta campos de brief válidos', () => {
    for (const o of OBJETIVOS) {
      for (const c of o.campos) expect(CAMPOS_VALIDOS).toContain(c)
    }
  })

  it('objetivoDef resolve chave conhecida e ignora desconhecida', () => {
    expect(objetivoDef('venda')?.label).toBe('Venda direta')
    expect(objetivoDef('inexistente')).toBeUndefined()
    expect(objetivoDef(undefined)).toBeUndefined()
  })

  it('objetivoLabel nunca quebra com valor legado', () => {
    expect(objetivoLabel('oferta')).toBe('Oferta/Promoção')
    expect(objetivoLabel('qualquer-coisa')).toBe('')
    expect(objetivoLabel(undefined)).toBe('')
  })
})

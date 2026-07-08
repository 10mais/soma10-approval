import { describe, it, expect } from 'vitest'
import { temModulo, totalMensalModulos } from '@/lib/modulos'

// Cobrança: um erro aqui cobra o cliente errado ou some com receita no financeiro.

describe('temModulo (acesso do cliente a um módulo)', () => {
  it('módulos do núcleo são sempre liberados, mesmo sem config', () => {
    expect(temModulo(undefined, 'entregas')).toBe(true)
    expect(temModulo({}, 'aprovacoes')).toBe(true)
    expect(temModulo({}, 'solicitar')).toBe(true)
  })

  it('add-on pago só libera quando explicitamente ativo', () => {
    expect(temModulo({}, 'analytics')).toBe(false)
    expect(temModulo({ analytics: { ativo: false } }, 'analytics')).toBe(false)
    expect(temModulo({ analytics: { ativo: true } }, 'analytics')).toBe(true)
  })

  it('chave inexistente nunca libera', () => {
    expect(temModulo({ analytics: { ativo: true } }, 'inexistente')).toBe(false)
  })
})

describe('totalMensalModulos (soma da mensalidade dos add-ons)', () => {
  it('sem módulos = 0', () => {
    expect(totalMensalModulos(undefined)).toBe(0)
    expect(totalMensalModulos({})).toBe(0)
  })

  it('usa o valor padrão do catálogo quando o cliente não define valor', () => {
    // analytics padrão = 149
    expect(totalMensalModulos({ analytics: { ativo: true } })).toBe(149)
  })

  it('usa o valor customizado do cliente quando definido', () => {
    expect(totalMensalModulos({ analytics: { ativo: true, valor: 200 } })).toBe(200)
  })

  it('soma apenas os add-ons ativos', () => {
    // analytics 149 + playbook 129 = 278; listening inativo não conta
    expect(totalMensalModulos({
      analytics: { ativo: true },
      playbook: { ativo: true },
      listening: { ativo: false },
    })).toBe(278)
  })

  it('valor 0 explícito é respeitado (não cai no padrão)', () => {
    // regressão: um "e.valor || padrão" ingênuo cobraria 149 aqui
    expect(totalMensalModulos({ analytics: { ativo: true, valor: 0 } })).toBe(0)
  })
})

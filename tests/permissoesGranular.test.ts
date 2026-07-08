import { describe, it, expect } from 'vitest'
import { podeAbaGranular, podeAcaoGranular } from '@/lib/permissoesGranular'

// Segunda camada de segurança: liga/desliga tela a tela e ação a ação.

describe('podeAbaGranular (acesso a uma tela)', () => {
  it('admin e papéis não afetados sempre podem', () => {
    expect(podeAbaGranular('admin', 'rentabilidade')).toBe(true)
    expect(podeAbaGranular('vendas', 'crm')).toBe(true)
    expect(podeAbaGranular('cliente', 'studio')).toBe(true)
  })

  it('default é liberado quando nada foi marcado', () => {
    expect(podeAbaGranular('gerente', 'studio')).toBe(true)
    expect(podeAbaGranular('usuario', 'tarefas')).toBe(true)
  })

  it('config do papel pode desligar uma aba específica', () => {
    const cfg = { usuario: { abas: { studio: false } } }
    expect(podeAbaGranular('usuario', 'studio', undefined, cfg)).toBe(false)
    expect(podeAbaGranular('usuario', 'tarefas', undefined, cfg)).toBe(true)
  })

  it('override do usuário vence a config do papel', () => {
    const cfg = { usuario: { abas: { studio: false } } }
    expect(podeAbaGranular('usuario', 'studio', { abas: { studio: true } }, cfg)).toBe(true)
  })
})

describe('podeAcaoGranular (ação crítica)', () => {
  it('default liberado; config desliga; override do usuário vence', () => {
    expect(podeAcaoGranular('gerente', 'publicar')).toBe(true)
    const cfg = { gerente: { acoes: { publicar: false } } }
    expect(podeAcaoGranular('gerente', 'publicar', undefined, cfg)).toBe(false)
    expect(podeAcaoGranular('gerente', 'publicar', { acoes: { publicar: true } }, cfg)).toBe(true)
  })

  it('papéis não afetados sempre podem a ação', () => {
    expect(podeAcaoGranular('admin', 'excluir')).toBe(true)
    expect(podeAcaoGranular('vendas', 'excluir')).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { usadas, restantes, statusPacote, valorPorSessao, podeConsumir } from '@/lib/pacotes'

// Pacotes de tratamento: contar sessões e decidir status/consumo. Errar aqui
// deixa consumir além do vendido ou marca concluído no lugar errado.
const sess = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), data: '2026-07-01T10:00:00.000Z' }))

describe('pacotes — saldo e status', () => {
  it('usadas e restantes', () => {
    expect(usadas({ sessoes: sess(3) })).toBe(3)
    expect(restantes({ sessoes: sess(3), totalSessoes: 10 })).toBe(7)
    expect(restantes({ sessoes: sess(12), totalSessoes: 10 })).toBe(0) // nunca negativo
  })
  it('status: ativo até esgotar, concluído ao zerar o saldo', () => {
    expect(statusPacote({ sessoes: sess(3), totalSessoes: 10 })).toBe('ativo')
    expect(statusPacote({ sessoes: sess(10), totalSessoes: 10 })).toBe('concluido')
  })
  it('cancelado manda sobre tudo', () => {
    expect(statusPacote({ sessoes: sess(3), totalSessoes: 10, cancelado: true })).toBe('cancelado')
    expect(statusPacote({ sessoes: sess(10), totalSessoes: 10, cancelado: true })).toBe('cancelado')
  })
  it('valor por sessão (rateio) e proteção contra divisão por zero', () => {
    expect(valorPorSessao({ valor: 1000, totalSessoes: 10 })).toBe(100)
    expect(valorPorSessao({ valor: 1000, totalSessoes: 0 })).toBe(0)
  })
  it('podeConsumir só com saldo e não cancelado', () => {
    expect(podeConsumir({ sessoes: sess(3), totalSessoes: 10 })).toBe(true)
    expect(podeConsumir({ sessoes: sess(10), totalSessoes: 10 })).toBe(false)
    expect(podeConsumir({ sessoes: sess(3), totalSessoes: 10, cancelado: true })).toBe(false)
  })
})

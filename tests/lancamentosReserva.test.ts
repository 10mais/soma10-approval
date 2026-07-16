import { describe, it, expect } from 'vitest'
import { lancamentosDaReserva, type ReservaFinanceiroLite } from '@/lib/lancamentosReserva'

// A tradução venda → financeiro. Se errar, o caixa previsto da operadora mente.

const base = (extra: Partial<ReservaFinanceiroLite> = {}): ReservaFinanceiroLite => ({
  id: 'r1',
  contratanteNome: 'Família Silva',
  status: 'confirmada',
  financeiro: {
    parcelas: [
      { id: 'p1', numero: 1, valor: 500, vencimento: '2026-08-01', status: 'pago', pagoEm: '2026-07-20' },
      { id: 'p2', numero: 2, valor: 500, vencimento: '2026-09-01', status: 'pendente' },
    ],
    pagamentos: [{ id: 'g1', data: '2026-07-16', valor: 200, nota: 'sinal' }],
  },
  ...extra,
})

describe('lancamentosDaReserva', () => {
  it('parcela vira entrada prevista; paga vira recebida na data do pagamento', () => {
    const l = lancamentosDaReserva(base(), 'Foz do Iguaçu')
    const p1 = l.find(x => x.id === 'res-r1-p1')!
    const p2 = l.find(x => x.id === 'res-r1-p2')!
    expect(p1).toMatchObject({ tipo: 'entrada', valor: 500, recebido: true, data: '2026-07-20', reservaId: 'r1' })
    expect(p2).toMatchObject({ recebido: false, data: '2026-09-01' })
    expect(p1.descricao).toBe('Família Silva — Foz do Iguaçu (parcela 1/2)')
  })

  it('pagamento avulso é dinheiro que JÁ entrou', () => {
    const g = lancamentosDaReserva(base(), 'Foz').find(x => x.id === 'res-r1-pg-g1')!
    expect(g).toMatchObject({ recebido: true, valor: 200, data: '2026-07-16' })
    expect(g.descricao).toContain('sinal')
  })

  it('ids são determinísticos — re-sincronizar sobrescreve em vez de duplicar', () => {
    const a = lancamentosDaReserva(base(), 'Foz').map(x => x.id)
    const b = lancamentosDaReserva(base(), 'Foz').map(x => x.id)
    expect(a).toEqual(b)
  })

  it('cancelada: parcela pendente some da previsão, o que foi pago FICA', () => {
    const l = lancamentosDaReserva(base({ status: 'cancelada' }), 'Foz')
    expect(l.map(x => x.id)).toEqual(['res-r1-p1', 'res-r1-pg-g1']) // p2 pendente caiu
  })

  it('sem financeiro ou com linha inválida, não inventa lançamento', () => {
    expect(lancamentosDaReserva({ id: 'r2', contratanteNome: 'X' }, 'Foz')).toEqual([])
    const suja = base()
    suja.financeiro!.parcelas = [{ id: 'p1', numero: 1, valor: 0, vencimento: '2026-08-01', status: 'pendente' }]
    suja.financeiro!.pagamentos = [{ id: 'g1', data: 'ontem', valor: 100 }]
    expect(lancamentosDaReserva(suja, 'Foz')).toEqual([])
  })
})

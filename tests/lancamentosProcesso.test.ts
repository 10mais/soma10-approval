import { describe, it, expect } from 'vitest'
import { lancamentosDoProcesso, type ProcessoFinanceiroLite } from '@/lib/lancamentosProcesso'

const proc = (over: Partial<ProcessoFinanceiroLite> = {}): ProcessoFinanceiroLite => ({
  id: 'abc', titulo: 'Família Lunkes', status: 'ativo',
  financeiro: {
    parcelas: [
      { id: 'p1', numero: 1, valor: 5000, vencimento: '2026-08-05', status: 'pago', pagoEm: '2026-08-03' },
      { id: 'p2', numero: 2, valor: 5000, vencimento: '2026-09-05', status: 'pendente' },
    ],
    pagamentos: [],
  },
  ...over,
})

describe('lancamentosDoProcesso', () => {
  it('cada parcela vira um lançamento de entrada', () => {
    const l = lancamentosDoProcesso(proc())
    expect(l).toHaveLength(2)
    expect(l.every(x => x.tipo === 'entrada')).toBe(true)
    expect(l[0].descricao).toContain('Família Lunkes')
    expect(l[0].descricao).toContain('parcela 1/2')
  })

  it('id é DETERMINÍSTICO — re-sincronizar sobrescreve, não duplica', () => {
    const a = lancamentosDoProcesso(proc())
    const b = lancamentosDoProcesso(proc())
    expect(a.map(x => x.id)).toEqual(b.map(x => x.id))
    expect(a[0].id).toBe('proc-abc-p1')
  })

  it('parcela paga entra na data do PAGAMENTO; pendente, na do vencimento', () => {
    const l = lancamentosDoProcesso(proc())
    expect(l[0].recebido).toBe(true)
    expect(l[0].data).toBe('2026-08-03')
    expect(l[1].recebido).toBe(false)
    expect(l[1].data).toBe('2026-09-05')
  })

  it('processo ARQUIVADO: pendente some da previsão, pago permanece', () => {
    const l = lancamentosDoProcesso(proc({ status: 'arquivado' }))
    expect(l).toHaveLength(1)
    expect(l[0].id).toBe('proc-abc-p1')
    expect(l[0].recebido).toBe(true)
  })

  it('pagamento avulso entra como recebido', () => {
    const l = lancamentosDoProcesso(proc({
      financeiro: { parcelas: [], pagamentos: [{ id: 'x1', data: '2026-08-10', valor: 800, nota: 'entrada extra' }] },
    }))
    expect(l).toHaveLength(1)
    expect(l[0].id).toBe('proc-abc-pg-x1')
    expect(l[0].recebido).toBe(true)
    expect(l[0].descricao).toContain('entrada extra')
  })

  it('lixo não vira lançamento (valor zero, data inválida)', () => {
    const l = lancamentosDoProcesso(proc({
      financeiro: {
        parcelas: [{ id: 'p1', numero: 1, valor: 0, vencimento: '2026-08-05', status: 'pendente' }],
        pagamentos: [{ id: 'x', data: 'ontem', valor: 100 }],
      },
    }))
    expect(l).toEqual([])
  })

  it('processo sem financeiro devolve lista vazia', () => {
    expect(lancamentosDoProcesso({ id: 'a', titulo: 'X' })).toEqual([])
  })
})

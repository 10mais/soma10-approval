import { describe, it, expect } from 'vitest'
import { mesAnterior, montarFechamento, mesesAFechar, faturamentoDoMes, type FechamentoMes } from '@/lib/fechamentoMes'
import type { ClienteFin } from '@/lib/receitaRecorrente'

const HOJE = new Date(2026, 8, 22) // 22/09/2026

const antigo: ClienteFin = { id: 'a', nome: 'Antigo', contratoValor: 2000, contratoInicio: '2026-07-01' }
const novo: ClienteFin = { id: 'b', nome: 'Novo', contratoValor: 3000, contratoInicio: '2026-09-05' }

describe('fechamento do mês — o passado vira história e não muda mais', () => {
  it('mês anterior atravessa a virada do ano', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12')
    expect(mesAnterior('2026-09')).toBe('2026-08')
  })

  it('o retrato do mês guarda o total e quem faturou nele', () => {
    const f = montarFechamento([antigo, novo], '2026-08', HOJE)
    expect(f.mes).toBe('2026-08')
    expect(f.total).toBe(2000)
    expect(f.porCliente).toEqual([{ id: 'a', nome: 'Antigo', total: 2000 }])
    expect(f.fechadoEm).toBeTruthy()
  })

  it('fecha do primeiro mês da base até o mês PASSADO — nunca o mês corrente', () => {
    expect(mesesAFechar([antigo, novo], HOJE, [])).toEqual(['2026-07', '2026-08'])
    expect(mesesAFechar([antigo, novo], HOJE, ['2026-07'])).toEqual(['2026-08'])
    expect(mesesAFechar([antigo, novo], HOJE, ['2026-07', '2026-08'])).toEqual([])
  })

  it('o número gravado ganha do recalculado — aumento de contrato não reescreve o passado', () => {
    const fechados: Record<string, FechamentoMes> = {
      '2026-08': { mes: '2026-08', total: 2000, fechadoEm: '2026-09-01T03:00:00.000Z', porCliente: [{ id: 'a', nome: 'Antigo', total: 2000 }] },
    }
    // o contrato do Antigo subiu para 5.000 depois do fechamento
    const aumentado: ClienteFin[] = [{ ...antigo, contratoValor: 5000 }, novo]
    expect(faturamentoDoMes('2026-08', fechados, aumentado, HOJE)).toEqual({ total: 2000, fechado: true })
    // o mês corrente ainda é cálculo — e já usa o valor novo
    expect(faturamentoDoMes('2026-09', fechados, aumentado, HOJE)).toEqual({ total: 8000, fechado: false })
  })

  it('mês sem fechamento cai no cálculo (antes do recurso existir, nada se perde)', () => {
    expect(faturamentoDoMes('2026-07', {}, [antigo, novo], HOJE)).toEqual({ total: 2000, fechado: false })
  })
})

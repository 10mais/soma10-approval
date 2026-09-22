import { describe, it, expect } from 'vitest'
import {
  mesDe, mesInicioContrato, mesFimContrato, contratoVigenteNoMes, mensalidadeCliente,
  receitaClienteNoMes, receitaTotalNoMes, mesesEntre, historicoFaturamento, faturamentoAcumulado,
  contratoVigenteNaData, type ClienteFin,
} from '@/lib/receitaRecorrente'

// "hoje" fixo: teste de dinheiro não pode mudar de resposta conforme o dia em que roda.
const HOJE = new Date(2026, 8, 22) // 22/09/2026 (mês 8 = setembro)

const antigo: ClienteFin = { id: 'a', nome: 'Cliente antigo', contratoValor: 2000, contratoInicio: '2026-01-10', criadoEm: '2026-01-09T12:00:00.000Z' }
const novo: ClienteFin = { id: 'b', nome: 'Cliente novo', contratoValor: 3000, contratoInicio: '2026-09-05' }

describe('receita recorrente — cada mês guarda o que ELE faturou', () => {
  it('cliente novo só entra do mês dele para a frente', () => {
    expect(receitaClienteNoMes(novo, '2026-08', HOJE).total).toBe(0)
    expect(receitaClienteNoMes(novo, '2026-09', HOJE).total).toBe(3000)
    expect(receitaClienteNoMes(novo, '2026-10', HOJE).total).toBe(3000)
  })

  it('o mês de agosto não vira o mês de setembro (nada de somar tudo em todo mês)', () => {
    const base = [antigo, novo]
    expect(receitaTotalNoMes(base, '2026-07', HOJE)).toBe(2000)
    expect(receitaTotalNoMes(base, '2026-08', HOJE)).toBe(2000)
    expect(receitaTotalNoMes(base, '2026-09', HOJE)).toBe(5000)
  })

  it('sem data de início, vale o mês do cadastro', () => {
    const c: ClienteFin = { contratoValor: 1000, criadoEm: '2026-06-15T10:00:00.000Z' }
    expect(mesInicioContrato(c)).toBe('2026-06')
    expect(receitaClienteNoMes(c, '2026-05', HOJE).total).toBe(0)
    expect(receitaClienteNoMes(c, '2026-06', HOJE).total).toBe(1000)
  })

  it('cliente arquivado para de faturar no mês em que saiu — e o passado dele fica de pé', () => {
    const saiu: ClienteFin = { contratoValor: 1500, contratoInicio: '2026-02-01', arquivado: true, arquivadoEm: '2026-07-20T09:00:00.000Z' }
    expect(mesFimContrato(saiu, HOJE)).toBe('2026-07')
    expect(receitaClienteNoMes(saiu, '2026-06', HOJE).total).toBe(1500)
    expect(receitaClienteNoMes(saiu, '2026-07', HOJE).total).toBe(1500)
    expect(receitaClienteNoMes(saiu, '2026-08', HOJE).total).toBe(0)
  })

  it('arquivado sem data: conta até o mês atual, nada no futuro', () => {
    const saiu: ClienteFin = { contratoValor: 900, contratoInicio: '2026-01-01', arquivado: true }
    expect(receitaClienteNoMes(saiu, '2026-09', HOJE).total).toBe(900)
    expect(receitaClienteNoMes(saiu, '2026-10', HOJE).total).toBe(0)
  })

  it('renovação vencida NÃO apaga a receita (contrato a renovar continua sendo contrato)', () => {
    const aRenovar: ClienteFin = { contratoValor: 2500, contratoInicio: '2025-09-01', contratoRenovacao: '2026-08-01' } as any
    expect(receitaClienteNoMes(aRenovar, '2026-09', HOJE).total).toBe(2500)
  })

  it('projeto interno não fatura — nem recorrente nem avulsa', () => {
    const interno: ClienteFin = { tipo: 'interno', contratoValor: 5000, contratoInicio: '2026-01-01', receitasAvulsas: [{ mes: '2026-09', valor: 700 }] }
    expect(receitaClienteNoMes(interno, '2026-09', HOJE).total).toBe(0)
  })

  it('cobrança avulsa entra só no mês dela, por cima do recorrente', () => {
    const c: ClienteFin = { ...antigo, receitasAvulsas: [{ mes: '2026-09', valor: 800, descricao: 'landing' }] }
    expect(receitaClienteNoMes(c, '2026-08', HOJE)).toEqual({ recorrente: 2000, avulsas: 0, total: 2000 })
    expect(receitaClienteNoMes(c, '2026-09', HOJE)).toEqual({ recorrente: 2000, avulsas: 800, total: 2800 })
  })

  it('módulos contratados somam à mensalidade', () => {
    const c: ClienteFin = { contratoValor: 1000, modulos: { analytics: { ativo: true, valor: 200 } } as any, contratoInicio: '2026-09-01' }
    expect(mensalidadeCliente(c)).toBe(1200)
    expect(receitaClienteNoMes(c, '2026-09', HOJE).total).toBe(1200)
  })

  it('o histórico é mês a mês e o acumulado é a soma dele (nunca o mês atual × N)', () => {
    const base = [antigo, novo]
    const h = historicoFaturamento(base, HOJE)
    expect(h[0]).toEqual({ mes: '2026-01', total: 2000 })
    expect(h[h.length - 1]).toEqual({ mes: '2026-09', total: 5000 })
    expect(h.length).toBe(9) // janeiro a setembro
    expect(faturamentoAcumulado(base, HOJE)).toBe(2000 * 9 + 3000)
  })

  it('previsão de caixa só cobra quem ainda é cliente naquela data', () => {
    const saiu: ClienteFin = { contratoValor: 1500, contratoInicio: '2026-02-01', arquivado: true, arquivadoEm: '2026-07-20' }
    expect(contratoVigenteNaData(novo, new Date(2026, 9, 5), HOJE)).toBe(true)
    expect(contratoVigenteNaData(saiu, new Date(2026, 9, 5), HOJE)).toBe(false)
  })

  it('mês de um carimbo com hora usa o dia LOCAL (o build da Vercel roda em UTC)', () => {
    expect(mesDe('2026-09-22')).toBe('2026-09')
    expect(mesDe('2026-09')).toBe('2026-09')
    expect(mesDe(new Date(2026, 7, 31, 21, 30).toISOString())).toBe('2026-08')
    expect(mesDe('')).toBeNull()
    expect(mesDe('nada')).toBeNull()
  })

  it('mesesEntre atravessa a virada do ano', () => {
    expect(mesesEntre('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(mesesEntre('2026-03', '2026-03')).toEqual(['2026-03'])
  })

  it('cliente sem início e sem cadastro não inventa passado', () => {
    const solto: ClienteFin = { contratoValor: 700 }
    expect(contratoVigenteNoMes(solto, '2026-05', HOJE)).toBe(false)
    expect(contratoVigenteNoMes(solto, '2026-09', HOJE)).toBe(true)
  })
})

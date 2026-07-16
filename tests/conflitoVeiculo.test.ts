import { describe, it, expect } from 'vitest'
import { conflitosDeVeiculo, type ViagemVeiculo } from '@/lib/conflitoVeiculo'

// A regra que impede o mesmo ônibus em duas viagens ao mesmo tempo. Bordas
// INCLUSIVAS: voltar dia 27 e sair dia 27 disputam o mesmo ônibus.

const v = (o: Partial<ViagemVeiculo>): ViagemVeiculo => ({
  id: 'v1', titulo: 'Foz', dataIda: '2026-07-20', dataVolta: '2026-07-22', veiculoId: 'bus1', ...o,
})

describe('conflitosDeVeiculo', () => {
  it('pega sobreposição cheia, parcial e contida', () => {
    const base = [v({})]
    // mesmo período
    expect(conflitosDeVeiculo(base, 'bus1', '2026-07-20', '2026-07-22')).toHaveLength(1)
    // começa dentro, termina depois
    expect(conflitosDeVeiculo(base, 'bus1', '2026-07-21', '2026-07-25')).toHaveLength(1)
    // contém a existente
    expect(conflitosDeVeiculo(base, 'bus1', '2026-07-19', '2026-07-23')).toHaveLength(1)
  })

  it('borda é INCLUSIVA: volta dia 22 conflita com saída dia 22', () => {
    expect(conflitosDeVeiculo([v({})], 'bus1', '2026-07-22', '2026-07-25')).toHaveLength(1)
    expect(conflitosDeVeiculo([v({})], 'bus1', '2026-07-23', '2026-07-25')).toHaveLength(0)
  })

  it('períodos disjuntos e veículo diferente não conflitam', () => {
    expect(conflitosDeVeiculo([v({})], 'bus1', '2026-08-01', '2026-08-03')).toHaveLength(0)
    expect(conflitosDeVeiculo([v({})], 'bus2', '2026-07-20', '2026-07-22')).toHaveLength(0)
  })

  it('bate-volta (sem dataVolta) ocupa só o dia da ida', () => {
    const bateVolta = [v({ dataVolta: undefined })]
    expect(conflitosDeVeiculo(bateVolta, 'bus1', '2026-07-20')).toHaveLength(1)
    expect(conflitosDeVeiculo(bateVolta, 'bus1', '2026-07-21', '2026-07-23')).toHaveLength(0)
  })

  it('cancelada LIBERA o veículo; realizada segue ocupando', () => {
    expect(conflitosDeVeiculo([v({ status: 'cancelada' })], 'bus1', '2026-07-20', '2026-07-22')).toHaveLength(0)
    expect(conflitosDeVeiculo([v({ status: 'realizada' })], 'bus1', '2026-07-20', '2026-07-22')).toHaveLength(1)
  })

  it('a própria viagem em edição não conflita consigo mesma', () => {
    expect(conflitosDeVeiculo([v({ id: 'eu' })], 'bus1', '2026-07-20', '2026-07-22', 'eu')).toHaveLength(0)
  })

  it('sem veículo ou sem data de ida não há o que checar', () => {
    expect(conflitosDeVeiculo([v({})], undefined, '2026-07-20')).toHaveLength(0)
    expect(conflitosDeVeiculo([v({})], 'bus1', undefined)).toHaveLength(0)
    expect(conflitosDeVeiculo([v({})], 'bus1', '20/07/2026')).toHaveLength(0)
  })

  it('volta antes da ida (dado sujo) vira bate-volta em vez de comparar lixo', () => {
    const suja = [v({ dataIda: '2026-07-20', dataVolta: '2026-07-10' })]
    expect(conflitosDeVeiculo(suja, 'bus1', '2026-07-20')).toHaveLength(1)
    expect(conflitosDeVeiculo(suja, 'bus1', '2026-07-15')).toHaveLength(0)
  })
})

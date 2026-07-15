import { describe, it, expect } from 'vitest'
import { poltronasOcupadas, poltronasEmConflito, valorTotalReserva, ocupaPoltrona, Reserva } from '@/lib/reservas'

// Reservas: JAMAIS dois passageiros na mesma poltrona. Errar aqui = overbooking.
const reserva = (id: string, viagemId: string, poltronas: string[], status: any = 'confirmada'): Reserva => ({
  id, viagemId, contratanteNome: 'X', status,
  passageiros: poltronas.map(p => ({ nome: 'p' + p, poltrona: p })),
  criadoEm: '', atualizadoEm: '',
})

describe('poltronas — unicidade', () => {
  const reservas = [
    reserva('r1', 'e1', ['1', '2']),
    reserva('r2', 'e1', ['5'], 'pre-reserva'),
    reserva('r3', 'e1', ['9'], 'cancelada'), // cancelada libera a poltrona
    reserva('r4', 'e2', ['1']),              // outra viagem não conta
  ]

  it('ocupadas ignora canceladas e outra viagem', () => {
    const oc = poltronasOcupadas(reservas, 'e1')
    expect(Array.from(oc).sort()).toEqual(['1', '2', '5'])
    expect(oc.has('9')).toBe(false) // cancelada
    expect(oc.has('1')).toBe(true)
  })

  it('ao editar, ignora a própria reserva', () => {
    const oc = poltronasOcupadas(reservas, 'e1', 'r1')
    expect(oc.has('1')).toBe(false)
    expect(oc.has('5')).toBe(true)
  })

  it('conflito: poltrona já ocupada por outra reserva', () => {
    const oc = poltronasOcupadas(reservas, 'e1')
    expect(poltronasEmConflito(['1'], oc)).toEqual(['1'])
    expect(poltronasEmConflito(['3', '4'], oc)).toEqual([]) // livres
  })

  it('conflito: poltrona repetida DENTRO da própria reserva', () => {
    expect(poltronasEmConflito(['7', '7'], new Set())).toEqual(['7'])
  })

  it('ocupaPoltrona: cancelada não ocupa; demais ocupam', () => {
    expect(ocupaPoltrona('confirmada')).toBe(true)
    expect(ocupaPoltrona('pre-reserva')).toBe(true)
    expect(ocupaPoltrona('cancelada')).toBe(false)
  })

  it('valor total = pax × pacote − desconto (nunca negativo)', () => {
    expect(valorTotalReserva(2, 1000, 100)).toBe(1900)
    expect(valorTotalReserva(1, 500, 999)).toBe(0)
  })
})

import { describe, it, expect } from 'vitest'
import { sobrepoe, acharConflito, ocupaAgenda } from '@/lib/agenda'

// Conflito de horário da Agenda. Guarda contra: encaixe silencioso em cima de
// outro paciente e falso conflito entre profissionais diferentes/cancelados.

const às = (h: string, dur = 30, extra: any = {}) => ({
  profissionalEmail: 'dra@x.com', dataInicio: `2026-07-12T${h}:00.000Z`, duracaoMin: dur, ...extra,
})

describe('sobrepoe', () => {
  it('intervalos cruzados conflitam', () => {
    expect(sobrepoe(às('09:00', 60), às('09:30', 30))).toBe(true)
    expect(sobrepoe(às('09:30', 30), às('09:00', 60))).toBe(true)
    expect(sobrepoe(às('09:00', 30), às('09:00', 30))).toBe(true)
  })
  it('fim às 10h e início às 10h NÃO conflitam (meio-aberto)', () => {
    expect(sobrepoe(às('09:00', 60), às('10:00', 30))).toBe(false)
  })
  it('data inválida nunca conflita (não trava o fluxo)', () => {
    expect(sobrepoe(às('09:00'), { ...às('09:00'), dataInicio: 'inválida' })).toBe(false)
  })
})

describe('acharConflito', () => {
  const marcados = [
    { id: 'a1', ...às('09:00', 30, { status: 'confirmado' }) },
    { id: 'a2', ...às('10:00', 30, { status: 'cancelado' }) },
    { id: 'a3', ...às('11:00', 30, { status: 'agendado', profissionalEmail: 'dr2@x.com' }) },
  ]
  it('acha conflito com horário ocupado do MESMO profissional', () => {
    expect(acharConflito(às('09:15', 30), marcados)?.id).toBe('a1')
  })
  it('cancelado não ocupa a agenda', () => {
    expect(acharConflito(às('10:00', 30), marcados)).toBeNull()
  })
  it('outro profissional no mesmo horário não é conflito', () => {
    expect(acharConflito(às('11:00', 30), marcados)).toBeNull()
  })
  it('editar a si mesmo não conflita consigo', () => {
    expect(acharConflito({ id: 'a1', ...às('09:00', 30) }, marcados)).toBeNull()
  })
})

describe('ocupaAgenda', () => {
  it('agendado/confirmado/atendido ocupam; faltou/cancelado não', () => {
    expect(ocupaAgenda('agendado')).toBe(true)
    expect(ocupaAgenda('confirmado')).toBe(true)
    expect(ocupaAgenda('atendido')).toBe(true)
    expect(ocupaAgenda('faltou')).toBe(false)
    expect(ocupaAgenda('cancelado')).toBe(false)
    expect(ocupaAgenda(undefined)).toBe(true) // default seguro
  })
})

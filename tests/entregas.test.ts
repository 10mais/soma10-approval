import { describe, it, expect } from 'vitest'
import { atrasada, emRisco, diasDeAtraso } from '@/lib/entregas'

// Regras de prazo de entrega das pautas. Guarda contra: alerta de atraso em post
// já entregue (spam), post atrasado sem alerta e datas inválidas quebrando o cron.

const AGORA = new Date('2026-07-10T12:00:00Z').getTime()
const DIA = 24 * 60 * 60 * 1000
const em = (deltaDias: number) => new Date(AGORA + deltaDias * DIA).toISOString()

describe('atrasada', () => {
  it('data passada + não entregue = atrasada', () => {
    expect(atrasada({ status: 'rascunho', dataAgendada: em(-1) }, AGORA)).toBe(true)
    expect(atrasada({ status: 'aguardando_aprovacao', dataAgendada: em(-3) }, AGORA)).toBe(true)
    expect(atrasada({ status: 'corrigir', dataAgendada: em(-1) }, AGORA)).toBe(true)
  })
  it('entregue/encaminhado NUNCA conta como atraso (anti-spam)', () => {
    for (const status of ['aprovado', 'agendado', 'publicando', 'publicado']) {
      expect(atrasada({ status, dataAgendada: em(-5) }, AGORA)).toBe(false)
    }
  })
  it('falha_publicacao fica fora (tem alerta próprio)', () => {
    expect(atrasada({ status: 'falha_publicacao', dataAgendada: em(-1) }, AGORA)).toBe(false)
  })
  it('data futura, sem data ou data inválida = não atrasada', () => {
    expect(atrasada({ status: 'rascunho', dataAgendada: em(1) }, AGORA)).toBe(false)
    expect(atrasada({ status: 'rascunho' }, AGORA)).toBe(false)
    expect(atrasada({ status: 'rascunho', dataAgendada: 'não-é-data' }, AGORA)).toBe(false)
  })
})

describe('emRisco', () => {
  it('vence em ≤2 dias e parado (rascunho/corrigir/reprovado) = em risco', () => {
    expect(emRisco({ status: 'rascunho', dataAgendada: em(1) }, AGORA)).toBe(true)
    expect(emRisco({ status: 'corrigir', dataAgendada: em(2) }, AGORA)).toBe(true)
    expect(emRisco({ status: 'reprovado', dataAgendada: em(0.5) }, AGORA)).toBe(true)
  })
  it('longe da data, já no cliente ou encaminhado = sem risco', () => {
    expect(emRisco({ status: 'rascunho', dataAgendada: em(5) }, AGORA)).toBe(false)
    expect(emRisco({ status: 'aguardando_aprovacao', dataAgendada: em(1) }, AGORA)).toBe(false)
    expect(emRisco({ status: 'agendado', dataAgendada: em(1) }, AGORA)).toBe(false)
  })
  it('data já passada não é "risco" (é atraso)', () => {
    expect(emRisco({ status: 'rascunho', dataAgendada: em(-1) }, AGORA)).toBe(false)
  })
})

describe('diasDeAtraso', () => {
  it('conta dias inteiros de atraso', () => {
    expect(diasDeAtraso({ status: 'rascunho', dataAgendada: em(-3) }, AGORA)).toBe(3)
    expect(diasDeAtraso({ status: 'rascunho', dataAgendada: em(-0.5) }, AGORA)).toBe(0)
  })
  it('sem atraso = 0 (nunca negativo)', () => {
    expect(diasDeAtraso({ status: 'rascunho', dataAgendada: em(2) }, AGORA)).toBe(0)
    expect(diasDeAtraso({ status: 'rascunho' }, AGORA)).toBe(0)
  })
})

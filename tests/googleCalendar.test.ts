import { describe, it, expect } from 'vitest'
import { normalizarEventos, agendaConfigurada } from '@/lib/googleCalendar'

// Só a parte pura: transformar a resposta da API do Google no nosso formato.
// A chamada de rede é coberta pela degradação (sem env = lista vazia).

describe('normalizarEventos', () => {
  it('evento com horário vira inicio/fim ISO e título', () => {
    const r = normalizarEventos([{ id: 'a', summary: 'Dentista', start: { dateTime: '2026-09-04T14:00:00-03:00' }, end: { dateTime: '2026-09-04T15:00:00-03:00' } }], 'Willian')
    expect(r).toEqual([{ id: 'a', titulo: 'Dentista', inicio: '2026-09-04T14:00:00-03:00', fim: '2026-09-04T15:00:00-03:00', calendario: 'Willian', diaInteiro: false }])
  })

  it('evento de dia inteiro usa `date` e marca diaInteiro', () => {
    const r = normalizarEventos([{ id: 'b', summary: 'Feriado', start: { date: '2026-09-07' }, end: { date: '2026-09-08' } }])
    expect(r[0].diaInteiro).toBe(true)
    expect(r[0].inicio).toBe('2026-09-07T00:00:00')
  })

  it('cancelado e sem início ficam fora', () => {
    const r = normalizarEventos([
      { id: 'c', summary: 'Cancelado', status: 'cancelled', start: { dateTime: '2026-09-04T10:00:00Z' } },
      { id: 'd', summary: 'Sem início' },
      null,
    ])
    expect(r).toHaveLength(0)
  })

  it('sem título ganha rótulo, e espaços são aparados', () => {
    const r = normalizarEventos([{ id: 'e', summary: '  Reunião  ', start: { dateTime: '2026-09-04T10:00:00Z' } }, { id: 'f', start: { dateTime: '2026-09-04T11:00:00Z' } }])
    expect(r[0].titulo).toBe('Reunião')
    expect(r[1].titulo).toBe('(sem título)')
  })

  it('entrada que não é lista devolve vazio', () => {
    expect(normalizarEventos(undefined as any)).toEqual([])
    expect(normalizarEventos({} as any)).toEqual([])
  })
})

describe('agendaConfigurada', () => {
  it('sem as três envs, não está configurada (e a Home não quebra)', () => {
    const backup = { a: process.env.GOOGLE_CALENDAR_SA_EMAIL, b: process.env.GOOGLE_CALENDAR_SA_KEY, c: process.env.GOOGLE_CALENDAR_IDS }
    delete process.env.GOOGLE_CALENDAR_SA_EMAIL
    expect(agendaConfigurada()).toBe(false)
    process.env.GOOGLE_CALENDAR_SA_EMAIL = 'x@sa.iam.gserviceaccount.com'
    process.env.GOOGLE_CALENDAR_SA_KEY = '-----BEGIN PRIVATE KEY-----'
    process.env.GOOGLE_CALENDAR_IDS = 'a@b.c'
    expect(agendaConfigurada()).toBe(true)
    process.env.GOOGLE_CALENDAR_SA_EMAIL = backup.a; process.env.GOOGLE_CALENDAR_SA_KEY = backup.b; process.env.GOOGLE_CALENDAR_IDS = backup.c
  })
})

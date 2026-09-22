import { describe, it, expect } from 'vitest'
import { estadoDaPresenca, presencaDoEvento, chaveDoAviso, PULSO_MS, DIGITANDO_TTL_S } from '@/lib/waPresenca'

describe('waPresenca — o que o WhatsApp manda vira o que a tela mostra', () => {
  it('composing = digitando; recording = gravando; o resto some', () => {
    expect(estadoDaPresenca('composing')).toBe('digitando')
    expect(estadoDaPresenca('recording')).toBe('gravando')
    expect(estadoDaPresenca('paused')).toBeNull()
    expect(estadoDaPresenca('available')).toBeNull()
    expect(estadoDaPresenca(undefined)).toBeNull()
  })

  it('lê o presence.update do Evolution (conversa 1:1)', () => {
    const r = presencaDoEvento({
      event: 'presence.update',
      data: { id: '5555999887766@s.whatsapp.net', presences: { '5555999887766@s.whatsapp.net': { lastKnownPresence: 'composing' } } },
    })
    expect(r).toEqual({ telefone: '5555999887766', estado: 'digitando' })
  })

  it('aceita o nome do evento no formato de constante (PRESENCE_UPDATE)', () => {
    const r = presencaDoEvento({ event: 'PRESENCE_UPDATE', data: { id: '5511@s.whatsapp.net', presences: { a: { lastKnownPresence: 'paused' } } } })
    expect(r).toEqual({ telefone: '5511', estado: null })
  })

  it('em grupo, basta um participante digitando', () => {
    const r = presencaDoEvento({
      event: 'presence.update',
      data: { id: '120363@g.us', presences: { 'a@s.whatsapp.net': { lastKnownPresence: 'available' }, 'b@s.whatsapp.net': { lastKnownPresence: 'composing' } } },
    })
    expect(r).toEqual({ telefone: '120363', estado: 'digitando' })
  })

  it('evento que não é de presença (ou sem número) é ignorado', () => {
    expect(presencaDoEvento({ event: 'messages.upsert', data: { key: { remoteJid: '5511@s.whatsapp.net' } } })).toBeNull()
    expect(presencaDoEvento({ event: 'presence.update', data: {} })).toBeNull()
    expect(presencaDoEvento(null)).toBeNull()
  })

  it('o aviso tem texto no dicionário só quando há o que mostrar', () => {
    expect(chaveDoAviso('digitando')).toBe('crm.digitando')
    expect(chaveDoAviso('gravando')).toBe('crm.gravando-audio')
    expect(chaveDoAviso(null)).toBeNull()
  })

  it('o "digitando" dura mais que um pulso (senão pisca) e menos que um esquecimento', () => {
    expect(DIGITANDO_TTL_S * 1000).toBeGreaterThan(PULSO_MS * 2)
    expect(DIGITANDO_TTL_S).toBeLessThanOrEqual(20)
  })
})

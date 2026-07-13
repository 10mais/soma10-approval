import { describe, it, expect } from 'vitest'
import { textoMensagemEvolution, normalizarUrlEvolution } from '@/lib/whatsapp'

// Bug real (2026-07-13): URL do Evolution colada sem https:// quebrava o fetch
// ('Failed to parse URL') — recebia mensagens mas não enviava.
describe('normalizarUrlEvolution', () => {
  it('prefixa https:// quando falta protocolo', () => {
    expect(normalizarUrlEvolution('evolution-api-production-a6ad.up.railway.app')).toBe('https://evolution-api-production-a6ad.up.railway.app')
  })
  it('mantém protocolo existente e remove barra final', () => {
    expect(normalizarUrlEvolution('https://x.up.railway.app/')).toBe('https://x.up.railway.app')
    expect(normalizarUrlEvolution('http://localhost:8080')).toBe('http://localhost:8080')
  })
  it('vazio devolve vazio', () => {
    expect(normalizarUrlEvolution('')).toBe('')
    expect(normalizarUrlEvolution(undefined)).toBe('')
  })
})

// Extração do texto de uma mensagem recebida do Evolution (messages.upsert).
// Errar aqui = mensagem do paciente entrar vazia ou como rótulo errado no CRM.

describe('textoMensagemEvolution', () => {
  it('texto simples (conversation)', () => {
    expect(textoMensagemEvolution({ conversation: 'oi, quero agendar' })).toBe('oi, quero agendar')
  })

  it('texto estendido (extendedTextMessage)', () => {
    expect(textoMensagemEvolution({ extendedTextMessage: { text: 'com link https://x' } })).toBe('com link https://x')
  })

  it('legenda de mídia vira o texto', () => {
    expect(textoMensagemEvolution({ imageMessage: { caption: 'olha meu antes' } })).toBe('olha meu antes')
    expect(textoMensagemEvolution({ videoMessage: { caption: 'vídeo do rosto' } })).toBe('vídeo do rosto')
  })

  it('mídia sem legenda vira rótulo entre colchetes', () => {
    expect(textoMensagemEvolution({ imageMessage: {} })).toBe('[imagem]')
    expect(textoMensagemEvolution({ audioMessage: {} })).toBe('[áudio]')
    expect(textoMensagemEvolution({ documentMessage: {} })).toBe('[documento]')
    expect(textoMensagemEvolution({ locationMessage: {} })).toBe('[localização]')
  })

  it('vazio/desconhecido devolve string vazia', () => {
    expect(textoMensagemEvolution(null)).toBe('')
    expect(textoMensagemEvolution({})).toBe('')
    expect(textoMensagemEvolution({ algoNovo: {} })).toBe('')
  })
})

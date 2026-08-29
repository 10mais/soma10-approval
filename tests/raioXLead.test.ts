import { describe, it, expect } from 'vitest'
import { situacaoDaConversa, temperatura, resumoConversa, interessesNaConversa, aplicarPlaceholders, MsgRaioX } from '@/lib/raioXLead'

// O raio-X é lido em 2 segundos, no meio do atendimento, para decidir se manda
// mensagem agora. Se ele errar o dono da bola ou a temperatura, a decisão sai
// errada — e o lead vai perguntar na concorrência.

const AGORA = new Date('2026-08-29T15:00:00.000Z')
const hAtras = (h: number) => new Date(AGORA.getTime() - h * 3600000).toISOString()

const msg = (de: 'cliente' | 'agente', h: number, texto = ''): MsgRaioX => ({ de, em: hAtras(h), texto })

describe('situação — de quem é a bola', () => {
  it('cliente falou por último: a bola é nossa', () => {
    const s = situacaoDaConversa([msg('agente', 5), msg('cliente', 3)], AGORA)
    expect(s.chave).toBe('responder')
    expect(s.detalhe).toContain('há 3h')
  })

  it('respondeu agora (menos de 1h) não é urgência vermelha', () => {
    const s = situacaoDaConversa([msg('agente', 2), msg('cliente', 0.2)], AGORA)
    expect(s.chave).toBe('responder')
    expect(s.label).toBe('Respondeu agora')
    expect(s.cor).toBe('#166534')
  })

  it('passou de 1h esperando: vira urgência', () => {
    expect(situacaoDaConversa([msg('cliente', 4)], AGORA).cor).toBe('#b91c1c')
  })

  it('nós falamos por último: aguardando resposta', () => {
    const s = situacaoDaConversa([msg('cliente', 30), msg('agente', 26)], AGORA)
    expect(s.chave).toBe('aguardando_resposta')
    expect(s.detalhe).toContain('há 1 dia')
  })

  it('conversa vazia não quebra', () => {
    expect(situacaoDaConversa([], AGORA).chave).toBe('sem_mensagens')
  })
})

describe('temperatura', () => {
  it('respondeu nas últimas 48h = quente', () => {
    expect(temperatura([msg('agente', 50), msg('cliente', 10)], AGORA).chave).toBe('quente')
    expect(temperatura([msg('cliente', 47)], AGORA).chave).toBe('quente')
  })

  it('respondeu na última semana = morno', () => {
    expect(temperatura([msg('cliente', 72)], AGORA).chave).toBe('morno')
  })

  it('mais de uma semana sem responder = frio (caso de reaquecimento)', () => {
    const t = temperatura([msg('cliente', 24 * 12)], AGORA)
    expect(t.chave).toBe('frio')
    expect(t.motivo).toContain('reaquecimento')
  })

  it('nós falando sozinhos NÃO esquenta o lead', () => {
    const t = temperatura([msg('agente', 3), msg('agente', 2), msg('agente', 1)], AGORA)
    expect(t.chave).toBe('sem_resposta')
    expect(t.motivo).toContain('nunca respondeu')
  })

  it('sem conversa nenhuma não inventa temperatura', () => {
    expect(temperatura([], AGORA).chave).toBe('sem_resposta')
  })
})

describe('resumo da conversa', () => {
  const msgs = [msg('agente', 100), msg('cliente', 90), msg('agente', 50), msg('cliente', 20)]

  it('conta os dois lados e guarda as pontas', () => {
    const r = resumoConversa(msgs, AGORA)
    expect(r.total).toBe(4)
    expect(r.doCliente).toBe(2)
    expect(r.nossas).toBe(2)
    expect(r.primeiroEm).toBe(hAtras(100))
    expect(r.primeiroDe).toBe('agente')
    expect(r.ultimaDe).toBe('cliente')
    expect(r.ultimaRespostaDelaEm).toBe(hAtras(20))
    expect(r.horasDesdeUltima).toBe(20)
  })

  it('conversa vazia devolve zeros, não NaN', () => {
    const r = resumoConversa([], AGORA)
    expect(r.total).toBe(0)
    expect(r.horasDesdeUltima).toBe(0)
    expect(r.primeiroEm).toBe('')
  })
})

describe('interesses', () => {
  const catalogo = ['Botox', 'Preenchimento labial', 'Limpeza de pele', 'Harmonização facial', 'Bioestimulador']

  it('acha o que a PESSOA falou, ignorando acento e caixa', () => {
    const msgs = [msg('cliente', 5, 'oi! queria saber sobre harmonizacao FACIAL'), msg('cliente', 4, 'e o botox também')]
    expect(interessesNaConversa(msgs, catalogo)).toContain('Harmonização facial')
    expect(interessesNaConversa(msgs, catalogo)).toContain('Botox')
  })

  it('o que NÓS oferecemos não vira interesse dela', () => {
    const msgs = [msg('agente', 5, 'temos botox e limpeza de pele'), msg('cliente', 4, 'ok obrigada')]
    expect(interessesNaConversa(msgs, catalogo)).toEqual([])
  })

  it('o mais repetido vem primeiro', () => {
    const msgs = [msg('cliente', 5, 'botox, botox e limpeza de pele')]
    expect(interessesNaConversa(msgs, catalogo)[0]).toBe('Botox')
  })

  it('termo curto do catálogo não casa com qualquer coisa', () => {
    const msgs = [msg('cliente', 5, 'oi, tudo bem?')]
    expect(interessesNaConversa(msgs, ['ok', 'hd', 'Botox'])).toEqual([])
  })

  it('conversa sem texto (só áudio/foto) não inventa interesse', () => {
    expect(interessesNaConversa([{ de: 'cliente', em: hAtras(2), tipo: 'audio' }], catalogo)).toEqual([])
  })
})

describe('placeholders das mensagens prontas', () => {
  it('troca nome e primeiro nome', () => {
    expect(aplicarPlaceholders('Oi {primeiro}, tudo bem?', 'Maria Silva Souza')).toBe('Oi Maria, tudo bem?')
    expect(aplicarPlaceholders('Olá {nome}!', 'Maria Silva')).toBe('Olá Maria Silva!')
  })

  it('sem nome não deixa "Oi ," nem o {primeiro} cru na tela', () => {
    const t = aplicarPlaceholders('Oi {primeiro}, tudo bem?', '')
    expect(t).not.toContain('{primeiro}')
    expect(t).toBe('Oi, tudo bem?')
  })
})

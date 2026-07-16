import { describe, it, expect } from 'vitest'
import { telefoneWhatsApp, mesmoTelefone, soDigitos } from '@/lib/telefoneBR'

// Bug real (2026-07-16): abrir a conversa pela ficha do contato criava uma
// thread vazia. O contato estava salvo como "55 991013609" (DDD + número, sem o
// 55 do país) e o WhatsApp usa 5555991013609. Enviar por ali iria para o número
// ERRADO — por isso a regra mora aqui, com teste, e não inline.

describe('telefoneWhatsApp', () => {
  it('acrescenta o 55 do país quando falta (o caso do bug)', () => {
    expect(telefoneWhatsApp('55 991013609')).toBe('5555991013609')
    expect(telefoneWhatsApp('(55) 99976-6707')).toBe('5555999766707')
  })

  it('não duplica o 55 de quem já veio completo', () => {
    expect(telefoneWhatsApp('5555999766707')).toBe('5555999766707')
    expect(telefoneWhatsApp('+55 (55) 99976-6707')).toBe('5555999766707')
  })

  it('o 55 de SÃO PAULO não vira país: 11 dígitos com DDD 55 ganham o país', () => {
    // "55991013609" é DDD 55 + 9 dígitos, NÃO um número com DDI já posto.
    expect(telefoneWhatsApp('55991013609')).toBe('5555991013609')
  })

  it('fixo de 8 dígitos funciona', () => {
    expect(telefoneWhatsApp('11 3255-4400')).toBe('551132554400')
    expect(telefoneWhatsApp('551132554400')).toBe('551132554400')
  })

  it('NÃO inventa nem tira o 9º dígito — quem decide é a operadora', () => {
    expect(telefoneWhatsApp('55 99976670')).toBe('555599976670') // 8 dígitos: fica com 8
    expect(telefoneWhatsApp('55 999766707')).toBe('5555999766707') // 9 dígitos: fica com 9
  })

  it('tira o zero de operadora', () => {
    expect(telefoneWhatsApp('055 999766707')).toBe('5555999766707')
  })

  it('DDD impossível não passa (11 é o menor do Brasil)', () => {
    expect(telefoneWhatsApp('10 999766707')).toBe('')
    expect(telefoneWhatsApp('5510999766707')).toBe('')
  })

  it('zero de operadora some ANTES de ler o DDD', () => {
    // "09 999766707" vira 99 (Maranhão) + 8 dígitos — o zero era prefixo, não DDD.
    expect(telefoneWhatsApp('09 999766707')).toBe('559999766707')
  })

  it('o que não dá para afirmar vira vazio — melhor não abrir que abrir errado', () => {
    for (const v of ['', undefined, 'sem numero', '123', '1', '999999999999999999']) {
      expect(telefoneWhatsApp(v)).toBe('')
    }
  })

  it('estrangeiro não é chutado como brasileiro', () => {
    expect(telefoneWhatsApp('+351 912 345 678')).toBe('') // Portugal
  })
})

describe('mesmoTelefone', () => {
  it('acha a mesma pessoa escrita de jeitos diferentes', () => {
    expect(mesmoTelefone('55 991013609', '5555991013609')).toBe(true)
    expect(mesmoTelefone('+55 (55) 99101-3609', '5555991013609')).toBe(true)
  })

  it('pessoas diferentes não se confundem', () => {
    expect(mesmoTelefone('55 991013609', '55 991013600')).toBe(false)
  })

  it('sem telefone nunca casa (senão dois contatos vazios viravam a mesma pessoa)', () => {
    expect(mesmoTelefone('', '')).toBe(false)
    expect(mesmoTelefone(undefined, '5555991013609')).toBe(false)
  })

  it('número que não normaliza ainda casa por igualdade literal', () => {
    expect(mesmoTelefone('+351 912345678', '351912345678')).toBe(true)
  })
})

describe('soDigitos', () => {
  it('tira tudo que não é número', () => {
    expect(soDigitos('+55 (55) 99101-3609')).toBe('5555991013609')
    expect(soDigitos(undefined)).toBe('')
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { pedirConversaWhatsApp, consumirConversaWhatsApp, CRM_ABRIR_TEL } from '@/lib/conversaInterna'

// O pedido atravessa DUAS telas (home → CRM) por sessionStorage. Testa-se o
// contrato entre elas: nome da chave, número limpo e o pedido valendo uma vez.

function fakeStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, String(v)) },
    removeItem: (k: string) => { m.delete(k) },
    clear: () => m.clear(),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size },
  } as Storage
}

beforeEach(() => { (globalThis as any).sessionStorage = fakeStorage() })

describe('conversaInterna', () => {
  it('leva o telefone de uma tela à outra, só com dígitos', () => {
    expect(pedirConversaWhatsApp('+55 (55) 99994-4104')).toBe(true)
    expect(sessionStorage.getItem(CRM_ABRIR_TEL)).toBe('5555999944104')
    expect(consumirConversaWhatsApp()).toBe('5555999944104')
  })

  it('o pedido vale UMA vez — recarregar não reabre a conversa', () => {
    pedirConversaWhatsApp('5599999999')
    expect(consumirConversaWhatsApp()).toBe('5599999999')
    expect(consumirConversaWhatsApp()).toBe('')
  })

  it('sem número não pede nada (quem chama não navega à toa)', () => {
    for (const v of [undefined, '', '   ', 'sem numero aqui']) {
      expect(pedirConversaWhatsApp(v)).toBe(false)
    }
    expect(consumirConversaWhatsApp()).toBe('')
  })

  it('sem sessionStorage (servidor) não explode', () => {
    delete (globalThis as any).sessionStorage
    expect(pedirConversaWhatsApp('5599999999')).toBe(false)
    expect(consumirConversaWhatsApp()).toBe('')
  })
})

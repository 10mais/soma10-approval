import { describe, it, expect, beforeEach } from 'vitest'
import { pedirConversaWhatsApp, consumirConversaWhatsApp, CRM_ABRIR_TEL, pedirFichaContato, consumirFichaContato, CRM_ABRIR_CONTATO } from '@/lib/conversaInterna'

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

describe('ficha do contato pedida de outra tela', () => {
  it('leva o id da home ao CRM', () => {
    expect(pedirFichaContato('  ct_123  ')).toBe(true)
    expect(sessionStorage.getItem(CRM_ABRIR_CONTATO)).toBe('ct_123')
    expect(consumirFichaContato()).toBe('ct_123')
  })

  it('o pedido vale UMA vez — recarregar nao reabre a ficha', () => {
    pedirFichaContato('ct_123')
    expect(consumirFichaContato()).toBe('ct_123')
    expect(consumirFichaContato()).toBe('')
  })

  it('sem id nao pede nada', () => {
    for (const v of [undefined, '', '   ']) expect(pedirFichaContato(v)).toBe(false)
    expect(consumirFichaContato()).toBe('')
  })

  it('ficha e conversa sao pedidos INDEPENDENTES (chaves diferentes)', () => {
    pedirConversaWhatsApp('5555999944104')
    pedirFichaContato('ct_9')
    expect(consumirFichaContato()).toBe('ct_9')
    // consumir a ficha nao pode engolir o pedido de conversa
    expect(consumirConversaWhatsApp()).toBe('5555999944104')
  })

  it('sem sessionStorage (servidor) nao explode', () => {
    delete (globalThis as any).sessionStorage
    expect(pedirFichaContato('ct_1')).toBe(false)
    expect(consumirFichaContato()).toBe('')
  })
})

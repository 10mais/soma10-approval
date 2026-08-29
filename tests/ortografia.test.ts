import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ortografiaLigada, definirOrtografia, aplicarOrtografia, CHAVE_ORTOGRAFIA } from '@/lib/ortografia'

// A chave e o atributo são o contrato entre a preferência (Minha Conta) e o
// <html>. Se o atributo não for exatamente `spellcheck="false"` no elemento
// raiz, a herança não desliga nada e o botão vira decoração.

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

// DOM mínimo: só o documentElement com os dois métodos que a lib usa.
function fakeDoc() {
  const attrs = new Map<string, string>()
  return {
    documentElement: {
      setAttribute: (k: string, v: string) => { attrs.set(k, v) },
      removeAttribute: (k: string) => { attrs.delete(k) },
      get: (k: string) => attrs.get(k) ?? null,
    },
  }
}

let doc: ReturnType<typeof fakeDoc>
beforeEach(() => {
  ;(globalThis as any).localStorage = fakeStorage()
  doc = fakeDoc()
  ;(globalThis as any).document = doc
})
afterEach(() => { delete (globalThis as any).document; delete (globalThis as any).localStorage })

describe('preferência do corretor', () => {
  it('nasce LIGADO — quem tem o dicionário certo merece a correção', () => {
    expect(ortografiaLigada()).toBe(true)
  })

  it('desligar grava a escolha e marca o <html>', () => {
    definirOrtografia(false)
    expect(localStorage.getItem(CHAVE_ORTOGRAFIA)).toBe('0')
    expect(ortografiaLigada()).toBe(false)
    expect(doc.documentElement.get('spellcheck')).toBe('false')
  })

  it('religar APAGA o atributo (não escreve "true"): a herança volta ao padrão', () => {
    definirOrtografia(false)
    definirOrtografia(true)
    expect(doc.documentElement.get('spellcheck')).toBeNull()
    expect(ortografiaLigada()).toBe(true)
  })

  it('aplicar na carga da página respeita o que foi salvo', () => {
    localStorage.setItem(CHAVE_ORTOGRAFIA, '0')
    aplicarOrtografia()
    expect(doc.documentElement.get('spellcheck')).toBe('false')
  })

  it('sem DOM (servidor) não explode', () => {
    delete (globalThis as any).document
    expect(() => aplicarOrtografia(false)).not.toThrow()
  })

  it('sem localStorage (aba privada) segue ligado e não quebra', () => {
    delete (globalThis as any).localStorage
    expect(ortografiaLigada()).toBe(true)
    expect(() => definirOrtografia(false)).not.toThrow()
  })
})

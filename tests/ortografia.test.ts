import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ortografiaLigada, definirOrtografia, aplicarOrtografia, CHAVE_ORTOGRAFIA } from '@/lib/ortografia'

// A chave e o atributo são o contrato entre a preferência (Minha Conta) e o
// <html>. Se o atributo não for exatamente `spellcheck="false"` no elemento
// raiz, a herança não desliga nada e a caixa vira decoração.

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
  it('nasce DESLIGADO — o vermelho em palavra certa era o padrão de quase todo mundo (dono, 04/11)', () => {
    expect(ortografiaLigada()).toBe(false)
  })

  it('na carga da página, sem escolha salva, marca o <html> com spellcheck="false"', () => {
    aplicarOrtografia()
    expect(doc.documentElement.get('spellcheck')).toBe('false')
  })

  it('ligar grava a escolha e APAGA o atributo (não escreve "true"): a herança volta ao padrão', () => {
    doc.documentElement.setAttribute('spellcheck', 'false') // como vem do servidor
    definirOrtografia(true)
    expect(localStorage.getItem(CHAVE_ORTOGRAFIA)).toBe('1')
    expect(ortografiaLigada()).toBe(true)
    expect(doc.documentElement.get('spellcheck')).toBeNull()
  })

  it('desligar de novo grava e volta a marcar o <html>', () => {
    definirOrtografia(true)
    definirOrtografia(false)
    expect(localStorage.getItem(CHAVE_ORTOGRAFIA)).toBe('0')
    expect(ortografiaLigada()).toBe(false)
    expect(doc.documentElement.get('spellcheck')).toBe('false')
  })

  it('na carga da página respeita quem ligou', () => {
    doc.documentElement.setAttribute('spellcheck', 'false')
    localStorage.setItem(CHAVE_ORTOGRAFIA, '1')
    aplicarOrtografia()
    expect(doc.documentElement.get('spellcheck')).toBeNull()
  })

  it('a preferência ANTIGA (chave sem _v2) não religa o vermelho', () => {
    localStorage.setItem('soma10_ortografia', '1')
    expect(ortografiaLigada()).toBe(false)
  })

  it('sem DOM (servidor) não explode', () => {
    delete (globalThis as any).document
    expect(() => aplicarOrtografia(false)).not.toThrow()
  })

  it('sem localStorage (aba privada) segue desligado e não quebra', () => {
    delete (globalThis as any).localStorage
    expect(ortografiaLigada()).toBe(false)
    expect(() => definirOrtografia(true)).not.toThrow()
  })
})

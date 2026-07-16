import { describe, it, expect } from 'vitest'
import { indiceDaMensagem, previaAposRemover } from '@/lib/apagarMensagem'

const msg = (id: string, texto: string, em: string) => JSON.stringify({ id, texto, em })

describe('indiceDaMensagem', () => {
  const lista = [msg('a', 'oi', '2026-07-16T10:00:00Z'), msg('b', 'tudo bem?', '2026-07-16T10:01:00Z'), msg('c', 'sim', '2026-07-16T10:02:00Z')]

  it('acha a mensagem pelo id', () => {
    expect(indiceDaMensagem(lista, 'a')).toBe(0)
    expect(indiceDaMensagem(lista, 'c')).toBe(2)
  })

  it('id que não existe = -1 (não apagar o item errado)', () => {
    expect(indiceDaMensagem(lista, 'zzz')).toBe(-1)
    expect(indiceDaMensagem(lista, '')).toBe(-1)
  })

  it('mensagens de texto IDÊNTICO são distinguidas pelo id', () => {
    const iguais = [msg('m1', 'ok', '2026-07-16T10:00:00Z'), msg('m2', 'ok', '2026-07-16T10:05:00Z')]
    expect(indiceDaMensagem(iguais, 'm1')).toBe(0)
    expect(indiceDaMensagem(iguais, 'm2')).toBe(1)
  })

  it('item corrompido na lista não derruba a busca', () => {
    expect(indiceDaMensagem(['{quebrado', msg('b', 'oi', 'x')], 'b')).toBe(1)
  })

  it('aceita objeto já desserializado (o SDK do Redis às vezes devolve assim)', () => {
    expect(indiceDaMensagem([{ id: 'a', texto: 'oi' } as any], 'a')).toBe(0)
  })
})

describe('previaAposRemover', () => {
  const lista = [msg('a', 'oi', '2026-07-16T10:00:00Z'), msg('b', 'tudo bem?', '2026-07-16T10:01:00Z'), msg('c', 'sim', '2026-07-16T10:02:00Z')]

  it('apagar a ÚLTIMA faz a prévia voltar para a anterior', () => {
    expect(previaAposRemover(lista, 2)).toEqual({ ultimaMsg: 'tudo bem?', ultimaEm: '2026-07-16T10:01:00Z' })
  })

  it('apagar do MEIO não mexe na prévia', () => {
    expect(previaAposRemover(lista, 1)).toEqual({ ultimaMsg: 'sim', ultimaEm: '2026-07-16T10:02:00Z' })
  })

  it('apagar a única mensagem esvazia a prévia', () => {
    expect(previaAposRemover([msg('a', 'oi', 'agora')], 0)).toBeNull()
  })

  it('prévia longa é cortada em 120 (é rótulo de lista, não a mensagem)', () => {
    const longa = 'x'.repeat(300)
    const r = previaAposRemover([msg('a', longa, 'a1'), msg('b', 'ultima', 'b1')], 1)
    expect(r!.ultimaMsg).toHaveLength(120)
  })

  it('pula item corrompido ao recalcular a prévia', () => {
    const r = previaAposRemover([msg('a', 'valida', 'a1'), '{quebrado', msg('c', 'apagar', 'c1')], 2)
    expect(r).toEqual({ ultimaMsg: 'valida', ultimaEm: 'a1' })
  })

  it('mídia sem texto vira prévia vazia, não quebra', () => {
    const r = previaAposRemover([JSON.stringify({ id: 'a', em: 'a1', tipo: 'imagem' }), msg('b', 'x', 'b1')], 1)
    expect(r).toEqual({ ultimaMsg: '', ultimaEm: 'a1' })
  })
})

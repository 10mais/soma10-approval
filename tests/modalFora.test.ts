import { describe, it, expect } from 'vitest'
import { deveFechar } from '@/lib/modalFora'

// Fechar modal por engano custa o formulário inteiro. O clique só vale quando
// COMEÇOU e TERMINOU no fundo — arrastar de dentro para fora (selecionar texto)
// não pode fechar nada.

const overlay = { id: 'overlay' }
const caixa = { id: 'caixa-do-modal' }
const input = { id: 'input-dentro' }

describe('deveFechar', () => {
  it('clique inteiro no fundo FECHA', () => {
    expect(deveFechar(overlay, overlay, overlay)).toBe(true)
  })

  it('selecionar texto e soltar no fundo NÃO fecha — o clique começou dentro', () => {
    // pressionou no input, arrastou, soltou no overlay
    expect(deveFechar(overlay, overlay, input)).toBe(false)
  })

  it('clique inteiro dentro do modal não fecha', () => {
    expect(deveFechar(caixa, overlay, caixa)).toBe(false)
    expect(deveFechar(input, overlay, input)).toBe(false)
  })

  it('pressionou no fundo e soltou dentro também não fecha', () => {
    expect(deveFechar(caixa, overlay, overlay)).toBe(false)
  })

  it('sem registro de onde pressionou, não fecha (não adivinha)', () => {
    expect(deveFechar(overlay, overlay, null)).toBe(false)
    expect(deveFechar(overlay, overlay, undefined)).toBe(false)
  })

  it('compara por identidade, não por conteúdo — dois nós iguais são nós diferentes', () => {
    expect(deveFechar({ id: 'overlay' }, { id: 'overlay' }, { id: 'overlay' })).toBe(false)
  })
})

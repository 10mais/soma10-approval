import { describe, it, expect } from 'vitest'
import { labelFormato, corFormato, seloFormato, FORMATOS } from '@/lib/formatoPost'

describe('formatoPost — o rótulo do formato é um só no sistema', () => {
  it('carrossel é Carrossel, não Story (o bug do link do cliente, 09/09)', () => {
    expect(labelFormato('carrossel')).toBe('Carrossel')
    expect(labelFormato('grafico')).toBe('Material Gráfico')
    expect(labelFormato('story')).toBe('Story')
    expect(labelFormato('reel')).toBe('Reel')
    expect(labelFormato('feed')).toBe('Feed')
  })

  it('vazio cai em Feed (o padrão de quem nasce sem formato) e desconhecido não vira chute', () => {
    expect(labelFormato(undefined)).toBe('Feed')
    expect(labelFormato('')).toBe('Feed')
    expect(labelFormato('  CARROSSEL  ')).toBe('Carrossel')
    expect(labelFormato('podcast')).toBe('Podcast')
  })

  it('selo: só aparece quando o formato não é o padrão', () => {
    expect(seloFormato('feed')).toBeNull()
    expect(seloFormato('')).toBeNull()
    expect(seloFormato('carrossel')).toBe('Carrossel')
    expect(seloFormato('story')).toBe('Story')
  })

  it('cor conhecida por formato; desconhecido não quebra', () => {
    expect(corFormato('carrossel')).toBe('#0891b2')
    expect(corFormato('inventado')).toBe('var(--v2-ink3)')
    expect(FORMATOS.map(f => f.chave)).toEqual(['feed', 'reel', 'carrossel', 'story', 'grafico'])
  })
})

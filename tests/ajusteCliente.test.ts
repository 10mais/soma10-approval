import { describe, it, expect } from 'vitest'
import { ajusteSemRetrabalho, dataValida } from '@/lib/ajusteCliente'

// Esta regra decide se um material vai ao ar SEM ninguém da equipe olhar.
// Todo caso duvidoso tem que cair para o lado do retrabalho.
describe('ajusteSemRetrabalho', () => {
  it('legenda nova sozinha: aplica automaticamente', () => {
    expect(ajusteSemRetrabalho({ tipo: 'corrected', anotacoes: [], novaLegenda: 'texto novo' })).toBe(true)
  })

  it('data nova sozinha: aplica automaticamente', () => {
    expect(ajusteSemRetrabalho({ tipo: 'corrected', anotacoes: [], novaData: '2026-09-22T11:30' })).toBe(true)
  })

  it('legenda + data: aplica automaticamente', () => {
    expect(ajusteSemRetrabalho({ tipo: 'corrected', anotacoes: [], novaLegenda: 'nova', novaData: '2026-09-22T11:30' })).toBe(true)
  })

  it('UM ponto marcado no layout já exige retrabalho', () => {
    expect(ajusteSemRetrabalho({ tipo: 'corrected', anotacoes: [{ x: 1, y: 2, text: 'trocar cor' }], novaLegenda: 'nova' })).toBe(false)
  })

  it('observação escrita exige retrabalho, mesmo sem ponto marcado', () => {
    expect(ajusteSemRetrabalho({ tipo: 'corrected', anotacoes: [], observacao: 'a logo está pequena', novaLegenda: 'nova' })).toBe(false)
  })

  it('observação só com espaços não conta como pedido', () => {
    expect(ajusteSemRetrabalho({ tipo: 'corrected', anotacoes: [], observacao: '   ', novaData: '2026-09-22T11:30' })).toBe(true)
  })

  it('sem legenda e sem data: não há o que aplicar', () => {
    expect(ajusteSemRetrabalho({ tipo: 'corrected', anotacoes: [] })).toBe(false)
  })

  it('legenda só com espaços não conta', () => {
    expect(ajusteSemRetrabalho({ tipo: 'corrected', anotacoes: [], novaLegenda: '   ' })).toBe(false)
  })

  it('data inválida não libera automação', () => {
    expect(ajusteSemRetrabalho({ tipo: 'corrected', anotacoes: [], novaData: 'ontem de tarde' })).toBe(false)
  })

  it('aprovação e reprovação seguem o caminho próprio', () => {
    expect(ajusteSemRetrabalho({ tipo: 'approved', novaLegenda: 'x' })).toBe(false)
    expect(ajusteSemRetrabalho({ tipo: 'rejected', novaLegenda: 'x' })).toBe(false)
    expect(ajusteSemRetrabalho({ tipo: 'caption', novaLegenda: 'x' })).toBe(false)
  })

  it('anotações em formato inesperado caem para retrabalho', () => {
    expect(ajusteSemRetrabalho({ tipo: 'corrected', anotacoes: 'trocar cor' as any, novaLegenda: 'nova' })).toBe(false)
  })

  it('observação em formato inesperado cai para retrabalho', () => {
    expect(ajusteSemRetrabalho({ tipo: 'corrected', anotacoes: [], observacao: { texto: 'x' } as any, novaLegenda: 'nova' })).toBe(false)
  })

  it('anotações ausentes (undefined) equivalem a nenhuma marcação', () => {
    expect(ajusteSemRetrabalho({ tipo: 'corrected', novaLegenda: 'nova' })).toBe(true)
  })
})

describe('dataValida', () => {
  it('aceita datetime-local e ISO', () => {
    expect(dataValida('2026-09-22T11:30')).toBe(true)
    expect(dataValida('2026-09-22T14:30:00.000Z')).toBe(true)
  })
  it('recusa vazio, espaço e texto solto', () => {
    expect(dataValida('')).toBe(false)
    expect(dataValida('   ')).toBe(false)
    expect(dataValida('semana que vem')).toBe(false)
    expect(dataValida(null)).toBe(false)
  })
})

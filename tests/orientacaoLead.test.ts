import { describe, it, expect } from 'vitest'
import { parseOrientacao } from '@/lib/orientacaoLead'

// Texto de LLM não tem contrato. Esta camada existe para a tela NUNCA mostrar
// uma orientação vazia (ou lixo) com cara de conselho da assistente.

describe('parseOrientacao', () => {
  it('lê o JSON mesmo embrulhado em markdown e conversa fiada', () => {
    const bruto = 'Claro! Aqui está:\n```json\n{"leitura":"Ela sumiu depois do preço","proximaAcao":"Reaquecer sem cobrar","mensagem":"Oi Maria, tudo bem?","alertas":["Não repetir o valor"],"fase":"interesse"}\n```'
    const o = parseOrientacao(bruto)!
    expect(o.leitura).toBe('Ela sumiu depois do preço')
    expect(o.proximaAcao).toBe('Reaquecer sem cobrar')
    expect(o.mensagem).toBe('Oi Maria, tudo bem?')
    expect(o.alertas).toEqual(['Não repetir o valor'])
    expect(o.fase).toBe('interesse')
  })

  it('alertas ausentes ou tortos viram lista vazia (não quebram a tela)', () => {
    expect(parseOrientacao('{"leitura":"x","proximaAcao":"y"}')!.alertas).toEqual([])
    expect(parseOrientacao('{"leitura":"x","alertas":"não é lista"}')!.alertas).toEqual([])
  })

  it('sem leitura e sem próxima ação NÃO vira caixa vazia bonita', () => {
    expect(parseOrientacao('{"mensagem":"oi"}')).toBeNull()
    expect(parseOrientacao('{}')).toBeNull()
  })

  it('resposta que não é JSON devolve null', () => {
    for (const v of ['', 'desculpe, não consegui', '[1,2,3]', null as any, undefined as any]) {
      expect(parseOrientacao(v)).toBeNull()
    }
  })

  it('corta texto absurdamente longo em vez de despejar na tela', () => {
    const o = parseOrientacao(JSON.stringify({ leitura: 'a'.repeat(5000), proximaAcao: 'ok', mensagem: 'b'.repeat(5000) }))!
    expect(o.leitura.length).toBe(600)
    expect(o.mensagem.length).toBe(1200)
  })

  it('no máximo 3 alertas — a tela não é um manual', () => {
    const o = parseOrientacao(JSON.stringify({ leitura: 'x', proximaAcao: 'y', alertas: ['a', 'b', 'c', 'd', 'e'] }))!
    expect(o.alertas.length).toBeLessThanOrEqual(4)
  })
})

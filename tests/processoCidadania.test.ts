import { describe, it, expect } from 'vitest'
import {
  ETAPAS_PROCESSO, ETAPAS_FLUXO, etapaDef, etapaLabel, indiceEtapa,
  ehFinal, progressoProcesso, proximaEtapa, etapaAnterior,
} from '@/lib/processoCidadania'

describe('ETAPAS_PROCESSO', () => {
  it('tem exatamente um desfecho de ganho e um de perdido', () => {
    expect(ETAPAS_PROCESSO.filter(e => e.ganho)).toHaveLength(1)
    expect(ETAPAS_PROCESSO.filter(e => e.perdido)).toHaveLength(1)
    expect(etapaDef('deferido')?.ganho).toBe(true)
    expect(etapaDef('arquivado')?.perdido).toBe(true)
  })
  it('ETAPAS_FLUXO exclui os desfechos e preserva a ordem', () => {
    expect(ETAPAS_FLUXO).toEqual(['viabilidade', 'genealogia', 'documentos', 'traducao', 'dossie', 'protocolo', 'acompanhamento'])
    expect(ETAPAS_FLUXO).not.toContain('deferido')
    expect(ETAPAS_FLUXO).not.toContain('arquivado')
  })
})

describe('etapaDef / etapaLabel', () => {
  it('resolve etapa conhecida', () => {
    expect(etapaDef('protocolo')?.label).toBe('Protocolo')
    expect(etapaLabel('genealogia')).toBe('Pesquisa genealógica')
  })
  it('desconhecida ou vazia não quebra', () => {
    expect(etapaDef(undefined)).toBeNull()
    expect(etapaDef('inexistente')).toBeNull()
    expect(etapaLabel(null)).toBe('Sem etapa')
  })
})

describe('indiceEtapa', () => {
  it('cresce ao longo da lista', () => {
    expect(indiceEtapa('viabilidade')).toBe(0)
    expect(indiceEtapa('acompanhamento')).toBeGreaterThan(indiceEtapa('documentos'))
  })
  it('desconhecida = -1', () => {
    expect(indiceEtapa('xyz')).toBe(-1)
  })
})

describe('ehFinal', () => {
  it('só deferido e arquivado são finais', () => {
    expect(ehFinal('deferido')).toBe(true)
    expect(ehFinal('arquivado')).toBe(true)
    expect(ehFinal('protocolo')).toBe(false)
    expect(ehFinal('viabilidade')).toBe(false)
    expect(ehFinal(undefined)).toBe(false)
  })
})

describe('progressoProcesso', () => {
  it('deferido = 1, arquivado = 0', () => {
    expect(progressoProcesso('deferido')).toBe(1)
    expect(progressoProcesso('arquivado')).toBe(0)
  })
  it('é monotônico crescente ao longo do fluxo', () => {
    let anterior = -1
    for (const e of ETAPAS_FLUXO) {
      const p = progressoProcesso(e)
      expect(p).toBeGreaterThan(anterior)
      expect(p).toBeGreaterThan(0)
      expect(p).toBeLessThan(1)
      anterior = p
    }
  })
  it('desconhecida = 0', () => {
    expect(progressoProcesso('xyz')).toBe(0)
    expect(progressoProcesso(null)).toBe(0)
  })
})

describe('proximaEtapa', () => {
  it('avança na esteira', () => {
    expect(proximaEtapa('viabilidade')).toBe('genealogia')
    expect(proximaEtapa('documentos')).toBe('traducao')
  })
  it('da última etapa de fluxo vai para deferido', () => {
    expect(proximaEtapa('acompanhamento')).toBe('deferido')
  })
  it('desfechos não têm próxima', () => {
    expect(proximaEtapa('deferido')).toBeNull()
    expect(proximaEtapa('arquivado')).toBeNull()
  })
})

describe('etapaAnterior', () => {
  it('volta na esteira', () => {
    expect(etapaAnterior('genealogia')).toBe('viabilidade')
    expect(etapaAnterior('traducao')).toBe('documentos')
  })
  it('a primeira não tem anterior', () => {
    expect(etapaAnterior('viabilidade')).toBeNull()
  })
  it('reabrir um desfecho volta para a última etapa de fluxo', () => {
    expect(etapaAnterior('deferido')).toBe('acompanhamento')
    expect(etapaAnterior('arquivado')).toBe('acompanhamento')
  })
})

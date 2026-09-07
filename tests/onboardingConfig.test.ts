import { describe, it, expect } from 'vitest'
import { configPadrao, normalizarConfig, etapasDaConfig, slug } from '@/lib/onboardingConfig'

describe('onboardingConfig — fases > etapas', () => {
  it('padrão = o checklist que já existia (mesmos ids, 3 fases, 9 etapas)', () => {
    const c = configPadrao()
    expect(c.fases.map(f => f.nome)).toEqual(['Formalização', 'Fundação', 'Go live'])
    expect(etapasDaConfig(c).map(e => e.id)).toEqual(['contrato', 'acessos', 'passagem', 'kickoff', 'escopo', 'marca', 'redes', 'playbook', 'primeiro'])
    expect(etapasDaConfig(c).filter(e => e.auto).length).toBe(5)
  })

  it('sem nada gravado (ou lixo) vale o padrão', () => {
    expect(normalizarConfig(null)).toEqual(configPadrao())
    expect(normalizarConfig({ fases: 'x' })).toEqual(configPadrao())
    expect(normalizarConfig({ fases: [{ nome: '   ', etapas: [] }] })).toEqual(configPadrao())
  })

  it('gera ids únicos a partir do nome e descarta etapa sem nome', () => {
    const c = normalizarConfig({ fases: [
      { nome: 'Diagnóstico', etapas: [{ nome: 'Auditoria de redes' }, { nome: 'Auditoria de redes' }, { nome: '' }, { id: 'Ok Id', nome: 'Com id inválido' }] },
      { nome: 'Diagnóstico', etapas: [] },
    ] })
    expect(c.fases.map(f => f.id)).toEqual(['diagnostico', 'diagnostico-2'])
    expect(c.fases[0].etapas.map(e => e.id)).toEqual(['auditoria-de-redes', 'auditoria-de-redes-2', 'ok-id'])
    expect(c.fases[0].etapas.length).toBe(3)
  })

  it('preserva ids válidos vindos do banco e só aceita detector conhecido', () => {
    const c = normalizarConfig({ fases: [{ id: 'f1', nome: 'Fase', etapas: [
      { id: 'contrato', nome: 'Contrato', auto: 'inventado' },
      { id: 'redes', nome: 'Redes', auto: 'redes', dica: '  Conectar  ' },
    ] }] })
    expect(c.fases[0].id).toBe('f1')
    expect(c.fases[0].etapas[0]).toEqual({ id: 'contrato', nome: 'Contrato' })
    expect(c.fases[0].etapas[1]).toEqual({ id: 'redes', nome: 'Redes', auto: 'redes', dica: 'Conectar' })
  })

  it('slug remove acento e símbolos', () => {
    expect(slug('Reunião de kick-off!')).toBe('reuniao-de-kick-off')
  })
})

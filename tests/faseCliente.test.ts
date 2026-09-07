import { describe, it, expect } from 'vitest'
import { faseDoCliente, checklistOnboarding, podeConcluirOnboarding, pendentesOnboarding, avaliarTransicao, limparChecklist, agruparPorFase, ITENS_MANUAIS } from '@/lib/faseCliente'
import { normalizarConfig } from '@/lib/onboardingConfig'

const completo = {
  segmento: 'Clínica', metaConectado: true, entregaveis: ['social_media'], postsMensais: 12,
  onboardingChecklist: { contrato: true, acessos: true, passagem: true, kickoff: true },
}

describe('faseCliente — ciclo de vida do cliente', () => {
  it('cliente antigo sem o campo é "producao" (a carteira não volta para o onboarding)', () => {
    expect(faseDoCliente({})).toBe('producao')
    expect(faseDoCliente(null)).toBe('producao')
    expect(faseDoCliente({ fase: 'qualquer' })).toBe('producao')
    expect(faseDoCliente({ fase: 'onboarding' })).toBe('onboarding')
  })

  it('checklist: manuais vêm de onboardingChecklist, automáticos dos dados', () => {
    const itens = checklistOnboarding({ cliente: { ...completo, onboardingChecklist: { contrato: true } }, marcos: 0, publicados: 0 })
    const por = Object.fromEntries(itens.map(i => [i.chave, i.ok]))
    expect(por.contrato).toBe(true)
    expect(por.acessos).toBe(false)
    expect(por.escopo).toBe(true)
    expect(por.marca).toBe(true)
    expect(por.redes).toBe(true)
    expect(por.playbook).toBe(false)
    expect(por.primeiro).toBe(false)
    expect(itens.filter(i => i.manual).length).toBe(ITENS_MANUAIS.length)
  })

  it('cliente novo em branco: nada marcado, nada concluído', () => {
    const itens = checklistOnboarding({ cliente: {}, marcos: 0, publicados: 0 })
    expect(pendentesOnboarding(itens).length).toBe(itens.length)
    expect(podeConcluirOnboarding(itens)).toBe(false)
  })

  it('tudo feito: pode concluir', () => {
    const itens = checklistOnboarding({ cliente: completo, marcos: 3, publicados: 1 })
    expect(podeConcluirOnboarding(itens)).toBe(true)
  })

  it('transição onboarding → produção exige checklist completo', () => {
    const faltando = checklistOnboarding({ cliente: { ...completo, onboardingChecklist: { contrato: true } }, marcos: 3, publicados: 1 })
    const r = avaliarTransicao({ de: 'onboarding', para: 'producao', itens: faltando, ehAdmin: false })
    expect(r.ok).toBe(false)
    if (r.ok === false) expect(r.pendentes).toEqual(['Acessos recebidos (Meta, site, ferramentas)', 'Passagem de bastão lida pelo gestor', 'Reunião de kickoff realizada'])
    const pronto = checklistOnboarding({ cliente: completo, marcos: 3, publicados: 1 })
    expect(avaliarTransicao({ de: 'onboarding', para: 'producao', itens: pronto, ehAdmin: false }).ok).toBe(true)
  })

  it('admin pode FORÇAR a conclusão com pendências; gerente não', () => {
    const faltando = checklistOnboarding({ cliente: {}, marcos: 0, publicados: 0 })
    expect(avaliarTransicao({ de: 'onboarding', para: 'producao', itens: faltando, ehAdmin: true, forcar: true }).ok).toBe(true)
    expect(avaliarTransicao({ de: 'onboarding', para: 'producao', itens: faltando, ehAdmin: true }).ok).toBe(false)
    expect(avaliarTransicao({ de: 'onboarding', para: 'producao', itens: faltando, ehAdmin: false, forcar: true }).ok).toBe(false)
  })

  it('reabrir (produção → onboarding) só admin; mesma fase é recusada', () => {
    const itens = checklistOnboarding({ cliente: completo, marcos: 3, publicados: 1 })
    expect(avaliarTransicao({ de: 'producao', para: 'onboarding', itens, ehAdmin: false }).ok).toBe(false)
    expect(avaliarTransicao({ de: 'producao', para: 'onboarding', itens, ehAdmin: true }).ok).toBe(true)
    expect(avaliarTransicao({ de: 'producao', para: 'producao', itens, ehAdmin: true }).ok).toBe(false)
  })

  it('limparChecklist só aceita chaves conhecidas e valor true', () => {
    expect(limparChecklist({ contrato: true, acessos: 'sim', invadido: true, kickoff: false })).toEqual({ contrato: true })
    expect(limparChecklist(null)).toEqual({})
    expect(limparChecklist('x')).toEqual({})
  })

  it('agrupa por fase na ordem da config, com contagem por fase', () => {
    const itens = checklistOnboarding({ cliente: { ...completo, onboardingChecklist: { contrato: true, acessos: true, passagem: true, kickoff: true } }, marcos: 0, publicados: 0 })
    const fases = agruparPorFase(itens)
    expect(fases.map(f => [f.nome, f.feitos, f.total])).toEqual([['Formalização', 4, 4], ['Fundação', 3, 4], ['Go live', 0, 1]])
  })

  it('config PERSONALIZADA: etapas novas manuais e automáticas, checklist gravado só aceita as manuais', () => {
    const cfg = normalizarConfig({ fases: [
      { nome: 'Diagnóstico', etapas: [{ nome: 'Auditoria das redes' }, { nome: 'Redes conectadas', auto: 'redes' }] },
      { nome: 'Lançamento', etapas: [{ nome: 'Primeiro post', auto: 'primeiro' }, { nome: 'Reunião de 30 dias' }] },
    ] })
    const itens = checklistOnboarding({ cliente: { metaConectado: true, onboardingChecklist: { 'auditoria-das-redes': true, 'redes-conectadas': true } }, marcos: 0, publicados: 0 }, cfg)
    expect(itens.map(i => [i.chave, i.ok, i.manual, i.faseNome])).toEqual([
      ['auditoria-das-redes', true, true, 'Diagnóstico'],
      ['redes-conectadas', true, false, 'Diagnóstico'],
      ['primeiro-post', false, false, 'Lançamento'],
      ['reuniao-de-30-dias', false, true, 'Lançamento'],
    ])
    // etapa automática marcada "à mão" é ignorada; chave desconhecida também
    expect(limparChecklist({ 'auditoria-das-redes': true, 'redes-conectadas': true, contrato: true }, cfg)).toEqual({ 'auditoria-das-redes': true })
  })
})

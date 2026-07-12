import { describe, it, expect } from 'vitest'
import { PERFIS, perfilDef } from '@/lib/perfisInstanciaCatalogo'
import { ABAS_PERM } from '@/lib/permissoesGranular'
import { GRUPOS, NIVEIS, podeNivel } from '@/lib/permissoesCatalogo'
import { podeAbaGranular } from '@/lib/permissoesGranular'

// Perfis de instância: presets do bootstrap (/api/setup). Estes testes travam a
// integridade do catálogo — chave de aba que não existe mais, grupo inválido ou
// funil sem terminal quebrariam silenciosamente a instância recém-provisionada.

const CHAVES_ABAS = ABAS_PERM.map(a => a.key)
const CHAVES_GRUPOS = GRUPOS.map(g => g.chave)
const CHAVES_NIVEIS = NIVEIS.map(n => n.chave)

describe('catálogo de perfis', () => {
  it('chaves únicas e metadados preenchidos', () => {
    const chaves = PERFIS.map(p => p.chave)
    expect(new Set(chaves).size).toBe(chaves.length)
    for (const p of PERFIS) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.descricao.length).toBeGreaterThan(0)
    }
  })

  it('perfilDef resolve chave válida e rejeita o resto', () => {
    expect(perfilDef('clinica')?.chave).toBe('clinica')
    expect(perfilDef('gestao')?.chave).toBe('gestao')
    expect(perfilDef('inexistente')).toBeNull()
    expect(perfilDef('')).toBeNull()
    expect(perfilDef(undefined)).toBeNull()
    expect(perfilDef(null)).toBeNull()
  })

  it('toda aba desligada no granular existe em ABAS_PERM (senão o NavBtn ignora)', () => {
    for (const p of PERFIS) {
      for (const papel of ['gerente', 'usuario'] as const) {
        const abas = p.permissoesGranular?.[papel]?.abas || {}
        for (const aba of Object.keys(abas)) {
          expect(CHAVES_ABAS, `perfil ${p.chave}: aba "${aba}" não existe em ABAS_PERM`).toContain(aba)
        }
      }
    }
  })

  it('permissoesPapel cobre os dois papéis com grupos e níveis válidos', () => {
    for (const p of PERFIS) {
      if (!p.permissoesPapel) continue
      for (const papel of ['gerente', 'usuario'] as const) {
        const grupos = p.permissoesPapel[papel]
        expect(grupos, `perfil ${p.chave}: papel ${papel} sem preset`).toBeTruthy()
        for (const [grupo, niveis] of Object.entries(grupos!)) {
          expect(CHAVES_GRUPOS, `perfil ${p.chave}: grupo "${grupo}" inválido`).toContain(grupo)
          for (const nivel of Object.keys(niveis || {})) {
            expect(CHAVES_NIVEIS, `perfil ${p.chave}: nível "${nivel}" inválido`).toContain(nivel)
          }
        }
      }
    }
  })

  it('funil semeado tem exatamente 1 ganho e 1 perdido', () => {
    for (const p of PERFIS) {
      if (!p.pipeline) continue
      expect(p.pipeline.estagios.filter(e => e.ganho).length, `perfil ${p.chave}`).toBe(1)
      expect(p.pipeline.estagios.filter(e => e.perdido).length, `perfil ${p.chave}`).toBe(1)
      expect(p.pipeline.estagios.length).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('perfil clinica — comportamento esperado nas duas camadas', () => {
  const def = perfilDef('clinica')!

  it('equipe vê Agenda e CRM; Studio/Planner ficam escondidos', () => {
    for (const papel of ['gerente', 'usuario']) {
      expect(podeAbaGranular(papel, 'agenda', undefined, def.permissoesGranular)).toBe(true)
      expect(podeAbaGranular(papel, 'crm', undefined, def.permissoesGranular)).toBe(true)
      expect(podeAbaGranular(papel, 'studio', undefined, def.permissoesGranular)).toBe(false)
      expect(podeAbaGranular(papel, 'planner', undefined, def.permissoesGranular)).toBe(false)
    }
  })

  it('estratégia desligada no módulo; usuário não exclui', () => {
    expect(podeNivel('gerente', 'estrategia', 'ver', undefined, def.permissoesPapel)).toBe(false)
    expect(podeNivel('usuario', 'estrategia', 'ver', undefined, def.permissoesPapel)).toBe(false)
    expect(podeNivel('usuario', 'crm', 'editar', undefined, def.permissoesPapel)).toBe(true)
    expect(podeNivel('usuario', 'crm', 'excluir', undefined, def.permissoesPapel)).toBe(false)
    expect(podeNivel('gerente', 'crm', 'excluir', undefined, def.permissoesPapel)).toBe(true)
  })
})

describe('perfil gestao — comportamento esperado', () => {
  const def = perfilDef('gestao')!

  it('equipe vê Projetos (estratégia) e CRM; social/Agenda escondidos', () => {
    expect(podeNivel('gerente', 'estrategia', 'editar', undefined, def.permissoesPapel)).toBe(true)
    expect(podeNivel('usuario', 'estrategia', 'ver', undefined, def.permissoesPapel)).toBe(true)
    for (const papel of ['gerente', 'usuario']) {
      expect(podeAbaGranular(papel, 'playbook', undefined, def.permissoesGranular)).toBe(true)
      expect(podeAbaGranular(papel, 'tarefas', undefined, def.permissoesGranular)).toBe(true)
      expect(podeAbaGranular(papel, 'documentos', undefined, def.permissoesGranular)).toBe(true)
      expect(podeAbaGranular(papel, 'studio', undefined, def.permissoesGranular)).toBe(false)
      expect(podeAbaGranular(papel, 'agenda', undefined, def.permissoesGranular)).toBe(false)
      expect(podeAbaGranular(papel, 'campanhas', undefined, def.permissoesGranular)).toBe(false)
    }
  })

  it('financeiro segue exclusivo do admin mesmo no perfil gestao', () => {
    expect(podeNivel('gerente', 'financeiro', 'ver', undefined, def.permissoesPapel)).toBe(false)
    expect(podeNivel('admin', 'financeiro', 'ver', undefined, def.permissoesPapel)).toBe(true)
  })
})

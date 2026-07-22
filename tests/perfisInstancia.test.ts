import { describe, it, expect } from 'vitest'
import { perfilVendeParaPessoa, PERFIS as PERFIS_CAT } from '@/lib/perfisInstanciaCatalogo'

// Regra usada pela TELA (esconder o campo empresa) e pela ROTA (não exigir no
// POST). Quando as duas discordaram, o formulário não pedia empresa e o servidor
// recusava a oportunidade da cidadania — bug relatado pelo dono.
describe('perfilVendeParaPessoa', () => {
  it('clínica, turismo e cidadania vendem para pessoa física', () => {
    expect(perfilVendeParaPessoa('clinica')).toBe(true)
    expect(perfilVendeParaPessoa('turismo')).toBe(true)
    expect(perfilVendeParaPessoa('cidadania')).toBe(true)
  })
  it('agência (sem perfil) e gestão seguem exigindo empresa', () => {
    expect(perfilVendeParaPessoa(null)).toBe(false)
    expect(perfilVendeParaPessoa(undefined)).toBe(false)
    expect(perfilVendeParaPessoa('gestao')).toBe(false)
  })
  it('perfil desconhecido não vira pessoa física por acidente', () => {
    expect(perfilVendeParaPessoa('inexistente')).toBe(false)
  })
  it('todo perfil do catálogo tem resposta definida (perfil novo passa por aqui)', () => {
    for (const p of PERFIS_CAT) {
      expect(typeof perfilVendeParaPessoa(p.chave)).toBe('boolean')
    }
  })
})
import { PERFIS, perfilDef, ABAS_OCULTAS_CLINICA, ABAS_OCULTAS_TURISMO, ABAS_OCULTAS_TELEFONIA, perfilSemRecrutamento, nomeSistema } from '@/lib/perfisInstanciaCatalogo'
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
    expect(perfilDef('turismo')?.chave).toBe('turismo')
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

  it('cada funil semeado tem exatamente 1 ganho e 1 perdido', () => {
    for (const p of PERFIS) {
      if (!p.pipelines) continue
      for (const pipe of p.pipelines) {
        expect(pipe.estagios.filter(e => e.ganho).length, `perfil ${p.chave} / ${pipe.nome}`).toBe(1)
        expect(pipe.estagios.filter(e => e.perdido).length, `perfil ${p.chave} / ${pipe.nome}`).toBe(1)
        expect(pipe.estagios.length).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('modo clínica esconde exatamente o que o dono pediu (2026-07-13), sem duplicatas', () => {
    // Studio, Planner, Mapas, Estratégia inteira, Conversão&Retenção, Candidaturas, Trabalhe Conosco, Clientes B2B
    expect([...ABAS_OCULTAS_CLINICA].sort()).toEqual(
      ['automacoes', 'campanhas', 'candidaturas', 'clientes', 'conversao', 'mapas', 'modelos', 'planner', 'playbook', 'recrutamento', 'solicitacoes', 'studio'].sort()
    )
    expect(new Set(ABAS_OCULTAS_CLINICA).size).toBe(ABAS_OCULTAS_CLINICA.length)
    // Agenda, CRM e Tarefas NUNCA podem entrar nesta lista (são o produto da clínica)
    for (const essencial of ['agenda', 'crm', 'tarefas', 'home']) {
      expect(ABAS_OCULTAS_CLINICA).not.toContain(essencial)
    }
  })

  it('perfil clínica semeia playbook de clínica com cadência válida', () => {
    const pb = perfilDef('clinica')!.playbook!
    expect(pb.roteiro).toMatch(/DÉCADA/)
    expect(pb.cadencia.length).toBeGreaterThanOrEqual(3)
    for (const p of pb.cadencia) {
      expect(['whatsapp', 'ligacao', 'email']).toContain(p.canal)
      expect(typeof p.dia).toBe('number')
      expect(p.titulo.length).toBeGreaterThan(0)
      expect(p.script.length).toBeGreaterThan(0)
    }
    // gestão não semeia playbook (usa o padrão de agência)
    expect(perfilDef('gestao')!.playbook).toBeUndefined()
  })

  it('clínica tem os 2 funis de venda: Agendamentos (consulta paga) + Tratamentos (venda na cadeira)', () => {
    const pipes = perfilDef('clinica')!.pipelines!
    expect(pipes.map(p => p.nome)).toEqual(['Agendamentos', 'Tratamentos'])
    const agend = pipes.find(p => p.nome === 'Agendamentos')!
    expect(agend.estagios.map(e => e.nome)).toEqual(['Lead novo', 'Em conversa', 'Em agendamento', 'Consulta paga', 'Compareceu', 'Não compareceu'])
    expect(agend.estagios.find(e => e.ganho)?.nome).toBe('Compareceu')
    const trat = pipes.find(p => p.nome === 'Tratamentos')!
    expect(trat.estagios.map(e => e.nome)).toEqual(['Avaliação feita', 'Proposta apresentada', 'Em negociação', 'Fechou', 'Não fechou'])
    expect(trat.estagios.find(e => e.ganho)?.nome).toBe('Fechou')
    expect(trat.estagios.find(e => e.perdido)?.nome).toBe('Não fechou')
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

describe('perfil turismo — operadora de excursões', () => {
  const def = perfilDef('turismo')!

  it('funil "Vendas de Viagem" com Emitido(ganho) e Perdido', () => {
    expect(def.pipelines!.map(p => p.nome)).toEqual(['Vendas de Viagem'])
    const funil = def.pipelines![0]
    expect(funil.estagios.find(e => e.ganho)?.nome).toBe('Emitido')
    expect(funil.estagios.find(e => e.perdido)?.nome).toBe('Perdido')
    expect(funil.estagios.map(e => e.nome)).toContain('Reserva')
  })

  it('CRM ligado, Estratégia desligada; social/Agenda escondidos', () => {
    for (const papel of ['gerente', 'usuario']) {
      expect(podeAbaGranular(papel, 'crm', undefined, def.permissoesGranular)).toBe(true)
      expect(podeAbaGranular(papel, 'studio', undefined, def.permissoesGranular)).toBe(false)
      expect(podeAbaGranular(papel, 'agenda', undefined, def.permissoesGranular)).toBe(false)
    }
    expect(podeNivel('gerente', 'estrategia', 'ver', undefined, def.permissoesPapel)).toBe(false)
    expect(podeNivel('usuario', 'crm', 'editar', undefined, def.permissoesPapel)).toBe(true)
  })

  it('esconde agência/clínica mas mantém CRM/Tarefas/Financeiro', () => {
    for (const oculta of ['studio', 'agenda', 'clientes', 'recrutamento', 'conversao']) {
      expect(ABAS_OCULTAS_TURISMO).toContain(oculta)
    }
    for (const essencial of ['crm', 'tarefas', 'rentabilidade', 'home', 'mensagens']) {
      expect(ABAS_OCULTAS_TURISMO).not.toContain(essencial)
    }
    expect(new Set(ABAS_OCULTAS_TURISMO).size).toBe(ABAS_OCULTAS_TURISMO.length)
  })

  it('perfilSemRecrutamento: clínica e turismo sim; gestão e agência não', () => {
    expect(perfilSemRecrutamento('clinica')).toBe(true)
    expect(perfilSemRecrutamento('turismo')).toBe(true)
    expect(perfilSemRecrutamento('gestao')).toBe(false)
    expect(perfilSemRecrutamento(null)).toBe(false)
  })
})

describe('perfil telefonia — varejo multi-loja', () => {
  const def = perfilDef('telefonia')!

  it('existe no catálogo com funil "Vendas" (Vendido=ganho, Não fechou=perdido)', () => {
    expect(def).toBeTruthy()
    expect(def.pipelines!.map(p => p.nome)).toEqual(['Vendas'])
    const funil = def.pipelines![0]
    expect(funil.estagios.find(e => e.ganho)?.nome).toBe('Vendido')
    expect(funil.estagios.find(e => e.perdido)?.nome).toBe('Não fechou')
  })

  it('CRM ligado, Estratégia desligada (varejo não usa estratégia de agência)', () => {
    expect(podeNivel('gerente', 'crm', 'editar', undefined, def.permissoesPapel)).toBe(true)
    expect(podeNivel('gerente', 'estrategia', 'ver', undefined, def.permissoesPapel)).toBe(false)
    for (const papel of ['gerente', 'usuario']) {
      expect(podeAbaGranular(papel, 'crm', undefined, def.permissoesGranular)).toBe(true)
      expect(podeAbaGranular(papel, 'studio', undefined, def.permissoesGranular)).toBe(false)
      expect(podeAbaGranular(papel, 'agenda', undefined, def.permissoesGranular)).toBe(false)
    }
  })

  it('esconde agência/clínica mas mantém CRM/Tarefas/Financeiro', () => {
    for (const oculta of ['studio', 'agenda', 'clientes', 'recrutamento', 'conversao', 'marca']) {
      expect(ABAS_OCULTAS_TELEFONIA).toContain(oculta)
    }
    for (const essencial of ['crm', 'tarefas', 'home', 'mensagens']) {
      expect(ABAS_OCULTAS_TELEFONIA).not.toContain(essencial)
    }
    expect(new Set(ABAS_OCULTAS_TELEFONIA).size).toBe(ABAS_OCULTAS_TELEFONIA.length)
  })

  it('vende para pessoa física, não usa recrutamento, branding "Soma10 App"', () => {
    expect(perfilVendeParaPessoa('telefonia')).toBe(true)
    expect(perfilSemRecrutamento('telefonia')).toBe(true)
    expect(nomeSistema('telefonia')).toBe('Soma10 App')
  })
})

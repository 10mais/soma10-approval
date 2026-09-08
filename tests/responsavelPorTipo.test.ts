import { describe, it, expect } from 'vitest'
import { responsavelPorTipo, papelDoTipo } from '@/lib/responsavelPorTipo'

const squad = { designer: 'des@x', gestor_projetos: 'gp@x', gestor_operacao: 'op@x', gestor_trafego: 'traf@x' }

describe('responsavelPorTipo — squad do cliente decide quem recebe a tarefa', () => {
  it('tipos de arte vão para o designer; campanha para o tráfego; texto/planejamento para o gestor de projetos', () => {
    expect(responsavelPorTipo(squad, 'carrossel')).toBe('des@x')
    expect(responsavelPorTipo(squad, 'reel')).toBe('des@x')
    expect(responsavelPorTipo(squad, 'campanha')).toBe('traf@x')
    expect(responsavelPorTipo(squad, 'copy')).toBe('gp@x')
    expect(responsavelPorTipo(squad, 'tarefa')).toBe('gp@x')
    expect(responsavelPorTipo(squad, undefined)).toBe('gp@x')
  })
  it('papel vago cai para o gestor de projetos, depois para o gestor da operação', () => {
    expect(responsavelPorTipo({ gestor_projetos: 'gp@x' }, 'criativo')).toBe('gp@x')
    expect(responsavelPorTipo({ gestor_operacao: 'op@x' }, 'criativo')).toBe('op@x')
    expect(responsavelPorTipo({}, 'criativo')).toBe('')
    expect(responsavelPorTipo(undefined, 'criativo')).toBe('')
  })
  it('tipo desconhecido (custom) vai para o gestor de projetos', () => {
    expect(papelDoTipo('meu_tipo_custom')).toBe('gestor_projetos')
    expect(responsavelPorTipo(squad, 'meu_tipo_custom')).toBe('gp@x')
  })
})

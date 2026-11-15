import { describe, it, expect } from 'vitest'
import { responsavelPorTipo, papelDoTipo, produtorDaPauta } from '@/lib/responsavelPorTipo'

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
  it('copy e briefing vão para o Social Media / Copywriter (papel novo, 20/10/2026)', () => {
    const comSocial = { ...squad, social_media: 'social@x' }
    expect(responsavelPorTipo(comSocial, 'copy')).toBe('social@x')
    expect(responsavelPorTipo(comSocial, 'briefing')).toBe('social@x')
    expect(responsavelPorTipo(comSocial, 'carrossel')).toBe('des@x') // arte continua com o designer
  })
  it('tipo desconhecido (custom) vai para o gestor de projetos', () => {
    expect(papelDoTipo('meu_tipo_custom')).toBe('gestor_projetos')
    expect(responsavelPorTipo(squad, 'meu_tipo_custom')).toBe('gp@x')
  })
  it('Reels e vídeo vão para o editor de vídeo; sem editor, para o designer (15/11/2026)', () => {
    const comEditor = { ...squad, editor_video: 'ed@x' }
    expect(responsavelPorTipo(comEditor, 'reel')).toBe('ed@x')
    expect(responsavelPorTipo(comEditor, 'video')).toBe('ed@x')
    expect(responsavelPorTipo(comEditor, 'carrossel')).toBe('des@x')
    expect(responsavelPorTipo(squad, 'video')).toBe('des@x')
    expect(responsavelPorTipo({ gestor_projetos: 'gp@x' }, 'reel')).toBe('gp@x')
  })
})

describe('produtorDaPauta — quem recebe a peça quando a copy é aprovada', () => {
  it('Reels: editor de vídeo; sem editor ou outro formato: designer; sem nenhum: vazio', () => {
    expect(produtorDaPauta({ designer: 'des@x', editor_video: ' ed@x ' }, 'reel')).toEqual({ email: 'ed@x', papel: 'editor_video' })
    expect(produtorDaPauta({ designer: 'des@x', editor_video: 'ed@x' }, 'carrossel')).toEqual({ email: 'des@x', papel: 'designer' })
    expect(produtorDaPauta({ designer: 'des@x' }, 'reel')).toEqual({ email: 'des@x', papel: 'designer' })
    expect(produtorDaPauta({}, 'reel')).toEqual({ email: '', papel: 'designer' })
    expect(produtorDaPauta(undefined, undefined)).toEqual({ email: '', papel: 'designer' })
  })
})

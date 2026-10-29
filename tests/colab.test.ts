import { describe, it, expect } from 'vitest'
import { MAX_COLAB, limparUsuario, limparColaboradores, colaboradoresAcimaDoLimite, gruposParaTentar } from '@/lib/colab'

// Dono, 26/10/2026: "está havendo algum erro na hora de marcar em colab algum perfil?". A tela
// deixava 4, a Meta aceita 3, e um @ recusado derrubava todos os convidados sem aviso.
describe('colab — limite e limpeza do @', () => {
  it('a Meta aceita até 3 colaboradores', () => {
    expect(MAX_COLAB).toBe(3)
  })

  it('limpa @, espaço, maiúscula e link do perfil', () => {
    expect(limparUsuario(' @Fulano.Silva ')).toBe('fulano.silva')
    expect(limparUsuario('https://www.instagram.com/beltrano_/?hl=pt-br')).toBe('beltrano_')
    expect(limparUsuario('instagram.com/ciclano')).toBe('ciclano')
    expect(limparUsuario(undefined)).toBe('')
  })

  it('lista limpa: sem inválidos, sem repetidos, no máximo 3; o excedente é avisado', () => {
    const lista = ['@a', 'A', 'b c', 'c', 'd', 'e']
    expect(limparColaboradores(lista)).toEqual(['a', 'c', 'd'])
    expect(colaboradoresAcimaDoLimite(lista)).toEqual(['e'])
    expect(limparColaboradores('nada')).toEqual([])
  })

  it('recusado: tenta de novo tirando um de cada vez, depois dois, até nenhum', () => {
    expect(gruposParaTentar(['a', 'b', 'c'])).toEqual([['a', 'b'], ['a', 'c'], ['b', 'c'], ['a'], ['b'], ['c'], []])
    expect(gruposParaTentar(['a'])).toEqual([[]])
    expect(gruposParaTentar([])).toEqual([])
  })
})

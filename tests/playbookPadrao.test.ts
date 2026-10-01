import { describe, it, expect } from 'vitest'
import { padraoDoPerfil } from '@/lib/playbookPadrao'
import { PERFIS } from '@/lib/perfisInstanciaCatalogo'

describe('de quem é o script que a instância recebe', () => {
  it('a agência (sem perfil) recebe o script do 10+', () => {
    expect(padraoDoPerfil(null)).toBe('agencia')
    expect(padraoDoPerfil(undefined)).toBe('agencia')
    expect(padraoDoPerfil('')).toBe('agencia')
  })

  it('clínica recebe o script de clínica', () => {
    expect(padraoDoPerfil('clinica')).toBe('clinica')
  })

  it('turismo NÃO recebe o script da agência — foi o bug da Deny', () => {
    expect(padraoDoPerfil('turismo')).toBe('vazio')
  })

  it('nenhum outro perfil herda script de outro negócio', () => {
    // Deriva do catálogo: perfil novo entra neste teste sozinho, sem ninguém
    // lembrar de atualizá-lo — que é como o erro passou da primeira vez.
    for (const p of PERFIS.map(x => x.chave)) {
      const esperado = p === 'clinica' ? 'clinica' : 'vazio'
      expect([p, padraoDoPerfil(p)]).toEqual([p, esperado])
    }
  })
})

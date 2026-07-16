import { describe, it, expect } from 'vitest'
import { abasOcultasDoPerfil, ABAS_OCULTAS_CLINICA } from '@/lib/perfisInstanciaCatalogo'
import { ABAS_PERM } from '@/lib/permissoesGranular'

// Um código, N instâncias: o que decide quais telas existem em cada uma é o
// perfil. Quem esconde tela errado apaga trabalho de vista (já aconteceu no
// Planner) — e quem MOSTRA tela errado entrega a agenda de paciente para a
// agência, que foi o que motivou estes testes.

describe('abasOcultasDoPerfil', () => {
  it('a Agenda é de clínica: só a clínica enxerga', () => {
    expect(abasOcultasDoPerfil('clinica')).not.toContain('agenda')
    for (const perfil of [null, undefined, 'gestao', 'turismo']) {
      expect(abasOcultasDoPerfil(perfil)).toContain('agenda')
    }
  })

  it('instância sem perfil é a agência (o 10+ nunca rodou /api/setup)', () => {
    expect(abasOcultasDoPerfil(null)).toEqual(abasOcultasDoPerfil(undefined))
    expect(abasOcultasDoPerfil('perfil-que-nao-existe')).toEqual(abasOcultasDoPerfil(null))
  })

  it('a agência mantém a própria operação (Studio, Planner, clientes)', () => {
    const ocultas = abasOcultasDoPerfil(null)
    for (const aba of ['studio', 'planner', 'clientes', 'tarefas', 'crm', 'playbook']) {
      expect(ocultas).not.toContain(aba)
    }
  })

  it('clínica segue sem as telas de agência', () => {
    expect(ABAS_OCULTAS_CLINICA).toContain('studio')
    expect(ABAS_OCULTAS_CLINICA).toContain('planner')
  })

  it('tela escondida não aparece na matriz de permissões da instância', () => {
    // A matriz oferece o que existe: sem isto, o admin da agência configuraria
    // quem "vê a Agenda" — uma tela que ninguém alcança.
    const ocultas = abasOcultasDoPerfil(null)
    const naMatriz = ABAS_PERM.filter(a => !a.perfil || a.perfil === null).map(a => a.key)
    for (const aba of ocultas) expect(naMatriz).not.toContain(aba)
  })

  it('toda aba de perfil declara um perfil que existe', () => {
    for (const a of ABAS_PERM) {
      if (a.perfil) expect(['clinica', 'turismo']).toContain(a.perfil)
    }
  })
})

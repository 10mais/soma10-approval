import { describe, it, expect } from 'vitest'
import { ehEquipeDoHub, podeTelaDoHub } from '@/lib/permissoesHub'
import { podeNivel } from '@/lib/permissoesCatalogo'
import { podeAcaoGranular } from '@/lib/permissoesGranular'

// Dono, 21/10/2026: "O Perfil da Ana ainda tem alguns erros de permissões. Ela não consegue
// excluir pautas e outras coisas também". O hub só reconhecia admin e gerente como equipe.

describe('ehEquipeDoHub — colaborador (usuario) é equipe no hub', () => {
  it('admin, gerente e usuario sim; cliente e vendas não', () => {
    expect(['admin', 'gerente', 'usuario'].every(r => ehEquipeDoHub(r))).toBe(true)
    expect(ehEquipeDoHub('cliente')).toBe(false)
    expect(ehEquipeDoHub('vendas')).toBe(false)
    expect(ehEquipeDoHub(undefined)).toBe(false)
  })
})

describe('podeTelaDoHub — a mesma regra do painel', () => {
  it('usuario com o padrão do papel: Produção sim, Playbook (Estratégia) não', () => {
    const ana = { role: 'usuario' }
    expect(podeTelaDoHub('/studio', ana)).toBe(true)
    expect(podeTelaDoHub('/tarefas', ana)).toBe(true)
    expect(podeTelaDoHub('/playbook', ana)).toBe(false)
    expect(podeTelaDoHub('', ana)).toBe(true) // início
    expect(podeTelaDoHub('/entregas', ana)).toBe(true) // tela sem regra
  })

  it('o que o admin marca para a pessoa vale (override individual)', () => {
    const ana = { role: 'usuario', permissoes: { estrategia: { ver: true } } }
    expect(podeTelaDoHub('/playbook', ana)).toBe(true)
  })

  it('tela desligada nas permissões detalhadas (do papel ou da pessoa) some', () => {
    expect(podeTelaDoHub('/studio', { role: 'usuario', permGranularPapel: { usuario: { abas: { studio: false } } } })).toBe(false)
    expect(podeTelaDoHub('/studio/x', { role: 'usuario', permissoesGranular: { abas: { studio: false } } })).toBe(false)
  })

  it('admin abre tudo; cliente não abre tela da equipe por aqui', () => {
    expect(podeTelaDoHub('/playbook', { role: 'admin' })).toBe(true)
    expect(podeTelaDoHub('/studio', { role: 'cliente' })).toBe(false)
  })
})

describe('excluir pauta = nível "Excluir" em Produção + ação "Excluir" (o que o hub passou a pedir)', () => {
  it('usuario: o padrão do papel não exclui; marcado na pessoa, exclui', () => {
    expect(podeNivel('usuario', 'producao', 'excluir', undefined, undefined)).toBe(false)
    const ana = { producao: { excluir: true } }
    expect(podeNivel('usuario', 'producao', 'excluir', ana, undefined) && podeAcaoGranular('usuario', 'excluir', undefined, undefined)).toBe(true)
    expect(podeAcaoGranular('usuario', 'excluir', { acoes: { excluir: false } }, undefined)).toBe(false)
  })
})

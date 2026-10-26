import { describe, it, expect } from 'vitest'
import { situacaoDaSolicitacao, resolvidaPeloSistema, situacaoValida, contarPorSituacao } from '@/lib/situacaoSolicitacao'

// Dono, 26/10/2026: "Em SOLICITAÇÕES: habilitar uma função de marcar como concluído ou descartado."

describe('situacaoDaSolicitacao', () => {
  it('pedido de ajuste, reprovação e solicitação de conteúdo nascem em aberto', () => {
    for (const tipo of ['ajuste_layout', 'ajuste_copy', 'reprovacao', 'solicitacao_conteudo']) {
      expect(situacaoDaSolicitacao({ tipo })).toBe('aberta')
    }
  })

  it('o que o fluxo já resolveu entra como concluída, sem clique (e a tela diz "pelo sistema")', () => {
    for (const tipo of ['aprovacao', 'ajuste_aplicado', 'corrigir_legenda']) {
      expect(situacaoDaSolicitacao({ tipo })).toBe('concluida')
      expect(resolvidaPeloSistema({ tipo })).toBe(true)
    }
  })

  it('a marca da equipe vence', () => {
    expect(situacaoDaSolicitacao({ tipo: 'ajuste_layout', situacao: 'concluida' })).toBe('concluida')
    expect(situacaoDaSolicitacao({ tipo: 'reprovacao', situacao: 'descartada' })).toBe('descartada')
    expect(situacaoDaSolicitacao({ tipo: 'aprovacao', situacao: 'descartada' })).toBe('descartada')
    expect(resolvidaPeloSistema({ tipo: 'aprovacao', situacao: 'concluida' })).toBe(false)
  })
})

describe('situacaoValida e contagem', () => {
  it('a rota aceita concluir, descartar ou reabrir (null) — nada além disso', () => {
    expect(situacaoValida('concluida')).toBe(true)
    expect(situacaoValida('descartada')).toBe(true)
    expect(situacaoValida(null)).toBe(true)
    expect(situacaoValida('aberta')).toBe(false)
    expect(situacaoValida(undefined)).toBe(false)
  })

  it('conta por situação para as abas da tela', () => {
    expect(contarPorSituacao([
      { tipo: 'ajuste_layout' }, { tipo: 'reprovacao' }, { tipo: 'aprovacao' },
      { tipo: 'ajuste_copy', situacao: 'concluida' }, { tipo: 'solicitacao_conteudo', situacao: 'descartada' },
    ])).toEqual({ aberta: 2, concluida: 2, descartada: 1, todas: 5 })
  })
})

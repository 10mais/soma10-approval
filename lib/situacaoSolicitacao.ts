// SITUAÇÃO de uma solicitação do cliente (tela Solicitações) — dono, 26/10/2026: "Em
// SOLICITAÇÕES: habilitar uma função de marcar como concluído ou descartado. Sempre confirme se
// 'tem certeza'". Puro e client-safe (a tela e a rota usam); testes em tests/situacaoSolicitacao.
//
// A equipe marca concluída ou descartada (LogCliente.situacao). Sem marca, a situação é
// derivada: o que o próprio fluxo já resolveu (o cliente aprovou; ou trocou legenda/data e o
// sistema aplicou e reprogramou) entra como concluída, sem pedir clique; o resto fica em aberto.

export type SituacaoSolicitacao = 'aberta' | 'concluida' | 'descartada'
export type FiltroSituacao = SituacaoSolicitacao | 'todas'

export const TIPOS_JA_RESOLVIDOS = ['aprovacao', 'ajuste_aplicado', 'corrigir_legenda']

type ComSituacao = { tipo?: string; situacao?: string | null }

export function situacaoDaSolicitacao(l: ComSituacao): SituacaoSolicitacao {
  if (l.situacao === 'concluida' || l.situacao === 'descartada') return l.situacao
  return TIPOS_JA_RESOLVIDOS.includes(l.tipo || '') ? 'concluida' : 'aberta'
}

/** Concluída sem ninguém marcar (aprovação, ajuste aplicado): a tela diz "pelo sistema". */
export const resolvidaPeloSistema = (l: ComSituacao): boolean => !l.situacao && TIPOS_JA_RESOLVIDOS.includes(l.tipo || '')

/** O que a rota aceita: marcar concluída/descartada, ou `null` para reabrir. */
export const situacaoValida = (v: unknown): v is 'concluida' | 'descartada' | null =>
  v === 'concluida' || v === 'descartada' || v === null

export function contarPorSituacao(lista: ComSituacao[]): Record<FiltroSituacao, number> {
  const n: Record<FiltroSituacao, number> = { aberta: 0, concluida: 0, descartada: 0, todas: lista.length }
  for (const l of lista) n[situacaoDaSolicitacao(l)]++
  return n
}

// GESTOS DE TOQUE (Mudança 2, dono 21/11/2026: "gestos e padrões nativos onde fizer sentido:
// deslizar para ações, puxar para atualizar"). Só a decisão mora aqui — quanto o dedo andou,
// para que lado, rápido ou devagar — para a regra ser testada e igual em toda tela. Quem usa
// (Folha, cartões de tarefa, listas) cuida só de mexer o elemento.

/** Arrastar a folha para baixo fecha quando passou de 30% da altura, ou foi um gesto rápido. */
export function deveFecharFolha(dy: number, alturaFolha: number, msDecorridos: number): boolean {
  if (dy <= 0) return false
  const velocidade = dy / Math.max(1, msDecorridos) // px/ms
  return dy > Math.max(80, alturaFolha * 0.3) || (dy > 30 && velocidade > 0.6)
}

export type Direcao = 'horizontal' | 'vertical' | null

/**
 * O eixo do gesto, decidido no começo: só vira "horizontal" quando o dedo andou mais para o
 * lado do que para baixo. Sem isso, deslizar um cartão brigaria com a rolagem da lista.
 */
export function eixoDoGesto(dx: number, dy: number, limiar = 10): Direcao {
  const ax = Math.abs(dx), ay = Math.abs(dy)
  if (ax < limiar && ay < limiar) return null
  return ax > ay * 1.3 ? 'horizontal' : 'vertical'
}

export type AcaoDeslize = 'esquerda' | 'direita' | null

/** Deslizar o cartão: passou do limite para um lado = a ação daquele lado. */
export function acaoDoDeslize(dx: number, larguraCartao: number, limiteFracao = 0.35): AcaoDeslize {
  const limite = Math.max(72, larguraCartao * limiteFracao)
  if (dx >= limite) return 'direita'
  if (dx <= -limite) return 'esquerda'
  return null
}

/** Quanto o cartão anda na tela: acompanha o dedo, mas com resistência depois do limite. */
export function deslocamentoComResistencia(dx: number, limite: number): number {
  const ax = Math.abs(dx)
  if (ax <= limite) return dx
  return Math.sign(dx) * (limite + (ax - limite) * 0.35)
}

/** Puxar para atualizar: dispara quando puxou 70px (já com a resistência aplicada) do topo. */
export const LIMITE_PUXAR = 70
export const puxadaVisivel = (dy: number): number => (dy <= 0 ? 0 : Math.min(110, dy * 0.5))
export const devePuxarAtualizar = (dy: number): boolean => puxadaVisivel(dy) >= LIMITE_PUXAR

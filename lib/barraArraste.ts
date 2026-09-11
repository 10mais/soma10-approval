// BARRA DE ARRASTAR HORIZONTAL — com cursor PRÓPRIO, não o do navegador.
//
// Por que existe: o funil do CRM é mais largo que a tela e a barra nativa do
// quadro fica no RODAPÉ de colunas de altura cheia — fora do alcance sem rolar
// a página inteira. A cópia fina no topo resolvia o alcance, mas continuava
// sendo um scrollbar NATIVO: no Windows 11 (e em qualquer sistema com barras
// sobrepostas) o cursor só aparece enquanto se rola, então a barra parecia
// VAZIA — nada para pegar e arrastar (queixa do dono, 11/09: "sumiu a barra
// para arrastar para o lado... é o cursor").
//
// A partir daqui o cursor é um elemento nosso: existe sempre que há o que
// rolar, tem largura mínima para caber o dedo e não some quando o mouse para.
// A matemática mora aqui, pura, porque ela é a parte com regra de verdade —
// e porque já são dois quadros que podem querer a mesma barra (funil do CRM e
// esteira de Processos), como aconteceu com lib/autoScrollKanban.

/** Menor cursor aceitável (px). Abaixo disso não dá para pegar — nem com o dedo. */
export const LARGURA_MINIMA = 44

export type MetricasBarra = {
  /** Há o que rolar? Sem transbordo a barra não deve aparecer. */
  visivel: boolean
  /** Largura do cursor, em px. */
  largura: number
  /** Distância do cursor até a esquerda do trilho, em px. */
  esquerda: number
}

type Medidas = {
  /** Largura TOTAL do conteúdo do quadro (scrollWidth). */
  scrollWidth: number
  /** Largura VISÍVEL do quadro (clientWidth). */
  clientWidth: number
  /** Largura do trilho onde o cursor anda (normalmente = clientWidth). */
  trilho: number
}

function limitar(v: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(max, Math.max(min, v))
}

/** Tamanho e posição do cursor a partir do estado atual do quadro. */
export function metricasBarra(a: Medidas & { scrollLeft: number }): MetricasBarra {
  const { scrollWidth, clientWidth, trilho, scrollLeft } = a
  const transbordo = scrollWidth - clientWidth
  if (trilho <= 0 || clientWidth <= 0 || transbordo <= 1) {
    return { visivel: false, largura: 0, esquerda: 0 }
  }
  const proporcional = Math.round(trilho * (clientWidth / scrollWidth))
  const largura = limitar(proporcional, Math.min(LARGURA_MINIMA, trilho), trilho)
  const curso = trilho - largura
  const esquerda = curso <= 0 ? 0 : limitar(Math.round((scrollLeft / transbordo) * curso), 0, curso)
  return { visivel: true, largura, esquerda }
}

/**
 * Caminho inverso: o cursor foi parar em `esquerda` — para onde o quadro rola?
 * Fora do trilho não é erro: arrastar além da ponta simplesmente encosta no fim.
 */
export function scrollDoCursor(esquerda: number, a: Medidas & { largura: number }): number {
  const { scrollWidth, clientWidth, trilho, largura } = a
  const transbordo = scrollWidth - clientWidth
  const curso = trilho - largura
  if (transbordo <= 0 || curso <= 0) return 0
  return limitar(Math.round((esquerda / curso) * transbordo), 0, transbordo)
}

/**
 * Clique no TRILHO (fora do cursor) = levar o cursor para lá, centrado no
 * ponto clicado. `px` é a distância do clique até a esquerda do trilho.
 */
export function esquerdaCentradaEm(px: number, a: { trilho: number; largura: number }): number {
  return limitar(Math.round(px - a.largura / 2), 0, Math.max(0, a.trilho - a.largura))
}

/** O ponto clicado caiu em cima do cursor? Se sim, arrasta-se sem saltar. */
export function pegouOCursor(px: number, m: { esquerda: number; largura: number }): boolean {
  return px >= m.esquerda && px <= m.esquerda + m.largura
}

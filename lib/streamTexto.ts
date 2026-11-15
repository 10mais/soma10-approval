// LER A IA ENQUANTO ELA ESCREVE.
//
// O assistente já fazia isso desde sempre: a rota encaminha cada pedaço de texto
// do modelo e a tela mostra na hora. As outras telas de IA (documento de marca,
// briefing) esperavam a resposta inteira e mostravam "Gerando…" parado por
// dezenas de segundos — a mesma queixa do botão Aprovar em outubro: a pessoa
// clica e parece que nada aconteceu.
//
// Esta lib é o protocolo dessa conversa, em um lugar só e com teste, porque o
// combinado estava escrito à mão dentro de um componente e ia divergir na
// segunda tela que copiasse.
//
// O FLUXO é texto puro com dois caracteres de controle:
//   texto do modelo … ␞ {"ok":true,…}     → tudo depois de ␞ é o resultado final
//   texto descartado … ␜ texto bom        → ␜ manda esquecer o que veio antes
//
// ␜ existe por causa do `pause_turn`: quando a busca na web estoura o limite de
// iterações, a rota recomeça o turno e o texto novo SUBSTITUI o anterior. Sem
// esse sinal a tela mostraria o documento duplicado.
//
// Os dois caracteres são de controle Unicode (U+241E e U+241C), não aparecem em
// texto escrito por gente nem pelo modelo.

export const SENTINELA = '␞'
export const LIMPAR = '␜'

/**
 * O que a tela deve exibir agora, a partir de tudo que chegou até aqui.
 * Corta no ␞ (dali para frente é dado, não texto) e obedece ao último ␜.
 * Tolera sentinela partida no meio de um pedaço — é só esperar o próximo.
 */
export function textoVisivel(acumulado: string): string {
  const bruto = String(acumulado ?? '')
  const corte = bruto.indexOf(SENTINELA)
  const texto = corte >= 0 ? bruto.slice(0, corte) : bruto
  const reinicio = texto.lastIndexOf(LIMPAR)
  const util = reinicio >= 0 ? texto.slice(reinicio + 1) : texto
  // Corta o branco do COMEÇO: o modelo costuma abrir com quebra de linha, e a
  // tela mostra o texto com `pre-wrap` — viraria um buraco no topo da caixa.
  // Só o começo: espaço no fim é o que separa a palavra atual da próxima, e
  // cortar faria o texto "grudar" a cada pedaço que chega.
  return util.replace(/^\s+/, '')
}

/**
 * O resultado final, que vem depois do ␞ — o documento salvo, o id, a data.
 * Devolve null enquanto não chegou ou se vier quebrado: meio JSON no meio do
 * fluxo é situação normal, não é erro para mostrar na cara da pessoa.
 */
export function dadosDaSentinela<T = any>(acumulado: string): T | null {
  const bruto = String(acumulado ?? '')
  const corte = bruto.indexOf(SENTINELA)
  if (corte < 0) return null
  try {
    const dados = JSON.parse(bruto.slice(corte + 1))
    return dados && typeof dados === 'object' ? (dados as T) : null
  } catch {
    return null
  }
}

/**
 * Lê o corpo da resposta até o fim, avisando a tela a cada pedaço.
 * Devolve o texto final e o dado da sentinela.
 *
 * `aoTexto` recebe o texto JÁ PRONTO para exibir (acumulado, sem os controles),
 * então a tela só precisa guardar o que chegou.
 */
export async function lerStreamDeTexto<T = any>(
  corpo: ReadableStream<Uint8Array> | null | undefined,
  aoTexto?: (texto: string) => void,
): Promise<{ texto: string; dados: T | null }> {
  if (!corpo) return { texto: '', dados: null }
  const leitor = corpo.getReader()
  const decoder = new TextDecoder()
  let acumulado = ''
  try {
    for (;;) {
      const { done, value } = await leitor.read()
      if (done) break
      // `stream: true` segura o caractere partido entre dois pedaços (acento,
      // emoji e os próprios controles ocupam mais de um byte em UTF-8).
      acumulado += decoder.decode(value, { stream: true })
      if (aoTexto) aoTexto(textoVisivel(acumulado))
    }
    acumulado += decoder.decode()
  } finally {
    try { leitor.releaseLock() } catch { /* fluxo já encerrado */ }
  }
  if (aoTexto) aoTexto(textoVisivel(acumulado))
  return { texto: textoVisivel(acumulado), dados: dadosDaSentinela<T>(acumulado) }
}

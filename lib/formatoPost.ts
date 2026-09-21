// FORMATO da pauta/post — uma lista só para o sistema inteiro.
//
// Dono, 09/09/2026: no Studio a peça estava marcada como CARROSSEL e o link do cliente
// mostrava STORY. A causa: o card do link decidia o rótulo com um ternário binário
// (`formato === 'reel' ? 'Reel' : 'Story'`), escrito quando só existiam feed, reel e story.
// Carrossel e material gráfico nasceram depois e caíram no "senão" — viraram Story.
//
// Cada tela tinha a sua listinha de rótulos (o link tinha DUAS, diferentes entre si). Agora
// a lista é esta, e o Studio é a fonte da verdade do que foi escolhido: o link mostra o que
// está gravado, sem tradução própria. Formato desconhecido devolve o próprio valor
// capitalizado, nunca um chute.
//
// 20/09/2026: o rótulo ganhou idioma. A CHAVE gravada no post (`feed`, `carrossel`…) não
// muda em idioma nenhum — só o texto que aparece na tela.
import { t, IDIOMA_PADRAO, type Idioma } from './i18n'

export type FormatoDef = { chave: string; rotulo: string; cor: string }

export const FORMATOS: FormatoDef[] = [
  { chave: 'feed', rotulo: 'formato.feed', cor: 'var(--v2-info)' },
  { chave: 'reel', rotulo: 'formato.reel', cor: 'var(--v2-hot)' },
  { chave: 'carrossel', rotulo: 'formato.carrossel', cor: '#0891b2' },
  { chave: 'story', rotulo: 'formato.story', cor: '#7c3aed' },
  { chave: 'grafico', rotulo: 'formato.grafico', cor: '#059669' },
]

const POR_CHAVE = new Map(FORMATOS.map(f => [f.chave, f]))

/** Rótulo do formato no idioma pedido. Desconhecido vira o próprio valor com a inicial maiúscula. */
export function labelFormato(formato?: string, idioma: Idioma = IDIOMA_PADRAO): string {
  const f = (formato || '').trim().toLowerCase()
  if (!f) return t('formato.feed', idioma)
  const def = POR_CHAVE.get(f)
  if (def) return t(def.rotulo, idioma)
  return f.charAt(0).toUpperCase() + f.slice(1)
}

export function corFormato(formato?: string): string {
  return POR_CHAVE.get((formato || '').trim().toLowerCase())?.cor || 'var(--v2-ink3)'
}

/** O selo aparece quando o formato NÃO é o padrão (feed) — o resto merece destaque. */
export function seloFormato(formato?: string, idioma: Idioma = IDIOMA_PADRAO): string | null {
  const f = (formato || '').trim().toLowerCase()
  if (!f || f === 'feed') return null
  return labelFormato(f, idioma)
}

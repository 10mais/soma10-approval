// ORDEM DOS MATERIAIS NA APROVAÇÃO — dono, 28/09/2026: "Organize os criativos que estão no
// link de aprovação por ordem de DATA. Primeiro os com postagens mais próximas."
//
// Antes, o link público ordenava pela data de CRIAÇÃO do material e o portal do cliente nem
// ordenava. O que importa para o cliente é o que vai ao ar primeiro. Regra única para o link
// público e o portal (rótulo/regra repetida em cada tela diverge):
//   1. com data de postagem, da mais próxima para a mais distante — a data que JÁ PASSOU
//      (material atrasado, ainda sem aprovação) vem antes de todas: é o mais urgente;
//   2. sem data, no fim, pela ordem em que foram criados;
//   3. empate na mesma data: ordem de criação.

type ItemOrdenavel = { dataAgendada?: string | null; criadoEm?: string | null }

const tempo = (s?: string | null) => {
  const t = s ? new Date(s).getTime() : NaN
  return isNaN(t) ? null : t
}

export function compararPorDataDePostagem(a: ItemOrdenavel, b: ItemOrdenavel): number {
  const ta = tempo(a.dataAgendada)
  const tb = tempo(b.dataAgendada)
  if (ta !== null && tb === null) return -1
  if (ta === null && tb !== null) return 1
  if (ta !== null && tb !== null && ta !== tb) return ta - tb
  return (tempo(a.criadoEm) ?? 0) - (tempo(b.criadoEm) ?? 0)
}

/** Devolve uma cópia ordenada (não mexe na lista original). */
export function ordenarPorDataDePostagem<T extends ItemOrdenavel>(lista: T[]): T[] {
  return [...lista].sort(compararPorDataDePostagem)
}

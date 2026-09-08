// ORDEM MANUAL das linhas do Gantt (dono, 08/09/2026: "me deixe mexer/mover de cima
// para baixo qualquer etapa do playbook; ali o setembro está abaixo do outubro, quero
// inverter isso manualmente").
//
// A ordem automática é por duração (lib/progressoGantt). Quando a pessoa arrasta uma
// linha para cima ou para baixo, a MÃO passa a mandar naquele bloco:
//   - etapas: a ordem é a do próprio array `marco.subetapas` e o marco marca
//     `ordemEtapasManual`;
//   - marcos: cada um ganha `ordem` (0, 1, 2…) e o cliente inteiro passa a seguir isso.
// "Ordenar por duração" limpa as duas coisas e devolve o automático.

// Tira o item da posição `de` e o coloca na posição `para` (as demais escorregam).
export function reordenar<T>(lista: T[], de: number, para: number): T[] {
  const n = lista.length
  if (de < 0 || de >= n) return lista
  const destino = Math.max(0, Math.min(n - 1, para))
  if (destino === de) return lista
  const copia = [...lista]
  const [item] = copia.splice(de, 1)
  copia.splice(destino, 0, item)
  return copia
}

// Para onde a linha `de` vai depois de arrastar `dy` pixels, respeitando alturas
// diferentes por linha (marco com etapas abertas é mais alto que um marco sozinho).
// Decide pelo CENTRO da linha arrastada: a faixa que contiver o centro é o destino.
export function novaPosicao(alturas: number[], de: number, dy: number): number {
  const n = alturas.length
  if (de < 0 || de >= n || !dy) return de
  const tops: number[] = []
  let acc = 0
  for (const h of alturas) { tops.push(acc); acc += h }
  const centro = tops[de] + alturas[de] / 2 + dy
  for (let i = 0; i < n; i++) {
    if (centro < tops[i] + alturas[i]) return i
  }
  return n - 1
}

// Ordem dos marcos: manda a `ordem` gravada quando existe (mesmo em um só marco);
// senão, vale a ordenação automática que vier em `porDuracao`.
export function ordenarMarcos<T extends { ordem?: number }>(marcos: T[], porDuracao: (l: T[]) => T[]): T[] {
  const manual = marcos.some(m => typeof m.ordem === 'number' && Number.isFinite(m.ordem))
  if (!manual) return porDuracao(marcos)
  return marcos
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const oa = typeof a.m.ordem === 'number' && Number.isFinite(a.m.ordem) ? a.m.ordem : Number.MAX_SAFE_INTEGER
      const ob = typeof b.m.ordem === 'number' && Number.isFinite(b.m.ordem) ? b.m.ordem : Number.MAX_SAFE_INTEGER
      return oa - ob || a.i - b.i
    })
    .map(x => x.m)
}

// PLAYBOOK em LISTA e em GANTT sobre os MESMOS dados (dono, 14/09/2026: "2 visualizações,
// 100% integradas; o que lançar para um fica visível no outro; quando lanço, não aparece").
//
// Duas regras puras que os dois modos compartilham:
//   1. foraDaJanela — o Gantt só mostra o que cabe na janela de tempo; antes, um marco
//      fora dela virava uma lasca de 2% na borda (invisível) e parecia "não ter sido
//      lançado". Agora o Gantt sabe que está fora e mostra um aviso na borda; a Lista
//      mostra tudo sempre.
//   2. etapasComTitulo — etapa sem título era DESCARTADA ao salvar (a API exige título).
//      Quem lança uma etapa só com prazo perdia a etapa em silêncio. Título vazio vira
//      "Etapa N" e nada some.

const MS_DIA = 24 * 60 * 60 * 1000
const ms = (iso?: string) => { const n = iso ? new Date(iso).getTime() : NaN; return Number.isFinite(n) ? n : NaN }

export type ForaDaJanela = 'antes' | 'depois' | null

/** O período [ini, fim] do item está inteiramente antes ou depois da janela [janelaIni, janelaFim]? */
export function foraDaJanela(ini: string, fim: string | undefined, janelaIni: number, janelaFim: number): ForaDaJanela {
  const a = ms(ini)
  if (!Number.isFinite(a)) return null
  const bRaw = ms(fim)
  const b = Number.isFinite(bRaw) ? Math.max(a, bRaw) : a
  if (b < janelaIni) return 'antes'
  if (a > janelaFim) return 'depois'
  return null
}

/** Onde a janela deve começar para o item aparecer com folga, mantendo a largura (dias) atual. */
export function inicioParaMostrar(ini: string, dias: number): number {
  const a = ms(ini)
  const base = Number.isFinite(a) ? a : Date.now()
  const folga = Math.max(1, Math.round(dias * 0.1))
  const d = new Date(base - folga * MS_DIA); d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Título vazio vira "Etapa N" (posição na lista) — nunca some ao salvar. */
export function etapasComTitulo<T extends { titulo: string }>(subs: T[]): T[] {
  return subs.map((s, i) => ({ ...s, titulo: (s.titulo || '').trim() || `Etapa ${i + 1}` }))
}

/** Rótulo curto de período para a Lista ("08/09 – 20/09", "08/09", "sem prazo"). */
export function rotuloPeriodoLista(ini?: string, fim?: string): string {
  const f = (iso: string) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '' }
  const a = ini ? f(ini) : '', b = fim ? f(fim) : ''
  if (a && b && a !== b) return `${a} – ${b}`
  return a || b || 'sem prazo'
}

// GANTT do Playbook — regras puras de ARRASTAR barras (dono, 08/09/2026: "ajustar
// prazos arrastando a barra para a direita ou esquerda, ajustando automaticamente
// os prazos definidos") e do desenho de um Gantt completo (meses no eixo, fins de
// semana, "ajustar à visão").
//
// Tudo em DIAS INTEIROS: o arraste em pixels vira dias (arredondado) e as datas
// andam sem mexer na hora. Formatos preservados: o marco grava ISO completo
// (dataInicio/dataFim) e a etapa grava YYYY-MM-DD — cada uma volta como veio.
//
// Regras de família (como num Gantt de verdade):
//   - mover o MARCO leva as etapas junto (mesmo deslocamento);
//   - puxar a ponta do marco não mexe nas etapas;
//   - etapa arrastada para ANTES do início do marco estende o marco (o pai
//     envolve os filhos; o fim já é derivado por fimEfetivoDoMarco);
//   - fim nunca fica antes do início (a ponta trava na outra).

import type { SubEtapa } from './subetapas'

export const MS_DIA = 24 * 60 * 60 * 1000
const RE_YMD = /^\d{4}-\d{2}-\d{2}$/

export type TipoArraste = 'mover' | 'inicio' | 'fim'
export type Arraste = { tipo: TipoArraste; subId?: string; dias: number }
export type MarcoDatas = { dataInicio: string; dataFim?: string; subetapas?: SubEtapa[] }
export type PatchArraste = { dataInicio?: string; dataFim?: string; subetapas?: SubEtapa[] }

// Desloca uma data em N dias preservando o formato (YYYY-MM-DD ou ISO completo).
export function deslocarData(data: string | undefined, dias: number): string | undefined {
  if (!data) return undefined
  if (!dias) return data
  if (RE_YMD.test(data)) {
    const d = new Date(data + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + dias)
    return d.toISOString().slice(0, 10)
  }
  const t = new Date(data).getTime()
  if (!Number.isFinite(t)) return data
  return new Date(t + dias * MS_DIA).toISOString()
}

const ms = (d: string) => new Date(RE_YMD.test(d) ? d + 'T00:00:00Z' : d).getTime()
const ymd = (d: string) => (RE_YMD.test(d) ? d : new Date(d).toISOString().slice(0, 10))
// Escreve `data` (qualquer formato) no formato do `modelo`.
const noFormatoDe = (modelo: string, data: string) => (RE_YMD.test(modelo) ? ymd(data) : new Date(ymd(data) + 'T00:00:00Z').toISOString())

export function diasEntre(a: string, b: string): number {
  return Math.round((ms(b) - ms(a)) / MS_DIA)
}

export function pxParaDias(dx: number, pxPorDia: number): number {
  return pxPorDia > 0 ? Math.round(dx / pxPorDia) : 0
}

// Datas efetivas de uma etapa (herda as do marco quando não tem as próprias).
export function periodoDaEtapa(marco: MarcoDatas, se: SubEtapa): { ini: string; fim: string } {
  const ini = se.dataInicio || ymd(marco.dataInicio)
  const fim = se.dataFim || se.dataInicio || (marco.dataFim ? ymd(marco.dataFim) : ymd(marco.dataInicio))
  return { ini, fim }
}

// Devolve o PATCH a gravar no marco (só o que mudou), ou null se nada muda.
export function aplicarArraste(marco: MarcoDatas, a: Arraste): PatchArraste | null {
  if (!a.dias || !Number.isFinite(a.dias)) return null
  const d = Math.trunc(a.dias)

  if (a.subId) {
    const subs = marco.subetapas || []
    const i = subs.findIndex(s => s.id === a.subId)
    if (i < 0) return null
    const se = subs[i]
    const p = periodoDaEtapa(marco, se)
    let ini = p.ini, fim = p.fim
    if (a.tipo === 'mover') { ini = deslocarData(ini, d)!; fim = deslocarData(fim, d)! }
    else if (a.tipo === 'inicio') { ini = deslocarData(ini, d)!; if (ms(ini) > ms(fim)) ini = fim }
    else { fim = deslocarData(fim, d)!; if (ms(fim) < ms(ini)) fim = ini }
    if (ini === p.ini && fim === p.fim) return null
    const novas = subs.map((s, j) => (j === i ? { ...s, dataInicio: ini, dataFim: fim } : s))
    const patch: PatchArraste = { subetapas: novas }
    // O pai envolve o filho: etapa começando antes do marco puxa o início do marco.
    if (ms(ini) < ms(marco.dataInicio)) patch.dataInicio = noFormatoDe(marco.dataInicio, ini)
    return patch
  }

  if (a.tipo === 'mover') {
    const patch: PatchArraste = { dataInicio: deslocarData(marco.dataInicio, d)! }
    if (marco.dataFim) patch.dataFim = deslocarData(marco.dataFim, d)!
    const subs = marco.subetapas || []
    if (subs.some(s => s.dataInicio || s.dataFim)) {
      patch.subetapas = subs.map(s => ({ ...s, ...(s.dataInicio ? { dataInicio: deslocarData(s.dataInicio, d)! } : {}), ...(s.dataFim ? { dataFim: deslocarData(s.dataFim, d)! } : {}) }))
    }
    return patch
  }
  if (a.tipo === 'inicio') {
    let ini = deslocarData(marco.dataInicio, d)!
    if (marco.dataFim && ms(ini) > ms(marco.dataFim)) ini = noFormatoDe(marco.dataInicio, marco.dataFim)
    return ini === marco.dataInicio ? null : { dataInicio: ini }
  }
  // fim: sem dataFim, a barra "de 3 dias" ganha um fim de verdade a partir do início.
  const base = marco.dataFim || marco.dataInicio
  let fim = deslocarData(base, d)!
  if (ms(fim) < ms(marco.dataInicio)) fim = noFormatoDe(base, marco.dataInicio)
  return fim === marco.dataFim ? null : { dataFim: fim }
}

export function fmtCurta(data: string): string {
  const d = new Date(RE_YMD.test(data) ? data + 'T00:00:00Z' : data)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
export function rotuloPeriodo(ini: string, fim?: string): string {
  return fim && ymd(fim) !== ymd(ini) ? `${fmtCurta(ini)} – ${fmtCurta(fim)}` : fmtCurta(ini)
}

// "Ajustar à visão": janela que mostra todos os marcos (e etapas) do cliente com folga.
export function janelaParaCaber(marcos: MarcoDatas[], hoje: number = Date.now()): { inicioMs: number; dias: number } {
  let a = Infinity, b = -Infinity
  for (const m of marcos) {
    const i = ms(m.dataInicio); if (Number.isFinite(i)) a = Math.min(a, i)
    const fins = [m.dataFim, ...(m.subetapas || []).map(s => s.dataFim || s.dataInicio)].filter((x): x is string => !!x).map(ms)
    const inis = (m.subetapas || []).map(s => s.dataInicio).filter((x): x is string => !!x).map(ms)
    for (const x of [...fins, i]) if (Number.isFinite(x)) b = Math.max(b, x)
    for (const x of inis) if (Number.isFinite(x)) a = Math.min(a, x)
  }
  if (!Number.isFinite(a) || !Number.isFinite(b)) { const h = new Date(hoje); h.setHours(0, 0, 0, 0); return { inicioMs: h.getTime() - 7 * MS_DIA, dias: 30 } }
  const span = Math.max(1, Math.round((b - a) / MS_DIA))
  const folga = Math.max(2, Math.round(span * 0.08))
  return { inicioMs: a - folga * MS_DIA, dias: Math.max(7, Math.min(730, span + folga * 2)) }
}

// Eixo superior: um rótulo por mês dentro da janela ("set/2026"), na posição do dia 1
// (ou no início da janela, para o mês que já começou).
export function rotulosMeses(inicioMs: number, dias: number): { pct: number; txt: string }[] {
  const out: { pct: number; txt: string }[] = []
  const fimMs = inicioMs + dias * MS_DIA
  const d = new Date(inicioMs)
  let cursor = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  while (cursor < fimMs) {
    const dt = new Date(cursor)
    const pct = Math.max(0, ((cursor - inicioMs) / (dias * MS_DIA)) * 100)
    out.push({ pct, txt: `${dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${dt.getFullYear()}` })
    cursor = new Date(dt.getFullYear(), dt.getMonth() + 1, 1).getTime()
  }
  return out
}

// Faixas de fim de semana (sáb+dom) em % da janela; só vale a pena até ~3 meses.
export function colunasFimDeSemana(inicioMs: number, dias: number): { pct: number; larguraPct: number }[] {
  if (dias > 92) return []
  const out: { pct: number; larguraPct: number }[] = []
  for (let i = 0; i < dias; i++) {
    const dt = new Date(inicioMs + i * MS_DIA)
    if (dt.getDay() !== 6) continue
    out.push({ pct: (i / dias) * 100, larguraPct: (Math.min(2, dias - i) / dias) * 100 })
  }
  return out
}

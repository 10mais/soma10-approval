// SUB-ETAPAS de um marco do Playbook (dono, 07/09/2026): "dentro de cada marco,
// abrir como se fossem sub-marcos ou etapas desse marco, para que também conte
// no prazo detalhado e nos KPIs — tudo dentro do mesmo marco".
//
// Cada sub-etapa tem prazo próprio, status e um KPI opcional (nome + meta +
// atual). O marco não ganha filhos soltos no banco: as sub-etapas vivem DENTRO
// do marco (`marco.subetapas`), então nada muda em índices, Gantt por cliente,
// bola da vez ou modelos. O que muda é o que se deriva delas: progresso,
// atraso, prazo efetivo e KPIs — tudo calculado aqui, testado, sem gravar.

export type SubEtapaStatus = 'pendente' | 'em_andamento' | 'concluido'
export type SubEtapa = {
  id: string
  titulo: string
  status: SubEtapaStatus
  dataInicio?: string // YYYY-MM-DD
  dataFim?: string // YYYY-MM-DD
  kpi?: string // nome do indicador (ex.: "Seguidores", "Leads")
  kpiMeta?: number
  kpiAtual?: number
  responsavelNome?: string
  cor?: string // #rrggbb; ausente = cor do marco
}

export const SUBETAPA_STATUS: { key: SubEtapaStatus; label: string }[] = [
  { key: 'pendente', label: 'Pendente' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'concluido', label: 'Concluída' },
]
const STATUS_OK = new Set<string>(SUBETAPA_STATUS.map(s => s.key))
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

function num(v: unknown): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}
function data(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.slice(0, 10)
  return DATA_RE.test(s) ? s : undefined
}

// Aceita o que vier da tela/banco e devolve sub-etapas válidas: título
// obrigatório, status conhecido, datas YYYY-MM-DD, números finitos. Sem id,
// gera um estável a partir da posição (a tela cria com uuid; aqui é só rede).
export function normalizarSubetapas(bruto: unknown): SubEtapa[] {
  if (!Array.isArray(bruto)) return []
  const saida: SubEtapa[] = []
  bruto.forEach((e, i) => {
    const titulo = typeof e?.titulo === 'string' ? e.titulo.trim() : ''
    if (!titulo) return
    const s: SubEtapa = {
      id: typeof e?.id === 'string' && e.id.trim() ? e.id.trim().slice(0, 64) : `se-${i + 1}`,
      titulo: titulo.slice(0, 160),
      status: STATUS_OK.has(e?.status) ? e.status : 'pendente',
    }
    const di = data(e?.dataInicio); if (di) s.dataInicio = di
    const df = data(e?.dataFim); if (df) s.dataFim = df
    const kpi = typeof e?.kpi === 'string' ? e.kpi.trim().slice(0, 80) : ''
    if (kpi) s.kpi = kpi
    const meta = num(e?.kpiMeta); if (meta !== undefined) s.kpiMeta = meta
    const atual = num(e?.kpiAtual); if (atual !== undefined) s.kpiAtual = atual
    const resp = typeof e?.responsavelNome === 'string' ? e.responsavelNome.trim().slice(0, 80) : ''
    if (resp) s.responsavelNome = resp
    if (typeof e?.cor === 'string' && /^#[0-9a-fA-F]{6}$/.test(e.cor)) s.cor = e.cor.toLowerCase()
    saida.push(s)
  })
  return saida
}

export function kpiPct(s: SubEtapa): number | null {
  if (!s.kpiMeta || s.kpiMeta <= 0) return null
  return Math.max(0, Math.min(100, Math.round(((s.kpiAtual || 0) / s.kpiMeta) * 100)))
}

export type ProgressoMarco = {
  total: number; concluidas: number; pct: number
  atrasadas: SubEtapa[] // prazo passou e não concluiu
  proxima?: SubEtapa // primeira não concluída, em ordem
  kpis: { total: number; atingidos: number }
  fimEfetivo?: string // YYYY-MM-DD — o maior prazo entre as sub-etapas (o "prazo detalhado")
}

const hojeISO = (agora: number) => new Date(agora).toISOString().slice(0, 10)

export function progressoMarco(subs: SubEtapa[] | undefined, agora: number = Date.now()): ProgressoMarco {
  const lista = subs || []
  const hoje = hojeISO(agora)
  const concluidas = lista.filter(s => s.status === 'concluido').length
  const atrasadas = lista.filter(s => s.status !== 'concluido' && !!s.dataFim && s.dataFim < hoje)
  const comKpi = lista.filter(s => s.kpiMeta && s.kpiMeta > 0)
  const fins = lista.map(s => s.dataFim).filter((d): d is string => !!d).sort()
  return {
    total: lista.length, concluidas,
    pct: lista.length ? Math.round((concluidas / lista.length) * 100) : 0,
    atrasadas,
    proxima: lista.find(s => s.status !== 'concluido'),
    kpis: { total: comKpi.length, atingidos: comKpi.filter(s => (s.kpiAtual || 0) >= (s.kpiMeta || 0)).length },
    fimEfetivo: fins.length ? fins[fins.length - 1] : undefined,
  }
}

// Prazo efetivo do marco: o próprio dataFim OU o maior prazo das sub-etapas, o
// que for mais tarde. Uma sub-etapa que termina depois do marco estende o marco.
export function fimEfetivoDoMarco(marco: { dataFim?: string }, subs: SubEtapa[] | undefined): string | undefined {
  const p = progressoMarco(subs)
  const fimMarco = marco.dataFim ? marco.dataFim.slice(0, 10) : undefined
  if (!fimMarco) return p.fimEfetivo
  if (!p.fimEfetivo) return fimMarco
  return p.fimEfetivo > fimMarco ? p.fimEfetivo : fimMarco
}

// Status sugerido para o marco a partir das sub-etapas (a tela sugere; ninguém grava sem querer):
// todas concluídas -> concluido; alguma atrasada -> atrasado; alguma começou -> em_andamento; senão mantém.
export function statusSugerido(atual: string, subs: SubEtapa[] | undefined, agora: number = Date.now()): string {
  const p = progressoMarco(subs, agora)
  if (p.total === 0) return atual
  if (atual === 'cancelado') return atual
  if (p.concluidas === p.total) return 'concluido'
  if (p.atrasadas.length) return 'atrasado'
  if (p.concluidas > 0 || (subs || []).some(s => s.status === 'em_andamento')) return 'em_andamento'
  return atual === 'concluido' ? 'em_andamento' : atual
}

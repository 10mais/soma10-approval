// LINHA DO TEMPO do Plano de entregas (Mudança 3, dono 21/11/2026: "abro o plano de entregas,
// escolho cliente e período, e entendo em poucos segundos tudo o que foi, está sendo e será
// entregue"). Contas puras: status de cada entrega, janela do período, posição na faixa,
// contadores e o resumo de todos os clientes. As telas (RoadmapEntregas, RoadmapConsolidado)
// só desenham.
//
// "Entrega" = um marco do Plano de entregas. As semanas do plano de ação (marco tipo 'semana',
// lib/planoAcao) viram UMA faixa só, "Plano por semanas", e cada entrega da semana conta nos
// números — 15 faixas de semana encheriam a tela sem dizer mais.
//
// Status é calculado, nunca o digitado: concluído / atrasado / em andamento / a fazer.

import { ehData, diaDoInstante, diasEntre, somarDias } from './datas'
import { progressoMarco, type SubEtapa } from './subetapas'

export type StatusEntrega = 'concluido' | 'atrasado' | 'andamento' | 'a_fazer'
export const ROTULO_STATUS: Record<StatusEntrega, string> = { concluido: 'Entregue', andamento: 'Em andamento', atrasado: 'Atrasado', a_fazer: 'A seguir' }

export type MarcoRoad = {
  id: string; clienteId: string; clienteNome?: string; titulo: string; status?: string
  dataInicio: string; dataFim?: string; tipo?: string; foco?: string; recesso?: boolean
  subetapas?: SubEtapa[]
}

export const dia = (v?: string): string => (v ? diaDoInstante(v) : '')

/** Fim efetivo: o maior entre o fim do marco e o das etapas. */
function fimDe(m: MarcoRoad): string {
  const fins = [dia(m.dataFim), ...(m.subetapas || []).map(s => s.dataFim || '')].filter(ehData).sort()
  return fins[fins.length - 1] || dia(m.dataInicio)
}

/** Status de uma etapa: concluída, atrasada (prazo passou), em andamento ou a fazer. */
export function statusDaEtapa(s: SubEtapa, hoje: string, recesso = false): StatusEntrega {
  if (s.status === 'concluido') return 'concluido'
  if (!recesso && ehData(s.dataFim) && s.dataFim! < hoje) return 'atrasado'
  if (s.status === 'em_andamento' || (ehData(s.dataInicio) && s.dataInicio! <= hoje)) return 'andamento'
  return 'a_fazer'
}

/** Status de uma entrega (marco), pelas etapas e pelas datas. */
export function statusDaEntrega(m: MarcoRoad, hoje: string): StatusEntrega {
  const subs = m.subetapas || []
  if (m.status === 'concluido' && !subs.some(s => s.status !== 'concluido')) return 'concluido'
  if (subs.length) {
    const st = subs.map(s => statusDaEtapa(s, hoje, m.recesso))
    if (st.every(x => x === 'concluido')) return 'concluido'
    if (st.includes('atrasado')) return 'atrasado'
  }
  const ini = dia(m.dataInicio), fim = fimDe(m)
  if (!m.recesso && ehData(fim) && fim < hoje) return 'atrasado'
  if (ehData(ini) && ini <= hoje) return 'andamento'
  if (subs.some(s => s.status !== 'pendente')) return 'andamento'
  return 'a_fazer'
}

// ---------------------------------------------------------------- período
export type Periodo = 'mes' | 'trimestre' | 'semestre' | 'ano'
export const PERIODOS_ROAD: { key: Periodo; label: string; meses: number }[] = [
  { key: 'mes', label: 'Mês', meses: 1 }, { key: 'trimestre', label: 'Trimestre', meses: 3 },
  { key: 'semestre', label: 'Semestre', meses: 6 }, { key: 'ano', label: 'Ano', meses: 12 },
]
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_LONGO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const pad = (n: number) => String(n).padStart(2, '0')
const ultimoDia = (a: number, m: number) => new Date(a, m + 1, 0).getDate()

export type Janela = { inicio: string; fim: string; dias: number; rotulo: string }

/** Janela do período que contém `ref`, alinhada ao calendário (trimestre = jan-mar, abr-jun…). */
export function janelaDoPeriodo(periodo: Periodo, ref: string): Janela {
  const meses = PERIODOS_ROAD.find(p => p.key === periodo)!.meses
  const ano = Number(ref.slice(0, 4)), mes = Number(ref.slice(5, 7)) - 1
  const m0 = Math.floor(mes / meses) * meses
  const fimMes = m0 + meses - 1
  const inicio = `${ano}-${pad(m0 + 1)}-01`
  const fim = `${ano}-${pad(fimMes + 1)}-${pad(ultimoDia(ano, fimMes))}`
  const rotulo = periodo === 'mes' ? `${MESES_LONGO[m0]} ${ano}`
    : periodo === 'ano' ? String(ano)
    : periodo === 'trimestre' ? `${m0 / 3 + 1}º trimestre ${ano}`
    : `${m0 / 6 + 1}º semestre ${ano}`
  return { inicio, fim, dias: diasEntre(inicio, fim) + 1, rotulo }
}

/** Anda N períodos para frente ou para trás. */
export function moverPeriodo(periodo: Periodo, ref: string, delta: number): string {
  const meses = PERIODOS_ROAD.find(p => p.key === periodo)!.meses
  const d = new Date(Number(ref.slice(0, 4)), Number(ref.slice(5, 7)) - 1 + delta * meses, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
}

/** Posição (0-100%) de um dia na janela, presa nas pontas. */
export function posicao(j: Janela, d: string): number {
  if (!ehData(d)) return 0
  return Math.max(0, Math.min(100, (diasEntre(j.inicio, d) / j.dias) * 100))
}

/** Cabeçalho da faixa: os meses da janela com o começo de cada um em %. */
export function mesesDaJanela(j: Janela): { rotulo: string; esquerda: number }[] {
  const out: { rotulo: string; esquerda: number }[] = []
  let d = j.inicio
  while (d <= j.fim) {
    out.push({ rotulo: MESES[Number(d.slice(5, 7)) - 1], esquerda: posicao(j, d) })
    const prox = new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 1)
    d = `${prox.getFullYear()}-${pad(prox.getMonth() + 1)}-01`
  }
  return out
}

/** Para períodos de 1 mês, as semanas viram as marcas do cabeçalho. */
export function marcasDaJanela(j: Janela): { rotulo: string; esquerda: number }[] {
  if (j.dias > 31) return mesesDaJanela(j)
  const out: { rotulo: string; esquerda: number }[] = []
  for (let d = j.inicio; d <= j.fim; d = somarDias(d, 7)) out.push({ rotulo: `${d.slice(8, 10)}/${d.slice(5, 7)}`, esquerda: posicao(j, d) })
  return out
}

// ---------------------------------------------------------------- um cliente
export type PontoEtapa = { id: string; titulo: string; status: StatusEntrega; dia: string; pos: number }
export type Faixa = {
  id: string; titulo: string; status: StatusEntrega; inicio: string; fim: string
  esquerda: number; largura: number; pct: number; etapas: PontoEtapa[]
  marcoId?: string // a faixa abre este marco
  segmentos?: { id: string; esquerda: number; largura: number; status: StatusEntrega; titulo: string }[] // plano por semanas
}
export type Contadores = Record<StatusEntrega, number>
export type Roadmap = { faixas: Faixa[]; contadores: Contadores; total: number; pctEntregue: number; hoje: number | null }

const intersecta = (ini: string, fim: string, j: Janela) => ini <= j.fim && fim >= j.inicio
const vazio = (): Contadores => ({ concluido: 0, andamento: 0, atrasado: 0, a_fazer: 0 })
const ORDEM: Record<StatusEntrega, number> = { atrasado: 0, andamento: 1, a_fazer: 2, concluido: 3 }

export function roadmapDoCliente(marcos: MarcoRoad[], j: Janela, hoje: string): Roadmap {
  const contadores = vazio()
  const faixas: Faixa[] = []
  const comuns = marcos.filter(m => m.tipo !== 'semana' && m.status !== 'cancelado')
  const semanas = marcos.filter(m => m.tipo === 'semana').sort((a, b) => dia(a.dataInicio).localeCompare(dia(b.dataInicio)))

  for (const m of comuns) {
    const ini = dia(m.dataInicio), fim = fimDe(m)
    if (!ehData(ini) || !intersecta(ini, fim, j)) continue
    const status = statusDaEntrega(m, hoje)
    contadores[status]++
    const subs = m.subetapas || []
    const pg = progressoMarco(subs)
    const esquerda = posicao(j, ini)
    faixas.push({
      id: m.id, marcoId: m.id, titulo: m.titulo, status, inicio: ini, fim,
      esquerda, largura: Math.max(1.5, posicao(j, somarDias(fim, 1)) - esquerda),
      pct: status === 'concluido' ? 100 : pg.total ? pg.pct : 0,
      etapas: subs.filter(s => ehData(s.dataFim) && s.dataFim! >= j.inicio && s.dataFim! <= j.fim)
        .map(s => ({ id: s.id, titulo: s.titulo, status: statusDaEtapa(s, hoje, m.recesso), dia: s.dataFim!, pos: posicao(j, s.dataFim!) })),
    })
  }

  // Plano por semanas: uma faixa, um segmento por semana; cada entrega da semana conta.
  const semanasNaJanela = semanas.filter(m => intersecta(dia(m.dataInicio), fimDe(m), j))
  if (semanasNaJanela.length) {
    let feitas = 0, total = 0
    const etapas: PontoEtapa[] = []
    const segmentos = semanasNaJanela.map(m => {
      const ini = dia(m.dataInicio), fim = fimDe(m)
      for (const s of m.subetapas || []) {
        const st = statusDaEtapa(s, hoje, m.recesso)
        contadores[st]++; total++; if (st === 'concluido') feitas++
        if (ehData(s.dataFim) && s.dataFim! >= j.inicio && s.dataFim! <= j.fim) etapas.push({ id: `${m.id}:${s.id}`, titulo: s.titulo, status: st, dia: s.dataFim!, pos: posicao(j, s.dataFim!) })
      }
      const esquerda = posicao(j, ini)
      return { id: m.id, esquerda, largura: Math.max(0.8, posicao(j, somarDias(fim, 1)) - esquerda), status: statusDaEntrega(m, hoje), titulo: m.foco || m.titulo }
    })
    const st: StatusEntrega = segmentos.some(s => s.status === 'atrasado') ? 'atrasado' : segmentos.every(s => s.status === 'concluido') ? 'concluido' : segmentos.some(s => s.status !== 'a_fazer') ? 'andamento' : 'a_fazer'
    const ini = dia(semanasNaJanela[0].dataInicio), fim = fimDe(semanasNaJanela[semanasNaJanela.length - 1])
    const esquerda = posicao(j, ini)
    faixas.push({ id: 'semanas', titulo: 'Plano por semanas', status: st, inicio: ini, fim, esquerda, largura: Math.max(1.5, posicao(j, somarDias(fim, 1)) - esquerda), pct: total ? Math.round((feitas / total) * 100) : 0, etapas, segmentos })
  }

  faixas.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo))
  const total = contadores.concluido + contadores.andamento + contadores.atrasado + contadores.a_fazer
  return { faixas, contadores, total, pctEntregue: total ? Math.round((contadores.concluido / total) * 100) : 0, hoje: hoje >= j.inicio && hoje <= j.fim ? posicao(j, hoje) : null }
}

/** Os cards embaixo da linha: atrasado, em andamento, a seguir e entregue, nesta ordem. */
export function faixasPorStatus(r: Roadmap): { status: StatusEntrega; faixas: Faixa[] }[] {
  return (['atrasado', 'andamento', 'a_fazer', 'concluido'] as StatusEntrega[])
    .map(status => ({ status, faixas: r.faixas.filter(f => f.status === status).sort((a, b) => a.fim.localeCompare(b.fim)) }))
}

/** Celular: as faixas agrupadas pelo mês em que terminam. */
export function faixasPorMes(r: Roadmap): { mes: string; rotulo: string; faixas: Faixa[] }[] {
  const mapa = new Map<string, Faixa[]>()
  for (const f of [...r.faixas].sort((a, b) => a.fim.localeCompare(b.fim))) {
    const k = f.fim.slice(0, 7)
    mapa.set(k, [...(mapa.get(k) || []), f])
  }
  return Array.from(mapa.entries()).map(([mes, faixas]) => ({ mes, rotulo: `${MESES_LONGO[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`, faixas }))
}

// ---------------------------------------------------------------- todos os clientes
export type LinhaCliente = {
  clienteId: string; clienteNome: string; contadores: Contadores; total: number; pctEntregue: number
  proximo?: { titulo: string; dia: string; status: StatusEntrega }
  marcos: { esquerda: number; status: StatusEntrega; titulo: string }[] // losangos na faixa do período
}

export function resumoDosClientes(marcos: MarcoRoad[], j: Janela, hoje: string, nomes: Record<string, string> = {}): LinhaCliente[] {
  const porCliente = new Map<string, MarcoRoad[]>()
  for (const m of marcos) if (m.clienteId) porCliente.set(m.clienteId, [...(porCliente.get(m.clienteId) || []), m])
  const linhas: LinhaCliente[] = []
  for (const [clienteId, lista] of Array.from(porCliente)) {
    const r = roadmapDoCliente(lista, j, hoje)
    if (!r.total) continue
    const abertos = r.faixas.filter(f => f.status !== 'concluido').sort((a, b) => ORDEM[a.status] - ORDEM[b.status] || a.fim.localeCompare(b.fim))
    linhas.push({
      clienteId, clienteNome: nomes[clienteId] || lista[0].clienteNome || 'Cliente', contadores: r.contadores, total: r.total, pctEntregue: r.pctEntregue,
      proximo: abertos[0] ? { titulo: abertos[0].titulo, dia: abertos[0].fim, status: abertos[0].status } : undefined,
      marcos: r.faixas.map(f => ({ esquerda: Math.min(100, f.esquerda + f.largura), status: f.status, titulo: f.titulo })),
    })
  }
  // Quem tem atraso primeiro (mais atrasos antes), depois quem tem menos feito.
  return linhas.sort((a, b) => b.contadores.atrasado - a.contadores.atrasado || a.pctEntregue - b.pctEntregue || a.clienteNome.localeCompare(b.clienteNome))
}

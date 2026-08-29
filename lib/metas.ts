// Meta de vendas — a régua do mês, do trimestre e do ano.
//
// Duas decisões estruturais moram aqui:
//
// 1. A meta é guardada POR MÊS (12 valores), não como um número anual. Meta
//    anual dividida na hora de mostrar não sobrevive à realidade de uma clínica:
//    dezembro e julho não valem o mesmo que fevereiro. O "anual" é a SOMA dos
//    meses — e quem quiser o caminho fácil usa `distribuirAnual`.
// 2. Todo recorte (semana, trimestre, ano, um intervalo qualquer) sai de UMA
//    função — `metaIntervalo` — que fatia os meses proporcionalmente aos dias.
//    Sem isso, a "meta da semana" que cruza a virada do mês seria chutada.
//
// O realizado NÃO é digitado: vem das oportunidades ganhas no CRM. Ver
// `dataDoGanho` — é ela que diz a que mês a venda pertence.

export type MetaAno = {
  ano: number
  meses: number[]             // 12 valores em R$ (janeiro..dezembro)
  atualizadoEm?: string
  atualizadoPorNome?: string
}

export function metaVazia(ano: number): MetaAno {
  return { ano, meses: Array(12).fill(0) }
}

// Aceita o que veio do banco sem confiar: meta antiga/corrompida não pode
// derrubar a tela nem inventar número.
export function normalizaMeta(bruta: any, ano: number): MetaAno {
  const meses = Array.from({ length: 12 }, (_, i) => {
    const v = Number(bruta?.meses?.[i])
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0
  })
  return { ano, meses, atualizadoEm: bruta?.atualizadoEm, atualizadoPorNome: bruta?.atualizadoPorNome }
}

// Divide o total do ano em 12 meses iguais. A sobra dos centavos vai para
// dezembro, de propósito: a soma dos 12 tem que bater EXATAMENTE com o que o
// dono digitou, senão a meta anual da tela não fecha com a que ele definiu.
export function distribuirAnual(total: number): number[] {
  const t = Math.max(0, Math.round((Number(total) || 0) * 100)) // centavos
  const base = Math.floor(t / 12)
  const meses = Array(12).fill(base)
  meses[11] = base + (t - base * 12)
  return meses.map(c => c / 100)
}

export function totalAno(meta: MetaAno): number {
  return meta.meses.reduce((s, v) => s + (Number(v) || 0), 0)
}

const diasNoMes = (ano: number, mes: number) => new Date(ano, mes + 1, 0).getDate()

export function inicioDoMes(ano: number, mes: number): Date { return new Date(ano, mes, 1, 0, 0, 0, 0) }
export function fimDoMes(ano: number, mes: number): Date { return new Date(ano, mes, diasNoMes(ano, mes), 23, 59, 59, 999) }
export function intervaloMes(ano: number, mes: number): [Date, Date] { return [inicioDoMes(ano, mes), fimDoMes(ano, mes)] }
export function intervaloTrimestre(ano: number, tri: number): [Date, Date] { return [inicioDoMes(ano, tri * 3), fimDoMes(ano, tri * 3 + 2)] }
export function intervaloAno(ano: number): [Date, Date] { return [inicioDoMes(ano, 0), fimDoMes(ano, 11)] }

// Semana de segunda a domingo (a semana comercial brasileira).
export function intervaloSemana(d: Date): [Date, Date] {
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dia = (base.getDay() + 6) % 7 // 0 = segunda
  const seg = new Date(base); seg.setDate(base.getDate() - dia)
  const dom = new Date(seg); dom.setDate(seg.getDate() + 6); dom.setHours(23, 59, 59, 999)
  return [seg, dom]
}

const DIA = 86400000
const soData = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

// Quantos dias do intervalo [de, ate] caem dentro do mês (contando as pontas).
function diasDoMesNoIntervalo(ano: number, mes: number, de: Date, ate: Date): number {
  const ini = Math.max(soData(de), soData(inicioDoMes(ano, mes)))
  const fim = Math.min(soData(ate), soData(fimDoMes(ano, mes)))
  if (fim < ini) return 0
  return Math.round((fim - ini) / DIA) + 1
}

// Meta de QUALQUER intervalo: soma a parte proporcional de cada mês tocado.
// Mês inteiro devolve o valor cheio (dias do mês ÷ dias do mês = 1), então
// trimestre e ano continuam sendo soma exata, sem erro de arredondamento.
export function metaIntervalo(meta: MetaAno, de: Date, ate: Date): number {
  let total = 0
  for (let m = 0; m < 12; m++) {
    const valor = Number(meta.meses[m]) || 0
    if (!valor) continue
    const dias = diasDoMesNoIntervalo(meta.ano, m, de, ate)
    if (!dias) continue
    total += valor * (dias / diasNoMes(meta.ano, m))
  }
  return Math.round(total * 100) / 100
}

// ---- Realizado (vem do CRM) ----

export type NegocioMeta = {
  id?: string
  titulo?: string
  valor?: number
  status?: string
  pipelineId?: string
  donoNome?: string
  fechadoEm?: string
  atualizadoEm?: string
  criadoEm?: string
  atividades?: { tipo?: string; criadoEm?: string }[]
}

// A que DIA a venda pertence. `fechadoEm` é gravado quando o negócio vira
// ganho; negócio ganho antes desse campo existir cai na atividade "ganho" da
// timeline (que tem a data real) e só então em `atualizadoEm`. Sem essa ordem,
// editar em outubro uma venda de agosto mudaria o mês do faturamento — e a meta
// de agosto passaria a mentir para sempre.
export function dataDoGanho(n: NegocioMeta): string {
  if (n.fechadoEm) return n.fechadoEm
  const ganho = (n.atividades || []).filter(a => a.tipo === 'ganho' && a.criadoEm).pop()
  return ganho?.criadoEm || n.atualizadoEm || n.criadoEm || ''
}

export type Realizado = { valor: number; qtd: number; negocios: NegocioMeta[] }

// Soma as oportunidades GANHAS no intervalo. `pipelineId` vazio = todos os funis.
export function realizadoNoIntervalo(negocios: NegocioMeta[], de: Date, ate: Date, pipelineId = ''): Realizado {
  const ini = de.getTime(), fim = ate.getTime()
  const dentro = negocios.filter(n => {
    if (n.status !== 'ganho') return false
    if (pipelineId && (n.pipelineId || '') !== pipelineId) return false
    const d = dataDoGanho(n)
    if (!d) return false
    const t = new Date(d).getTime()
    return Number.isFinite(t) && t >= ini && t <= fim
  })
  return {
    valor: Math.round(dentro.reduce((s, n) => s + (Number(n.valor) || 0), 0) * 100) / 100,
    qtd: dentro.length,
    negocios: dentro.sort((a, b) => new Date(dataDoGanho(b)).getTime() - new Date(dataDoGanho(a)).getTime()),
  }
}

// ---- Progresso (é o que a tela mostra) ----

export type Situacao = 'batida' | 'adiantado' | 'no_ritmo' | 'atrasado' | 'sem_meta'

export type Progresso = {
  meta: number
  realizado: number
  falta: number          // nunca negativo: o que passou da meta é excedente, não "falta"
  excedente: number
  pct: number            // 0-100+ (pode passar de 100)
  semMeta: boolean
  esperadoAteHoje: number // onde a régua deveria estar HOJE (proporcional aos dias)
  projecao: number        // fechamento no ritmo atual
  diasDecorridos: number
  diasTotais: number
  situacao: Situacao
}

// `agora` entra por parâmetro (nada de Date.now() escondido): é o que deixa o
// período passado/futuro ser calculado — e testado.
export function progresso(meta: number, realizado: number, de: Date, ate: Date, agora: Date): Progresso {
  const diasTotais = Math.round((soData(ate) - soData(de)) / DIA) + 1
  const decorridosBrutos = Math.round((soData(agora) - soData(de)) / DIA) + 1
  const diasDecorridos = Math.max(0, Math.min(diasTotais, decorridosBrutos))
  const semMeta = !(meta > 0)
  const pct = semMeta ? 0 : (realizado / meta) * 100
  const esperadoAteHoje = semMeta ? 0 : Math.round(meta * (diasDecorridos / diasTotais) * 100) / 100
  const projecao = diasDecorridos > 0 ? Math.round((realizado / diasDecorridos) * diasTotais * 100) / 100 : 0

  let situacao: Situacao = 'sem_meta'
  if (!semMeta) {
    if (realizado >= meta) situacao = 'batida'
    // 5% de folga para os dois lados: sem isso "no ritmo" nunca acontece e o
    // painel fica pintando de vermelho quem está a um dia de distância.
    else if (realizado >= esperadoAteHoje * 1.05) situacao = 'adiantado'
    else if (realizado >= esperadoAteHoje * 0.95) situacao = 'no_ritmo'
    else situacao = 'atrasado'
  }

  return {
    meta, realizado,
    falta: Math.max(0, Math.round((meta - realizado) * 100) / 100),
    excedente: Math.max(0, Math.round((realizado - meta) * 100) / 100),
    pct: Math.round(pct * 10) / 10,
    semMeta, esperadoAteHoje, projecao, diasDecorridos, diasTotais, situacao,
  }
}

export const CORES_SITUACAO: Record<Situacao, { cor: string; fundo: string; label: string }> = {
  batida: { cor: '#166534', fundo: '#dcfce7', label: 'Meta batida' },
  adiantado: { cor: '#166534', fundo: '#f0fdf4', label: 'Adiantado' },
  no_ritmo: { cor: '#a16207', fundo: '#fffbeb', label: 'No ritmo' },
  atrasado: { cor: '#b91c1c', fundo: '#fef2f2', label: 'Atrasado' },
  sem_meta: { cor: '#9ca3af', fundo: '#f7f7f7', label: 'Sem meta definida' },
}

export const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const MESES_LONGO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

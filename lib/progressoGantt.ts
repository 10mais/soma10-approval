// PRIORIDADE E PROGRESSO do Gantt do Playbook (dono, 08/09/2026):
//
//   "Trabalhos mais longos = para cima (quanto mais tempo, mais para o topo)."
//   "Mostrar a tarefa dentro de cada ETAPA e o grau de conclusão e tempo com %.
//    Faça o cálculo de tempo que ainda resta + o número de tarefas; cada tarefa
//    feita é um check em direção à % de conclusão."
//
// Duas medidas independentes, nunca misturadas num número só:
//   CONCLUSÃO — quanto do trabalho está feito. Manda quem tem fato: tarefas
//     concluídas / tarefas do item; sem tarefas, o KPI (atual/meta); sem os
//     dois, o status. Tarefa descartada não conta nem como feita nem no total.
//   TEMPO — quanto do prazo já passou, e quantos dias faltam (ou de atraso).
//
// A barra do Gantt pinta a CONCLUSÃO na cor cheia sobre a barra inteira em tom
// mais claro; o texto mostra "feitas/total" e a % junto do tempo que resta.

const MS_DIA = 24 * 60 * 60 * 1000
const RE_YMD = /^\d{4}-\d{2}-\d{2}$/
const ms = (d: string) => new Date(RE_YMD.test(d) ? d + 'T00:00:00Z' : d).getTime()
// Dia (em UTC) de um instante — comparar datas "só dia" sem o fuso empurrar um dia.
const diaDe = (t: number) => Math.floor(t / MS_DIA)

// Duração em dias, mínimo 1 (um item de um dia só dura um dia).
export function duracaoDias(ini: string, fim?: string): number {
  const a = ms(ini)
  if (!Number.isFinite(a)) return 1
  const b = fim ? ms(fim) : a
  if (!Number.isFinite(b)) return 1
  return Math.max(1, diaDe(b) - diaDe(a) + 1)
}

// Mais longo primeiro. Empate: o que começa antes fica em cima; empatou de novo,
// mantém a ordem que veio (estável) — meses sequenciais de mesmo tamanho não embaralham.
export function ordenarPorDuracao<T>(itens: T[], periodo: (t: T) => { ini: string; fim?: string }): T[] {
  return itens
    .map((item, i) => ({ item, i, p: periodo(item) }))
    .sort((a, b) => {
      const d = duracaoDias(b.p.ini, b.p.fim) - duracaoDias(a.p.ini, a.p.fim)
      if (d) return d
      const t = ms(a.p.ini) - ms(b.p.ini)
      if (t) return t
      return a.i - b.i
    })
    .map(x => x.item)
}

export type ProgressoTempo = {
  pct: number // 0–100 do prazo já percorrido
  diasTotais: number
  diasRestantes: number // negativo = dias de atraso
  comecou: boolean
  venceu: boolean
}

export function progressoTempo(ini: string, fim: string | undefined, agora: number = Date.now()): ProgressoTempo {
  const diasTotais = duracaoDias(ini, fim)
  const dIni = diaDe(ms(ini))
  const dFim = diaDe(fim ? ms(fim) : ms(ini))
  const hoje = diaDe(agora)
  const passados = hoje - dIni
  return {
    pct: Math.max(0, Math.min(100, Math.round((passados / diasTotais) * 100))),
    diasTotais,
    diasRestantes: dFim - hoje,
    comecou: hoje >= dIni,
    venceu: hoje > dFim,
  }
}

// "faltam 6 dias" / "vence hoje" / "3 dias de atraso" / "começa em 4 dias"
export function textoTempo(t: ProgressoTempo): string {
  if (!t.comecou) {
    const faltam = t.diasRestantes - t.diasTotais + 1
    return faltam === 1 ? 'começa amanhã' : `começa em ${faltam} dias`
  }
  if (t.diasRestantes > 1) return `faltam ${t.diasRestantes} dias`
  if (t.diasRestantes === 1) return 'falta 1 dia'
  if (t.diasRestantes === 0) return 'vence hoje'
  const atraso = -t.diasRestantes
  return atraso === 1 ? '1 dia de atraso' : `${atraso} dias de atraso`
}

export type TarefaLeveStatus = { status?: string }
export type ProgressoTarefas = { feitas: number; total: number; pct: number }

// Tarefa descartada sai da conta (não é trabalho a fazer nem feito).
export function progressoTarefas(tarefas: TarefaLeveStatus[] | undefined): ProgressoTarefas {
  const validas = (tarefas || []).filter(t => t.status !== 'descartado')
  const feitas = validas.filter(t => t.status === 'concluido').length
  return { feitas, total: validas.length, pct: validas.length ? Math.round((feitas / validas.length) * 100) : 0 }
}

const PCT_STATUS_ETAPA: Record<string, number> = { concluido: 100, em_andamento: 50, pendente: 0 }

// % de conclusão de UMA etapa: tarefas mandam; sem tarefas, o KPI; sem os dois, o status.
export function pctConclusaoEtapa(
  etapa: { status?: string; kpiMeta?: number; kpiAtual?: number },
  tarefas: TarefaLeveStatus[] | undefined,
): number {
  const t = progressoTarefas(tarefas)
  if (t.total > 0) return t.pct
  if (etapa.kpiMeta && etapa.kpiMeta > 0) return Math.max(0, Math.min(100, Math.round(((etapa.kpiAtual || 0) / etapa.kpiMeta) * 100)))
  return PCT_STATUS_ETAPA[etapa.status || 'pendente'] ?? 0
}

// % do MARCO: média das etapas (cada uma já contando as suas tarefas). Sem etapas,
// valem as tarefas do marco; sem nada disso, o status do próprio marco.
export function pctConclusaoMarco(
  marco: { status?: string; subetapas?: { id: string; status?: string; kpiMeta?: number; kpiAtual?: number }[] },
  tarefasPorEtapa: (id: string) => TarefaLeveStatus[],
  tarefasDoMarco: TarefaLeveStatus[] | undefined,
): number {
  const subs = marco.subetapas || []
  if (subs.length) {
    const soma = subs.reduce((acc, se) => acc + pctConclusaoEtapa(se, tarefasPorEtapa(se.id)), 0)
    return Math.round(soma / subs.length)
  }
  const t = progressoTarefas(tarefasDoMarco)
  if (t.total > 0) return t.pct
  return marco.status === 'concluido' ? 100 : marco.status === 'em_andamento' ? 50 : 0
}

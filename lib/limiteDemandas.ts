// LIMITADOR DE DEMANDAS (dono, 15/11/2026): "Cada integrante do time pode assumir simultaneamente
// 3 demandas distintas ... ele 'Pesca' essa demanda e começa a fazer ... A quarta bloqueia! Ele só
// pode assumir mais uma se finalizar alguma anterior." Plano: docs/redesenho-agency/
// PLANO-LIMITADOR-DEMANDAS.md. Puro e client-safe; testes em tests/limiteDemandas.test.ts.
//
// Decisões do dono (15/11):
// - ocupam vaga Em andamento e Em ajuste (Aguardando material libera a vaga);
// - ajuste do cliente com a pessoa sem vaga ESPERA vaga (topo da fila, A fazer + ajustePedidoEm);
// - pescar da própria fila, livre;
// - vale para a produção criativa (designer, editor de vídeo, Social Media nas copies).
//
// A regra só olha TRANSIÇÕES: quem já estava acima do limite no dia em que o limitador ligou fica
// assim até entregar (nada é devolvido à força), e editar uma tarefa que já ocupa vaga nunca trava
// ("regra nova não trava item antigo").

import { diaDoInstante, subtrairDiasUteis } from './datas'

export const LIMITE_PADRAO = 3

/** Status que ocupam vaga (com a pessoa trabalhando na peça). */
export const STATUS_QUE_OCUPAM = ['em_andamento', 'em_ajuste'] as const

/** Tipos de tarefa da produção criativa. Reunião, relatório, financeiro e tarefa geral não contam. */
export const TIPOS_CRIATIVOS = ['carrossel', 'criativo', 'post', 'reel', 'story', 'video', 'copy', 'briefing']

export type ConfigLimite = {
  ligado: boolean
  limite: number // padrão para todos
  porPessoa?: Record<string, number> // e-mail (minúsculo) -> limite próprio
}

export const CONFIG_LIMITE_PADRAO: ConfigLimite = { ligado: true, limite: LIMITE_PADRAO, porPessoa: {} }

export type TarefaLimite = {
  id: string
  titulo?: string
  status: string
  tipo?: string
  responsavelEmail?: string
  responsavelNome?: string
  clienteNome?: string
  origemPostId?: string
  fasePauta?: string
  aguardandoMaterial?: unknown
  ajustePedidoEm?: string
  excluidoEm?: string
  prazo?: string
  prioridade?: string
  // Relógio de produção (F4): ver relogioProducao
  emProducaoDesde?: string
  producaoMs?: number
  entregas?: EntregaProducao[]
}

/** Uma entrega da peça: quem entregou, quando e quanto tempo ela ocupou vaga desde a última. */
export type EntregaProducao = { por: string; em: string; ms?: number }

const norm = (e?: string) => (e || '').trim().toLowerCase()

/** A tarefa é da produção criativa (pauta do Estúdio ou tipo de peça). */
export function ehDemandaCriativa(t: Pick<TarefaLimite, 'tipo' | 'origemPostId' | 'fasePauta'>): boolean {
  return !!t.origemPostId || !!t.fasePauta || TIPOS_CRIATIVOS.includes(t.tipo || '')
}

/** A tarefa ocupa uma vaga do responsável agora. */
export function ocupaVaga(t: TarefaLimite): boolean {
  return !t.excluidoEm && !!norm(t.responsavelEmail) && ehDemandaCriativa(t)
    && (STATUS_QUE_OCUPAM as readonly string[]).includes(t.status) && !t.aguardandoMaterial
}

/** Limite da pessoa: o dela, se houver, senão o padrão. Nunca menor que 1. */
export function limiteDe(email: string | undefined, cfg: ConfigLimite): number {
  const proprio = cfg.porPessoa?.[norm(email)]
  const n = Number.isFinite(proprio) && (proprio as number) > 0 ? (proprio as number) : cfg.limite
  return Math.max(1, Math.round(n || LIMITE_PADRAO))
}

export type Vagas = { ocupadas: number; limite: number; livres: number; acima: boolean; tarefas: TarefaLimite[] }

/** As vagas da pessoa. `ignorar` = a tarefa que está sendo movida (não conta contra ela mesma). */
export function vagasDe(email: string | undefined, tarefas: TarefaLimite[], cfg: ConfigLimite, ignorar?: string): Vagas {
  const eu = norm(email)
  const minhas = eu ? tarefas.filter(t => t.id !== ignorar && norm(t.responsavelEmail) === eu && ocupaVaga(t)) : []
  const limite = limiteDe(eu, cfg)
  return { ocupadas: minhas.length, limite, livres: Math.max(0, limite - minhas.length), acima: minhas.length > limite, tarefas: minhas }
}

/** A mudança de `antes` para `depois` faz a tarefa passar a ocupar uma vaga de alguém. */
export function precisaDeVaga(antes: TarefaLimite | null | undefined, depois: TarefaLimite): boolean {
  if (!ocupaVaga(depois)) return false
  if (!antes || !ocupaVaga(antes)) return true
  // Já ocupava: só precisa de vaga nova se mudou de mãos.
  return norm(antes.responsavelEmail) !== norm(depois.responsavelEmail)
}

const primeiroNome = (nome?: string, email?: string) => (nome || '').trim().split(/\s+/)[0] || norm(email).split('@')[0] || 'A pessoa'

/** ok = pode; sem vaga vem o motivo escrito e as peças que estão ocupando as vagas. */
export type Veredito = { ok: boolean; motivo?: string; vagas?: Vagas }

/**
 * Pode a tarefa ir de `antes` para `depois`? Recusa quando a mudança ocupa uma vaga e o
 * responsável já está no limite. `quem` é quem está pedindo (para escrever "Você" ou o nome).
 */
export function podeAssumir(
  antes: TarefaLimite | null | undefined, depois: TarefaLimite, tarefas: TarefaLimite[], cfg: ConfigLimite, quem?: { email?: string },
): Veredito {
  if (!cfg.ligado || !precisaDeVaga(antes, depois)) return { ok: true }
  const vagas = vagasDe(depois.responsavelEmail, tarefas, cfg, depois.id)
  if (vagas.livres > 0) return { ok: true }
  const souEu = !!quem?.email && norm(quem.email) === norm(depois.responsavelEmail)
  const sujeito = souEu ? 'Você está' : `${primeiroNome(depois.responsavelNome, depois.responsavelEmail)} está`
  const acao = souEu ? 'Entregue, devolva para a fila ou marque "Aguardando material" em uma delas para pescar outra.' : 'Uma delas precisa ser entregue, devolvida para a fila ou marcada "Aguardando material" antes.'
  return { ok: false, motivo: `${sujeito} com ${vagas.ocupadas} de ${vagas.limite} demandas em andamento. ${acao}`, vagas }
}

/**
 * Ajuste pedido (cliente ou revisão interna) numa peça já entregue: vira Em ajuste se o responsável
 * tem vaga; sem vaga, espera no topo da fila (A fazer, com a marca ajustePedidoEm).
 */
export function statusDoAjuste(t: TarefaLimite, tarefas: TarefaLimite[], cfg: ConfigLimite): 'em_ajuste' | 'a_fazer' {
  const depois = { ...t, status: 'em_ajuste', aguardandoMaterial: undefined }
  return podeAssumir(t, depois, tarefas, cfg).ok ? 'em_ajuste' : 'a_fazer'
}

/** Ajuste do cliente parado na fila esperando vaga (A fazer com a marca do ajuste). */
export const ajusteEsperandoVaga = (t: Pick<TarefaLimite, 'status' | 'ajustePedidoEm'>): boolean =>
  t.status === 'a_fazer' && !!t.ajustePedidoEm

/** Na fila da pessoa (pode ser pescada): produção criativa, A fazer, sem esperar material. */
export const naFila = (t: TarefaLimite): boolean =>
  !t.excluidoEm && ehDemandaCriativa(t) && t.status === 'a_fazer' && !t.aguardandoMaterial

const PESO_PRIORIDADE: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 }
const msPrazo = (iso?: string) => { const n = iso ? new Date(iso).getTime() : NaN; return Number.isFinite(n) ? n : Infinity }

/**
 * A fila da pessoa na ordem de pescar: ajustes esperando vaga primeiro (o cliente está esperando),
 * depois prioridade, depois prazo. O sistema sugere a do topo; pescar é livre.
 */
export function filaDe<T extends TarefaLimite>(email: string | undefined, tarefas: T[]): T[] {
  const eu = norm(email)
  if (!eu) return []
  return tarefas
    .filter(t => norm(t.responsavelEmail) === eu && naFila(t))
    .sort((a, b) =>
      (Number(ajusteEsperandoVaga(b)) - Number(ajusteEsperandoVaga(a)))
      || ((PESO_PRIORIDADE[a.prioridade || ''] ?? 9) - (PESO_PRIORIDADE[b.prioridade || ''] ?? 9))
      || (msPrazo(a.prazo) - msPrazo(b.prazo))
      || (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR'))
}

/** Pescou uma peça pulando outra marcada como Prioridade (urgente/alta) da própria fila: avisa. */
export function pulouPrioridade<T extends TarefaLimite>(pescada: T, fila: T[]): T | null {
  const prioritarias = fila.filter(t => t.id !== pescada.id && (t.prioridade === 'urgente' || t.prioridade === 'alta'))
  if (!prioritarias.length) return null
  const peso = PESO_PRIORIDADE[pescada.prioridade || ''] ?? 9
  return prioritarias.find(t => (PESO_PRIORIDADE[t.prioridade || ''] ?? 9) < peso) || null
}

/** Normaliza a configuração vinda do Redis (ou do formulário). */
export function normalizarConfigLimite(c: Partial<ConfigLimite> | null | undefined): ConfigLimite {
  const limite = Math.max(1, Math.min(20, Math.round(Number(c?.limite) || LIMITE_PADRAO)))
  const porPessoa: Record<string, number> = {}
  for (const [email, n] of Object.entries(c?.porPessoa || {})) {
    const v = Math.round(Number(n))
    if (norm(email) && v >= 1 && v <= 20) porPessoa[norm(email)] = v
  }
  return { ligado: c?.ligado === undefined ? CONFIG_LIMITE_PADRAO.ligado : !!c.ligado, limite, porPessoa }
}

/**
 * RISCO DE ATRASO (plano §5): peça ainda na fila (ninguém pescou) com o prazo a 2 dias úteis ou
 * menos. O gestor de projetos é avisado para reordenar, trocar o responsável ou marcar Prioridade.
 * `hoje` = dia de Brasília (YYYY-MM-DD).
 */
export const DIAS_UTEIS_RISCO = 2
export function emRiscoDeAtraso(t: TarefaLimite, hoje: string): boolean {
  if (!naFila(t)) return false
  const dia = diaDoInstante(t.prazo)
  if (!dia) return false
  return subtrairDiasUteis(dia, DIAS_UTEIS_RISCO) <= hoje
}

// ===================================================================== F4 (15/11/2026)

/**
 * EXCEÇÃO DO GESTOR (plano §3): numa urgência, o gestor de projetos do squad do cliente, o gerente
 * e o admin podem passar do limite de uma pessoa, com motivo escrito (fica no histórico da tarefa).
 */
export const MIN_MOTIVO_EXCECAO = 5
export function podeForcarLimite(quem: { email?: string; role?: string } | undefined, gestorProjetos?: string): boolean {
  if (!quem) return false
  if (quem.role === 'admin' || quem.role === 'gerente') return true
  return !!norm(quem.email) && norm(quem.email) === norm(gestorProjetos)
}
export const motivoExcecaoValido = (m?: string): boolean => (m || '').trim().length >= MIN_MOTIVO_EXCECAO

/** Texto do histórico da tarefa quando o limite foi passado. */
export function textoExcecao(v: Veredito, depois: TarefaLimite, motivo: string, porNome?: string): string {
  const nome = primeiroNome(depois.responsavelNome, depois.responsavelEmail)
  const ocupadas = (v.vagas?.ocupadas ?? 0) + 1
  const limite = v.vagas?.limite ?? LIMITE_PADRAO
  return `Limite de vagas passado${porNome ? ` por ${porNome}` : ''}: ${nome} ficou com ${ocupadas} de ${limite}. Motivo: ${motivo.trim().slice(0, 300)}`
}

/**
 * RELÓGIO DE PRODUÇÃO (Carga da equipe): soma o tempo em que a peça ocupou vaga (Em andamento ou
 * Em ajuste, sem esperar material) e, na ENTREGA (Em revisão ou Concluída vindo de um status
 * aberto), registra quem entregou e quanto tempo levou, e zera a conta para a próxima rodada (a
 * copy entregue pelo Social Media e o criativo do designer na mesma tarefa contam cada um para
 * quem fez). Devolve só os campos que mudam; `undefined` apaga o campo. `agora` em ISO.
 */
export type RelogioProducao = Partial<Pick<TarefaLimite, 'emProducaoDesde' | 'producaoMs' | 'entregas'>>
const ENTREGUE = ['em_revisao', 'concluido']
export const MAX_ENTREGAS_GUARDADAS = 20
export function relogioProducao(antes: TarefaLimite | null | undefined, depois: TarefaLimite, agora: string): RelogioProducao {
  const out: RelogioProducao = {}
  const ocupavaAntes = !!antes && ocupaVaga(antes)
  const ocupaDepois = ocupaVaga(depois)
  let acumulado = antes?.producaoMs || 0
  if (!ocupavaAntes && ocupaDepois) out.emProducaoDesde = agora
  if (ocupavaAntes && !ocupaDepois) {
    const desde = antes?.emProducaoDesde ? new Date(antes.emProducaoDesde).getTime() : NaN
    const passou = new Date(agora).getTime() - desde
    if (Number.isFinite(passou) && passou > 0) { acumulado += passou; out.producaoMs = acumulado }
    out.emProducaoDesde = undefined
  }
  const entregouAgora = ENTREGUE.includes(depois.status) && (!antes || !ENTREGUE.includes(antes.status))
  const por = norm(depois.responsavelEmail)
  if (entregouAgora && ehDemandaCriativa(depois) && por) {
    const entrega: EntregaProducao = { por, em: agora, ...(acumulado > 0 ? { ms: acumulado } : {}) }
    out.entregas = [...(antes?.entregas || depois.entregas || []), entrega].slice(-MAX_ENTREGAS_GUARDADAS)
    out.producaoMs = undefined
  }
  return out
}

const DIA_MS = 24 * 60 * 60 * 1000

/**
 * Métricas da pessoa para a Carga da equipe: entregas nos últimos 7 dias e tempo médio em produção
 * (tempo corrido ocupando vaga) das entregas dos últimos 30 dias. Só conta o que tem o relógio,
 * ou seja, o que foi entregue depois que a F4 entrou no ar.
 */
export function metricasProducao(email: string | undefined, tarefas: TarefaLimite[], agoraMs: number): { entregasSemana: number; tempoMedioMs: number | null; amostra: number } {
  const eu = norm(email)
  if (!eu) return { entregasSemana: 0, tempoMedioMs: null, amostra: 0 }
  const minhas: EntregaProducao[] = []
  for (const t of tarefas) if (!t.excluidoEm) for (const e of t.entregas || []) if (norm(e.por) === eu) minhas.push(e)
  const dentro = (dias: number) => (e: EntregaProducao) => { const n = new Date(e.em).getTime(); return Number.isFinite(n) && agoraMs - n <= dias * DIA_MS }
  const entregasSemana = minhas.filter(dentro(7)).length
  const comTempo = minhas.filter(dentro(30)).filter(e => (e.ms || 0) > 0)
  const tempoMedioMs = comTempo.length ? Math.round(comTempo.reduce((s, e) => s + (e.ms || 0), 0) / comTempo.length) : null
  return { entregasSemana, tempoMedioMs, amostra: comTempo.length }
}

/** "3h20", "1d 4h", "40min" — duração curta para as telas. */
export function fmtDuracao(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—'
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h${String(min % 60).padStart(2, '0')}`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

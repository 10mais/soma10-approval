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
}

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

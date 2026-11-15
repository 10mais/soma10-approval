// LIMITADOR DE DEMANDAS — lado servidor (Redis). A regra pura vive em lib/limiteDemandas (testada);
// aqui só se lê a configuração e as tarefas. Toda rota que muda status ou responsável de tarefa
// passa por verificarLimite: a regra vale em todo caminho, nunca só na tela.
import { redis, Tarefa, Cliente } from './redis'
import {
  normalizarConfigLimite, podeAssumir, podeForcarLimite, motivoExcecaoValido, textoExcecao, MIN_MOTIVO_EXCECAO,
  type ConfigLimite, type TarefaLimite, type Veredito,
} from './limiteDemandas'

export const CHAVE_CONFIG_LIMITE = 'config:limiteDemandas'

export async function getConfigLimite(): Promise<ConfigLimite> {
  const c = await redis.get<Partial<ConfigLimite>>(CHAVE_CONFIG_LIMITE).catch(() => null)
  return normalizarConfigLimite(c)
}

export async function salvarConfigLimite(c: Partial<ConfigLimite>): Promise<ConfigLimite> {
  const limpa = normalizarConfigLimite(c)
  await redis.set(CHAVE_CONFIG_LIMITE, limpa)
  return limpa
}

/** Todas as tarefas ativas (fora da lixeira). */
export async function tarefasAtivas(): Promise<Tarefa[]> {
  const ids = await redis.smembers('tarefas')
  if (!ids.length) return []
  return ((await redis.mget<(Tarefa | null)[]>(...ids.map(id => `tarefa:${id}`))).filter(Boolean) as Tarefa[]).filter(t => !(t as any).excluidoEm)
}

/** A mudança de `antes` para `depois` cabe nas vagas do responsável? */
export async function verificarLimite(antes: TarefaLimite | null | undefined, depois: TarefaLimite, quem?: { email?: string }, cache?: { cfg?: ConfigLimite; tarefas?: TarefaLimite[] }): Promise<Veredito> {
  const cfg = cache?.cfg || await getConfigLimite()
  if (!cfg.ligado) return { ok: true }
  const tarefas = cache?.tarefas || await tarefasAtivas()
  return podeAssumir(antes, depois, tarefas as TarefaLimite[], cfg, quem)
}

/** Resposta 409 padrão da recusa: o motivo e as peças que estão ocupando as vagas. */
export function corpoDaRecusa(v: Veredito, podeForcar = false) {
  return {
    error: v.motivo || 'Sem vaga livre para assumir esta demanda.',
    limite: true,
    ...(podeForcar ? { podeForcar: true } : {}),
    vagas: { ocupadas: v.vagas?.ocupadas ?? 0, limite: v.vagas?.limite ?? 0, tarefas: (v.vagas?.tarefas || []).map(t => ({ id: t.id, titulo: t.titulo, clienteNome: t.clienteNome, status: t.status })) },
  }
}

/** Gestor de projetos do squad do cliente da tarefa (para a exceção). */
async function gestorProjetosDe(clienteId?: string): Promise<string> {
  if (!clienteId) return ''
  const c = await redis.get<Cliente>(`cliente:${clienteId}`).catch(() => null)
  return (c?.squadPapeis?.gestor_projetos || '').trim()
}

export type ResultadoLimite =
  { ok: boolean; recusa?: ReturnType<typeof corpoDaRecusa>; status?: number; excecao?: string }

/**
 * verificarLimite + EXCEÇÃO DO GESTOR (F4). Sem vaga: recusa (409) dizendo se quem pede pode passar
 * do limite. Com `forcar.motivo` de quem pode (gestor de projetos do squad, gerente, admin), passa e
 * devolve o texto para o histórico da tarefa (`excecao`).
 */
export async function checarLimite(
  antes: TarefaLimite | null | undefined, depois: TarefaLimite & { clienteId?: string },
  quem: { email?: string; role?: string; nome?: string }, forcar?: { motivo?: string } | null,
): Promise<ResultadoLimite> {
  const v = await verificarLimite(antes, depois, quem)
  if (v.ok) return { ok: true }
  const pode = podeForcarLimite(quem, await gestorProjetosDe(depois.clienteId))
  if (pode && forcar && motivoExcecaoValido(forcar.motivo)) {
    return { ok: true, excecao: textoExcecao(v, depois, String(forcar.motivo), quem.nome) }
  }
  if (pode && forcar) return { ok: false, status: 400, recusa: { ...corpoDaRecusa(v, true), error: `Escreva o motivo para passar do limite (mínimo ${MIN_MOTIVO_EXCECAO} letras).` } }
  return { ok: false, status: 409, recusa: corpoDaRecusa(v, pode) }
}

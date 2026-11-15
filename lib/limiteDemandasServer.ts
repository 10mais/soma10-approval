// LIMITADOR DE DEMANDAS — lado servidor (Redis). A regra pura vive em lib/limiteDemandas (testada);
// aqui só se lê a configuração e as tarefas. Toda rota que muda status ou responsável de tarefa
// passa por verificarLimite: a regra vale em todo caminho, nunca só na tela.
import { redis, Tarefa } from './redis'
import { normalizarConfigLimite, podeAssumir, type ConfigLimite, type TarefaLimite, type Veredito } from './limiteDemandas'

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
export function corpoDaRecusa(v: Veredito) {
  return {
    error: v.motivo || 'Sem vaga livre para assumir esta demanda.',
    limite: true,
    vagas: { ocupadas: v.vagas?.ocupadas ?? 0, limite: v.vagas?.limite ?? 0, tarefas: (v.vagas?.tarefas || []).map(t => ({ id: t.id, titulo: t.titulo, clienteNome: t.clienteNome, status: t.status })) },
  }
}

import { redis } from './redis'
import { v4 as uuid } from 'uuid'
import { PIPES_KEY, ESTAGIOS_KEY } from './crmPipelines'
import { perfilDef, PerfilInstancia } from './perfisInstanciaCatalogo'

// Server-side: grava no Redis o preset do perfil escolhido no bootstrap.
// Catálogo (client-safe) em ./perfisInstanciaCatalogo. Retorna a chave aplicada
// ou null quando nenhum perfil foi pedido (instância nasce no padrão da agência).

export async function aplicarPerfilInstancia(chave?: string | null): Promise<PerfilInstancia | null> {
  const def = perfilDef(chave)
  if (!def) return null

  if (def.permissoesPapel) await redis.set('config:permissoesPapel', def.permissoesPapel)
  if (def.permissoesGranular) await redis.set('config:permissoesGranular', def.permissoesGranular)

  if (def.pipeline) {
    const pipelineId = uuid()
    await redis.set(PIPES_KEY, [{ id: pipelineId, nome: def.pipeline.nome, ordem: 0 }])
    await redis.set(ESTAGIOS_KEY, def.pipeline.estagios.map((e, i) => ({
      id: uuid(), nome: e.nome, ordem: i, pipelineId,
      ...(e.ganho ? { ganho: true } : {}), ...(e.perdido ? { perdido: true } : {}),
    })))
  }

  return def.chave
}

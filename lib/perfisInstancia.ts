import { redis } from './redis'
import { v4 as uuid } from 'uuid'
import { PIPES_KEY, ESTAGIOS_KEY } from './crmPipelines'
import { perfilDef, PerfilInstancia } from './perfisInstanciaCatalogo'

// Server-side: grava no Redis o preset do perfil escolhido no bootstrap.
// Catálogo (client-safe) em ./perfisInstanciaCatalogo. Retorna a chave aplicada
// ou null quando nenhum perfil foi pedido (instância nasce no padrão da agência).

// Perfil gravado na instância — o app lê isso pra adaptar telas/comportamento
// (ex.: home clínica, rótulo Pacientes, vínculo agenda↔contato).
export async function getPerfilInstancia(): Promise<PerfilInstancia | null> {
  const p = await redis.get<string>('config:perfilInstancia')
  return perfilDef(p)?.chave || null
}

export async function aplicarPerfilInstancia(chave?: string | null): Promise<PerfilInstancia | null> {
  const def = perfilDef(chave)
  if (!def) return null

  await redis.set('config:perfilInstancia', def.chave)
  if (def.permissoesPapel) await redis.set('config:permissoesPapel', def.permissoesPapel)
  if (def.permissoesGranular) await redis.set('config:permissoesGranular', def.permissoesGranular)

  if (def.pipelines?.length) {
    const pipes = def.pipelines.map((p, pi) => ({ id: uuid(), nome: p.nome, ordem: pi }))
    await redis.set(PIPES_KEY, pipes)
    await redis.set(ESTAGIOS_KEY, def.pipelines.flatMap((p, pi) => p.estagios.map((e, i) => ({
      id: uuid(), nome: e.nome, ordem: i, pipelineId: pipes[pi].id,
      ...(e.ganho ? { ganho: true } : {}), ...(e.perdido ? { perdido: true } : {}),
    }))))
  }

  if (def.playbook) {
    await redis.set('crm:playbookQualificacao', {
      roteiro: def.playbook.roteiro,
      cadencia: def.playbook.cadencia.map(p => ({ id: uuid(), ...p })),
    })
  }

  return def.chave
}

import { redis, CrmEstagio, CrmPipeline } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const PIPES_KEY = 'crm:pipelines'
export const ESTAGIOS_KEY = 'crm:estagios'

// Etapas padrão de um pipeline recém-criado (Ganho/Perdido são terminais).
export function estagiosPadrao(pipelineId: string): CrmEstagio[] {
  const nomes: [string, Partial<CrmEstagio>][] = [
    ['Lead', {}], ['Contato feito', {}], ['Reunião', {}], ['Proposta', {}],
    ['Negociação', {}], ['Ganho', { ganho: true }], ['Perdido', { perdido: true }],
  ]
  return nomes.map(([nome, extra], i) => ({ id: uuid(), nome, ordem: i, pipelineId, ...extra }))
}

// Garante >=1 pipeline e que todos os estágios tenham pipelineId. Idempotente —
// migra instalações antigas (estágios sem pipelineId caem no pipeline padrão).
export async function garantirSetupCrm(): Promise<{ pipelines: CrmPipeline[]; estagios: CrmEstagio[] }> {
  let pipelines = await redis.get<CrmPipeline[]>(PIPES_KEY)
  let estagios = await redis.get<CrmEstagio[]>(ESTAGIOS_KEY)
  let mudouPipes = false, mudouEst = false

  if (!Array.isArray(pipelines) || pipelines.length === 0) {
    pipelines = [{ id: uuid(), nome: 'Comercial', ordem: 0 }]
    mudouPipes = true
  }
  const padraoId = pipelines[0].id

  if (!Array.isArray(estagios) || estagios.length === 0) {
    estagios = estagiosPadrao(padraoId)
    mudouEst = true
  } else {
    for (const e of estagios) if (!e.pipelineId) { e.pipelineId = padraoId; mudouEst = true }
  }

  if (mudouPipes) await redis.set(PIPES_KEY, pipelines)
  if (mudouEst) await redis.set(ESTAGIOS_KEY, estagios)

  return {
    pipelines: [...pipelines].sort((a, b) => a.ordem - b.ordem),
    estagios: [...estagios].sort((a, b) => a.ordem - b.ordem),
  }
}

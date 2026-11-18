import { redis } from './redis'
import { normalizarSla, SLA_PADRAO, type Sla } from './planoAcao'

// Configurações operacionais ajustáveis (antes fixas no código). Chave: config:operacional
export type Operacional = {
  slaAprovacaoHoras: number   // horas em aprovação antes de alertar (antes fixo 24)
  lixeiraDias: number         // dias para restaurar itens excluídos (antes fixo 30)
  saudeDias: number           // meta da Saúde do Caixa em dias (antes fixo 60)
  prioridadePadrao: 'baixa' | 'media' | 'alta' // prioridade padrão de nova tarefa
  sla: Sla // combinados do plano de ação (lib/planoAcao, F4 de 17/11/2026)
}

export const OPERACIONAL_PADRAO: Operacional = {
  slaAprovacaoHoras: 24,
  lixeiraDias: 30,
  saudeDias: 60,
  prioridadePadrao: 'media',
  sla: SLA_PADRAO,
}

export async function getOperacional(): Promise<Operacional> {
  const c = await redis.get<Partial<Operacional>>('config:operacional')
  return { ...OPERACIONAL_PADRAO, ...(c || {}), sla: normalizarSla(c?.sla) }
}

import { redis } from './redis'
import { v4 as uuid } from 'uuid'

// Registro de auditoria: "quem fez o quê" nas ações sensíveis (excluir cliente,
// mudar permissões, resetar senha, restaurar backup...). Marca de SaaS profissional.
// Mesma filosofia do lib/erros: best-effort, NUNCA quebra o fluxo principal.

const TTL = 60 * 60 * 24 * 180 // 180 dias
const CAP = 500 // últimos N registros

export type RegistroAuditoria = {
  id: string
  ator: string // quem fez (nome ou e-mail)
  acao: string // slug: cliente_excluido, permissoes_alteradas, backup_restaurado...
  alvo?: string // o que foi afetado (nome/id legível)
  detalhe?: string
  criadoEm: string
}

export async function registrarAuditoria(ev: { ator?: string; acao: string; alvo?: string; detalhe?: string }): Promise<void> {
  try {
    const reg: RegistroAuditoria = {
      id: uuid(),
      ator: ev.ator || 'desconhecido',
      acao: ev.acao,
      alvo: ev.alvo,
      detalhe: ev.detalhe,
      criadoEm: new Date().toISOString(),
    }
    await redis.set(`audit:${reg.id}`, reg, { ex: TTL })
    await redis.lpush('auditoria:log', reg.id)
    await redis.ltrim('auditoria:log', 0, CAP - 1)
  } catch { /* auditoria nunca derruba o fluxo principal */ }
}

export async function listarAuditoria(limite = 100): Promise<RegistroAuditoria[]> {
  try {
    const ids = await redis.lrange('auditoria:log', 0, Math.max(0, limite - 1))
    if (!ids.length) return []
    const regs = await Promise.all(ids.map(id => redis.get<RegistroAuditoria>(`audit:${id}`)))
    return regs.filter(Boolean) as RegistroAuditoria[]
  } catch {
    return []
  }
}

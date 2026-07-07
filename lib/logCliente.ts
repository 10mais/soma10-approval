import { redis } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

// Registro (log) de TODAS as solicitações/decisões do cliente, para não se perder
// quando a notificação some ao editar. Descartável: cada entrada expira em 30 dias
// e os índices são podados por tempo.
const TTL_SEG = 30 * 24 * 60 * 60 // 30 dias
const RETENCAO_MS = TTL_SEG * 1000

export type TipoLogCliente =
  | 'aprovacao'
  | 'ajuste_layout'
  | 'ajuste_copy'
  | 'reprovacao'
  | 'corrigir_legenda'
  | 'solicitacao_conteudo'

export type LogCliente = {
  id: string
  ts: number
  clienteId: string
  clienteNome: string
  tipo: TipoLogCliente
  acao: string          // rótulo legível ("Pediu ajuste no layout")
  postId?: string
  resumo?: string       // trecho da legenda/título do material
  motivo?: string       // texto do pedido / observação do cliente
  origem?: string       // 'portal' | 'link' | 'codigo'
}

export async function registrarLogCliente(e: Omit<LogCliente, 'id' | 'ts'>): Promise<void> {
  try {
    const ts = Date.now()
    const log: LogCliente = { id: uuid(), ts, ...e }
    await redis.set(`log:${log.id}`, log, { ex: TTL_SEG })
    const corte = ts - RETENCAO_MS
    // Índice global + por cliente (ZSET pontuado por timestamp), podados por tempo.
    await redis.zadd('logs:cliente', { score: ts, member: log.id })
    await redis.zremrangebyscore('logs:cliente', 0, corte)
    if (e.clienteId) {
      await redis.zadd(`logs:cliente:${e.clienteId}`, { score: ts, member: log.id })
      await redis.zremrangebyscore(`logs:cliente:${e.clienteId}`, 0, corte)
    }
  } catch {
    // O log nunca pode quebrar a ação principal (aprovar/solicitar).
  }
}

export async function listarLogsCliente(opts: { clienteId?: string; postId?: string; limite?: number } = {}): Promise<LogCliente[]> {
  const key = opts.clienteId ? `logs:cliente:${opts.clienteId}` : 'logs:cliente'
  const limite = opts.limite || 300
  // Mais recentes primeiro (rev): pega os N ids de maior score.
  const ids = (await redis.zrange<string[]>(key, 0, limite - 1, { rev: true })) || []
  if (!ids.length) return []
  const entradas = (await Promise.all(ids.map(id => redis.get<LogCliente>(`log:${id}`)))).filter(Boolean) as LogCliente[]
  const filtradas = opts.postId ? entradas.filter(l => l.postId === opts.postId) : entradas
  return filtradas.sort((a, b) => b.ts - a.ts)
}

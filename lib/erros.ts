import { redis } from './redis'
import { v4 as uuid } from 'uuid'
import { notificarAdmins } from './notificacoes'

// Captura de erros server-side (observabilidade caseira, sem dependência externa).
// Grava o erro no Redis (TTL 14d, cap 200) e ALERTA os admins uma vez por janela
// (dedupe por escopo — evita floodar quando um cron falha em loop).
// Regra de ouro: NUNCA lança. Se a própria captura falhar, engole em silêncio —
// observabilidade jamais pode derrubar o fluxo principal.

const TTL_ERRO = 60 * 60 * 24 * 14 // 14 dias
const CAP_LOG = 200 // últimos N erros guardados
const JANELA_ALERTA = 60 * 30 // 30 min entre alertas do mesmo escopo

export type RegistroErro = {
  id: string
  escopo: string // ex.: 'cron/publicar', 'stripe/webhook', 'decision'
  mensagem: string
  stack?: string
  contexto?: Record<string, any>
  criadoEm: string
}

function mensagemDe(err: unknown): string {
  if (err instanceof Error) return err.message || err.name || 'erro'
  if (typeof err === 'string') return err
  try { return JSON.stringify(err) } catch { return String(err) }
}

function stackDe(err: unknown): string | undefined {
  if (err instanceof Error && err.stack) return err.stack.split('\n').slice(0, 8).join('\n')
  return undefined
}

// Registra um erro e (best-effort) alerta os admins. Devolve o id ou null.
export async function capturarErro(escopo: string, err: unknown, contexto?: Record<string, any>): Promise<string | null> {
  try {
    const registro: RegistroErro = {
      id: uuid(),
      escopo,
      mensagem: mensagemDe(err),
      stack: stackDe(err),
      contexto,
      criadoEm: new Date().toISOString(),
    }
    // Loga no console também (aparece nos runtime logs da Vercel).
    console.error(`[erro:${escopo}]`, registro.mensagem, registro.stack || '')

    await redis.set(`erro:${registro.id}`, registro, { ex: TTL_ERRO })
    await redis.lpush('erros:log', registro.id)
    await redis.ltrim('erros:log', 0, CAP_LOG - 1)

    // Alerta os admins no máximo 1x por janela por escopo (anti-flood).
    const primeira = await redis.set(`erro_alerta:${escopo}`, '1', { nx: true, ex: JANELA_ALERTA })
    if (primeira) {
      await notificarAdmins(
        'geral',
        'Falha no sistema',
        `Ocorreu um erro em "${escopo}": ${registro.mensagem}. Veja em Configurações → Saúde do sistema.`,
      ).catch(() => {})
    }
    return registro.id
  } catch {
    // Observabilidade nunca derruba o fluxo principal.
    return null
  }
}

// Lista os últimos erros registrados (para o painel admin de Saúde do sistema).
export async function listarErros(limite = 50): Promise<RegistroErro[]> {
  try {
    const ids = await redis.lrange('erros:log', 0, Math.max(0, limite - 1))
    if (!ids.length) return []
    const regs = await Promise.all(ids.map(id => redis.get<RegistroErro>(`erro:${id}`)))
    return regs.filter(Boolean) as RegistroErro[]
  } catch {
    return []
  }
}

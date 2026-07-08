import { redis } from './redis'

// Proteção contra força bruta no login: conta as falhas por e-mail numa janela
// e bloqueia temporariamente ao passar do limite. Best-effort (falha aberta —
// nunca trava o login por erro de infraestrutura). Zerado a cada login correto.

const JANELA = 60 * 15 // 15 minutos
const LIMITE = 8 // tentativas erradas antes de bloquear

const chave = (email: string) => `login_fail:${(email || '').trim().toLowerCase()}`

export async function loginBloqueado(email: string): Promise<boolean> {
  try {
    const n = await redis.get<number>(chave(email))
    return (Number(n) || 0) >= LIMITE
  } catch {
    return false // falha aberta: infra fora não pode trancar todo mundo
  }
}

export async function registrarFalhaLogin(email: string): Promise<void> {
  try {
    const k = chave(email)
    const n = await redis.incr(k)
    if (n === 1) await redis.expire(k, JANELA)
  } catch { /* best-effort */ }
}

export async function limparFalhasLogin(email: string): Promise<void> {
  try {
    await redis.del(chave(email))
  } catch { /* best-effort */ }
}

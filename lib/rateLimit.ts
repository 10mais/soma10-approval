import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

// Rate limiting simples (janela fixa) no Redis — protege os endpoints públicos de
// abuso/spam sem dependência nova. Chave por IP + rota. Falha aberta (se o Redis
// oscilar, não bloqueia usuário legítimo).
export async function rateLimit(chave: string, limite: number, janelaSeg: number): Promise<boolean> {
  try {
    const k = `rl:${chave}`
    const n = await redis.incr(k)
    if (n === 1) await redis.expire(k, janelaSeg)
    return n <= limite
  } catch {
    return true // nunca bloqueia por erro interno
  }
}

// IP do cliente atrás do proxy da Vercel.
export function ipDaReq(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'desconhecido'
}

// Aplica o limite e, se estourar, devolve a resposta 429 pronta (ou null se OK).
export async function checarRate(req: NextRequest, rota: string, limite: number, janelaSeg: number): Promise<NextResponse | null> {
  const ok = await rateLimit(`${rota}:${ipDaReq(req)}`, limite, janelaSeg)
  if (ok) return null
  return NextResponse.json({ error: 'Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.' }, { status: 429 })
}

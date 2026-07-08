import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Health check público e leve — para monitores de uptime (ex.: UptimeRobot,
// BetterStack). Só confirma que o app responde e que o Redis está de pé.
// NÃO expõe nada sensível. Devolve 503 se o banco estiver fora (o monitor alerta).
export async function GET() {
  const inicio = Date.now()
  let bancoOk = false
  try {
    const pong = await redis.ping()
    bancoOk = pong === 'PONG' || pong === 'pong' || !!pong
  } catch {
    bancoOk = false
  }
  const body = {
    ok: bancoOk,
    redis: bancoOk ? 'up' : 'down',
    latenciaMs: Date.now() - inicio,
    ts: new Date().toISOString(),
  }
  return NextResponse.json(body, {
    status: bancoOk ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}

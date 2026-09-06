import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { normalizarConfig, regraDoDia } from '@/lib/regrasDoMes'

export const runtime = 'nodejs'

// Regras inegociáveis do mês (10, jan–out) + frases de inspiração por dia.
// GET: qualquer pessoa da equipe (a Home e o splash leem); PUT: só admin.
const CHAVE = 'config:regrasDoMes'

export async function GET() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const cfg = normalizarConfig(await redis.get(CHAVE).catch(() => null))
  return NextResponse.json({ ...cfg, hoje: regraDoDia(cfg) })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'só admin' }, { status: 403 })
  const bruto = await req.json().catch(() => null)
  const cfg = normalizarConfig(bruto)
  await redis.set(CHAVE, cfg)
  // A Home guarda cache de 60s por pessoa; regra nova aparece no próximo minuto.
  return NextResponse.json({ ok: true, ...cfg, hoje: regraDoDia(cfg) })
}

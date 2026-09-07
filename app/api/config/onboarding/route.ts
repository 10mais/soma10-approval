import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { normalizarConfig, DETECTORES } from '@/lib/onboardingConfig'
import { CHAVE_ONBOARDING, lerConfigOnboarding } from '@/lib/onboardingConfigStore'

export const runtime = 'nodejs'

// Fases e etapas do onboarding (Configurações → Onboarding).
// GET: equipe (o hub e a rota de fase leem); PUT: só admin.
export async function GET() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const cfg = await lerConfigOnboarding()
  return NextResponse.json({ ...cfg, detectores: DETECTORES })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'só admin' }, { status: 403 })
  const bruto = await req.json().catch(() => null)
  const cfg = normalizarConfig(bruto)
  await redis.set(CHAVE_ONBOARDING, cfg)
  return NextResponse.json({ ok: true, ...cfg, detectores: DETECTORES })
}

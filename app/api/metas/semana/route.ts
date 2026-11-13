import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { normalizaMetasSemana, type MetasSemana } from '@/lib/painelClinica'

export const runtime = 'nodejs'

// METAS DA SEMANA da clínica (quantidade): consultas novas, retornos e
// comparecimentos — plano aprovado pelo dono em 13/11/2026. Valem para toda
// semana; o Painel do CRM leva a meta para o mês na proporção dos dias.
//
// Quem VÊ: a equipe. Quem DEFINE: só o admin (mesma regra da meta em R$, em
// /api/metas). O realizado não fica aqui: sai da Agenda na hora de mostrar.
const CHAVE = 'meta:semana-clinica'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const bruta = await redis.get<MetasSemana>(CHAVE).catch(() => null)
  return NextResponse.json({ metas: normalizaMetasSemana(bruta) })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'só o admin define as metas' }, { status: 403 })
  const b = await req.json().catch(() => null)
  if (!b || typeof b !== 'object') return NextResponse.json({ error: 'corpo inválido' }, { status: 400 })
  const metas = normalizaMetasSemana({
    ...b,
    atualizadoEm: new Date().toISOString(),
    atualizadoPorNome: String((session.user as any)?.name || ''),
  })
  await redis.set(CHAVE, metas)
  return NextResponse.json({ ok: true, metas })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'

export const runtime = 'nodejs'

export type ResumoTemplatePreset = { id: string; nome: string; intro: string; fechamento: string }
const CHAVE = 'config:resumoTemplates'

async function carregar(): Promise<ResumoTemplatePreset[]> {
  const t = await redis.get<ResumoTemplatePreset[]>(CHAVE)
  return Array.isArray(t) ? t : []
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json(await carregar())
}

// PUT salva a lista inteira de predefinicoes (admin/gerente).
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const body = await req.json()
  const lista: ResumoTemplatePreset[] = Array.isArray(body.templates)
    ? body.templates.map((t: any) => ({ id: String(t.id), nome: String(t.nome || 'Predefinição'), intro: String(t.intro || ''), fechamento: String(t.fechamento || '') }))
    : []
  await redis.set(CHAVE, lista)
  return NextResponse.json({ ok: true, templates: lista })
}

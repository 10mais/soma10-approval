import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'

export const runtime = 'nodejs'

export type TipoTarefaCustom = { key: string; label: string; cor: string; icone: string }

const CHAVE = 'tipos:tarefa'
// Icone padrao (etiqueta) para tipos personalizados
const ICONE_PADRAO = 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01'
// Chaves dos tipos embutidos (nao podem colidir)
const RESERVADAS = ['carrossel', 'criativo', 'ecommerce', 'estrategia', 'landing_page', 'planejamento', 'post', 'reel', 'story', 'tarefa', 'video', '__novo__']

async function carregar(): Promise<TipoTarefaCustom[]> {
  const t = await redis.get<TipoTarefaCustom[]>(CHAVE)
  return Array.isArray(t) ? t : []
}

function slugify(label: string): string {
  return label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'tipo'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  return NextResponse.json(await carregar())
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })

  const body = await req.json()
  const label = (body.label || '').trim()
  if (!label) return NextResponse.json({ error: 'Informe o nome do tipo' }, { status: 400 })
  const cor = /^#[0-9a-fA-F]{6}$/.test(body.cor || '') ? body.cor : '#6b7280'

  const tipos = await carregar()
  // Gera uma key unica a partir do nome
  const base = slugify(label)
  let key = base
  let i = 2
  while (tipos.some(t => t.key === key) || RESERVADAS.includes(key)) { key = `${base}_${i++}` }

  const novo: TipoTarefaCustom = { key, label, cor, icone: body.icone || ICONE_PADRAO }
  const atualizado = [...tipos, novo]
  await redis.set(CHAVE, atualizado)
  return NextResponse.json({ ok: true, tipo: novo, tipos: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key obrigatorio' }, { status: 400 })
  const tipos = await carregar()
  const atualizado = tipos.filter(t => t.key !== key)
  await redis.set(CHAVE, atualizado)
  return NextResponse.json({ ok: true, tipos: atualizado })
}

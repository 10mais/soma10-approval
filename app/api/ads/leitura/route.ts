import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'

export const runtime = 'nodejs'

// LEITURA DO PERÍODO — o texto do gestor sobre o mês (dono, 09/09/2026: a tela substitui o
// PPT de mensuração). É o que transforma número em conversa e vai junto no PDF enviado
// depois. Uma chave por cliente e mês: `ads_leitura:{clienteId}:{AAAA-MM}`.
const RE_PERIODO = /^\d{4}-\d{2}$/

function chave(clienteId: string, periodo: string): string | null {
  if (!clienteId || !RE_PERIODO.test(periodo)) return null
  return `ads_leitura:${clienteId}:${periodo}`
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const role = (session.user as any).role
  let clienteId = req.nextUrl.searchParams.get('clienteId') || ''
  if (role === 'cliente') clienteId = (session.user as any).clienteId || ''
  const k = chave(clienteId, req.nextUrl.searchParams.get('periodo') || '')
  if (!k) return NextResponse.json({ texto: '' })
  const texto = await redis.get<string>(k)
  return NextResponse.json({ texto: texto || '' })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const { clienteId, periodo, texto } = await req.json()
  const k = chave(String(clienteId || ''), String(periodo || ''))
  if (!k) return NextResponse.json({ error: 'cliente e periodo (AAAA-MM) obrigatorios' }, { status: 400 })
  const limpo = String(texto || '').slice(0, 4000)
  if (limpo.trim()) await redis.set(k, limpo)
  else await redis.del(k)
  return NextResponse.json({ ok: true })
}

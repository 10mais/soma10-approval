import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, CrmEstagio } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

const CHAVE = 'crm:estagios'

// Funil padrão (editável). Ganho/Perdido são estágios terminais.
function padrao(): CrmEstagio[] {
  const nomes: [string, Partial<CrmEstagio>][] = [
    ['Lead', {}], ['Contato feito', {}], ['Reunião', {}], ['Proposta', {}],
    ['Negociação', {}], ['Ganho', { ganho: true }], ['Perdido', { perdido: true }],
  ]
  return nomes.map(([nome, extra], i) => ({ id: uuid(), nome, ordem: i, ...extra }))
}

async function carregar(): Promise<CrmEstagio[]> {
  const t = await redis.get<CrmEstagio[]>(CHAVE)
  if (Array.isArray(t) && t.length) return [...t].sort((a, b) => a.ordem - b.ordem)
  // Semente na primeira leitura
  const novo = padrao()
  await redis.set(CHAVE, novo)
  return novo
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json(await carregar())
}

// PUT salva a lista inteira (admin/gerente). Mantém pelo menos 1 ganho e 1 perdido.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const body = await req.json()
  let lista: CrmEstagio[] = Array.isArray(body.estagios)
    ? body.estagios.map((e: any, i: number) => ({ id: String(e.id || uuid()), nome: String(e.nome || 'Estágio'), ordem: typeof e.ordem === 'number' ? e.ordem : i, ...(e.ganho ? { ganho: true } : {}), ...(e.perdido ? { perdido: true } : {}) }))
    : []
  if (!lista.length) lista = padrao()
  if (!lista.some(e => e.ganho)) lista.push({ id: uuid(), nome: 'Ganho', ordem: lista.length, ganho: true })
  if (!lista.some(e => e.perdido)) lista.push({ id: uuid(), nome: 'Perdido', ordem: lista.length, perdido: true })
  lista.sort((a, b) => a.ordem - b.ordem)
  await redis.set(CHAVE, lista)
  return NextResponse.json({ ok: true, estagios: lista })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Loja } from '@/lib/redis'
import { resolverEscopoLoja } from '@/lib/escopoLoja'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Lojas/filiais do varejo (perfil telefonia). Lista única por instância —
// padrão config:contasBancarias (PUT salva a lista inteira). GET é liberado à
// equipe (o seletor de loja precisa das lojas); escrever/remover é do admin.
const KEY = 'config:lojas'

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

export async function GET() {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const todas = (await redis.get<Loja[]>(KEY)) || []
  const lista = Array.isArray(todas) ? todas : []
  // Escopo: operador travado só vê a SUA loja (nem o nome das outras vaza no seletor);
  // sem loja atribuída = não vê nenhuma. Admin/gestor veem todas.
  const esc = resolverEscopoLoja({ role: (session.user as any).role, lojaId: (session.user as any).lojaId })
  if (esc.tipo === 'loja') return NextResponse.json(lista.filter(l => l.id === esc.lojaId))
  if (esc.tipo === 'bloqueado') return NextResponse.json([])
  return NextResponse.json(lista)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { lojas } = await req.json()
  if (!Array.isArray(lojas)) return NextResponse.json({ error: 'lista inválida' }, { status: 400 })
  const antigas = (await redis.get<Loja[]>(KEY)) || []
  const limpa: Loja[] = lojas
    .filter((l: any) => String(l?.nome || '').trim())
    .map((l: any) => ({
      id: l.id || uuid(),
      nome: String(l.nome).trim().slice(0, 80),
      endereco: (l.endereco || '').toString().trim().slice(0, 200) || undefined,
      ativa: l.ativa !== false,
      // Nome da instância Evolution da loja (WhatsApp por loja) — sanitizado.
      evolutionInstance: (l.evolutionInstance || '').toString().trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || undefined,
      criadoEm: antigas.find(a => a.id === l.id)?.criadoEm || new Date().toISOString(),
    }))
  await redis.set(KEY, limpa)
  return NextResponse.json({ ok: true, lojas: limpa })
}

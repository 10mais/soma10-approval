import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { getPermissoesPapel, PermissoesPapel } from '@/lib/permissoesPapel'
import { registrarAuditoria } from '@/lib/auditoria'

export const runtime = 'nodejs'

// GET: qualquer logado nao-cliente (o dashboard usa para gatear o menu).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json(await getPermissoesPapel())
}

// PUT: só admin configura.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const body = await req.json()
  const atual = await getPermissoesPapel()
  const novo: PermissoesPapel = {
    ...atual,
    ...(body.gerente ? { gerente: { ...atual.gerente, ...body.gerente } } : {}),
    ...(body.usuario ? { usuario: { ...atual.usuario, ...body.usuario } } : {}),
  }
  await redis.set('config:permissoesPapel', novo)
  await registrarAuditoria({ ator: session.user?.name || session.user?.email || 'admin', acao: 'permissoes_papel_alteradas', detalhe: 'Matriz de permissões por papel atualizada' })
  return NextResponse.json({ ok: true, permissoes: novo })
}

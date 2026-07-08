import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { getPermGranularPapel } from '@/lib/permissoesGranularServer'
import { registrarAuditoria } from '@/lib/auditoria'

export const runtime = 'nodejs'

// Config de permissões detalhadas POR PAPEL (gerente/usuario). Leitura p/ equipe; escrita só admin.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json(await getPermGranularPapel())
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const body = await req.json()
  const limpo: any = {}
  for (const papel of ['gerente', 'usuario'] as const) {
    if (body?.[papel]) limpo[papel] = { abas: body[papel].abas || {}, acoes: body[papel].acoes || {} }
  }
  await redis.set('config:permissoesGranular', limpo)
  await registrarAuditoria({ ator: session.user?.name || session.user?.email || 'admin', acao: 'permissoes_granular_alteradas', detalhe: 'Permissões detalhadas (telas/ações) atualizadas' })
  return NextResponse.json({ ok: true })
}

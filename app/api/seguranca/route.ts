import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { doisFatoresGlobalAtivo, setDoisFatoresGlobal } from '@/lib/seguranca'
import { registrarAuditoria } from '@/lib/auditoria'

export const runtime = 'nodejs'

// Interruptor global do 2FA — SOMENTE ADMIN.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json({ doisFatores: await doisFatoresGlobalAtivo() })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { doisFatores } = await req.json().catch(() => ({} as any))
  await setDoisFatoresGlobal(!!doisFatores)
  await registrarAuditoria({ ator: session.user?.name || session.user?.email || 'admin', acao: doisFatores ? '2fa_global_ligado' : '2fa_global_desligado', detalhe: 'Interruptor global da verificação em 2 fatores' })
  return NextResponse.json({ ok: true, doisFatores: !!doisFatores })
}

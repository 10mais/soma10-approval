import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exportarTudo } from '@/lib/backup'

export const runtime = 'nodejs'
export const maxDuration = 300

// Download on-demand do backup completo — SOMENTE ADMIN. Devolve o JSON como
// arquivo (attachment). Não armazena nada; é o "exportar agora".
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  const dados = await exportarTudo()
  const agora = new Date()
  dados._meta.geradoEm = agora.toISOString()
  const dia = agora.toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="backup-soma10-${dia}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}

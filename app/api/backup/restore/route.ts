import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { list } from '@vercel/blob'
import { restaurarBackup } from '@/lib/backup'
import { registrarAuditoria } from '@/lib/auditoria'
import { capturarErro } from '@/lib/erros'

export const runtime = 'nodejs'
export const maxDuration = 300

// Restauração de backup (recuperação de desastre) — SOMENTE ADMIN, com dupla
// trava (exige o texto "RESTAURAR"). Dois modos:
//  - { pathname } : lê o backup gerenciado do Blob no SERVIDOR (sem limite de
//    corpo — caminho recomendado para bancos grandes).
//  - { dados }    : backup enviado pelo cliente (arquivo baixado; sujeito ao
//    limite de ~4,5MB da Vercel).
// UPSERT (nunca apaga; ver lib/backup.restaurarBackup). Registra na auditoria.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  const { dados, pathname, confirmar } = await req.json().catch(() => ({} as any))
  if (confirmar !== 'RESTAURAR') {
    return NextResponse.json({ error: 'confirmação inválida — digite RESTAURAR' }, { status: 400 })
  }

  try {
    let payload = dados
    let origem = 'arquivo enviado'
    if (pathname) {
      if (!/^backups\/[\w-]+\.json$/.test(String(pathname))) {
        return NextResponse.json({ error: 'caminho de backup inválido' }, { status: 400 })
      }
      const token = process.env.BLOB_READ_WRITE_TOKEN
      const { blobs } = await list({ prefix: 'backups/', token })
      const alvo = blobs.find(b => b.pathname === pathname)
      if (!alvo) return NextResponse.json({ error: 'backup não encontrado' }, { status: 404 })
      const res = await fetch(alvo.url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      payload = await res.json()
      origem = pathname
    }
    if (!payload || !payload._meta) {
      return NextResponse.json({ error: 'arquivo de backup inválido' }, { status: 400 })
    }

    const r = await restaurarBackup(payload)
    const ator = session.user?.name || session.user?.email || 'admin'
    await registrarAuditoria({ ator, acao: 'backup_restaurado', alvo: origem, detalhe: `Contagens: ${JSON.stringify(r.contagens)}` })
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    await capturarErro('backup/restore', e)
    return NextResponse.json({ error: e?.message || 'falha ao restaurar' }, { status: 500 })
  }
}

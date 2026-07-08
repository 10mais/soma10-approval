import { NextRequest, NextResponse } from 'next/server'
import { cronAutorizado } from '@/lib/cronAuth'
import { salvarBackup } from '@/lib/backup'
import { capturarErro } from '@/lib/erros'

export const runtime = 'nodejs'
export const maxDuration = 300

// Backup diário do Redis -> Blob privado. Protegido por CRON_SECRET.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: 'armazenamento (Blob) não configurado' }, { status: 500 })
  try {
    const r = await salvarBackup()
    console.log('[cron/backup]', JSON.stringify(r))
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    console.error('[cron/backup] erro:', e?.message)
    await capturarErro('cron/backup', e)
    return NextResponse.json({ error: e?.message || 'falha no backup' }, { status: 500 })
  }
}

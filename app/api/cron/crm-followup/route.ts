import { NextRequest, NextResponse } from 'next/server'
import { redis, CrmNegocio } from '@/lib/redis'
import { notificar } from '@/lib/notificacoes'

export const runtime = 'nodejs'

// Cron diário (cron-job.org, com ?secret=CRON_SECRET): avisa o dono dos negócios
// abertos cujo próximo follow-up venceu (hoje ou antes). Dedupe por dia.
export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET && req.nextUrl.searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const ids = await redis.smembers('crm:negocios')
  const negocios = ids.length ? ((await redis.mget<(CrmNegocio | null)[]>(...ids.map(i => `negocio:${i}`))).filter(Boolean) as CrmNegocio[]) : []

  const hojeFim = new Date(); hojeFim.setHours(23, 59, 59, 999)
  const hojeStr = new Date().toISOString().slice(0, 10)
  let avisados = 0

  for (const n of negocios) {
    if (n.status !== 'aberto' || !n.proximoFollowUp || !n.dono) continue
    if (new Date(n.proximoFollowUp).getTime() > hojeFim.getTime()) continue
    // Dedupe: 1 aviso por negócio por dia
    const chaveDedupe = `crm_followup_notif:${n.id}:${hojeStr}`
    const jaAvisou = await redis.set(chaveDedupe, '1', { nx: true, ex: 60 * 60 * 26 })
    if (jaAvisou !== 'OK') continue
    const venc = new Date(n.proximoFollowUp).toLocaleDateString('pt-BR')
    await notificar(n.dono, 'geral', `Follow-up: ${n.titulo}`, `Hora de retomar o contato (follow-up previsto para ${venc})${n.empresa ? ` — ${n.empresa}` : ''}.`).catch(() => {})
    avisados++
  }

  return NextResponse.json({ ok: true, avisados, total: negocios.length })
}

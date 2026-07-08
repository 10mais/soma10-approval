import { NextRequest, NextResponse } from 'next/server'
import { redis, CrmNegocio } from '@/lib/redis'
import { notificar } from '@/lib/notificacoes'
import { cronAutorizado } from '@/lib/cronAuth'
import { capturarErro } from '@/lib/erros'

export const runtime = 'nodejs'

// Cron diário: avisa o dono dos negócios abertos cujo follow-up/agendamento
// venceu (hoje ou antes). Dedupe por dia. Aceita ?secret= ou Authorization.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  try {
    return await rodarFollowups()
  } catch (e) {
    await capturarErro('cron/crm-followup', e)
    return NextResponse.json({ error: 'falha nos follow-ups' }, { status: 500 })
  }
}

async function rodarFollowups(): Promise<NextResponse> {
  const ids = await redis.smembers('crm:negocios')
  const negocios = ids.length ? ((await redis.mget<(CrmNegocio | null)[]>(...ids.map(i => `negocio:${i}`))).filter(Boolean) as CrmNegocio[]) : []

  const hojeFim = new Date(); hojeFim.setHours(23, 59, 59, 999)
  const hojeStr = new Date().toISOString().slice(0, 10)
  let avisados = 0

  for (const n of negocios) {
    if (n.status !== 'aberto' || !n.dono) continue

    // 1) Próximo follow-up simples (campo proximoFollowUp)
    if (n.proximoFollowUp && new Date(n.proximoFollowUp).getTime() <= hojeFim.getTime()) {
      const chaveDedupe = `crm_followup_notif:${n.id}:${hojeStr}`
      const jaAvisou = await redis.set(chaveDedupe, '1', { nx: true, ex: 60 * 60 * 26 })
      if (jaAvisou === 'OK') {
        const venc = new Date(n.proximoFollowUp).toLocaleDateString('pt-BR')
        await notificar(n.dono, 'crm_followup', `Follow-up: ${n.titulo}`, `Hora de retomar o contato (follow-up previsto para ${venc})${n.empresa ? ` — ${n.empresa}` : ''}.`).catch(() => {})
        avisados++
      }
    }

    // 2) Cadência: toques agendados que venceram (hoje ou antes) e não foram feitos
    for (const a of (n.agendamentos || [])) {
      if (a.feito || !a.quando) continue
      if (new Date(a.quando + 'T23:59:59').getTime() > hojeFim.getTime()) continue
      const chave = `crm_agenda_notif:${a.id}:${hojeStr}`
      const ja = await redis.set(chave, '1', { nx: true, ex: 60 * 60 * 26 })
      if (ja !== 'OK') continue
      const tipo = /reuni/i.test(a.canal) ? 'crm_reuniao' as const : 'crm_followup' as const
      await notificar(n.dono, tipo, `Agendamento: ${a.titulo}`, `${n.titulo}${n.empresa ? ` — ${n.empresa}` : ''} · canal: ${a.canal}${a.nota ? `. ${a.nota.slice(0, 120)}` : ''}`).catch(() => {})
      avisados++
    }
  }

  return NextResponse.json({ ok: true, avisados, total: negocios.length })
}

import { NextRequest, NextResponse } from 'next/server'
import { redis, Tarefa } from '@/lib/redis'
import { notificar } from '@/lib/notificacoes'
import { cronAutorizado } from '@/lib/cronAuth'
import { capturarErro } from '@/lib/erros'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  try {
    return await rodarPrazos()
  } catch (e) {
    await capturarErro('cron/tarefas', e)
    return NextResponse.json({ error: 'falha nos prazos de tarefa' }, { status: 500 })
  }
}

async function rodarPrazos(): Promise<NextResponse> {
  const ids = await redis.smembers('tarefas')
  const tarefas = (await Promise.all(ids.map(id => redis.get<Tarefa>(`tarefa:${id}`)))).filter(Boolean) as Tarefa[]
  const agora = Date.now()
  const UMA_HORA = 60 * 60 * 1000
  let notificados = 0

  for (const t of tarefas) {
    if (!t.prazo || t.status === 'concluido' || !t.responsavelEmail) continue
    const prazoMs = new Date(t.prazo).getTime()
    const diff = prazoMs - agora
    const chaveProximo = `tarefa_notif_proximo:${t.id}`
    const chaveVencida = `tarefa_notif_vencida:${t.id}`

    // Prazo proximo (entre 0 e 1h)
    if (diff > 0 && diff <= UMA_HORA) {
      const jaNotificou = await redis.get(chaveProximo)
      if (!jaNotificou) {
        await notificar(t.responsavelEmail, 'tarefa_prazo_proximo', 'Prazo proximo', `A tarefa "${t.titulo}" vence em menos de 1 hora.`, undefined, t.id)
        await redis.set(chaveProximo, '1')
        await redis.expire(chaveProximo, 7200)
        notificados++
      }
    }

    // Tarefa vencida (ate 2h atras para nao re-notificar infinitamente)
    if (diff < 0 && diff > -2 * UMA_HORA) {
      const jaNotificou = await redis.get(chaveVencida)
      if (!jaNotificou) {
        await notificar(t.responsavelEmail, 'tarefa_vencida', 'Tarefa vencida', `A tarefa "${t.titulo}" venceu o prazo.`, undefined, t.id)
        await redis.set(chaveVencida, '1')
        await redis.expire(chaveVencida, 86400)
        notificados++
      }
    }
  }

  return NextResponse.json({ ok: true, verificadas: tarefas.length, notificados })
}

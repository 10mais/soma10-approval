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

    // ABORDAGEM do CRM (jornada do contato): o comercial precisa se organizar,
    // então avisa NA SEMANA e NO DIA — e não pelo "falta 1h" das tarefas comuns
    // (um retorno marcado para daqui a 90 dias não se resolve em 1 hora).
    if ((t as any).tipo === 'retorno_paciente') {
      const dataBR = new Date(prazoMs).toLocaleDateString('pt-BR')
      const SEMANA = 7 * 24 * UMA_HORA
      // 1) Entrou na semana da abordagem. Se a tarefa JÁ nasceu dentro da semana,
      //    o aviso da criação já cobriu — não repete.
      if (diff > 0 && diff <= SEMANA) {
        const nasceuDentroDaSemana = prazoMs - new Date(t.criadoEm).getTime() <= SEMANA
        const chaveSemana = `tarefa_notif_semana:${t.id}`
        if (!nasceuDentroDaSemana && !(await redis.get(chaveSemana))) {
          await notificar(t.responsavelEmail, 'tarefa_prazo_proximo', 'Abordagem esta semana', `"${t.titulo}" está marcada para ${dataBR}.`, undefined, t.id)
          await redis.set(chaveSemana, '1', { ex: 8 * 24 * 3600 })
          notificados++
        }
      }
      // 2) É HOJE — avisa de manhã (a partir das 8h), não de madrugada.
      const ehHoje = new Date(prazoMs).toDateString() === new Date(agora).toDateString()
      if (ehHoje && new Date(agora).getHours() >= 8) {
        const chaveDia = `tarefa_notif_dia:${t.id}`
        if (!(await redis.get(chaveDia))) {
          await notificar(t.responsavelEmail, 'tarefa_prazo_proximo', 'Abordagem hoje', `"${t.titulo}" é hoje (${dataBR}).`, undefined, t.id)
          await redis.set(chaveDia, '1', { ex: 20 * 3600 })
          notificados++
        }
      }
      // Segue para "vencida" abaixo; pula a regra de 1h (já avisada no dia).
      if (diff > 0) continue
    }

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

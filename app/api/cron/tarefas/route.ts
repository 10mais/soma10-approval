import { diaDoInstante, fmtDiaDoInstante, horaBR, ehFimDoDiaBR, somarDias } from '@/lib/datas'
import { NextRequest, NextResponse } from 'next/server'
import { redis, Tarefa, Usuario, Veiculo } from '@/lib/redis'
import { notificar } from '@/lib/notificacoes'
import { cronAutorizado } from '@/lib/cronAuth'
import { capturarErro } from '@/lib/erros'
import { alertasDaFrota } from '@/lib/frotaAlertas'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  try {
    // Vencimentos da frota viram Tarefa ANTES de rodar os prazos — assim uma
    // tarefa criada agora já entra na varredura de avisos do mesmo ciclo.
    const frota = await gerarTarefasFrota()
    const r = await rodarPrazos()
    const body = await r.json()
    return NextResponse.json({ ...body, tarefasFrota: frota })
  } catch (e) {
    await capturarErro('cron/tarefas', e)
    return NextResponse.json({ error: 'falha nos prazos de tarefa' }, { status: 500 })
  }
}

// Documento vencendo e revisão prevista viram Tarefa (uma vez cada — a chave do
// alerta carrega a data, então renovar o documento gera alerta novo no ano seguinte).
// Dono: gerente (operação), caindo no admin quando não houver. Só roda se a
// instância for turismo — as outras não têm frota.
async function gerarTarefasFrota(): Promise<number> {
  const perfil = await redis.get<string>('config:perfilInstancia')
  if (perfil !== 'turismo') return 0

  const ids = await redis.smembers('veiculos')
  if (!ids.length) return 0
  const veiculos = (await redis.mget<(Veiculo | null)[]>(...ids.map(i => `veiculo:${i}`))).filter(Boolean) as Veiculo[]
  const alertas = alertasDaFrota(veiculos as any, new Date().toISOString().slice(0, 10))
  if (!alertas.length) return 0

  const emails = await redis.smembers('usuarios')
  const equipe = (await Promise.all(emails.map(e => redis.get<Usuario>(`usuario:${e}`)))).filter(Boolean) as Usuario[]
  const dono = equipe.find(u => u.role === 'gerente') || equipe.find(u => u.role === 'admin')
  if (!dono) return 0

  const agora = new Date().toISOString()
  let criadas = 0
  for (const a of alertas) {
    const chave = `frota_alerta:${a.chave}`
    if (await redis.get(chave)) continue
    const tarefa: any = {
      id: uuid(), titulo: a.titulo, descricao: a.descricao,
      status: 'a_fazer', prioridade: 'alta', tipo: 'frota_vencimento',
      responsavelEmail: dono.email, responsavelNome: dono.nome,
      prazo: `${a.quando}T09:00:00`, criadoPor: 'Sistema', criadoEm: agora, atualizadoEm: agora,
    }
    await redis.set(`tarefa:${tarefa.id}`, tarefa)
    await redis.sadd('tarefas', tarefa.id)
    // 120 dias cobre a janela de vencido (60) com folga, sem reviver o alerta.
    await redis.set(chave, tarefa.id, { ex: 120 * 24 * 3600 })
    await notificar(dono.email, 'tarefa_atribuida', 'Frota — vencimento', a.titulo, undefined, tarefa.id).catch(() => {})
    criadas++
  }
  return criadas
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

    // ABORDAGEM do CRM (jornada do contato) e VENCIMENTO da frota: quem recebe
    // precisa se organizar, então avisa NA SEMANA e NO DIA — e não pelo "falta 1h"
    // das tarefas comuns (um retorno de 90 dias, ou um licenciamento, não se
    // resolve em 1 hora).
    if ((t as any).tipo === 'retorno_paciente' || (t as any).tipo === 'frota_vencimento') {
      const dataBR = fmtDiaDoInstante(t.prazo) // o servidor roda em UTC: o dia e a hora são os de Brasília
      const SEMANA = 7 * 24 * UMA_HORA
      const assunto = (t as any).tipo === 'frota_vencimento' ? 'Frota' : 'Abordagem'
      // 1) Entrou na semana da abordagem. Se a tarefa JÁ nasceu dentro da semana,
      //    o aviso da criação já cobriu — não repete.
      if (diff > 0 && diff <= SEMANA) {
        const nasceuDentroDaSemana = prazoMs - new Date(t.criadoEm).getTime() <= SEMANA
        const chaveSemana = `tarefa_notif_semana:${t.id}`
        if (!nasceuDentroDaSemana && !(await redis.get(chaveSemana))) {
          await notificar(t.responsavelEmail, 'tarefa_prazo_proximo', `${assunto} esta semana`, `"${t.titulo}" está marcada para ${dataBR}.`, undefined, t.id)
          await redis.set(chaveSemana, '1', { ex: 8 * 24 * 3600 })
          notificados++
        }
      }
      // 2) É HOJE — avisa de manhã (a partir das 8h), não de madrugada.
      const ehHoje = diaDoInstante(t.prazo) === diaDoInstante(new Date(agora).toISOString())
      if (ehHoje && horaBR(agora) >= 8) {
        const chaveDia = `tarefa_notif_dia:${t.id}`
        if (!(await redis.get(chaveDia))) {
          await notificar(t.responsavelEmail, 'tarefa_prazo_proximo', `${assunto} hoje`, `"${t.titulo}" é hoje (${dataBR}).`, undefined, t.id)
          await redis.set(chaveDia, '1', { ex: 20 * 3600 })
          notificados++
        }
      }
      // Segue para "vencida" abaixo; pula a regra de 1h (já avisada no dia).
      if (diff > 0) continue
    }

    // PRAZO DE DIA (fim do dia em Brasília — o modal e o Estúdio gravam assim) e pauta do Estúdio:
    // avisa na VÉSPERA e NO DIA a partir das 8h de Brasília, e a atrasada na manhã seguinte. O "falta
    // 1h" (às 23h) e o "venceu" (à meia-noite) não servem para prazo de dia (dono, 20/10/2026: "o
    // designer precisa receber as notificações"). A chave leva o dia: prazo mudou, avisa de novo.
    if ((t as any).origemPostId || ehFimDoDiaBR(t.prazo)) {
      if (horaBR(agora) >= 8) {
        const hojeBR = diaDoInstante(new Date(agora).toISOString())
        const diaPrazo = diaDoInstante(t.prazo)
        const cli = t.clienteNome ? ` (${t.clienteNome})` : ''
        const aviso = diaPrazo === somarDias(hojeBR, 1) ? { chave: `tarefa_notif_vespera:${t.id}:${diaPrazo}`, tipo: 'tarefa_prazo_proximo' as const, titulo: 'Prazo amanhã', texto: `"${t.titulo}"${cli} vence amanhã, ${fmtDiaDoInstante(t.prazo)}.` }
          : diaPrazo === hojeBR ? { chave: `tarefa_notif_hoje:${t.id}:${diaPrazo}`, tipo: 'tarefa_prazo_proximo' as const, titulo: 'Prazo hoje', texto: `"${t.titulo}"${cli} vence hoje.` }
            // atrasada só nos 3 primeiros dias (no 1º deploy, as muito antigas não viram enxurrada de aviso)
            : diaPrazo && diaPrazo < hojeBR && diaPrazo >= somarDias(hojeBR, -3) ? { chave: `tarefa_notif_atrasada:${t.id}:${diaPrazo}`, tipo: 'tarefa_vencida' as const, titulo: 'Tarefa atrasada', texto: `"${t.titulo}"${cli} venceu em ${fmtDiaDoInstante(t.prazo)}.` }
              : null
        if (aviso && !(await redis.get(aviso.chave))) {
          await notificar(t.responsavelEmail, aviso.tipo, aviso.titulo, aviso.texto, undefined, t.id)
          await redis.set(aviso.chave, '1', { ex: 40 * 24 * 3600 })
          notificados++
        }
      }
      continue
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

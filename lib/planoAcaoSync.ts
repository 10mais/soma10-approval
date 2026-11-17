import { v4 as uuid } from 'uuid'
import { redis, Marco, Tarefa } from './redis'
import { diaDoInstante, fimDoDiaBR, inicioDoDiaBR } from './datas'
import { semanasDoPlano, entregasParaCriarTarefa, reconciliarEntregas, tipoTarefaDaFrente, type TarefaLigada } from './planoAcao'
import { notificar } from './notificacoes'
import { dispararEvento } from './automacoesEngine'

// PLANO DE AÇÃO, F2 (17/11/2026): deixa as semanas de um cliente em dia com as tarefas.
//  1. Status: a entrega ligada a uma tarefa recebe o status, o dia da conclusão e o
//     responsável da tarefa (lib/planoAcao.reconciliarEntregas).
//  2. Nascimento: entrega da equipe com prazo nos próximos 14 dias (ou vencida) e sem
//     tarefa ganha a tarefa, com marcoId + subetapaId (lib/planoAcao.entregasParaCriarTarefa).
// Roda quando o Plano de entregas abre um cliente com semanas (rota /api/plano-acao/sincronizar)
// e de hora em hora no cron de tarefas. Idempotente: a entrega ligada não ganha outra tarefa,
// e uma trava curta impede duas chamadas criarem em dobro.

export type ResultadoSync = { ok: true; criadas: number; atualizadas: number; ocupado?: boolean }

export async function sincronizarPlanoAcao(clienteId: string, autor = 'Plano de ação'): Promise<ResultadoSync> {
  const trava = `trava:planoAcao:${clienteId}`
  const ganhou = await redis.set(trava, '1', { nx: true, ex: 30 })
  if (!ganhou) return ({ ok: true, ocupado: true, criadas: 0, atualizadas: 0 })

  try {
    const ids = await redis.smembers('marcos')
    const todos = ids.length ? ((await redis.mget<(Marco | null)[]>(...ids.map(id => `marco:${id}`))).filter(Boolean) as Marco[]) : []
    const semanas = todos.filter(m => m.clienteId === clienteId && m.tipo === 'semana')
    if (!semanas.length) return ({ ok: true, criadas: 0, atualizadas: 0 })

    // 1. status pela tarefa
    const idsTarefa = Array.from(new Set(semanas.flatMap(m => (m.subetapas || []).map(e => (e.vinculo?.tipo === 'tarefa' ? e.vinculo.id : '')).filter(Boolean))))
    const tarefas = idsTarefa.length ? ((await redis.mget<(Tarefa | null)[]>(...idsTarefa.map(id => `tarefa:${id}`))).filter(Boolean) as Tarefa[]) : []
    const ligadas = new Map<string, TarefaLigada>(tarefas.map(t => [t.id, t]))
    const mudados = new Set<string>()
    for (const m of semanas) {
      const r = reconciliarEntregas(m.subetapas || [], ligadas, diaDoInstante)
      if (r.mudou) { m.subetapas = r.entregas; mudados.add(m.id) }
    }

    // 2. tarefas que nascem
    const agora = new Date().toISOString()
    const hoje = diaDoInstante(agora)
    
    const numero = new Map(semanasDoPlano(semanas).map(s => [s.id, s.numero]))
    const porPessoa = new Map<string, Tarefa[]>()
    let criadas = 0
    for (const { marcoId, entrega } of entregasParaCriarTarefa(semanas, hoje)) {
      const m = semanas.find(x => x.id === marcoId)!
      const w = numero.get(marcoId) || 0
      const tarefa: Tarefa = {
        id: uuid(),
        titulo: entrega.titulo,
        descricao: `Entrega do plano de ação de ${m.clienteNome || 'cliente'}, semana W${w}${m.foco ? ` (${m.foco})` : ''}. Concluir esta tarefa conclui a entrega no Plano de entregas.`,
        tipo: tipoTarefaDaFrente(entrega.frente) as Tarefa['tipo'],
        status: 'a_fazer', prioridade: 'media',
        responsavelEmail: entrega.responsavelEmail, responsavelNome: entrega.responsavelNome || '',
        clienteId: m.clienteId, clienteNome: m.clienteNome || '',
        marcoId: m.id, subetapaId: entrega.id,
        dataInicio: inicioDoDiaBR(entrega.dataInicio && entrega.dataInicio <= entrega.dataFim! ? entrega.dataInicio : hoje),
        prazo: fimDoDiaBR(entrega.dataFim!),
        criadoPor: autor, criadoEm: agora, atualizadoEm: agora,
        atividades: [{ id: uuid(), tipo: 'criacao', descricao: `Criada pelo plano de ação (entrega da semana W${w})`, autor, criadoEm: agora }],
        comentarios: [],
      }
      await redis.set(`tarefa:${tarefa.id}`, tarefa)
      await redis.sadd('tarefas', tarefa.id)
      m.subetapas = (m.subetapas || []).map(e => (e.id === entrega.id ? { ...e, vinculo: { tipo: 'tarefa' as const, id: tarefa.id } } : e))
      mudados.add(m.id)
      criadas++
      const lista = porPessoa.get(entrega.responsavelEmail!) || []
      lista.push(tarefa); porPessoa.set(entrega.responsavelEmail!, lista)
      dispararEvento('tarefa_criada', { tarefaId: tarefa.id, titulo: tarefa.titulo, tipo: tarefa.tipo, prioridade: tarefa.prioridade, clienteId: tarefa.clienteId, clienteNome: tarefa.clienteNome, responsavelEmail: tarefa.responsavelEmail, responsavelNome: tarefa.responsavelNome }).catch(() => {})
    }

    for (const id of Array.from(mudados)) {
      const m = semanas.find(x => x.id === id)!
      await redis.set(`marco:${id}`, { ...m, atualizadoEm: agora })
    }

    // Um aviso por pessoa, não um por tarefa: a primeira sincronização pode criar várias.
    for (const [email, lista] of Array.from(porPessoa)) {
      const cli = lista[0].clienteNome || 'cliente'
      const titulo = lista.length === 1 ? 'Nova entrega do plano de ação' : `${lista.length} entregas do plano de ação`
      const msg = lista.length === 1 ? `${lista[0].titulo} (${cli})` : `${cli}: ${lista.map(t => t.titulo).slice(0, 3).join('; ')}${lista.length > 3 ? '…' : ''}`
      await notificar(email, 'tarefa_atribuida', titulo, msg, undefined, lista[0].id).catch(() => {})
    }

    return ({ ok: true, criadas, atualizadas: mudados.size })
  } finally {
    await redis.del(trava).catch(() => {})
  }
}

/** Todos os clientes que têm semanas (para o cron). */
export async function clientesComPlanoAcao(): Promise<string[]> {
  const ids = await redis.smembers('marcos')
  if (!ids.length) return []
  const marcos = (await redis.mget<(Marco | null)[]>(...ids.map(id => `marco:${id}`))).filter(Boolean) as Marco[]
  return Array.from(new Set(marcos.filter(m => m.tipo === 'semana' && m.clienteId).map(m => m.clienteId)))
}

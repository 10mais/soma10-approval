// Linha de montagem Studio > Tarefa > Planner — lado servidor.
//
// Casa ÚNICA da criação de tarefa a partir de pauta. O caminho automático
// (copy aprovada em /api/esteira/aprovar) e o manual (/api/esteira/relacionar)
// passam pelos mesmos tijolos daqui — dois caminhos que convergem, não dois
// comportamentos. As REGRAS puras (quando criar, títulos, descrição, prazo)
// vivem em lib/esteiraFluxo.ts, com testes.

import { redis, Post, Tarefa, Plano, Cliente } from './redis'
import { v4 as uuid } from 'uuid'
import { descricaoTarefaDesigner, tituloSubtarefa, tituloTarefaMae, prazoTarefaMae } from './esteiraFluxo'
import { notificar } from './notificacoes'
import { dispararEvento } from './automacoesEngine'

// Etapa da Esteira -> tipo de tarefa (regra herdada do /api/esteira/relacionar).
// 'pronto' não gera tarefa: a pauta já virou post no Planner.
export function tipoPorEtapa(etapa?: string): Tarefa['tipo'] | null {
  switch (etapa) {
    case 'briefing': return 'briefing'
    case 'copy':
    case 'aprovacao_copy': return 'copy'
    case 'criativo':
    case 'aprovacao_criativo': return 'criativo'
    default: return null
  }
}

// Tarefa-mãe LAZY do plano: reutiliza a existente (Plano.tarefaId) ou cria na
// hora. Devolve o id, ou null se o plano não existir.
export async function tarefaMaeDoPlano(planoId: string, autor: string): Promise<string | null> {
  const plano = await redis.get<Plano>(`plano:${planoId}`)
  if (!plano) return null
  if (plano.tarefaId) {
    const t = await redis.get<Tarefa>(`tarefa:${plano.tarefaId}`)
    if (t) return plano.tarefaId
    // tarefa-mãe apagada: cria outra e regrava o vínculo
  }
  const pautaIds = await redis.smembers(`plano:${planoId}:pautas`)
  const pautas = pautaIds.length > 0
    ? ((await redis.mget<(Post | null)[]>(...pautaIds.map(pid => `post:${pid}`))).filter(Boolean) as Post[])
    : []
  const agora = new Date().toISOString()
  const mae: Tarefa = {
    id: uuid(),
    titulo: tituloTarefaMae(plano),
    descricao: '<p>Tarefa do plano de conteúdo. Cada pauta entra como subtarefa quando a copy é aprovada pelo cliente.</p>',
    tipo: 'planejamento',
    status: 'a_fazer',
    prioridade: 'media',
    responsavelEmail: '',
    responsavelNome: '',
    clienteId: plano.clienteId || '',
    clienteNome: plano.clienteNome || '',
    marcoId: '',
    prazo: prazoTarefaMae(pautas, plano),
    criadoPor: autor,
    criadoEm: agora,
    atualizadoEm: agora,
    atividades: [{ id: uuid(), tipo: 'criacao', descricao: 'Tarefa do plano criada automaticamente (primeira copy aprovada)', autor, criadoEm: agora }],
    comentarios: [],
  }
  await redis.set(`tarefa:${mae.id}`, mae)
  await redis.sadd('tarefas', mae.id)
  await redis.set(`plano:${planoId}`, { ...plano, tarefaId: mae.id })
  return mae.id
}

// Copy aprovada -> nasce (ou reabre) a tarefa do DESIGNER com tudo dentro:
// copy aprovada na descrição, anexos da pauta, prazo = data da postagem,
// responsável = Designer do squad do cliente. Nunca lança: falha aqui não pode
// derrubar a aprovação do cliente (o chamador embrulha em try/catch mesmo assim).
export async function nascerTarefaDesigner(postId: string, autor: string): Promise<{ tarefaId: string; reaberta: boolean } | null> {
  const post = await redis.get<Post>(`post:${postId}`)
  if (!post || post.etapa !== 'criativo') return null
  const agora = new Date().toISOString()

  // Pauta que JÁ tem tarefa (ajuste -> copy reaprovada, ou vínculo manual antigo):
  // reabre com a copy atualizada em vez de duplicar.
  if (post.tarefaId) {
    const t = await redis.get<Tarefa>(`tarefa:${post.tarefaId}`)
    if (t) {
      const atualizada: Tarefa = {
        ...t,
        status: t.status === 'concluido' ? 'a_fazer' : t.status,
        descricao: descricaoTarefaDesigner(post),
        ...(post.anexos?.length ? { anexos: post.anexos } : {}),
        atualizadoEm: agora,
        atividades: [...(t.atividades || []), { id: uuid(), tipo: 'status', descricao: 'Copy reaprovada pelo cliente — tarefa atualizada com a copy nova', autor, criadoEm: agora }],
      }
      await redis.set(`tarefa:${t.id}`, atualizada)
      if (t.responsavelEmail) {
        await notificar(t.responsavelEmail, 'geral', `Copy reaprovada — ${post.clienteNome || 'Cliente'}`, `A copy da pauta "${tituloSubtarefa(post)}" foi reaprovada. A tarefa foi atualizada.`, undefined, t.id).catch(() => {})
      }
      return { tarefaId: t.id, reaberta: true }
    }
    // tarefa apagada: limpa o vínculo morto e cria uma nova abaixo
  }

  const cliente = post.clienteId ? await redis.get<Cliente>(`cliente:${post.clienteId}`) : null
  const designerEmail = (cliente?.squadPapeis?.designer || '').trim()
  let designerNome = ''
  if (designerEmail) {
    const u = await redis.get<{ nome?: string }>(`usuario:${designerEmail}`).catch(() => null)
    designerNome = u?.nome || ''
  }
  const tarefaPaiId = post.planoId ? await tarefaMaeDoPlano(post.planoId, autor) : null

  const sub: Tarefa = {
    id: uuid(),
    titulo: tituloSubtarefa(post),
    descricao: descricaoTarefaDesigner(post),
    tipo: 'criativo',
    status: 'a_fazer',
    prioridade: 'media',
    responsavelEmail: designerEmail,
    responsavelNome: designerNome,
    clienteId: post.clienteId || '',
    clienteNome: post.clienteNome || '',
    marcoId: post.marcoId || '',
    ...(tarefaPaiId ? { tarefaPaiId } : {}),
    prazo: post.dataAgendada || '',
    ...(post.anexos?.length ? { anexos: post.anexos } : {}),
    origemPostId: post.id,
    criadoPor: autor,
    criadoEm: agora,
    atualizadoEm: agora,
    atividades: [{ id: uuid(), tipo: 'criacao', descricao: 'Criada automaticamente: copy aprovada pelo cliente — produzir o criativo', autor, criadoEm: agora }],
    comentarios: [],
  }
  await redis.set(`tarefa:${sub.id}`, sub)
  await redis.sadd('tarefas', sub.id)
  await redis.set(`post:${post.id}`, { ...post, tarefaId: sub.id })
  if (designerEmail) {
    await notificar(designerEmail, 'geral', `Criativo para produzir — ${post.clienteNome || 'Cliente'}`, `Copy aprovada pelo cliente. A tarefa "${sub.titulo}" está com você.${sub.prazo ? ` Prazo: ${new Date(sub.prazo).toLocaleDateString('pt-BR')}.` : ''}`, undefined, sub.id).catch(() => {})
  }
  await dispararEvento('tarefa_criada', { tarefaId: sub.id, titulo: sub.titulo, tipo: sub.tipo, prioridade: sub.prioridade, clienteId: sub.clienteId, clienteNome: sub.clienteNome, responsavelEmail: sub.responsavelEmail, responsavelNome: sub.responsavelNome }).catch(() => {})
  return { tarefaId: sub.id, reaberta: false }
}

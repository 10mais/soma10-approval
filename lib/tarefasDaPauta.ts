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

// Cliente devolveu o criativo (ajuste/reprovacao): a linha de montagem devolve
// a peca para a estacao certa — reabre a tarefa do designer com o feedback
// dentro. Idempotente: tarefa ja aberta so registra o feedback (nao reseta o
// status de quem ja esta trabalhando). Nunca mexe na etapa da pauta.
export async function reabrirTarefaDaPauta(postId: string, feedback: string, autor: string): Promise<boolean> {
  const post = await redis.get<Post>(`post:${postId}`)
  const tarefaId = post?.tarefaId
  if (!post || !tarefaId) return false
  const t = await redis.get<Tarefa>(`tarefa:${tarefaId}`)
  if (!t) return false
  const agora = new Date().toISOString()
  const estavaConcluida = t.status === 'concluido'
  const atualizada: Tarefa = {
    ...t,
    status: estavaConcluida ? 'a_fazer' : t.status,
    ...(estavaConcluida ? { concluidoEm: undefined } : {}),
    atualizadoEm: agora,
    atividades: [...(t.atividades || []), { id: uuid(), tipo: 'status', descricao: estavaConcluida ? 'Cliente pediu ajuste no criativo — tarefa reaberta' : 'Cliente pediu ajuste no criativo', autor, criadoEm: agora }],
    comentarios: [...(t.comentarios || []), { id: uuid(), autor, autorNome: autor, texto: `Feedback do cliente: ${feedback || 'sem comentário'}`, criadoEm: agora }],
  }
  await redis.set(`tarefa:${tarefaId}`, atualizada)
  if (t.responsavelEmail) {
    await notificar(t.responsavelEmail, 'tarefa_alterada', `Ajuste no criativo — ${post.clienteNome || 'Cliente'}`, `O cliente pediu ajuste no criativo da tarefa "${t.titulo}": ${(feedback || 'sem comentário').slice(0, 140)}`, undefined, tarefaId).catch(() => {})
  }
  return true
}

// Anexos que a tarefa do designer carrega: os da pauta + os de CADA lâmina do
// carrossel (o dono reportou anexo de lâmina ficando para trás, 23/07).
function anexosDaPauta(post: Post): { nome: string; url: string; tipo: string }[] {
  return [
    ...(post.anexos || []),
    ...((post.laminas || []).map((l, i) => l.anexo ? { ...l.anexo, nome: `Lâmina ${i + 1} — ${l.anexo.nome}` } : null).filter(Boolean) as { nome: string; url: string; tipo: string }[]),
  ]
}

// Copy aprovada -> nasce (ou reabre) a tarefa do DESIGNER com tudo dentro:
// copy aprovada na descrição, anexos da pauta E das lâminas, prazo = data da
// postagem, responsável = Designer do squad do cliente. `opts.manual` é o botão
// "Criar tarefa desta pauta": cria em QUALQUER etapa exceto pronto (o time quer
// a tarefa do designer mesmo antes da aprovação — controle manual). Nunca
// lança: falha aqui não pode derrubar a aprovação do cliente.
export async function nascerTarefaDesigner(postId: string, autor: string, opts: { manual?: boolean } = {}): Promise<{ tarefaId: string; reaberta: boolean } | null> {
  const post = await redis.get<Post>(`post:${postId}`)
  if (!post) return null
  const etapaOk = post.etapa === 'criativo' || (opts.manual && post.etapa && post.etapa !== 'pronto')
  if (!etapaOk) return null
  const agora = new Date().toISOString()

  // Pauta que JÁ tem tarefa (ajuste -> copy reaprovada, ou vínculo manual antigo):
  // reabre com a copy atualizada em vez de duplicar.
  if (post.tarefaId) {
    const t = await redis.get<Tarefa>(`tarefa:${post.tarefaId}`)
    if (t) {
      const anexosT = anexosDaPauta(post)
      const atualizada: Tarefa = {
        ...t,
        status: t.status === 'concluido' ? 'a_fazer' : t.status,
        descricao: descricaoTarefaDesigner(post),
        ...(anexosT.length ? { anexos: anexosT } : {}),
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
  const anexosSub = anexosDaPauta(post)

  // TOP-LEVEL de propósito: a tarefa do designer PRECISA aparecer no kanban de
  // produção — e o kanban esconde subtarefas (filtro !tarefaPaiId). Antes ela
  // nascia como subtarefa da "tarefa-mãe do plano" e ficava invisível: parecia
  // que "não chegava à produção". O vínculo com a pauta é o origemPostId.
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
    prazo: post.dataAgendada || '',
    ...(anexosSub.length ? { anexos: anexosSub } : {}),
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

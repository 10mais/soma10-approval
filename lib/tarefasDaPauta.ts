// Linha de montagem Studio > Tarefa > Planner — lado servidor.
//
// Casa ÚNICA da criação de tarefa a partir de pauta. O caminho automático
// (copy aprovada em /api/esteira/aprovar) e o manual (/api/esteira/relacionar)
// passam pelos mesmos tijolos daqui — dois caminhos que convergem, não dois
// comportamentos. As REGRAS puras (quando criar, títulos, descrição, prazo)
// vivem em lib/esteiraFluxo.ts, com testes.

import { redis, Post, Tarefa, Plano, Cliente, Notificacao } from './redis'
import { v4 as uuid } from 'uuid'
import { descricaoTarefaDesigner, tituloSubtarefa, tituloTarefaMae, prazoTarefaMae, tipoTarefaDoFormato, prazoDoCriativo, donoDoPlano, avisoPautasNovas } from './esteiraFluxo'
import { notificar } from './notificacoes'
import { fmtDiaDoInstante, diaDoInstante, fimDoDiaBR, inicioDoDiaBR } from './datas'
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

// TAREFA DO PLANO do mês (a "mãe" das pautas): reutiliza a existente (Plano.tarefaId) ou cria.
// Dono, 20/10/2026: "pautas no estúdio viram uma única tarefa. Cada pauta como subtarefa!" — a
// tarefa do plano fica com o Social Media / Copywriter do squad (donoDoPlano) e vai do dia 1 do
// mês até a última postagem; cada pauta entra como subtarefa do designer quando a copy é
// aprovada (nascerTarefaDesigner). Nasce junto com o plano (POST /api/planos) e, para plano
// antigo, na primeira copy aprovada. Devolve o id, ou null se o plano não existir.
export async function tarefaMaeDoPlano(planoId: string, autor: string): Promise<string | null> {
  const plano = await redis.get<Plano>(`plano:${planoId}`)
  if (!plano) return null
  if (plano.tarefaId) {
    const t = await redis.get<Tarefa>(`tarefa:${plano.tarefaId}`)
    if (t && !(t as any).excluidoEm) return plano.tarefaId
    // tarefa do plano apagada (ou na lixeira): cria outra e regrava o vínculo
  }
  const pautaIds = await redis.smembers(`plano:${planoId}:pautas`)
  const pautas = pautaIds.length > 0
    ? ((await redis.mget<(Post | null)[]>(...pautaIds.map(pid => `post:${pid}`))).filter(Boolean) as Post[])
    : []
  const agora = new Date().toISOString()
  const cliente = plano.clienteId ? await redis.get<Cliente>(`cliente:${plano.clienteId}`).catch(() => null) : null
  const donoEmail = donoDoPlano(cliente?.squadPapeis)
  const donoNome = donoEmail ? ((await redis.get<{ nome?: string }>(`usuario:${donoEmail}`).catch(() => null))?.nome || '') : ''
  const fimDoPlano = prazoTarefaMae(pautas, plano)
  const mae: Tarefa = {
    id: uuid(),
    titulo: tituloTarefaMae(plano),
    descricao: '<p>Plano de conteúdo do mês, com o Social Media / Copywriter. Cada pauta entra aqui como subtarefa do designer quando a copy é aprovada, com prazo de 3 dias úteis antes da postagem.</p>',
    tipo: 'planejamento',
    status: 'a_fazer',
    prioridade: 'media',
    responsavelEmail: donoEmail,
    responsavelNome: donoNome,
    clienteId: plano.clienteId || '',
    clienteNome: plano.clienteNome || '',
    marcoId: '',
    dataInicio: inicioDoDiaBR(`${plano.ano}-${String(plano.mes).padStart(2, '0')}-01`),
    prazo: fimDoDiaBR(diaDoInstante(fimDoPlano)) || fimDoPlano,
    origemPlanoId: plano.id,
    criadoPor: autor,
    criadoEm: agora,
    atualizadoEm: agora,
    atividades: [{ id: uuid(), tipo: 'criacao', descricao: 'Tarefa do plano do mês criada automaticamente', autor, criadoEm: agora }],
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
export async function reabrirTarefaDaPauta(postId: string, feedback: string, autor: string, origem: 'cliente' | 'equipe' = 'cliente'): Promise<boolean> {
  const quemPediu = origem === 'cliente' ? 'Cliente' : 'Revisão interna'
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
    ajustePedidoEm: agora, // "Ajuste pedido" na página da pessoa e na barra do topo; some ao concluir
    atualizadoEm: agora,
    atividades: [...(t.atividades || []), { id: uuid(), tipo: 'status', descricao: estavaConcluida ? `${quemPediu} pediu ajuste no criativo — tarefa reaberta` : `${quemPediu} pediu ajuste no criativo`, autor, criadoEm: agora }],
    comentarios: [...(t.comentarios || []), { id: uuid(), autor, autorNome: autor, texto: `Feedback ${origem === 'cliente' ? 'do cliente' : 'da revisão interna'}: ${feedback || 'sem comentário'}`, criadoEm: agora }],
  }
  await redis.set(`tarefa:${tarefaId}`, atualizada)
  if (t.responsavelEmail) {
    await notificar(t.responsavelEmail, 'tarefa_alterada', `Ajuste no criativo — ${post.clienteNome || 'Cliente'}`, `${origem === 'cliente' ? 'O cliente' : 'A revisão interna'} pediu ajuste no criativo da tarefa "${t.titulo}": ${(feedback || 'sem comentário').slice(0, 140)}`, undefined, tarefaId).catch(() => {})
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

// AVISO AGRUPADO ao designer (dono, 20/10/2026: "O Designer precisa receber as notificações").
// Tipo tarefa_atribuida: não dá para silenciar e pinga o celular. Várias pautas do mesmo cliente
// em 10 minutos (o cliente aprova as copies de uma vez) ATUALIZAM o mesmo aviso em vez de criar um
// por pauta — dez pushes seguidos fazem o designer silenciar tudo. Agrupado, o clique abre a
// tarefa do plano (onde estão todas). Nunca lança.
const JANELA_AVISO_PAUTAS = 10 * 60
async function avisarPautaNova(email: string, clienteId: string, clienteNome: string | undefined, sub: Tarefa, maeId: string | null): Promise<void> {
  const chave = `aviso_pautas:${email}:${clienteId || 'sem-cliente'}`
  const grupo = await redis.get<{ notifId: string; titulos: string[] }>(chave).catch(() => null)
  if (grupo?.notifId) {
    const n = await redis.get<Notificacao>(`notificacao:${grupo.notifId}`).catch(() => null)
    if (n) {
      const titulos = [...(grupo.titulos || []), sub.titulo]
      const texto = avisoPautasNovas(clienteNome, titulos)
      await redis.set(`notificacao:${n.id}`, { ...n, ...texto, lida: false, criadoEm: new Date().toISOString(), tarefaId: maeId || n.tarefaId })
      await redis.set(chave, { notifId: n.id, titulos }, { ex: JANELA_AVISO_PAUTAS })
      return
    }
  }
  const texto = avisoPautasNovas(clienteNome, [sub.titulo], sub.prazo ? fmtDiaDoInstante(sub.prazo) : undefined)
  const nova = await notificar(email, 'tarefa_atribuida', texto.titulo, texto.mensagem, undefined, sub.id)
  if (nova?.id) await redis.set(chave, { notifId: nova.id, titulos: [sub.titulo] }, { ex: JANELA_AVISO_PAUTAS })
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
        descricao: descricaoTarefaDesigner(post, { manual: opts.manual, etapa: post.etapa }),
        // O formato pode ter mudado depois da tarefa criada (virou carrossel):
        // o chip e o checklist do kanban têm de acompanhar.
        tipo: tipoTarefaDoFormato(post.formato),
        ...(anexosT.length ? { anexos: anexosT } : {}),
        atualizadoEm: agora,
        atividades: [...(t.atividades || []), { id: uuid(), tipo: 'status', descricao: opts.manual ? 'Tarefa atualizada com o conteúdo atual da pauta (Studio)' : 'Copy reaprovada pelo cliente — tarefa atualizada com a copy nova', autor, criadoEm: agora }],
      }
      await redis.set(`tarefa:${t.id}`, atualizada)
      if (t.responsavelEmail) {
        await notificar(t.responsavelEmail, 'geral',
          opts.manual ? `Pauta atualizada — ${post.clienteNome || 'Cliente'}` : `Copy reaprovada — ${post.clienteNome || 'Cliente'}`,
          opts.manual ? `A tarefa "${t.titulo}" foi atualizada com o conteúdo atual da pauta.` : `A copy da pauta "${tituloSubtarefa(post)}" foi reaprovada. A tarefa foi atualizada.`,
          undefined, t.id).catch(() => {})
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

  // SUBTAREFA da tarefa do plano (dono, 20/10/2026: "Cada pauta como subtarefa!"). Em julho ela
  // nasceu assim e ficou INVISÍVEL — o kanban escondia subtarefas e "a copy aprovada não chegava
  // na produção"; por isso ficou top-level. Desde 70237e1 a subtarefa da pessoa aparece no quadro,
  // na lista e na barra do topo mesmo quando a mãe é de outra pessoa. Pauta fora de plano segue
  // top-level. Prazo: 3 dias úteis antes da postagem (prazoDoCriativo); início: hoje.
  const maeId = post.planoId ? await tarefaMaeDoPlano(post.planoId, autor).catch(() => null) : null
  const hoje = diaDoInstante(agora)
  const prazoCriativo = prazoDoCriativo(post.dataAgendada, hoje)
  const sub: Tarefa = {
    id: uuid(),
    titulo: tituloSubtarefa(post),
    descricao: descricaoTarefaDesigner(post, { manual: opts.manual, etapa: post.etapa }),
    // Tipo pelo FORMATO da pauta: é o que pinta o chip no kanban e escolhe o
    // checklist (carrossel -> "Design das lâminas"). Tudo como 'criativo'
    // escondia que a peça era um carrossel.
    tipo: tipoTarefaDoFormato(post.formato),
    status: 'a_fazer',
    prioridade: 'media',
    responsavelEmail: designerEmail,
    responsavelNome: designerNome,
    clienteId: post.clienteId || '',
    clienteNome: post.clienteNome || '',
    marcoId: post.marcoId || '',
    ...(maeId ? { tarefaPaiId: maeId } : {}),
    dataInicio: inicioDoDiaBR(hoje),
    prazo: prazoCriativo ? fimDoDiaBR(prazoCriativo) : '',
    ...(anexosSub.length ? { anexos: anexosSub } : {}),
    origemPostId: post.id,
    criadoPor: autor,
    criadoEm: agora,
    atualizadoEm: agora,
    atividades: [{ id: uuid(), tipo: 'criacao', descricao: opts.manual ? 'Criada a partir da pauta no Studio' : 'Criada automaticamente: copy aprovada pelo cliente — produzir o criativo', autor, criadoEm: agora }],
    comentarios: [],
  }
  await redis.set(`tarefa:${sub.id}`, sub)
  await redis.sadd('tarefas', sub.id)
  await redis.set(`post:${post.id}`, { ...post, tarefaId: sub.id })
  if (designerEmail) await avisarPautaNova(designerEmail, post.clienteId || '', post.clienteNome, sub, maeId).catch(() => {})
  await dispararEvento('tarefa_criada', { tarefaId: sub.id, titulo: sub.titulo, tipo: sub.tipo, prioridade: sub.prioridade, clienteId: sub.clienteId, clienteNome: sub.clienteNome, responsavelEmail: sub.responsavelEmail, responsavelNome: sub.responsavelNome }).catch(() => {})
  return { tarefaId: sub.id, reaberta: false }
}

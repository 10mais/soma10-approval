// Linha de montagem Studio > Tarefa > Planner — lado servidor.
//
// Casa ÚNICA da criação de tarefa a partir de pauta. O caminho automático
// (copy aprovada em /api/esteira/aprovar) e o manual (/api/esteira/relacionar)
// passam pelos mesmos tijolos daqui — dois caminhos que convergem, não dois
// comportamentos. As REGRAS puras (quando criar, títulos, descrição, prazo)
// vivem em lib/esteiraFluxo.ts, com testes.

import { redis, Post, Tarefa, Plano, Cliente, Notificacao } from './redis'
import { v4 as uuid } from 'uuid'
import { descricaoTarefaDesigner, tituloSubtarefa, tituloTarefaMae, prazoTarefaMae, tipoTarefaDoFormato, prazoDoCriativo, prazoDaCopy, donoDoPlano, avisoPautasNovas, statusAoPedirAjuste } from './esteiraFluxo'
import { notificar } from './notificacoes'
import { fmtDiaDoInstante, diaDoInstante, fimDoDiaBR, inicioDoDiaBR } from './datas'
import { dispararEvento } from './automacoesEngine'
import { anexosParaNovaRodada, planoDeEntregasDaPauta, somarAnexos } from './vinculoTarefa'
import { desindexarPost, indexarPost } from './postsIndex'

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
// a peca para a estacao certa — a tarefa do designer vai para EM AJUSTE (13/11) com
// o feedback dentro. Nunca mexe na etapa da pauta.
export async function reabrirTarefaDaPauta(postId: string, feedback: string, autor: string, origem: 'cliente' | 'equipe' = 'cliente'): Promise<boolean> {
  const quemPediu = origem === 'cliente' ? 'Cliente' : 'Revisão interna'
  const post = await redis.get<Post>(`post:${postId}`)
  const tarefaId = post?.tarefaId
  if (!post || !tarefaId) return false
  const t = await redis.get<Tarefa>(`tarefa:${tarefaId}`)
  if (!t) return false
  const agora = new Date().toISOString()
  const estavaConcluida = t.status === 'concluido'
  // Dono, 13/11/2026: "Quando o cliente pedir ajuste, volta a tarefa com o status EM AJUSTE".
  // Vale também para o ajuste pedido pela revisão interna. Descartada não ressuscita.
  const novoStatus = statusAoPedirAjuste(t.status) as Tarefa['status']
  const atualizada: Tarefa = {
    ...t,
    status: novoStatus,
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
async function avisarPautaNova(email: string, clienteId: string, clienteNome: string | undefined, sub: Tarefa, maeId: string | null, fase: 'copy' | 'criativo' = 'criativo'): Promise<void> {
  const chave = `${fase === 'copy' ? 'aviso_copies' : 'aviso_pautas'}:${email}:${clienteId || 'sem-cliente'}`
  const grupo = await redis.get<{ notifId: string; titulos: string[] }>(chave).catch(() => null)
  if (grupo?.notifId) {
    const n = await redis.get<Notificacao>(`notificacao:${grupo.notifId}`).catch(() => null)
    if (n) {
      const titulos = [...(grupo.titulos || []), sub.titulo]
      const texto = avisoPautasNovas(clienteNome, titulos, undefined, fase)
      await redis.set(`notificacao:${n.id}`, { ...n, ...texto, lida: false, criadoEm: new Date().toISOString(), tarefaId: maeId || n.tarefaId })
      await redis.set(chave, { notifId: n.id, titulos }, { ex: JANELA_AVISO_PAUTAS })
      return
    }
  }
  const texto = avisoPautasNovas(clienteNome, [sub.titulo], sub.prazo ? fmtDiaDoInstante(sub.prazo) : undefined, fase)
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
    if (t && t.fasePauta === 'copy' && !(t as any).excluidoEm) {
      // PASSAGEM AO DESIGNER (dono, 13/11/2026): a tarefa nasceu com a pauta, com o Social
      // Media, para a copy. Copy aprovada: a MESMA tarefa passa ao designer. Uma tarefa só.
      const cliente = post.clienteId ? await redis.get<Cliente>(`cliente:${post.clienteId}`) : null
      const designerEmail = (cliente?.squadPapeis?.designer || '').trim()
      const designerNome = designerEmail ? ((await redis.get<{ nome?: string }>(`usuario:${designerEmail}`).catch(() => null))?.nome || '') : ''
      const hoje = diaDoInstante(agora)
      const prazoCriativo = prazoDoCriativo(post.dataAgendada, hoje)
      const passada: Tarefa = {
        ...t,
        fasePauta: 'criativo',
        tipo: tipoTarefaDoFormato(post.formato),
        status: 'a_fazer',
        responsavelEmail: designerEmail,
        responsavelNome: designerNome,
        descricao: descricaoTarefaDesigner(post, { manual: opts.manual, etapa: post.etapa }),
        anexos: somarAnexos(t.anexos || [], anexosDaPauta(post)),
        dataInicio: inicioDoDiaBR(hoje),
        prazo: prazoCriativo ? fimDoDiaBR(prazoCriativo) : '',
        prazoManual: false,
        atualizadoEm: agora,
        atividades: [...(t.atividades || []), { id: uuid(), tipo: 'responsavel', descricao: `Copy aprovada — a tarefa passou para o designer${designerNome ? ` (${designerNome})` : ' (o squad do cliente não tem designer)'}`, autor, criadoEm: agora }],
      }
      await redis.set(`tarefa:${t.id}`, passada)
      if (designerEmail) await avisarPautaNova(designerEmail, post.clienteId || '', post.clienteNome, passada, t.tarefaPaiId || null).catch(() => {})
      return { tarefaId: t.id, reaberta: false }
    }
    if (t) {
      const anexosT = anexosDaPauta(post)
      const atualizada: Tarefa = {
        ...t,
        status: t.status === 'concluido' ? 'a_fazer' : t.status,
        descricao: descricaoTarefaDesigner(post, { manual: opts.manual, etapa: post.etapa }),
        // O formato pode ter mudado depois da tarefa criada (virou carrossel):
        // o chip e o checklist do kanban têm de acompanhar.
        tipo: tipoTarefaDoFormato(post.formato),
        // SOMA (lib/vinculoTarefa): a copy reaprovada não apaga o que o designer já tinha
        // anexado; a arte anterior fica como referência e a nova precisa ser marcada de novo.
        ...(anexosT.length ? { anexos: anexosParaNovaRodada(t.anexos || [], anexosT) } : {}),
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
    // Marco E etapa da pauta: só o marco deixava a peça fora da conta por etapa do Gantt.
    ...planoDeEntregasDaPauta(post),
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


// ===================================================================== FLUXO DE 13/11/2026
// Dono: "cada pauta criada, automaticamente vira tarefa ou subtarefa ... Tudo vinculado, nada
// perdido ou duplicado." A pauta e a tarefa são uma UNIDADE: nascem juntas, mudam juntas e vão
// para a lixeira juntas. Vale para as pautas novas (a tarefa delas tem `fasePauta`); as antigas
// seguem o fluxo de antes. Memória: proj-fluxo-pauta-tarefa.

// NASCE COM A PAUTA: subtarefa da tarefa do plano, com o Social Media do squad, fase da copy.
// Idempotente: pauta que já tem tarefa viva não ganha outra. Nunca lança.
export async function nascerTarefaDaPauta(postId: string, autor: string): Promise<string | null> {
  try {
    const post = await redis.get<Post>(`post:${postId}`)
    if (!post || !post.etapa || post.etapa === 'pronto' || (post as any).excluidoEm) return null
    if (post.tarefaId) {
      const atual = await redis.get<Tarefa>(`tarefa:${post.tarefaId}`)
      if (atual && !(atual as any).excluidoEm) return atual.id
    }
    const agora = new Date().toISOString()
    const cliente = post.clienteId ? await redis.get<Cliente>(`cliente:${post.clienteId}`).catch(() => null) : null
    const smEmail = donoDoPlano(cliente?.squadPapeis)
    const smNome = smEmail ? ((await redis.get<{ nome?: string }>(`usuario:${smEmail}`).catch(() => null))?.nome || '') : ''
    const maeId = post.planoId ? await tarefaMaeDoPlano(post.planoId, autor).catch(() => null) : null
    const hoje = diaDoInstante(agora)
    const prazo = prazoDaCopy(post.dataAgendada, hoje)
    const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const tarefa: Tarefa = {
      id: uuid(),
      titulo: tituloSubtarefa(post),
      descricao: `<p>Pauta do Estúdio: escrever a copy (headline, texto da arte, CTA e legenda) e enviar para aprovação do cliente. Quando a copy for aprovada, esta tarefa passa para o designer.</p>${post.briefing ? `<p><strong>Briefing:</strong> ${esc(post.briefing)}</p>` : ''}`,
      tipo: 'copy',
      fasePauta: 'copy',
      status: 'a_fazer',
      prioridade: 'media',
      responsavelEmail: smEmail,
      responsavelNome: smNome,
      clienteId: post.clienteId || '',
      clienteNome: post.clienteNome || '',
      ...planoDeEntregasDaPauta(post),
      ...(maeId ? { tarefaPaiId: maeId } : {}),
      dataInicio: inicioDoDiaBR(hoje),
      prazo: prazo ? fimDoDiaBR(prazo) : '',
      origemPostId: post.id,
      criadoPor: autor,
      criadoEm: agora,
      atualizadoEm: agora,
      atividades: [{ id: uuid(), tipo: 'criacao', descricao: 'Criada junto com a pauta no Estúdio — fase da copy', autor, criadoEm: agora }],
      comentarios: [],
    }
    await redis.set(`tarefa:${tarefa.id}`, tarefa)
    await redis.sadd('tarefas', tarefa.id)
    await redis.set(`post:${post.id}`, { ...post, tarefaId: tarefa.id })
    if (smEmail) await avisarPautaNova(smEmail, post.clienteId || '', post.clienteNome, tarefa, maeId, 'copy').catch(() => {})
    return tarefa.id
  } catch { return null }
}

// CLIENTE APROVOU O CRIATIVO: a tarefa da pauta conclui sozinha (dono, 13/11: "Quando o cliente
// aprova o criativo aí sim a tarefa passa para CONCLUÍDA"). Tarefa ainda na fase da copy, já
// concluída ou descartada fica como está. Nunca lança.
export async function concluirTarefaDaPauta(postId: string, autor: string, motivo = 'Cliente aprovou o criativo'): Promise<boolean> {
  try {
    const post = await redis.get<Post>(`post:${postId}`)
    if (!post?.tarefaId) return false
    const t = await redis.get<Tarefa>(`tarefa:${post.tarefaId}`)
    if (!t || (t as any).excluidoEm || t.fasePauta === 'copy' || t.status === 'concluido' || t.status === 'descartado') return false
    const agora = new Date().toISOString()
    const { ajustePedidoEm: _a, aguardandoMaterial: _m, ...resto } = t as any
    await redis.set(`tarefa:${t.id}`, {
      ...resto, status: 'concluido', concluidoEm: agora, atualizadoEm: agora, filaDesde: agora,
      atividades: [...(t.atividades || []), { id: uuid(), tipo: 'status', descricao: `${motivo} — tarefa concluída`, autor, criadoEm: agora }],
    })
    await dispararEvento('tarefa_concluida', { tarefaId: t.id, titulo: t.titulo, tipo: t.tipo, prioridade: t.prioridade, clienteId: t.clienteId, clienteNome: t.clienteNome, responsavelEmail: t.responsavelEmail, responsavelNome: t.responsavelNome }).catch(() => {})
    return true
  } catch { return false }
}

// A PAUTA MUDOU (data, formato, plano): a tarefa da unidade acompanha. Só para a tarefa que
// nasceu com a pauta (`fasePauta`), viva e aberta. Prazo mexido à mão (`prazoManual`) fica.
export async function sincronizarTarefaComPauta(antes: Post, depois: Post, autor: string): Promise<void> {
  try {
    if (!depois.tarefaId) return
    const t = await redis.get<Tarefa>(`tarefa:${depois.tarefaId}`)
    if (!t || !t.fasePauta || (t as any).excluidoEm || t.origemPostId !== depois.id) return
    if (t.status === 'concluido' || t.status === 'descartado') return
    const agora = new Date().toISOString()
    const patch: Partial<Tarefa> = {}
    const notas: string[] = []
    if ((antes.dataAgendada || '') !== (depois.dataAgendada || '') && !t.prazoManual) {
      const hoje = diaDoInstante(agora)
      const dia = t.fasePauta === 'copy' ? prazoDaCopy(depois.dataAgendada, hoje) : prazoDoCriativo(depois.dataAgendada, hoje)
      patch.prazo = dia ? fimDoDiaBR(dia) : ''
      notas.push(dia ? `Data da pauta mudou — prazo recalculado para ${fmtDiaDoInstante(patch.prazo)}` : 'Pauta sem data — prazo removido')
    }
    if ((antes.formato || '') !== (depois.formato || '') && t.fasePauta === 'criativo') {
      patch.tipo = tipoTarefaDoFormato(depois.formato)
      notas.push('Formato da pauta mudou — tipo da tarefa acompanhou')
    }
    if ((antes.planoId || '') !== (depois.planoId || '')) {
      const novaMae = depois.planoId ? await tarefaMaeDoPlano(depois.planoId, autor).catch(() => null) : null
      patch.tarefaPaiId = novaMae || undefined
      notas.push('Pauta mudou de plano — a tarefa foi junto')
    }
    if (!notas.length) return
    await redis.set(`tarefa:${t.id}`, {
      ...t, ...patch, atualizadoEm: agora,
      atividades: [...(t.atividades || []), ...notas.map(n => ({ id: uuid(), tipo: 'prazo' as const, descricao: n, autor, criadoEm: agora }))],
    })
  } catch { /* sincronizar nunca bloqueia a edição da pauta */ }
}

// LIXEIRA EM UNIDADE: excluir/restaurar a pauta leva a tarefa junto, e vice-versa. Só para a
// tarefa que nasceu com a pauta (`fasePauta`). Operações diretas no Redis (sem rota) para não
// voltar em laço.
export async function tarefaDaPautaParaLixeira(post: Post, autor: string, restaurar = false): Promise<void> {
  try {
    if (!post.tarefaId) return
    const t = await redis.get<Tarefa>(`tarefa:${post.tarefaId}`)
    if (!t || !t.fasePauta || t.origemPostId !== post.id) return
    const agora = new Date().toISOString()
    if (restaurar) {
      if (!(t as any).excluidoEm) return
      const { excluidoEm: _e, excluidoPor: _p, ...resto } = t as any
      await redis.set(`tarefa:${t.id}`, { ...resto, atualizadoEm: agora, atividades: [...(t.atividades || []), { id: uuid(), tipo: 'status', descricao: 'Pauta restaurada — a tarefa voltou junto', autor, criadoEm: agora }] })
      await redis.srem('tarefas_excluidas', t.id); await redis.sadd('tarefas', t.id)
      return
    }
    if ((t as any).excluidoEm) return
    await redis.set(`tarefa:${t.id}`, { ...t, excluidoEm: agora, excluidoPor: autor, atualizadoEm: agora, atividades: [...(t.atividades || []), { id: uuid(), tipo: 'status', descricao: 'Pauta excluída — a tarefa foi junto para a lixeira', autor, criadoEm: agora }] })
    await redis.srem('tarefas', t.id); await redis.sadd('tarefas_excluidas', t.id)
  } catch { /* nunca bloqueia */ }
}

export async function pautaDaTarefaParaLixeira(t: Tarefa, autor: string, restaurar = false): Promise<void> {
  try {
    if (!t.fasePauta || !t.origemPostId) return
    const post = await redis.get<Post>(`post:${t.origemPostId}`)
    if (!post || post.tarefaId !== t.id) return
    const agora = new Date().toISOString()
    if (restaurar) {
      if (!(post as any).excluidoEm) return
      const { excluidoEm: _e, excluidoPor: _p, ...resto } = post as any
      const planoVivo = post.planoId ? await redis.get(`plano:${post.planoId}`) : null
      const volta = { ...resto, atualizadoEm: agora, ...(post.planoId && !planoVivo ? { planoId: undefined } : {}) }
      await redis.set(`post:${post.id}`, volta)
      await redis.srem('posts_excluidos', post.id); await redis.sadd('posts', post.id)
      await indexarPost(post.clienteId, post.id)
      if (volta.planoId) await redis.sadd(`plano:${volta.planoId}:pautas`, post.id)
      if (volta.status === 'agendado') await redis.sadd('agendados', post.id)
      return
    }
    if ((post as any).excluidoEm) return
    await redis.set(`post:${post.id}`, { ...post, excluidoEm: agora, excluidoPor: autor })
    await redis.srem('posts', post.id); await redis.srem('agendados', post.id)
    await desindexarPost(post.clienteId, post.id)
    if (post.planoId) await redis.srem(`plano:${post.planoId}:pautas`, post.id)
    await redis.sadd('posts_excluidos', post.id)
  } catch { /* nunca bloqueia */ }
}

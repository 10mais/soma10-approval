// PAUTA ↔ TAREFA DE PRODUÇÃO — a regra que junta o Planner/Studio com a Gestão
// de tarefas (pedido do dono, 07/09/2026: "tarefas do tipo criativo ou conteúdo
// precisam ser marcadas como em produção; as pautas precisam estar vinculadas a
// essas tarefas, inclusive os anexos").
//
// O vínculo já existe nos dados: post.tarefaId ↔ tarefa.origemPostId. Esta lib
// só decide, a partir dele, o ESTADO real de cada pauta e o que conta como
// "em produção" — para o hub do cliente, o relatório da semana e o Studio
// lerem a mesma verdade. Puro, sem rede.

export type PostV = {
  id: string
  status?: string
  etapa?: string
  tarefaId?: string
  imagens?: string[]
  excluidoEm?: string
}
export type TarefaV = {
  id: string
  titulo?: string
  tipo?: string
  status?: string
  origemPostId?: string
  responsavelNome?: string
  anexos?: Anexo[]
  excluidoEm?: string
}
// `papel`: 'referencia' (material de apoio, o padrão) ou 'criativo' (a ARTE PRONTA
// que o designer entrega — é o que vira mídia da pauta). Anexo sem papel = referência.
export type Anexo = { nome: string; url: string; tipo: string; papel?: 'referencia' | 'criativo' }

// Tipos de tarefa que são PRODUÇÃO de conteúdo/criativo. 'tarefa' genérica,
// estratégia, landing page etc. ficam de fora.
export const TIPOS_PRODUCAO = ['criativo', 'carrossel', 'reel', 'story', 'post', 'video', 'copy', 'briefing'] as const
const ABERTA = ['a_fazer', 'em_andamento', 'em_ajuste', 'em_revisao'] // = STATUS_ABERTOS de lib/statusTarefa
const ETAPAS_PRODUCAO = ['briefing', 'copy', 'criativo']
const ETAPAS_CLIENTE = ['aprovacao_copy', 'aprovacao_criativo']

export const STATUS_TAREFA_LABEL: Record<string, string> = { a_fazer: 'A fazer', em_andamento: 'Em andamento', em_ajuste: 'Em ajuste', em_revisao: 'Em revisão', concluido: 'Concluída', descartado: 'Descartada' }

export function ehTarefaDeProducao(t: { tipo?: string }): boolean {
  return (TIPOS_PRODUCAO as readonly string[]).includes(t.tipo || '')
}
export function tarefaAberta(t: { status?: string; excluidoEm?: string }): boolean {
  return !t.excluidoEm && ABERTA.includes(t.status || '')
}

/** A tarefa ligada à pauta, por qualquer um dos dois lados do vínculo. */
export function tarefaDaPauta(post: PostV, tarefas: TarefaV[]): TarefaV | undefined {
  if (post.tarefaId) { const t = tarefas.find(x => x.id === post.tarefaId && !x.excluidoEm); if (t) return t }
  return tarefas.find(x => x.origemPostId === post.id && !x.excluidoEm)
}

export type EstadoPauta = 'publicada' | 'aguardando_cliente' | 'em_producao' | 'pronta' | 'outra'

/** Estado REAL da pauta: uma pauta "pronta" cuja tarefa de produção ainda está aberta está em produção. */
export function estadoDaPauta(post: PostV, tarefas: TarefaV[] = []): EstadoPauta {
  if (post.excluidoEm) return 'outra'
  if (post.status === 'publicado') return 'publicada'
  if (ETAPAS_CLIENTE.includes(post.etapa || '') || post.status === 'aguardando_aprovacao') return 'aguardando_cliente'
  const t = tarefaDaPauta(post, tarefas)
  if (t && tarefaAberta(t) && ehTarefaDeProducao(t)) return 'em_producao'
  if (ETAPAS_PRODUCAO.includes(post.etapa || '')) return 'em_producao'
  if (post.etapa === 'pronto') return 'pronta'
  return 'outra'
}

export type ResumoProducao = {
  pautasEmProducao: PostV[]
  tarefasSemPauta: TarefaV[] // tarefas de produção abertas que não estão ligadas a nenhuma pauta
  emProducao: number // pautas + tarefas sem pauta (sem contar duas vezes)
  prontas: PostV[]
}

export function resumoProducao(posts: PostV[] = [], tarefas: TarefaV[] = []): ResumoProducao {
  const vivos = posts.filter(p => !p.excluidoEm)
  const pautasEmProducao = vivos.filter(p => estadoDaPauta(p, tarefas) === 'em_producao')
  const prontas = vivos.filter(p => estadoDaPauta(p, tarefas) === 'pronta')
  const idsPautas = new Set(vivos.map(p => p.id))
  const idsTarefasDePautas = new Set(vivos.map(p => tarefaDaPauta(p, tarefas)?.id).filter(Boolean))
  const tarefasSemPauta = tarefas.filter(t => tarefaAberta(t) && ehTarefaDeProducao(t) && !idsTarefasDePautas.has(t.id) && !(t.origemPostId && idsPautas.has(t.origemPostId)))
  return { pautasEmProducao, tarefasSemPauta, emProducao: pautasEmProducao.length + tarefasSemPauta.length, prontas }
}

/** Só imagem e vídeo viram mídia da pauta; PDF, doc e áudio ficam como anexo. */
export function anexosParaCriativo(anexos: Anexo[] = []): Anexo[] {
  return anexos.filter(a => {
    const tipo = (a.tipo || '').toLowerCase()
    if (tipo.startsWith('image/') || tipo.startsWith('video/')) return true
    return /\.(png|jpe?g|webp|gif|mp4|mov|m4v)(\?|$)/i.test(a.url || '')
  })
}

/** O CRIATIVO PRONTO da tarefa: os anexos marcados como 'criativo' (só imagem/vídeo).
 *  Compatibilidade: tarefa antiga sem papel nenhum -> todos os anexos de imagem/vídeo contam. */
export function anexosCriativoPronto(anexos: Anexo[] = []): Anexo[] {
  const marcados = anexos.filter(a => a.papel === 'criativo')
  if (marcados.length) return anexosParaCriativo(marcados)
  if (anexos.some(a => a.papel === 'referencia')) return [] // já se usa o papel: sem criativo marcado = sem criativo
  return anexosParaCriativo(anexos)
}

/** Ao concluir a tarefa: se a pauta ainda não tem mídia, o criativo pronto da tarefa vira a mídia da pauta. */
export function midiasParaPauta(post: PostV, anexosTarefa: Anexo[] = []): { imagens: string[] } | {} {
  if (post.imagens && post.imagens.length) return {}
  const urls = anexosCriativoPronto(anexosTarefa).map(a => a.url)
  return urls.length ? { imagens: urls } : {}
}

/** Entregar (Em revisão) ou concluir tarefa de PRODUÇÃO vinculada a pauta sem criativo pronto: a tela avisa (não bloqueia). */
export function avisoAoConcluir(t: { tipo?: string; origemPostId?: string; anexos?: Anexo[]; fasePauta?: string }): string | null {
  if (!t.origemPostId || !ehTarefaDeProducao(t) || t.fasePauta === 'copy') return null
  if (anexosCriativoPronto(t.anexos || []).length) return null
  return 'Esta tarefa é de uma pauta e não tem criativo pronto anexado: a peça não vai para a Fila de programação. Anexe a arte e marque como criativo pronto para ela seguir.'
}

/** Tarefa que nasceu com a pauta conclui sozinha quando o cliente aprova o criativo (13/11).
 *  Concluir à mão antes disso é permitido (o responsável manda), com uma pergunta. */
export function avisoConcluirAntesDaAprovacao(t: { fasePauta?: string; status?: string }): string | null {
  if (!t.fasePauta || t.status === 'concluido') return null
  return t.fasePauta === 'copy'
    ? 'Esta tarefa é a da pauta: a copy ainda não foi aprovada e, quando for, a tarefa passa para o designer. Concluir agora mesmo assim?'
    : 'Esta tarefa conclui sozinha quando o cliente aprova o criativo. Concluir agora mesmo assim? (Para entregar a arte, use Em revisão.)'
}

/** A pauta deve RECEBER o criativo agora? (usado pelo PUT de /api/tarefas)
 *  Duas portas: concluir a tarefa vinculada, OU vincular a pauta a uma tarefa que já estava
 *  concluída — o vínculo só passou a ser editável em 09/09, e sem essa segunda porta o
 *  designer teria de reabrir e concluir de novo só para a arte chegar ao Studio. */
// Desde 13/11/2026 a entrega é a tarefa entrar em EM REVISÃO (ou ser concluída à mão), e
// passar de Em revisão para Concluído (cliente aprovou) não entrega de novo.
const ENTREGUE = ['em_revisao', 'concluido']
export function deveEntregarCriativo(
  antes: { status?: string; origemPostId?: string },
  depois: { status?: string; origemPostId?: string },
): boolean {
  if (!depois.origemPostId) return false
  if (!ENTREGUE.includes(depois.status || '')) return false
  const entregouAgora = !ENTREGUE.includes(antes.status || '')
  const vinculouAgora = depois.origemPostId !== antes.origemPostId
  return entregouAgora || vinculouAgora
}

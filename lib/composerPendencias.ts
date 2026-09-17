// O QUE FALTA PARA O POST SAIR — dono, 17/09/2026 (print de um post agendado): "não está
// permitindo alterar a data de posts agendados. Quando troco a data, não posso clicar em
// confirmar."
//
// Os botões Salvar / Enviar para aprovação / Agendar ficavam apagados SEM dizer por quê. A
// regra que os desliga (etapa do Playbook obrigatória desde 09/09, legenda, mídia, rede,
// capa do vídeo...) continua valendo — o que muda é que ela vira uma LISTA escrita que a tela
// mostra embaixo dos botões. Post agendado antes da etapa virar obrigatória é o caso típico:
// tudo preenchido, menos a etapa, e nenhum aviso.

export type EstadoComposer = {
  clienteId: string
  marcoId?: string
  multiPerfil?: boolean
  contaIds?: string[]
  ehStory?: boolean
  legenda?: string
  totalMidias: number
  redes: string[]
  videosSemCapa: number
  enviandoArquivo?: boolean
}

export type Pendencia = { chave: 'cliente' | 'etapa' | 'perfil' | 'legenda' | 'midia' | 'rede' | 'capa' | 'upload'; texto: string }

/** Tudo o que impede publicar, agendar ou enviar para aprovação, na ordem em que aparece na tela. */
export function pendenciasDoPost(e: EstadoComposer): Pendencia[] {
  const out: Pendencia[] = []
  if (!e.clienteId) { out.push({ chave: 'cliente', texto: 'escolher o cliente' }); return out }
  if (!e.marcoId) out.push({ chave: 'etapa', texto: 'escolher a etapa do Playbook' })
  if (e.multiPerfil && !(e.contaIds || []).length) out.push({ chave: 'perfil', texto: 'marcar ao menos um perfil de destino' })
  if (e.totalMidias <= 0) out.push({ chave: 'midia', texto: 'adicionar ao menos uma mídia' })
  if (!e.ehStory && !String(e.legenda || '').trim()) out.push({ chave: 'legenda', texto: 'escrever a legenda' })
  if (!e.redes.length) out.push({ chave: 'rede', texto: 'marcar Instagram ou Facebook' })
  if (!e.ehStory && e.videosSemCapa > 0) out.push({ chave: 'capa', texto: e.videosSemCapa > 1 ? 'definir a capa de cada vídeo' : 'definir a capa do vídeo' })
  if (e.enviandoArquivo) out.push({ chave: 'upload', texto: 'esperar o envio dos arquivos terminar' })
  return out
}

/** "Para liberar os botões: escolher a etapa do Playbook e escrever a legenda." */
export function frasePendencias(p: Pendencia[], prefixo = 'Para liberar os botões'): string {
  if (!p.length) return ''
  const textos = p.map(x => x.texto)
  const lista = textos.length === 1 ? textos[0] : `${textos.slice(0, -1).join(', ')} e ${textos[textos.length - 1]}`
  return `${prefixo}: ${lista}.`
}

/** O que bloqueia CADA botão. Dono, 17/09, depois de ver o aviso: "não ativa o botão de
 *  agendar quando edito a data. Faça isso acontecer."
 *  - Post NOVO: tudo bloqueia tudo, como antes (a etapa é obrigatória para nascer vinculado).
 *  - Post que JÁ EXISTE (edição): trocar a data e salvar/agendar não trava pela etapa do
 *    Playbook — post agendado antes de a etapa virar obrigatória precisa poder mudar de dia.
 *    "Salvar alterações" só espera o envio de arquivos terminar: salvar mantém o status do post
 *    (statusAoSalvarEdicao), então não é por ele que conteúdo incompleto vai ao ar.
 *  - Enviar para aprovação continua exigindo a etapa (o cliente vê o material pela etapa). */
export function pendenciasDaAcao(p: Pendencia[], acao: 'salvar' | 'agendar' | 'publicar' | 'aprovacao', modoEdicao: boolean): Pendencia[] {
  if (!modoEdicao) return p
  if (acao === 'salvar') return p.filter(x => x.chave === 'cliente' || x.chave === 'upload')
  if (acao === 'aprovacao') return p
  return p.filter(x => x.chave !== 'etapa')
}

/** Status do post ao SALVAR uma edição. Salvar não muda o estado do post: agendado continua
 *  agendado (com a data nova), em aprovação continua em aprovação. Só um agendado que perdeu a
 *  data volta a rascunho — não existe agendamento sem horário. Antes, no Planner do cliente,
 *  "Salvar alterações" jogava todo post para rascunho e tirava o agendamento. */
export function statusAoSalvarEdicao(atual: string | undefined, acao: string | undefined, temData: boolean): string {
  const s = atual || 'rascunho'
  if (acao === 'aprovacao') return 'aguardando_aprovacao'
  if (acao === 'agendar') return temData ? 'agendado' : s
  if (s === 'agendado' && !temData) return 'rascunho'
  return s
}

/** Valor mínimo do <input type="datetime-local"> no fuso de quem usa (toISOString é UTC e,
 *  no Brasil, travava as três horas seguintes). */
export function minimoDatetimeLocal(agora: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}T${p(agora.getHours())}:${p(agora.getMinutes())}`
}

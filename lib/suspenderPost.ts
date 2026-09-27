// SUSPENDER POSTAGENS — tirar da fila sem excluir, e devolver depois.
//
// Dono, 27/09/2026: "Preciso de uma forma onde consigamos suspender postagens, trazer para
// rascunho, em qualquer rede social." Decisões dele: post a post (sem ação em massa) e o
// YouTube incluído — inclusive o vídeo que já subiu e espera a data própria lá no YouTube.
//
// Dois níveis:
//   • POST INTEIRO: vira rascunho, sai da fila, e guarda o que era (status e quem suspendeu)
//     para reativar voltar exatamente ao ponto de antes. A data fica no post.
//   • UMA REDE: tira só o Instagram, o Facebook ou o YouTube de um post que ainda vai sair,
//     e guarda em `redesSuspensas` para devolver. Também serve para o post que saiu pela
//     metade (falhou numa rede): suspender a que falta encerra a pendência.
//
// O que NÃO dá, e a tela diz: post já publicado não volta a rascunho (a API do Instagram não
// retira post publicado; no Facebook só excluindo). A exceção é o YouTube com data própria:
// o vídeo está lá PRIVADO esperando o `publishAt`, e dá para cancelar esse agendamento.
//
// Tudo aqui é puro (sem rede, sem banco) — quem fala com o Redis e com o YouTube é a rota
// /api/posts/suspender.

export type Rede = 'instagram' | 'facebook' | 'youtube'

export type SuspensaoPost = {
  em: string
  por: string
  statusAnterior: string
}

// O mínimo do Post que estas regras leem (o tipo completo mora em lib/redis).
export type PostSuspensivel = {
  status: string
  dataAgendada?: string
  redes?: Rede[]
  redesPublicadas?: string[]
  redesSuspensas?: Rede[]
  suspenso?: SuspensaoPost
  midiaRemovida?: boolean
  youtubeVideoIds?: Record<string, string>
  youtubeVisibilidade?: 'public' | 'unlisted' | 'private'
  youtubePublicarEm?: string
  youtubeAgendaSuspensa?: boolean
}

/** Status de onde um post inteiro pode ser suspenso: tudo que ainda pode ir ao ar sozinho. */
export const STATUS_SUSPENDIVEIS = ['agendado', 'aprovado', 'aguardando_aprovacao', 'corrigir', 'reprovado', 'falha_publicacao']

const REDES_PADRAO: Rede[] = ['instagram', 'facebook'] // post antigo, sem `redes`
export const redesDoPost = (p: PostSuspensivel): Rede[] => (p.redes && p.redes.length ? p.redes : REDES_PADRAO)

/** A rede já saiu em algum perfil? (chave nova "conta:rede" ou a antiga, só "rede") */
export function redePublicada(p: PostSuspensivel, rede: Rede): boolean {
  return (p.redesPublicadas || []).some(k => k === rede || k.endsWith(`:${rede}`))
}

/**
 * O vídeo já está no YouTube, PRIVADO, esperando a data própria (publishAt)? É o único caso
 * em que algo "publicado" ainda pode ser segurado.
 */
export function youtubeEsperandoNoYouTube(p: PostSuspensivel, agora = new Date()): boolean {
  if (!redePublicada(p, 'youtube') || p.youtubeAgendaSuspensa) return false
  if ((p.youtubeVisibilidade || 'public') !== 'public' || !p.youtubePublicarEm) return false
  const t = new Date(p.youtubePublicarEm).getTime()
  return !isNaN(t) && t > agora.getTime()
}

// ---------- POST INTEIRO ----------

export type MotivoNaoSuspende = 'ja-suspenso' | 'publicando' | 'publicado' | 'rascunho' | 'status'

export function motivoNaoSuspende(p: PostSuspensivel): MotivoNaoSuspende | null {
  if (p.suspenso) return 'ja-suspenso'
  if (p.status === 'publicando') return 'publicando'
  if (p.status === 'publicado') return 'publicado'
  if (p.status === 'rascunho') return 'rascunho'
  if (!STATUS_SUSPENDIVEIS.includes(p.status)) return 'status'
  return null
}

/**
 * Suspende o post inteiro. A data NÃO é apagada (reativar precisa dela) — o que tira da fila
 * é o status: o cron só publica `agendado`, e a rota ainda tira do índice de agendados.
 */
export function suspender(p: PostSuspensivel, por: string, agora = new Date()): { ok: true; patch: Record<string, any>; cancelarYouTube: boolean } | { ok: false; motivo: MotivoNaoSuspende } {
  const motivo = motivoNaoSuspende(p)
  if (motivo) return { ok: false, motivo }
  return {
    ok: true,
    patch: {
      status: 'rascunho',
      suspenso: { em: agora.toISOString(), por: por || 'equipe', statusAnterior: p.status },
      ...(youtubeEsperandoNoYouTube(p, agora) ? { youtubeAgendaSuspensa: true } : {}),
      atualizadoEm: agora.toISOString(),
    },
    // Post que falhou numa rede mas já subiu o vídeo agendado no YouTube: segurar o post
    // inteiro também segura o vídeo lá.
    cancelarYouTube: youtubeEsperandoNoYouTube(p, agora),
  }
}

export type MotivoNaoReativa = 'nao-suspenso' | 'precisa-data'

/**
 * Reativa: volta ao status de antes. Se era AGENDADO e a data já passou (ou não há data), pede
 * uma data nova — reativar sem isso publicaria no mesmo minuto, o que ninguém pediu.
 */
export function reativar(p: PostSuspensivel, agora = new Date(), novaData?: string): { ok: true; patch: Record<string, any>; reagendarYouTube: boolean } | { ok: false; motivo: MotivoNaoReativa } {
  if (!p.suspenso) return { ok: false, motivo: 'nao-suspenso' }
  const anterior = p.suspenso.statusAnterior || 'rascunho'
  const data = novaData || p.dataAgendada
  const t = data ? new Date(data).getTime() : NaN
  if (anterior === 'agendado' && (isNaN(t) || t <= agora.getTime())) return { ok: false, motivo: 'precisa-data' }
  return {
    ok: true,
    patch: {
      status: anterior,
      suspenso: undefined,
      ...(p.youtubeAgendaSuspensa ? { youtubeAgendaSuspensa: undefined } : {}),
      ...(novaData ? { dataAgendada: new Date(novaData).toISOString() } : {}),
      atualizadoEm: agora.toISOString(),
    },
    reagendarYouTube: !!p.youtubeAgendaSuspensa,
  }
}

// ---------- UMA REDE ----------

export type MotivoRede = 'nao-marcada' | 'ja-publicada' | 'ultima-rede' | 'publicando' | 'nao-suspensa' | 'post-publicado' | 'precisa-data-youtube'

/**
 * Suspende uma rede só.
 *   - YouTube já enviado e esperando a data própria: `remoto` (a rota cancela lá no YouTube).
 *   - Rede que ainda não saiu: sai de `redes` e vai para `redesSuspensas`.
 *   - Última rede do post: não — isso é suspender o post inteiro.
 * Post que falhou só na rede suspensa passa a PUBLICADO (o que faltava deixou de faltar).
 */
export function suspenderRede(p: PostSuspensivel, rede: Rede, agora = new Date()): { ok: true; patch: Record<string, any>; remoto: boolean } | { ok: false; motivo: MotivoRede } {
  if (p.status === 'publicando') return { ok: false, motivo: 'publicando' }
  if (rede === 'youtube' && youtubeEsperandoNoYouTube(p, agora)) {
    return { ok: true, remoto: true, patch: { youtubeAgendaSuspensa: true, atualizadoEm: agora.toISOString() } }
  }
  const redes = redesDoPost(p)
  if (!redes.includes(rede)) return { ok: false, motivo: 'nao-marcada' }
  if (redePublicada(p, rede)) return { ok: false, motivo: 'ja-publicada' }
  const restantes = redes.filter(r => r !== rede)
  if (!restantes.length) return { ok: false, motivo: 'ultima-rede' }
  const patch: Record<string, any> = {
    redes: restantes,
    redesSuspensas: Array.from(new Set([...(p.redesSuspensas || []), rede])),
    atualizadoEm: agora.toISOString(),
  }
  if (p.status === 'falha_publicacao' && restantes.every(r => redePublicada(p, r))) {
    patch.status = 'publicado'
    patch.erroPublicacao = `Publicado. ${NOME_REDE[rede]} foi suspenso e ficou de fora.`
  }
  return { ok: true, remoto: false, patch }
}

/**
 * Devolve uma rede suspensa. Post já PUBLICADO não recebe rede de volta: depois de publicar, o
 * sistema limpa a mídia do armazenamento, e não há mais o que enviar.
 */
export function reativarRede(p: PostSuspensivel, rede: Rede, agora = new Date(), novaDataYouTube?: string): { ok: true; patch: Record<string, any>; remoto: boolean } | { ok: false; motivo: MotivoRede } {
  if (p.status === 'publicando') return { ok: false, motivo: 'publicando' }
  if (rede === 'youtube' && p.youtubeAgendaSuspensa && redePublicada(p, 'youtube')) {
    // O post já saiu e não abre mais no editor: a data nova do YouTube vem aqui mesmo.
    const data = novaDataYouTube || p.youtubePublicarEm
    const t = data ? new Date(data).getTime() : NaN
    if (isNaN(t) || t <= agora.getTime()) return { ok: false, motivo: 'precisa-data-youtube' }
    return { ok: true, remoto: true, patch: { youtubeAgendaSuspensa: undefined, youtubePublicarEm: new Date(t).toISOString(), atualizadoEm: agora.toISOString() } }
  }
  if (!(p.redesSuspensas || []).includes(rede)) return { ok: false, motivo: 'nao-suspensa' }
  if (p.status === 'publicado' || p.midiaRemovida) return { ok: false, motivo: 'post-publicado' }
  return {
    ok: true,
    remoto: false,
    patch: {
      redes: Array.from(new Set([...redesDoPost(p), rede])),
      redesSuspensas: (p.redesSuspensas || []).filter(r => r !== rede),
      atualizadoEm: agora.toISOString(),
    },
  }
}

export const NOME_REDE: Record<Rede, string> = { instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube' }

/** Texto de cada recusa, para a tela e para a resposta da API (pt; a tela traduz pela chave). */
export const TEXTO_MOTIVO: Record<MotivoNaoSuspende | MotivoNaoReativa | MotivoRede, string> = {
  'ja-suspenso': 'Este post já está suspenso.',
  'publicando': 'O post está sendo publicado agora. Espere terminar.',
  'publicado': 'Post já publicado não volta para rascunho (o Instagram não permite retirar; no Facebook, só excluindo).',
  'rascunho': 'O post já é um rascunho: não está na fila de publicação.',
  'status': 'Este post não está na fila de publicação.',
  'nao-suspenso': 'Este post não está suspenso.',
  'precisa-data': 'A data do agendamento já passou. Escolha uma nova data para reativar.',
  'nao-marcada': 'Esta rede não está marcada neste post.',
  'ja-publicada': 'Esta rede já publicou o post.',
  'ultima-rede': 'É a única rede do post. Para tirar da fila, suspenda o post inteiro.',
  'nao-suspensa': 'Esta rede não está suspensa.',
  'post-publicado': 'O post já foi publicado e a mídia foi liberada: não dá para enviar a outra rede agora. Use "Reaproveitar".',
  'precisa-data-youtube': 'A data do YouTube já passou. Escolha uma nova data para o vídeo ir ao ar.',
}

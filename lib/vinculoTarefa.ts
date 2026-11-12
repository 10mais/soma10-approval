// VÍNCULO PAUTA ↔ TAREFA — quem aponta para quem, e o que nunca se perde no caminho.
//
// O vínculo mora nos dois lados: `tarefa.origemPostId` (a tarefa sabe a pauta) e
// `post.tarefaId` (a pauta sabe a tarefa). Concluir a tarefa entrega o criativo pela
// tarefa; o ajuste do cliente reabre a tarefa pela PAUTA (lib/tarefasDaPauta). Se os
// dois lados discordam, o ajuste reabre a tarefa errada. Até 12/11/2026 a API deixava
// vínculo de um lado só em três casos (trocar a pauta, tirar a pauta, vincular pauta
// cujo vínculo antigo estava morto) e vincular apagava os anexos da tarefa. As regras
// que corrigem isso vivem aqui, puras e testadas; a API só executa.

export type AnexoV = { nome: string; url: string; tipo: string; papel?: 'referencia' | 'criativo' }

// Soma anexos sem apagar nem duplicar (pela URL). Os que já estavam ficam na frente e
// mantêm o próprio `papel` — o criativo pronto que o designer anexou continua criativo.
export function somarAnexos<T extends AnexoV>(atuais: T[] = [], novos: T[] = []): T[] {
  const out = (atuais || []).filter(Boolean)
  const vistos = new Set(out.map(a => a.url).filter(Boolean))
  for (const a of novos || []) {
    if (!a?.url || vistos.has(a.url)) continue
    vistos.add(a.url)
    out.push(a)
  }
  return out
}

// COPY REAPROVADA reabre a tarefa do designer para uma arte NOVA. A arte da rodada anterior
// fica na tarefa (nada se apaga), mas rebaixada a referência: se continuasse marcada como
// criativo pronto, concluir sem arte nova devolveria a arte velha ao Estúdio como entrega
// e o aviso "concluir sem criativo pronto" não apareceria.
export function anexosParaNovaRodada<T extends AnexoV>(daTarefa: T[] = [], daPauta: T[] = []): T[] {
  const rebaixados = (daTarefa || []).filter(Boolean).map(a => (a.papel === 'criativo' ? { ...a, papel: 'referencia' as const } : a))
  return somarAnexos(rebaixados, daPauta)
}

type PautaV = { id: string; tarefaId?: string }
type TarefaDonaV = { id: string; origemPostId?: string; excluidoEm?: string } | null | undefined

// A pauta pode passar a apontar para `tarefaId`? Sim quando está livre, quando já é desta
// tarefa, ou quando o vínculo que ela guarda está MORTO: a tarefa dona não existe mais,
// está na lixeira (excluir já solta a pauta, DELETE /api/tarefas) ou não aponta de volta.
// Se a dona está viva e aponta para a pauta, o vínculo dela fica — mover vínculo entre
// duas tarefas vivas é decisão do dono (PLANO-VINCULOS-TAREFA §11.1), não desta regra.
export function pautaLivrePara(pauta: PautaV, tarefaId: string, dona?: TarefaDonaV): boolean {
  if (!pauta.tarefaId || pauta.tarefaId === tarefaId) return true
  if (!dona) return true
  if (dona.excluidoEm) return true
  return dona.origemPostId !== pauta.id
}

// Ao trocar a pauta (A → B) ou tirá-la (A → nada): a pauta A solta a tarefa, mas só se
// ainda aponta para ELA (nunca rouba o vínculo de outra tarefa).
export function soltaPautaAntiga(antigaId: string | undefined, novaId: string | undefined, pautaAntiga: PautaV | null | undefined, tarefaId: string): boolean {
  const antes = (antigaId || '').trim()
  const depois = (novaId || '').trim()
  if (!antes || antes === depois) return false
  return !!pautaAntiga && pautaAntiga.id === antes && pautaAntiga.tarefaId === tarefaId
}

// Plano de entregas que a tarefa herda da pauta: o marco E a etapa dentro dele. Antes a
// tarefa do designer levava só o marco e a conta por etapa do Gantt (lib/progressoGantt)
// não via a peça. Etapa sem marco não existe (o valor é marcoId::subetapaId).
export function planoDeEntregasDaPauta(post: { marcoId?: string; subetapaId?: string }): { marcoId: string; subetapaId?: string } {
  const marcoId = (post.marcoId || '').trim()
  const subetapaId = (post.subetapaId || '').trim()
  return marcoId && subetapaId ? { marcoId, subetapaId } : { marcoId }
}

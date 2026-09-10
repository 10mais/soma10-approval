// ETAPA DO PLAYBOOK como opção de seleção — a mesma lista para todo lugar que pergunta
// "a que etapa isto pertence?" (tarefa, post do Planner, campanha de mídia).
//
// Dono, 09/09/2026: "em Planner não aparecem todas as etapas dos marcos". O seletor listava
// só os MARCOS; as etapas de dentro (marco.subetapas) ficavam invisíveis, então o material
// só podia ser preso ao marco inteiro. A hierarquia é MARCO > ETAPA e as duas precisam
// aparecer, como já acontece no modal de tarefa desde 08/09.
//
// O valor de uma etapa é composto (`marcoId::subetapaId`) porque o <select> guarda uma
// string só; `separarValor` desmonta na hora de gravar. Marco inteiro continua sendo o id
// puro do marco.

export type MarcoOpcao = {
  id: string
  titulo: string
  subetapas?: { id: string; titulo: string }[]
}

export type GrupoOpcoes = {
  marcoId: string
  titulo: string // nome do marco (rótulo do grupo)
  opcoes: { valor: string; rotulo: string; ehMarco: boolean }[]
}

/** Monta os grupos do seletor: o marco inteiro e, dentro dele, cada etapa. */
export function opcoesEtapas(marcos: MarcoOpcao[] = []): GrupoOpcoes[] {
  return marcos.map(m => {
    // Etapa SEM id não some da lista: ganha o mesmo id por posição que lib/subetapas
    // gera ao gravar (`se-N`). Some do seletor = a pessoa não consegue vincular o que vê.
    const subs = (m.subetapas || [])
      .map((s, i) => ({ ...s, id: (s?.id || '').trim() || `se-${i + 1}` }))
      .filter(s => (s.titulo || '').trim())
    return {
      marcoId: m.id,
      titulo: m.titulo || 'Marco sem título',
      opcoes: [
        { valor: m.id, rotulo: subs.length ? `${m.titulo} (o marco inteiro)` : m.titulo, ehMarco: true },
        ...subs.map(s => ({ valor: `${m.id}::${s.id}`, rotulo: s.titulo, ehMarco: false })),
      ],
    }
  })
}

/** "m1::s2" -> { marcoId: 'm1', subetapaId: 's2' }; "m1" -> só o marco. */
export function separarValor(valor: string): { marcoId: string; subetapaId: string } {
  const [marcoId = '', subetapaId = ''] = String(valor || '').split('::')
  return { marcoId, subetapaId }
}

export function juntarValor(marcoId?: string, subetapaId?: string): string {
  if (!marcoId) return ''
  return subetapaId ? `${marcoId}::${subetapaId}` : marcoId
}

/** Como o vínculo aparece escrito: "Marco › Etapa". Vínculo perdido não inventa nome. */
export function rotuloEtapa(marcos: MarcoOpcao[] = [], marcoId?: string, subetapaId?: string): string {
  if (!marcoId) return ''
  const m = marcos.find(x => x.id === marcoId)
  if (!m) return ''
  const s = subetapaId ? (m.subetapas || []).find(x => x.id === subetapaId) : undefined
  return s ? `${m.titulo} › ${s.titulo}` : m.titulo
}

/** Garante que o valor selecionado TENHA uma opção — se a etapa vinculada não estiver mais
 *  na lista (marco trocado, etapa apagada, lista ainda carregando), o <select> pularia
 *  sozinho para a primeira opção e a pessoa veria "voltou para o marco inteiro" sem ter
 *  mexido em nada (dono, 10/09). Aqui ele mantém o que está gravado e diz o que houve. */
export function opcaoDoValorAtual(
  grupos: GrupoOpcoes[],
  valor: string,
  rotulo?: string,
): { valor: string; rotulo: string } | null {
  if (!valor) return null
  const existe = grupos.some(g => g.opcoes.some(o => o.valor === valor))
  if (existe) return null
  return { valor, rotulo: rotulo || 'Etapa vinculada (não está mais na lista)' }
}

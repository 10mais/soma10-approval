// Modelo de projeto: o CÁLCULO, separado da gravação.
//
// A régua das datas é CASCATA: cada etapa começa onde a anterior terminou.
// Etapa com duração 0 não empurra o cursor e nasce sem `dataFim` — é um marco
// pontual ("Reunião de kickoff"), não um período.
//
// Isto mora fora das rotas porque o MESMO cálculo é usado em três lugares que
// não podem divergir: aplicar um modelo, converter um negócio ganho no CRM e a
// PRÉVIA do mutirão. Prévia que simula por conta própria vira mentira no dia em
// que alguém mexer só na rota — aqui ela roda exatamente o código que grava.

export type EtapaModelo = { titulo: string; categoria?: string; descricao?: string; diasDuracao?: number }
export type TarefaModelo = { titulo: string; tipo?: string; prioridade?: string; marcoIndice?: number }
export type ModeloAplicavel = { marcos?: EtapaModelo[]; tarefas?: TarefaModelo[] }

export type EtapaPlanejada = { titulo: string; categoria: string; descricao: string; dataInicio: string; dataFim: string }
export type TarefaPlanejada = { titulo: string; tipo: string; prioridade: string; etapaIndice?: number }
export type PlanoModelo = { etapas: EtapaPlanejada[]; tarefas: TarefaPlanejada[] }

const DIA_MS = 24 * 60 * 60 * 1000

// O que o modelo vira quando aplicado a partir de `inicioBase`. Puro: mesma
// entrada, mesma saída — a data de "agora" é decidida por quem chama, nunca aqui.
export function planejarModelo(modelo: ModeloAplicavel, inicioBase: Date): PlanoModelo {
  const etapas: EtapaPlanejada[] = []
  let cursor = new Date(inicioBase.getTime())

  for (const m of (modelo.marcos || [])) {
    const ini = new Date(cursor.getTime())
    const dur = Math.max(0, Number(m.diasDuracao) || 0)
    const fim = new Date(ini.getTime() + dur * DIA_MS)
    etapas.push({
      titulo: m.titulo || '',
      categoria: m.categoria || 'outro',
      descricao: m.descricao || '',
      dataInicio: ini.toISOString(),
      dataFim: dur > 0 ? fim.toISOString() : '',
    })
    if (dur > 0) cursor = fim
  }

  // `marcoIndice` apontando para etapa inexistente vira tarefa solta, não erro:
  // modelo meio editado é rascunho, e rascunho não pode derrubar a aplicação.
  const tarefas: TarefaPlanejada[] = (modelo.tarefas || []).map(t => ({
    titulo: t.titulo || '',
    tipo: t.tipo || 'tarefa',
    prioridade: t.prioridade || 'media',
    ...(typeof t.marcoIndice === 'number' && etapas[t.marcoIndice] ? { etapaIndice: t.marcoIndice } : {}),
  }))

  return { etapas, tarefas }
}

// Remover a etapa `indice` REINDEXANDO as tarefas das etapas seguintes.
//
// A tela fazia só metade disso: desvinculava as tarefas da etapa removida e
// deixava as de baixo com o índice antigo — que passa a apontar para a etapa
// vizinha. Silencioso, e some no meio de um rascunho grande. Como o vínculo
// tarefa->etapa é POSICIONAL, remover no meio obriga a descer todo mundo.
export function removerEtapaDoModelo<M extends EtapaModelo, T extends TarefaModelo>(
  modelo: { marcos?: M[]; tarefas?: T[] }, indice: number
): { marcos: M[]; tarefas: T[] } {
  const marcos = (modelo.marcos || []).filter((_, j) => j !== indice)
  const tarefas = (modelo.tarefas || []).map(t => {
    if (typeof t.marcoIndice !== 'number') return t
    if (t.marcoIndice === indice) return { ...t, marcoIndice: undefined }
    return t.marcoIndice > indice ? { ...t, marcoIndice: t.marcoIndice - 1 } : t
  })
  return { marcos, tarefas }
}

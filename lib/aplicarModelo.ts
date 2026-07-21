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

export type UnidadeDuracao = 'dias' | 'semanas' | 'meses' | 'anos'
export const UNIDADES: { chave: UnidadeDuracao; label: string; abrev: string }[] = [
  { chave: 'dias', label: 'dias', abrev: 'd' },
  { chave: 'semanas', label: 'semanas', abrev: 'sem' },
  { chave: 'meses', label: 'meses', abrev: 'mes' },
  { chave: 'anos', label: 'anos', abrev: 'ano' },
]

// `duracao` + `unidade` é o formato atual. `diasDuracao` é o de antes (sempre em
// dias) e continua valendo nos modelos já salvos — sem unidade, o número é dia.
export type EtapaModelo = { titulo: string; categoria?: string; descricao?: string; diasDuracao?: number; duracao?: number; unidade?: UnidadeDuracao }
export type TarefaModelo = { titulo: string; tipo?: string; prioridade?: string; marcoIndice?: number }
export type ModeloAplicavel = { marcos?: EtapaModelo[]; tarefas?: TarefaModelo[] }

export type EtapaPlanejada = { titulo: string; categoria: string; descricao: string; dataInicio: string; dataFim: string }
export type TarefaPlanejada = { titulo: string; tipo: string; prioridade: string; etapaIndice?: number }
export type PlanoModelo = { etapas: EtapaPlanejada[]; tarefas: TarefaPlanejada[] }

const DIA_MS = 24 * 60 * 60 * 1000

// Avança uma data em N unidades.
//
// Dia e semana são aritmética simples. Mês e ano são CALENDÁRIO, não "30 dias"
// e "365 dias": quem escreve "1 mês" numa etapa espera 03/ago -> 03/set, e a
// aproximação erraria por um ou dois dias todo mês, acumulando na cascata.
//
// A armadilha do fim de mês: `setMonth` do JS transborda em silêncio — 31/jan
// com +1 mês vira 03/mar (fevereiro não tem 31). Aqui o dia é grampeado no
// último dia do mês de destino, que é o que "um mês depois" significa.
export function avancarData(base: Date, quantidade: number, unidade: UnidadeDuracao = 'dias'): Date {
  const n = Math.max(0, Math.floor(Number(quantidade) || 0))
  if (n === 0) return new Date(base.getTime())
  if (unidade === 'dias') return new Date(base.getTime() + n * DIA_MS)
  if (unidade === 'semanas') return new Date(base.getTime() + n * 7 * DIA_MS)

  const d = new Date(base.getTime())
  const mesesTotal = unidade === 'anos' ? n * 12 : n
  const diaOriginal = d.getUTCDate()
  d.setUTCDate(1) // some com o transbordo ANTES de trocar o mês
  d.setUTCMonth(d.getUTCMonth() + mesesTotal)
  const ultimoDiaDoMes = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(diaOriginal, ultimoDiaDoMes))
  return d
}

// Quantas unidades esta etapa dura, no formato de hoje ou no antigo.
export function duracaoDaEtapa(m: EtapaModelo): { quantidade: number; unidade: UnidadeDuracao } {
  if (typeof m.duracao === 'number' || m.unidade) {
    return { quantidade: Math.max(0, Number(m.duracao) || 0), unidade: m.unidade || 'dias' }
  }
  return { quantidade: Math.max(0, Number(m.diasDuracao) || 0), unidade: 'dias' }
}

// O que o modelo vira quando aplicado a partir de `inicioBase`. Puro: mesma
// entrada, mesma saída — a data de "agora" é decidida por quem chama, nunca aqui.
export function planejarModelo(modelo: ModeloAplicavel, inicioBase: Date): PlanoModelo {
  const etapas: EtapaPlanejada[] = []
  let cursor = new Date(inicioBase.getTime())

  for (const m of (modelo.marcos || [])) {
    const ini = new Date(cursor.getTime())
    const { quantidade, unidade } = duracaoDaEtapa(m)
    const fim = avancarData(ini, quantidade, unidade)
    etapas.push({
      titulo: m.titulo || '',
      categoria: m.categoria || 'outro',
      descricao: m.descricao || '',
      dataInicio: ini.toISOString(),
      dataFim: quantidade > 0 ? fim.toISOString() : '',
    })
    if (quantidade > 0) cursor = fim
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

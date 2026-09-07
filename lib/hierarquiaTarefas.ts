// HIERARQUIA DE TAREFAS — "puxar tarefas para dentro de outras" (pedido do dono,
// 07/09/2026, referência ClickUp). Regras puras que a API e a tela obedecem:
//
// - UM nível: mãe → filhas. Uma filha não vira mãe, e uma mãe (com filhas) não
//   vira filha. A Lista e o Kanban foram desenhados para um nível.
// - Sem ciclo: a tarefa não pode ser mãe de si mesma.
// - Cliente: a filha assume o cliente da mãe quando divergem (a mãe é a unidade
//   de entrega; o hub do cliente e o relatório da semana leem por clienteId).
// - Concluir a mãe com filhas abertas é uma PERGUNTA, não um bloqueio.

export type TarefaH = {
  id: string
  titulo?: string
  status?: string
  clienteId?: string
  clienteNome?: string
  tarefaPaiId?: string | null
  prazo?: string
  excluidoEm?: string
}

// (sem união discriminada: o tsconfig não estreita por `ok`; motivo vem vazio quando ok)
export type Veredito = { ok: boolean; motivo?: string }

const ABERTA = ['a_fazer', 'em_andamento', 'em_revisao']

export function filhasDe(maeId: string, tarefas: TarefaH[]): TarefaH[] {
  return tarefas.filter(t => t.tarefaPaiId === maeId && !t.excluidoEm)
}

/** A tarefa `id` pode virar subtarefa de `maeId`? */
export function podeSerFilha(id: string, maeId: string, tarefas: TarefaH[]): Veredito {
  if (!id || !maeId) return { ok: false, motivo: 'Tarefa ou mãe não informada.' }
  if (id === maeId) return { ok: false, motivo: 'Uma tarefa não pode ser subtarefa de si mesma.' }
  const t = tarefas.find(x => x.id === id)
  const mae = tarefas.find(x => x.id === maeId)
  if (!t) return { ok: false, motivo: 'Tarefa não encontrada.' }
  if (!mae) return { ok: false, motivo: 'Tarefa-mãe não encontrada.' }
  if (mae.excluidoEm) return { ok: false, motivo: 'A tarefa-mãe está na lixeira.' }
  if (mae.tarefaPaiId) return { ok: false, motivo: `"${mae.titulo || 'Essa tarefa'}" já é uma subtarefa — só há um nível: mãe e filhas.` }
  if (filhasDe(id, tarefas).length > 0) return { ok: false, motivo: `"${t.titulo || 'Essa tarefa'}" tem subtarefas. Tire-as de dentro antes de movê-la para outra mãe.` }
  if (t.tarefaPaiId === maeId) return { ok: false, motivo: 'Já é subtarefa dessa tarefa.' }
  return { ok: true }
}

/** Campos a gravar na filha ao vincular: mãe + (se divergir) cliente da mãe. */
export function camposAoVincular(t: TarefaH, mae: TarefaH): { tarefaPaiId: string; clienteId?: string; clienteNome?: string; clienteMudou: boolean } {
  const mudou = (mae.clienteId || '') !== (t.clienteId || '')
  return mudou
    ? { tarefaPaiId: mae.id, clienteId: mae.clienteId || '', clienteNome: mae.clienteNome || '', clienteMudou: true }
    : { tarefaPaiId: mae.id, clienteMudou: false }
}

export function progressoDaMae(maeId: string, tarefas: TarefaH[]): { total: number; concluidas: number; abertas: TarefaH[] } {
  const filhas = filhasDe(maeId, tarefas)
  const concluidas = filhas.filter(f => f.status === 'concluido').length
  return { total: filhas.length, concluidas, abertas: filhas.filter(f => ABERTA.includes(f.status || '')) }
}

/** Prazo da filha depois do prazo da mãe = aviso (não bloqueia). */
export function prazoEstoura(filha: TarefaH, mae: TarefaH): boolean {
  if (!filha.prazo || !mae.prazo) return false
  const a = new Date(filha.prazo).getTime(), b = new Date(mae.prazo).getTime()
  return Number.isFinite(a) && Number.isFinite(b) && a > b + 60000
}

/** Mesma validação para várias de uma vez (barra de ações em massa): devolve as que podem e os motivos das que não podem. */
export function validarEmMassa(ids: string[], maeId: string, tarefas: TarefaH[]): { podem: string[]; recusadas: { id: string; motivo: string }[] } {
  const podem: string[] = [], recusadas: { id: string; motivo: string }[] = []
  for (const id of ids) {
    const v = podeSerFilha(id, maeId, tarefas)
    if (v.ok) podem.push(id); else recusadas.push({ id, motivo: v.motivo || 'Não permitido.' })
  }
  return { podem, recusadas }
}

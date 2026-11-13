// STATUS DA TAREFA — fonte única de ordem, rótulo, cor e "está aberta".
//
// Até 13/11/2026 cada tela tinha a sua lista (20 arquivos): rótulos sem acento numa, cores
// diferentes noutra, e a lista de "abertas" copiada em 12 lugares. O status novo "Em ajuste"
// (dono, 13/11: "Quando o cliente pedir ajuste, volta a tarefa com o status EM AJUSTE") teria
// de ser lembrado em todos eles; esquecido em um, a tarefa sumiria daquela tela. Por isso a
// lista mora aqui, com teste, e as telas importam.
//
// Ciclo da tarefa de uma pauta (lib/tarefasDaPauta): A fazer → Em andamento → Em revisão
// (criativo entregue, peça na Fila de programação) → Em ajuste (cliente ou revisão interna
// pediu ajuste) → Em revisão → Concluído (cliente aprovou o criativo).

export type StatusTarefa = 'a_fazer' | 'em_andamento' | 'em_ajuste' | 'em_revisao' | 'concluido' | 'descartado'

export const STATUS_TAREFA: { chave: StatusTarefa; rotulo: string; cor: string }[] = [
  { chave: 'a_fazer', rotulo: 'A fazer', cor: 'var(--v2-ink3)' },
  { chave: 'em_andamento', rotulo: 'Em andamento', cor: 'var(--v2-info)' },
  { chave: 'em_ajuste', rotulo: 'Em ajuste', cor: 'var(--v2-hot)' },
  { chave: 'em_revisao', rotulo: 'Em revisão', cor: 'var(--v2-amber)' },
  { chave: 'concluido', rotulo: 'Concluído', cor: 'var(--v2-ok)' },
  { chave: 'descartado', rotulo: 'Descartado', cor: 'var(--v2-ink2)' },
]

// Abertas = ainda dão trabalho a alguém. Tarefa antiga sem status conta como aberta.
export const STATUS_ABERTOS: StatusTarefa[] = ['a_fazer', 'em_andamento', 'em_ajuste', 'em_revisao']

export function statusAberto(status?: string | null): boolean {
  return !status || (STATUS_ABERTOS as string[]).includes(status)
}

export function rotuloStatusTarefa(status?: string | null): string {
  return STATUS_TAREFA.find(s => s.chave === status)?.rotulo || status || ''
}

export function corStatusTarefa(status?: string | null): string {
  return STATUS_TAREFA.find(s => s.chave === status)?.cor || 'var(--v2-ink3)'
}

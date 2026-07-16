// Campos da Tarefa que vêm do FORMULÁRIO. Uma lista só, usada na criação (POST)
// e na edição (PUT).
//
// Por que existe: o POST montava a tarefa campo a campo e a lista de campos do
// PUT era outra, escrita à mão. As duas divergiram — `anexos`, `checklist`,
// `documentoId` e `mapaId` estavam só no PUT. Resultado: anexo subido numa
// tarefa NOVA era jogado fora sem erro nenhum, e só "colava" na segunda
// tentativa (aí já era edição, e o PUT salvava). Duas listas para a mesma coisa
// voltam a divergir; esta é a única.
//
// Também é a fronteira de confiança: só o que está aqui entra. `id`,
// `criadoPor`, `criadoEm`, `atividades` e `comentarios` são do servidor — se
// viessem do corpo, o cliente reescreveria a autoria e o histórico.

import type { Tarefa } from './redis'

export const CAMPOS_TAREFA = [
  'titulo', 'descricao', 'tipo', 'status', 'prioridade',
  'responsavelEmail', 'responsavelNome', 'clienteId', 'clienteNome',
  'marcoId', 'prazo', 'recorrencia', 'anexos', 'checklist',
  'documentoId', 'mapaId',
] as const

export type CampoTarefa = typeof CAMPOS_TAREFA[number]

// Pega do corpo SÓ os campos do formulário. Chave ausente ≠ chave vazia: quem
// não mandou o campo não o altera (o PUT depende disso para o salvamento
// parcial, ex.: só mudar o status ao arrastar no kanban).
export function camposDoCorpo(body: unknown): Partial<Tarefa> {
  const out: Record<string, unknown> = {}
  if (!body || typeof body !== 'object') return out
  for (const campo of CAMPOS_TAREFA) {
    if (campo in (body as Record<string, unknown>)) out[campo] = (body as Record<string, unknown>)[campo]
  }
  return out as Partial<Tarefa>
}

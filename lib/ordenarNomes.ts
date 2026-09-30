// ORDEM ALFABÉTICA DE PESSOAS — dono, 29/09/2026 (print do filtro de responsável em Tarefas):
// "Aonde selecionamos o usuário, tanto aqui, quanto dentro da tarefa, salve eles em ordem
// alfabética... Ex.: Ana em primeiro da lista. Willian, por último."
//
// A lista vinha na ordem do conjunto `usuarios` do Redis, que não tem ordem nenhuma. Ordena-se
// na ORIGEM (lib/cache.getUsuariosRaw, que abastece /api/usuarios e /api/equipe) e de novo na
// tela de Tarefas, que também recebe listas montadas por outras telas.
// Português de verdade: sem diferenciar maiúscula nem acento ("Álvaro" fica entre os "A").

const coll = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

/** Compara pelo nome; sem nome, pelo e-mail (quem não tem nome não some da lista). */
export function compararPessoas(a: { nome?: string; email?: string }, b: { nome?: string; email?: string }): number {
  const na = String(a?.nome || '').trim() || String(a?.email || '')
  const nb = String(b?.nome || '').trim() || String(b?.email || '')
  return coll.compare(na, nb) || coll.compare(String(a?.email || ''), String(b?.email || ''))
}

/** Cópia ordenada (não mexe na lista original). */
export function ordenarPorNome<T extends { nome?: string; email?: string }>(lista: T[] | null | undefined): T[] {
  return [...(lista || [])].sort(compararPessoas)
}

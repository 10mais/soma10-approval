// ABRIR UMA TAREFA de qualquer tela (dono, 20/10/2026: barra "Próximas tarefas", cartão da tarefa
// do plano no Estúdio). Dentro do painel, quem abre é o próprio painel (modal da tarefa, sem
// recarregar); fora dele (Equipe, hub do cliente), vai para /dashboard?tarefa=ID, que o painel lê.
//
// Por que um registro e não só o link: dentro do painel o link troca a URL, o painel abre e limpa
// a URL por fora do roteador; o segundo clique na MESMA tarefa não mudava nada e não abria.

type Abridor = (id: string) => void

let abridor: Abridor | null = null

/** O painel registra quem abre a tarefa (e tira ao desmontar). */
export function registrarAbridorDeTarefa(fn: Abridor | null): void {
  abridor = fn
}

/** Abre a tarefa: pelo painel, se ele estiver na tela; senão, pelo link. */
export function abrirTarefa(id: string, irPara: (url: string) => void): void {
  if (!id) return
  if (abridor) abridor(id)
  else irPara(`/dashboard?tarefa=${encodeURIComponent(id)}`)
}

// Fechar modal ao clicar FORA — sem perder trabalho por engano.
//
// Dois erros que isto conserta:
//
// 1. SELECIONAR TEXTO FECHAVA O MODAL. `onClick` no overlay dispara quando o
//    mouse é SOLTO ali — mesmo que tenha sido PRESSIONADO dentro do modal. Ao
//    arrastar para selecionar um texto e soltar fora da caixa, o formulário
//    fechava e o trabalho ia junto. O que importa é onde o clique COMEÇOU.
// 2. Fechar sem perguntar: clique fora acidental descartava o formulário inteiro.
//
// Por isso `deveFechar` exige que o pressionar E o soltar tenham acontecido no
// overlay. O registro do "onde pressionou" é global (um listener na fase de
// captura), o que evita ter que dar estado a cada um dos ~30 modais do sistema.

// Núcleo puro — é aqui que mora a regra, e é o que os testes cobrem.
export function deveFechar(alvo: unknown, overlay: unknown, pressionadoEm: unknown): boolean {
  // Soltou em cima de algo DENTRO do modal (o alvo não é o fundo) → não fecha.
  if (alvo !== overlay) return false
  // Pressionou dentro e arrastou até o fundo (seleção de texto) → não fecha.
  if (pressionadoEm !== overlay) return false
  return true
}

let pressionadoEm: EventTarget | null = null

// Fase de CAPTURA: precisa registrar antes de qualquer stopPropagation dos filhos.
if (typeof document !== 'undefined') {
  const marcar = (e: Event) => { pressionadoEm = e.target }
  document.addEventListener('mousedown', marcar, true)
  document.addEventListener('touchstart', marcar, true)
}

export function ondePressionou(): EventTarget | null { return pressionadoEm }

type Evento = { target: unknown; currentTarget: unknown }

// Foi um clique de verdade no fundo do modal?
export function clicouNoFundo(e: Evento): boolean {
  return deveFechar(e.target, e.currentTarget, pressionadoEm)
}

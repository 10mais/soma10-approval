// Relógio da tela de abertura (SplashRegra).
//
// Lógica pura, fora do componente, por dois motivos:
// 1) A splash pode MONTAR DUAS VEZES na mesma abertura (o dashboard a renderiza
//    enquanto a sessão carrega e de novo quando a sessão fica pronta). O relógio
//    tem que ser um só: a segunda instância continua de onde a primeira parou,
//    em vez de recomeçar os 5s do zero.
// 2) Incidente de 07/09/2026: a splash ficou invisível MAS cobrindo a tela
//    inteira (ninguém clicava em nada, no celular e no desktop). Um overlay de
//    carregamento nunca pode depender de um único caminho feliz para sumir —
//    por isso existe um TETO absoluto, independente de fetch, sessão ou timer.

export const SPLASH_COM_REGRA_MS = 5000
export const SPLASH_SEM_REGRA_MS = 1200
export const SPLASH_TETO_MS = 12000 // depois disso a splash sai, aconteça o que acontecer
export const SPLASH_SAIDA_MS = 420 // duração do fade

/** Quanto ainda falta mostrar, dado quando o relógio começou e se há regra. */
export function tempoRestante(inicio: number, agora: number, temRegra: boolean): number {
  const alvo = temRegra ? SPLASH_COM_REGRA_MS : SPLASH_SEM_REGRA_MS
  return Math.max(0, alvo - (agora - inicio))
}

/** Quanto falta para o teto absoluto (0 = já passou; a splash tem que sair). */
export function tetoRestante(inicio: number, agora: number): number {
  return Math.max(0, SPLASH_TETO_MS - (agora - inicio))
}

/** A splash pode sair? Sai quando o tempo mínimo passou E o pai está pronto, ou quando o teto estourou. */
export function podeSair(args: { inicio: number; agora: number; temRegra: boolean | undefined; pronto: boolean }): boolean {
  const { inicio, agora, temRegra, pronto } = args
  if (tetoRestante(inicio, agora) === 0) return true
  if (temRegra === undefined) return false // ainda não sabemos se há regra: espera (até o teto)
  return pronto && tempoRestante(inicio, agora, temRegra) === 0
}

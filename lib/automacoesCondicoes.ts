// Lógica PURA de avaliação de condições/escopo das automações (client-safe:
// usa só `import type` do redis, então não instancia o cliente Redis). Extraída
// do motor para poder ser testada de forma determinística — um erro aqui dispara
// automações erradas (spam ao cliente) ou deixa de disparar as certas.
import type { Automacao, AutomacaoCondicao } from './redis'

// Uma condição bate o valor do contexto contra o alvo, pelo operador.
export function condBate(c: AutomacaoCondicao, ctx: Record<string, any>): boolean {
  const v = ctx[c.campo]
  const alvo = c.valor ?? ''
  switch (c.operador) {
    case 'preenchido': return v != null && String(v) !== ''
    case 'vazio': return v == null || String(v) === ''
    case 'igual': return String(v ?? '').toLowerCase() === alvo.toLowerCase()
    case 'diferente': return String(v ?? '').toLowerCase() !== alvo.toLowerCase()
    case 'contem': return String(v ?? '').toLowerCase().includes(alvo.toLowerCase())
    case 'maior': return Number(v) > Number(alvo)
    case 'menor': return Number(v) < Number(alvo)
    default: return true
  }
}

// Combina as condições da regra por "todas" (every) ou "qualquer" (some).
// Sem condições = sempre passa.
export function avaliarCondicoes(regra: Automacao, ctx: Record<string, any>): boolean {
  const cs = regra.condicoes || []
  if (!cs.length) return true
  return regra.condicaoLogica === 'qualquer' ? cs.some(c => condBate(c, ctx)) : cs.every(c => condBate(c, ctx))
}

// Escopo: 'selecionados' = só os clienteIds da regra; 'todos' = todos, com
// override de exclusão por cliente.
export function escopoBate(regra: Automacao, ctx: Record<string, any>): boolean {
  const cid = ctx.clienteId as string | undefined
  if (regra.alvo === 'selecionados') return !!cid && (regra.clienteIds || []).includes(cid)
  if (cid && (regra.clienteIdsExcluidos || []).includes(cid)) return false
  return true
}

// FECHAMENTO DO MÊS — o faturamento de um mês que passou fica GRAVADO.
//
// Dono, 22/09/2026: "cada mês que passou precisa ficar gravado o faturamento que teve e não
// misturar com os demais."
//
// Calcular o passado a partir do contrato de hoje (lib/receitaRecorrente) já conserta a soma,
// mas ainda é um cálculo: no dia em que o contrato de um cliente sobe de R$ 2.000 para
// R$ 3.000, os meses ANTERIORES também subiriam — o histórico mudaria sozinho. Por isso, todo
// mês que termina é FECHADO: o número daquele mês é gravado com a data do fechamento e não se
// mexe mais, aconteça o que acontecer com o contrato depois.
//
// Quem fecha é o cron diário (/api/cron/alertas). É idempotente: mês já fechado não é
// reescrito, e o primeiro fechamento preenche os meses passados que ainda não tinham registro.

import { redis } from './redis'
import {
  historicoFaturamento, receitaClienteNoMes, mesDoDia, mesesEntre, primeiroMesDaBase,
  type ClienteFin,
} from './receitaRecorrente'

export type FechamentoMes = {
  mes: string            // 'YYYY-MM'
  total: number
  fechadoEm: string      // ISO — quando o número virou história
  porCliente: { id: string; nome: string; total: number }[]
}

export const chaveFechamento = (mes: string) => `financeiro:mes:${mes}`

/** Mês anterior ao de referência ('2026-01' → '2025-12'). */
export function mesAnterior(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
}

/** O retrato de um mês, pronto para gravar. */
export function montarFechamento(clientes: ClienteFin[], mes: string, hoje: Date): FechamentoMes {
  const porCliente = clientes
    .map(c => ({ id: String(c.id || ''), nome: String(c.nome || ''), total: receitaClienteNoMes(c, mes, hoje).total }))
    .filter(l => l.total > 0)
    .sort((a, b) => b.total - a.total)
  return {
    mes,
    total: porCliente.reduce((s, l) => s + l.total, 0),
    fechadoEm: new Date().toISOString(),
    porCliente,
  }
}

/** Meses já terminados que ainda não foram fechados (do primeiro da base até o mês passado). */
export function mesesAFechar(clientes: ClienteFin[], hoje: Date, jaFechados: string[]): string[] {
  const ultimo = mesAnterior(mesDoDia(hoje))
  const primeiro = primeiroMesDaBase(clientes, hoje)
  if (primeiro > ultimo) return []
  const fechados = new Set(jaFechados)
  return mesesEntre(primeiro, ultimo).filter(m => !fechados.has(m))
}

/** Fecha o que falta. Devolve os meses gravados agora (vazio = já estava tudo fechado). */
export async function fecharMesesPendentes(clientes: ClienteFin[], hoje = new Date()): Promise<string[]> {
  const ultimo = mesAnterior(mesDoDia(hoje))
  const primeiro = primeiroMesDaBase(clientes, hoje)
  if (primeiro > ultimo) return []
  const candidatos = mesesEntre(primeiro, ultimo)
  const existentes = await Promise.all(candidatos.map(m => redis.get<FechamentoMes>(chaveFechamento(m)).catch(() => null)))
  const faltando = candidatos.filter((m, i) => !existentes[i])
  for (const mes of faltando) {
    await redis.set(chaveFechamento(mes), montarFechamento(clientes, mes, hoje))
    await redis.sadd('financeiro:meses', mes)
  }
  return faltando
}

/** Todos os meses fechados (para a tela usar o número gravado em vez de recalcular). */
export async function lerFechamentos(): Promise<FechamentoMes[]> {
  const meses = await redis.smembers('financeiro:meses').catch(() => [] as string[])
  if (!meses.length) return []
  const lista = await redis.mget<(FechamentoMes | null)[]>(...meses.map(chaveFechamento))
  return (lista.filter(Boolean) as FechamentoMes[]).sort((a, b) => a.mes.localeCompare(b.mes))
}

/** Faturamento do mês: o GRAVADO quando existe; senão, o calculado (mês corrente e futuros). */
export function faturamentoDoMes(mes: string, fechados: Record<string, FechamentoMes>, clientes: ClienteFin[], hoje: Date): { total: number; fechado: boolean } {
  const f = fechados[mes]
  if (f) return { total: f.total, fechado: true }
  return { total: historicoFaturamento(clientes, hoje, mes).find(x => x.mes === mes)?.total ?? clientes.reduce((s, c) => s + receitaClienteNoMes(c, mes, hoje).total, 0), fechado: false }
}

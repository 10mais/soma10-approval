// FATURAMENTO RECORRENTE POR MÊS — o mês é quem manda.
//
// Dono, 22/09/2026: "o cálculo no financeiro está errado. Está somando todo o montante,
// sem levar em consideração os períodos de entrada. (…) cada mês que passou precisa ficar
// gravado o faturamento que teve e não misturar com os demais. A cada cliente novo, lança o
// valor DALI PARA FRENTE, e não todo o montante."
//
// O que estava errado: a tela somava `contratoValor` de TODO cliente em TODO mês. Um cliente
// fechado em setembro aparecia faturando em janeiro; um cliente arquivado continuava faturando
// para sempre. Todo mês do gráfico dava o mesmo número — o histórico não existia.
//
// A regra agora, por cliente e por mês:
//   • começa no mês do INÍCIO DO CONTRATO (`contratoInicio`); sem isso, no mês em que o
//     cliente foi cadastrado (`criadoEm`) — é o "dali para frente";
//   • termina quando o cliente é ARQUIVADO (mês de `arquivadoEm`); arquivado sem data,
//     conta até o mês atual e nada depois;
//   • `contratoRenovacao` NÃO encerra nada: renovação vencida é contrato a renovar, não
//     contrato morto — cortar a receita aí apagaria faturamento real da tela;
//   • `contratoValor` é o valor MENSAL (é assim que a tela de cadastro pede). O ciclo
//     (trimestral, anual…) diz quando o dinheiro ENTRA, não quanto se fatura no mês — a data
//     de entrada vive na previsão de caixa, pelo dia de vencimento;
//   • cobranças avulsas/modulares já nascem com o mês delas e entram só nesse mês.
//
// Tudo aqui é puro: mesma entrada, mesma saída, sem Redis e sem relógio escondido (o "hoje"
// é parâmetro). Quem soma dinheiro na tela chama daqui — duas contas de faturamento em dois
// arquivos divergem no pior lugar possível.

import { totalMensalModulos, type ClienteModulos } from './modulos'

export type ClienteFin = {
  id?: string
  nome?: string
  tipo?: string // 'interno' = projeto da casa, não fatura
  contratoValor?: number
  contratoInicio?: string
  criadoEm?: string
  arquivado?: boolean
  arquivadoEm?: string
  inadimplente?: boolean
  modulos?: ClienteModulos
  receitasAvulsas?: { id?: string; mes: string; valor: number; descricao?: string }[]
}

/** 'YYYY-MM' de uma data. Data pura (YYYY-MM-DD) é lida como está; carimbo com hora vira o
 *  mês LOCAL — `slice(0, 7)` num ISO com Z joga o dia 31 às 21h para o mês seguinte. */
export function mesDe(data?: string | null): string | null {
  const s = String(data || '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(s)) return s.slice(0, 7)
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Mês de referência de um Date (o "hoje" de quem chama). */
export function mesDoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Primeiro mês que fatura: início do contrato ou, sem ele, o cadastro do cliente. */
export function mesInicioContrato(c: ClienteFin): string | null {
  return mesDe(c.contratoInicio) || mesDe(c.criadoEm)
}

/** Último mês que fatura (null = segue faturando). */
export function mesFimContrato(c: ClienteFin, hoje: Date): string | null {
  if (!c.arquivado) return null
  return mesDe(c.arquivadoEm) || mesDoDia(hoje)
}

/** O contrato está valendo neste mês? */
export function contratoVigenteNoMes(c: ClienteFin, mes: string, hoje: Date): boolean {
  if (c.tipo === 'interno') return false
  const ini = mesInicioContrato(c)
  // Cliente sem início e sem cadastro conhecido: não dá para inventar passado — vale de hoje.
  if (ini && mes < ini) return false
  if (!ini && mes < mesDoDia(hoje)) return false
  const fim = mesFimContrato(c, hoje)
  if (fim && mes > fim) return false
  return true
}

/** Mensalidade cheia do cliente (contrato + assinaturas de módulos), sem olhar o mês. */
export function mensalidadeCliente(c: ClienteFin): number {
  return (Number(c.contratoValor) || 0) + totalMensalModulos(c.modulos)
}

/** Cobranças avulsas/modulares lançadas NESTE mês. */
export function avulsasNoMes(c: ClienteFin, mes: string): number {
  return (c.receitasAvulsas || []).filter(r => r.mes === mes).reduce((s, r) => s + (Number(r.valor) || 0), 0)
}

/** O que este cliente faturou (ou vai faturar) NESTE mês. */
export function receitaClienteNoMes(c: ClienteFin, mes: string, hoje: Date): { recorrente: number; avulsas: number; total: number } {
  const recorrente = contratoVigenteNoMes(c, mes, hoje) ? mensalidadeCliente(c) : 0
  // Avulsa é um lançamento daquele mês: vale mesmo fora da vigência (o cliente pagou algo
  // pontual antes de assinar ou depois de sair), mas nunca para projeto interno.
  const avulsas = c.tipo === 'interno' ? 0 : avulsasNoMes(c, mes)
  return { recorrente, avulsas, total: recorrente + avulsas }
}

/** Faturamento de todos os clientes num mês. */
export function receitaTotalNoMes(clientes: ClienteFin[], mes: string, hoje: Date): number {
  return clientes.reduce((s, c) => s + receitaClienteNoMes(c, mes, hoje).total, 0)
}

/** Meses de 'de' até 'ate' (inclusive), em ordem. */
export function mesesEntre(de: string, ate: string): string[] {
  const [a1, m1] = de.split('-').map(Number)
  const [a2, m2] = ate.split('-').map(Number)
  const out: string[] = []
  let ano = a1, mes = m1
  while (ano < a2 || (ano === a2 && mes <= m2)) {
    out.push(`${ano}-${String(mes).padStart(2, '0')}`)
    mes++
    if (mes > 12) { mes = 1; ano++ }
  }
  return out
}

/** Primeiro mês com faturamento em toda a base (para o acumulado "Tudo"). */
export function primeiroMesDaBase(clientes: ClienteFin[], hoje: Date): string {
  const inicios = clientes.filter(c => c.tipo !== 'interno').map(c => mesInicioContrato(c)).filter(Boolean) as string[]
  const avulsas = clientes.flatMap(c => (c.receitasAvulsas || []).map(r => r.mes)).filter(Boolean)
  const todos = [...inicios, ...avulsas].sort()
  return todos[0] || mesDoDia(hoje)
}

/**
 * Faturamento de cada mês do histórico até o mês atual — é a linha do tempo que a tela mostra.
 * Mês fechado guarda o que ELE teve; nada é misturado com os outros.
 */
export function historicoFaturamento(clientes: ClienteFin[], hoje: Date, ate?: string): { mes: string; total: number }[] {
  const fim = ate || mesDoDia(hoje)
  const ini = primeiroMesDaBase(clientes, hoje)
  if (ini > fim) return []
  return mesesEntre(ini, fim).map(mes => ({ mes, total: receitaTotalNoMes(clientes, mes, hoje) }))
}

/** Acumulado do histórico (o que a opção "Tudo" mostra): soma mês a mês, sem repetir ninguém. */
export function faturamentoAcumulado(clientes: ClienteFin[], hoje: Date, ate?: string): number {
  return historicoFaturamento(clientes, hoje, ate).reduce((s, m) => s + m.total, 0)
}

/** O contrato está valendo NESTA DATA? (previsão de caixa: só cobra quem ainda é cliente) */
export function contratoVigenteNaData(c: ClienteFin, data: Date, hoje: Date): boolean {
  return contratoVigenteNoMes(c, mesDoDia(data), hoje)
}

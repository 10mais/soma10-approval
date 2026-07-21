// Contrato de cidadania → Financeiro. Puro, client-safe, testável.
//
// A VENDA da assessoria é o PROCESSO: o contrato fechado vira parcelas/pagamentos
// em Processo.financeiro (lib/financeiroContrato). Este módulo traduz esse
// financeiro em LANÇAMENTOS do Financeiro geral — cada parcela vira uma entrada
// prevista (recebida quando paga) e cada pagamento avulso, uma entrada recebida.
//
// IDs DETERMINÍSTICOS (`proc-{id}-{parcela}`): a rota re-sincroniza a cada
// salvamento — mesmo id sobrescreve em vez de duplicar, e o que sumiu do
// processo é removido do financeiro. Sem isso, editar o contrato três vezes
// deixaria três previsões da mesma parcela e o "a receber" mentiria.
//
// Processo ARQUIVADO: as parcelas pendentes somem da previsão (não vão entrar),
// mas o que JÁ FOI PAGO continua — o dinheiro entrou de verdade, e desistência
// de cliente não apaga o que ele pagou.

import type { Parcela, Pagamento } from './financeiroContrato'

export type ProcessoFinanceiroLite = {
  id: string
  titulo: string
  status?: string // 'ativo' | 'pausado' | 'concluido' | 'arquivado'
  financeiro?: {
    parcelas?: Parcela[]
    pagamentos?: Pagamento[]
  }
}

export type LancamentoProcesso = {
  id: string
  tipo: 'entrada'
  descricao: string
  valor: number
  data: string // YYYY-MM-DD
  recebido: boolean
  processoId: string
}

const ehData = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

export function lancamentosDoProcesso(processo: ProcessoFinanceiroLite): LancamentoProcesso[] {
  const f = processo?.financeiro
  if (!f) return []
  const encerrado = processo.status === 'arquivado'
  const quem = processo.titulo || 'Processo'
  const out: LancamentoProcesso[] = []

  const parcelas = (f.parcelas || []).filter(p => Number(p?.valor) > 0 && ehData(p?.vencimento))
  for (const p of parcelas) {
    const paga = p.status === 'pago'
    if (encerrado && !paga) continue // parcela que não vai mais entrar
    out.push({
      id: `proc-${processo.id}-${p.id}`,
      tipo: 'entrada',
      descricao: `${quem} (parcela ${p.numero}/${parcelas.length})`,
      valor: Math.round(p.valor * 100) / 100,
      data: paga && ehData(p.pagoEm) ? p.pagoEm! : p.vencimento,
      recebido: paga,
      processoId: processo.id,
    })
  }

  for (const pg of f.pagamentos || []) {
    if (!(Number(pg?.valor) > 0) || !ehData(pg?.data)) continue
    out.push({
      id: `proc-${processo.id}-pg-${pg.id}`,
      tipo: 'entrada',
      descricao: `${quem} (pagamento${pg.nota ? ` — ${pg.nota}` : ''})`,
      valor: Math.round(pg.valor * 100) / 100,
      data: pg.data,
      recebido: true, // pagamento avulso é registro de dinheiro que JÁ entrou
      processoId: processo.id,
    })
  }

  return out
}

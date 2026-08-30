// GANHOS DO CRM → ENTRADAS NO FINANCEIRO.
//
// A venda fechada no funil e o dinheiro no caixa são a mesma coisa vista de dois
// lugares — mas o lançamento NÃO é automático, de propósito:
//
// 1. Ganho no CRM é decisão comercial; entrada no caixa é fato financeiro. Nem
//    todo ganho vira dinheiro no dia (e alguns não viram nunca).
// 2. Falta o dado que só quem recebeu sabe: a FORMA DE PAGAMENTO.
//
// Por isso o sistema PERGUNTA — lista os ganhos ainda não lançados e o admin
// lança um a um, escolhendo forma e data. O vínculo `negocioId` no lançamento é
// o que impede lançar a mesma venda duas vezes.

import { dataDoGanho, NegocioMeta } from './metas'

// Mesmas formas do PDV do varejo (lib/redis FormaPagamentoVenda): uma clínica
// recebe pelos mesmos meios de uma loja, e dois catálogos divergiriam no
// primeiro relatório que somasse os dois.
export const FORMAS_PAGAMENTO: { chave: string; label: string }[] = [
  { chave: 'pix', label: 'Pix' },
  { chave: 'dinheiro', label: 'Dinheiro' },
  { chave: 'debito', label: 'Cartão de débito' },
  { chave: 'credito', label: 'Cartão de crédito' },
  { chave: 'boleto', label: 'Boleto' },
  { chave: 'outro', label: 'Outro' },
]

export function rotuloFormaPagamento(chave?: string): string {
  return FORMAS_PAGAMENTO.find(f => f.chave === chave)?.label || 'Não informada'
}
export function formaValida(chave?: string): boolean {
  return FORMAS_PAGAMENTO.some(f => f.chave === chave)
}

export type LancamentoLite = { id?: string; negocioId?: string }

// Ganhos que ainda não viraram entrada. Fora da lista: o que já foi lançado
// (vínculo `negocioId`), o que o admin dispensou e o ganho SEM VALOR — lançar
// R$ 0 no caixa é sujeira, não registro.
export function ganhosPendentes(
  negocios: NegocioMeta[],
  lancamentos: LancamentoLite[],
  dispensados: string[] = [],
): NegocioMeta[] {
  const jaLancados = new Set(lancamentos.map(l => l.negocioId).filter(Boolean) as string[])
  const ignorados = new Set(dispensados)
  return negocios
    .filter(n => n.status === 'ganho' && (Number(n.valor) || 0) > 0)
    .filter(n => !!n.id && !jaLancados.has(n.id) && !ignorados.has(n.id))
    .sort((a, b) => new Date(dataDoGanho(b)).getTime() - new Date(dataDoGanho(a)).getTime())
}

// Data sugerida do lançamento: o dia em que a venda foi ganha (mesma regra da
// meta — `dataDoGanho`). Sem data reconhecível, cai em `hoje`, nunca em vazio.
export function dataSugerida(n: NegocioMeta, hoje: Date): string {
  const iso = dataDoGanho(n)
  const d = iso ? new Date(iso) : null
  const base = d && !isNaN(d.getTime()) ? d : hoje
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
}

// Descrição que vai para o extrato. Leva o nome da pessoa quando existe: no
// financeiro, "Oportunidade" sem nome não diz de quem é o dinheiro.
export function descricaoDoGanho(n: NegocioMeta, contatoNome?: string): string {
  const titulo = String(n.titulo || '').trim() || 'Venda'
  const nome = String(contatoNome || '').trim()
  const base = nome && !titulo.toLowerCase().includes(nome.toLowerCase()) ? `${titulo} — ${nome}` : titulo
  return base.slice(0, 140)
}

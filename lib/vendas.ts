// PDV do varejo (perfil telefonia) — regras PURAS da venda. A baixa de estoque
// (DECRBY atômico) e a persistência ficam na rota /api/vendas; aqui só validação,
// soma por produto e a tradução da venda em lançamento do Financeiro. Sem Redis,
// sem Date — testável. O total usa totalVenda (lib/estoque), casa única do cálculo.
import type { ItemVenda, Venda, LancamentoFuturo } from './redis'

export type ItemVendaEntrada = { produtoId?: string; nome?: string; quantidade?: any; precoUnit?: any }

// Normaliza/valida o carrinho. Erro (string) ou a lista limpa. Preço por item é
// SNAPSHOT (o operador pode ajustar no PDV — preço da rede é só o padrão).
export function limparItensVenda(itens: ItemVendaEntrada[]): { erro: string } | { ok: true; itens: ItemVenda[] } {
  if (!Array.isArray(itens) || itens.length === 0) return { erro: 'Adicione ao menos um item à venda.' }
  const limpos: ItemVenda[] = []
  for (const it of itens) {
    const produtoId = String(it?.produtoId || '').trim()
    const nome = String(it?.nome || '').trim()
    const quantidade = Math.floor(Number(it?.quantidade) || 0)
    const precoUnit = Math.round((Number(it?.precoUnit) || 0) * 100) / 100
    if (!produtoId) return { erro: 'Item sem produto.' }
    if (quantidade <= 0) return { erro: `Quantidade inválida para "${nome || produtoId}".` }
    if (precoUnit < 0) return { erro: `Preço inválido para "${nome || produtoId}".` }
    limpos.push({ produtoId, nome, quantidade, precoUnit })
  }
  return { ok: true, itens: limpos }
}

// Soma por produto: o mesmo item repetido no carrinho conta junto. É o que a
// baixa atômica de estoque consome (um DECRBY por produto, não por linha).
export function quantidadePorProduto(itens: ItemVenda[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const it of itens) m[it.produtoId] = (m[it.produtoId] || 0) + it.quantidade
  return m
}

// Venda à vista vira UMA entrada RECEBIDA no Financeiro da loja. Id determinístico
// (venda-{id}) — a rota pode re-sincronizar/remover sem duplicar.
export function lancamentoDaVenda(
  venda: Pick<Venda, 'id' | 'lojaId' | 'total' | 'data' | 'contatoId'>,
  descricao: string,
): LancamentoFuturo {
  return {
    id: `venda-${venda.id}`,
    tipo: 'entrada',
    descricao,
    valor: Math.round((Number(venda.total) || 0) * 100) / 100,
    data: (venda.data || '').slice(0, 10),
    recebido: true,
    ...(venda.contatoId ? { clienteId: venda.contatoId } : {}),
    vendaId: venda.id,
    lojaId: venda.lojaId,
    criadoEm: venda.data,
  }
}

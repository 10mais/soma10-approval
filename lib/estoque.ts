// Regras de estoque do varejo — PURAS (sem Redis). A parte com risco de corrida
// (baixar o saldo de vários itens de uma venda) vive na rota /api/vendas, que usa
// DECRBY atômico do Upstash sobre a chave `estoque:{lojaId}:{produtoId}`. Aqui
// ficam só as decisões que dá para testar sem banco.
//
// O saldo VIVO é a chave numérica (rápido, atômico). As MovimentacaoEstoque são
// o log de auditoria + a base das transferências. Estas funções validam entradas
// e calculam o que cada movimento faz — nunca leem/escrevem.

export type ItemBaixa = { produtoId: string; quantidade: number }
export type SaldoPorProduto = Record<string, number> // produtoId -> saldo na loja

// Chave do saldo de um produto numa loja. Única fonte da verdade do saldo vivo.
export function chaveEstoque(lojaId: string, produtoId: string): string {
  return `estoque:${lojaId}:${produtoId}`
}

// A venda pode sair? Confere cada item contra o saldo da loja. Devolve a lista
// de faltas (vazia = pode). É uma checagem OTIMISTA (a garantia real é o DECRBY
// atômico na rota) — serve para recusar cedo e dar mensagem boa.
export function faltasParaBaixa(itens: ItemBaixa[], saldo: SaldoPorProduto): { produtoId: string; pedido: number; disponivel: number }[] {
  const faltas: { produtoId: string; pedido: number; disponivel: number }[] = []
  // Soma por produto: o mesmo item repetido no carrinho conta junto.
  const pedidoPorProduto = new Map<string, number>()
  for (const it of itens) {
    const q = Math.max(0, Math.floor(Number(it.quantidade) || 0))
    if (q <= 0) continue
    pedidoPorProduto.set(it.produtoId, (pedidoPorProduto.get(it.produtoId) || 0) + q)
  }
  for (const [produtoId, pedido] of Array.from(pedidoPorProduto)) {
    const disponivel = Math.max(0, Math.floor(Number(saldo[produtoId]) || 0))
    if (pedido > disponivel) faltas.push({ produtoId, pedido, disponivel })
  }
  return faltas
}

export function podeBaixar(itens: ItemBaixa[], saldo: SaldoPorProduto): boolean {
  return faltasParaBaixa(itens, saldo).length === 0
}

// Produto abaixo do mínimo? Mínimo ausente/0 = sem alerta.
export function abaixoDoMinimo(saldo: number, minimo?: number): boolean {
  if (!minimo || minimo <= 0) return false
  return (Number(saldo) || 0) < minimo
}

// Valida uma transferência entre lojas ANTES de aplicar. Erro (string) ou null.
export function validarTransferencia(params: {
  lojaOrigem: string; lojaDestino: string; quantidade: number; saldoOrigem: number
}): string | null {
  const { lojaOrigem, lojaDestino, quantidade, saldoOrigem } = params
  if (!lojaOrigem || !lojaDestino) return 'Informe a loja de origem e a de destino.'
  if (lojaOrigem === lojaDestino) return 'A loja de origem e a de destino não podem ser a mesma.'
  const q = Math.floor(Number(quantidade) || 0)
  if (q <= 0) return 'A quantidade transferida deve ser maior que zero.'
  if (q > (Number(saldoOrigem) || 0)) return `Estoque insuficiente na origem: há ${saldoOrigem}, tentando transferir ${q}.`
  return null
}

// Sanitiza/valida um produto recebido do cliente HTTP. Erro (string) ou o objeto limpo.
export type ProdutoEntrada = {
  nome?: string; sku?: string; categoria?: string; precoVenda?: any; precoCusto?: any; estoqueMinimo?: any; ativo?: boolean; descricao?: string
}
const CATEGORIAS = ['smartphone', 'eletronico', 'acessorio', 'outro']
export function limparProduto(bruto: ProdutoEntrada): { erro: string } | { ok: true; campos: any } {
  const nome = (bruto?.nome || '').trim()
  if (!nome) return { erro: 'Informe o nome do produto.' }
  const preco = Number(bruto?.precoVenda)
  if (!isFinite(preco) || preco < 0) return { erro: 'Preço de venda inválido.' }
  const categoria = CATEGORIAS.includes(bruto?.categoria as any) ? bruto!.categoria : 'outro'
  const num = (v: any) => { const n = Number(v); return isFinite(n) && n >= 0 ? n : undefined }
  return {
    ok: true,
    campos: {
      nome,
      sku: (bruto?.sku || '').trim() || undefined,
      categoria,
      precoVenda: preco,
      precoCusto: num(bruto?.precoCusto),
      estoqueMinimo: num(bruto?.estoqueMinimo),
      ativo: bruto?.ativo !== false,
      descricao: (bruto?.descricao || '').trim() || undefined,
    },
  }
}

// Total de uma venda: soma(qtd × preço) - desconto, nunca negativo.
export function totalVenda(itens: { quantidade: number; precoUnit: number }[], desconto = 0): number {
  const bruto = (itens || []).reduce((s, it) => s + Math.max(0, Number(it.quantidade) || 0) * Math.max(0, Number(it.precoUnit) || 0), 0)
  const d = Math.max(0, Number(desconto) || 0)
  return Math.max(0, Math.round((bruto - d) * 100) / 100)
}

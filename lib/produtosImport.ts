// Importação de produtos em massa (varejo telefonia). PURO e testável: parseia o
// texto colado (CSV/TSV, com ou sem cabeçalho) em linhas de produto + quantidade
// inicial. A rota /api/produtos/importar faz o upsert no catálogo (compartilhado)
// e a ENTRADA de estoque na LOJA escolhida.

export type LinhaImportProduto = {
  nome: string
  sku?: string
  categoria: string
  precoVenda: number
  precoCusto?: number
  estoqueMinimo?: number
  quantidade: number
}

export const CATEGORIAS_IMPORT = ['smartphone', 'eletronico', 'acessorio', 'outro']

// Número tolerante a formato BR (1.234,56) e US (1234.56) + "R$"/espaços.
export function numBR(s: any): number {
  const t = String(s ?? '').trim().replace(/[R$\s]/gi, '')
  if (!t) return NaN
  const br = /,\d{1,2}$/.test(t) // vírgula decimal no fim
  const norm = br ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  const n = Number(norm)
  return isFinite(n) ? n : NaN
}

// Colunas (por posição): nome ; sku ; categoria ; preço venda ; custo ; estoque mín ; quantidade
// Aceita separador ; , ou TAB. Linha de cabeçalho é detectada e pulada.
export function parseProdutosColados(texto: string): { linhas: LinhaImportProduto[]; ignoradas: number } {
  const linhas: LinhaImportProduto[] = []
  let ignoradas = 0
  const rows = String(texto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  for (const row of rows) {
    const sep = row.includes('\t') ? '\t' : (row.match(/;/g) || []).length >= (row.match(/,/g) || []).length ? ';' : ','
    const c = row.split(sep).map(s => s.trim())
    const nome = c[0] || ''
    // Cabeçalho: primeira coluna "nome/produto/descrição" e a linha fala de preço/qtd.
    if (/^(nome|produto|descri)/i.test(nome) && /pre|valor|qtd|quant|estoque|custo/i.test(row)) continue
    const preco = numBR(c[3])
    if (!nome || !isFinite(preco)) { ignoradas++; continue }
    const cat = CATEGORIAS_IMPORT.includes((c[2] || '').toLowerCase()) ? (c[2] as string).toLowerCase() : 'outro'
    const custo = numBR(c[4])
    const min = numBR(c[5])
    linhas.push({
      nome: nome.slice(0, 120),
      sku: (c[1] || '').trim() || undefined,
      categoria: cat,
      precoVenda: Math.max(0, Math.round(preco * 100) / 100),
      ...(isFinite(custo) ? { precoCusto: Math.max(0, Math.round(custo * 100) / 100) } : {}),
      ...(isFinite(min) ? { estoqueMinimo: Math.max(0, Math.floor(min)) } : {}),
      quantidade: Math.max(0, Math.floor(numBR(c[6]) || 0)),
    })
  }
  return { linhas, ignoradas }
}

// Chave de casamento com o catálogo existente: SKU (quando houver) senão o nome
// normalizado. É o que decide criar × atualizar no upsert.
export function chaveMatchProduto(p: { sku?: string; nome?: string }): string {
  const sku = (p.sku || '').trim().toLowerCase()
  if (sku) return `sku:${sku}`
  return `nome:${(p.nome || '').trim().toLowerCase()}`
}

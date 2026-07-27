// Importação de produtos em massa (varejo telefonia). PURO e testável. Aceita:
//  - o EXPORT do ERP do cliente (cabeçalho com "Descrição do Produto", "Preço
//    Venda", "Estoque", "Meu Custo Compra", "Est. Mínimo", "Código Barras"…) —
//    mapeia por NOME de coluna, na ordem que vier;
//  - o formato simples posicional (nome;sku;categoria;preço;custo;mín;qtd).
// A rota /api/produtos/importar faz o upsert no catálogo + a ENTRADA de estoque na loja.

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

// Divide o texto em células por linha (separador ; , ou TAB, decidido pela 1ª linha).
export function celulas(texto: string): string[][] {
  const rows = String(texto || '').split(/\r?\n/).map(l => l.replace(/\r$/, '')).filter(l => l.trim())
  if (!rows.length) return []
  const h = rows[0]
  const sep = h.includes('\t') ? '\t' : (h.match(/;/g) || []).length >= (h.match(/,/g) || []).length ? ';' : ','
  return rows.map(r => r.split(sep).map(s => s.trim()))
}

// Índice da primeira coluna cujo cabeçalho casa com algum padrão (na ordem dada).
function achar(header: string[], ...pats: RegExp[]): number {
  for (const p of pats) { const i = header.findIndex(h => p.test(h)); if (i >= 0) return i }
  return -1
}

// A 1ª linha é um cabeçalho de planilha de produto?
function ehCabecalhoProduto(header: string[]): boolean {
  const j = header.join(' ')
  return /descri|produto|nome/i.test(j) && /(pre[çc]o|valor|estoque|custo|qtd|quant)/i.test(j)
}

export function parseProdutosColados(texto: string): { linhas: LinhaImportProduto[]; ignoradas: number } {
  const grade = celulas(texto)
  if (!grade.length) return { linhas: [], ignoradas: 0 }
  const header = grade[0]

  // Mapa de colunas: por NOME (ERP) se houver cabeçalho; senão posições fixas.
  const comCab = ehCabecalhoProduto(header)
  const col = comCab
    ? {
        nome: achar(header, /descri|^produto|^nome/i),
        sku: achar(header, /barras/i, /c[oó]digo pr[oó]prio/i, /^c[oó]digo$/i, /refer/i, /sku/i),
        categoria: achar(header, /grupo|categoria/i),
        preco: achar(header, /pre[çc]o.*venda/i, /^venda$/i, /^pre[çc]o$/i),
        custo: achar(header, /custo/i),
        min: achar(header, /m[ií]nimo/i),
        qtd: achar(header, /^estoque$/i, /quantidade/i, /^qtd/i, /saldo/i),
      }
    : { nome: 0, sku: 1, categoria: 2, preco: 3, custo: 4, min: 5, qtd: 6 }

  const linhas: LinhaImportProduto[] = []
  let ignoradas = 0
  const dados = comCab ? grade.slice(1) : grade
  const val = (c: string[], i: number) => (i >= 0 ? (c[i] || '') : '')
  for (const c of dados) {
    const nome = val(c, col.nome).trim()
    const preco = numBR(val(c, col.preco))
    if (!nome || !isFinite(preco)) { if (nome || c.some(x => x)) ignoradas++; continue }
    const catRaw = val(c, col.categoria).toLowerCase()
    const cat = CATEGORIAS_IMPORT.includes(catRaw) ? catRaw : 'outro'
    const custo = numBR(val(c, col.custo))
    const min = numBR(val(c, col.min))
    linhas.push({
      nome: nome.slice(0, 120),
      sku: val(c, col.sku).trim() || undefined,
      categoria: cat,
      precoVenda: Math.max(0, Math.round(preco * 100) / 100),
      ...(isFinite(custo) ? { precoCusto: Math.max(0, Math.round(custo * 100) / 100) } : {}),
      ...(isFinite(min) ? { estoqueMinimo: Math.max(0, Math.floor(min)) } : {}),
      quantidade: Math.max(0, Math.floor(numBR(val(c, col.qtd)) || 0)),
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

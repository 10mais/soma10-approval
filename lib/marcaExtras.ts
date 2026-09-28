// MARCA — produtos/serviços e benchmarks do cliente.
//
// Dono, 28/09/2026: "Em MARCA (dentro de cada cliente) precisamos de um local para adicionar
// links de benchmark (links instagrans, site, etc)" e "Quais produtos/serviços" — "Os
// serviços/produtos precisam de um NOME + DESCRIÇÃO".
//
// Aqui mora a regra (limpeza do que chega da tela) e o TEXTO que vai para a IA. Os geradores
// (documento de marca, playbook, briefing, plano, copy, legenda, criativo do Studio) e o
// assistente leem o mesmo bloco — um lugar só, para não divergirem entre si.
//
// Benchmark é da EQUIPE (costuma ter concorrente); o cliente não vê no portal. Produtos e
// serviços são do negócio dele: o cliente vê, só a equipe edita.

export type ProdutoServico = { id: string; nome: string; descricao?: string }

export type TipoBenchmark = 'instagram' | 'site' | 'youtube' | 'tiktok' | 'facebook' | 'linkedin' | 'outro'
export type Benchmark = { id: string; url: string; tipo: TipoBenchmark; nome?: string; observar?: string }

export const LIMITE_PRODUTOS = 50
export const LIMITE_BENCHMARKS = 30
export const LIMITE_NOME = 80
export const LIMITE_DESCRICAO_PRODUTO = 1000
export const LIMITE_OBSERVAR = 300

const txt = (v: any, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
// Descrição aceita quebra de linha (lista de itens do serviço), só apara as pontas.
const bloco = (v: any, max: number) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max)
const idValido = (v: any) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v)

/** Produtos/serviços: nome obrigatório, sem repetir nome, no máximo 50. */
export function limparProdutos(bruto: any, novoId: () => string): ProdutoServico[] {
  if (!Array.isArray(bruto)) return []
  const out: ProdutoServico[] = []
  for (const p of bruto) {
    const nome = txt(p?.nome, LIMITE_NOME)
    if (!nome) continue
    if (out.some(x => x.nome.toLowerCase() === nome.toLowerCase())) continue
    const descricao = bloco(p?.descricao, LIMITE_DESCRICAO_PRODUTO)
    out.push({ id: idValido(p?.id) ? p.id : novoId(), nome, ...(descricao ? { descricao } : {}) })
    if (out.length >= LIMITE_PRODUTOS) break
  }
  return out
}

/**
 * Link de benchmark como a equipe digita → URL de verdade.
 *   "@perfil"            → https://www.instagram.com/perfil/
 *   "site.com.br/x"      → https://site.com.br/x
 *   "https://..."        → como veio
 * Devolve null quando não dá para virar um link (texto solto, javascript:, etc).
 */
export function normalizarLink(bruto: string): string | null {
  let s = String(bruto || '').trim()
  if (!s) return null
  const arroba = s.match(/^@([A-Za-z0-9._]{1,30})$/)
  if (arroba) return `https://www.instagram.com/${arroba[1]}/`
  if (!/^https?:\/\//i.test(s)) {
    if (/\s/.test(s) || !/^[^/]+\.[a-z]{2,}/i.test(s)) return null
    s = `https://${s}`
  }
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

/** A rede do link, pelo endereço — é o que dá o ícone e o rótulo na tela. */
export function tipoDoLink(url: string): TipoBenchmark {
  let host = ''
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return 'outro' }
  if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am') return 'instagram'
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'youtube'
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok'
  if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.com') return 'facebook'
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin'
  return 'site'
}

/** Nome curto para mostrar quando a equipe não deu nome: "@perfil" no Instagram, o domínio no site. */
export function rotuloDoLink(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    const caminho = u.pathname.split('/').filter(Boolean)
    if (tipoDoLink(url) === 'instagram' || tipoDoLink(url) === 'tiktok') {
      const h = (caminho[0] || '').replace(/^@/, '')
      if (h) return `@${h}`
    }
    return host
  } catch {
    return url
  }
}

/** Benchmarks: só link válido, sem repetir o mesmo endereço, no máximo 30. */
export function limparBenchmarks(bruto: any, novoId: () => string): Benchmark[] {
  if (!Array.isArray(bruto)) return []
  const out: Benchmark[] = []
  const chave = (u: string) => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')
  for (const b of bruto) {
    const url = normalizarLink(b?.url)
    if (!url) continue
    if (out.some(x => chave(x.url) === chave(url))) continue
    const nome = txt(b?.nome, LIMITE_NOME)
    const observar = txt(b?.observar, LIMITE_OBSERVAR)
    out.push({ id: idValido(b?.id) ? b.id : novoId(), url, tipo: tipoDoLink(url), ...(nome ? { nome } : {}), ...(observar ? { observar } : {}) })
    if (out.length >= LIMITE_BENCHMARKS) break
  }
  return out
}

export const NOME_TIPO_BENCHMARK: Record<TipoBenchmark, string> = {
  instagram: 'Instagram', site: 'Site', youtube: 'YouTube', tiktok: 'TikTok', facebook: 'Facebook', linkedin: 'LinkedIn', outro: 'Link',
}

/**
 * Bloco de texto para os prompts. Vazio quando o cliente não tem nada cadastrado (o prompt
 * fica igual ao de antes). `limite` corta o total para não estourar prompts curtos.
 */
export function textoMarcaExtras(c: { produtosServicos?: ProdutoServico[]; benchmarks?: Benchmark[] } | null | undefined, limite = 3000): string {
  if (!c) return ''
  const partes: string[] = []
  const produtos = Array.isArray(c.produtosServicos) ? c.produtosServicos.filter(p => p?.nome) : []
  if (produtos.length) {
    partes.push(`Produtos e serviços (use os NOMES exatos ao citar uma oferta):\n${produtos.map(p => `- ${p.nome}${p.descricao ? `: ${p.descricao.replace(/\s+/g, ' ')}` : ''}`).join('\n')}`)
  }
  const bench = Array.isArray(c.benchmarks) ? c.benchmarks.filter(b => b?.url) : []
  if (bench.length) {
    partes.push(`Benchmarks de referência (inspirar-se no que funciona; NUNCA copiar texto, marca ou identidade):\n${bench.map(b => `- ${b.nome || rotuloDoLink(b.url)} (${NOME_TIPO_BENCHMARK[b.tipo] || 'Link'}): ${b.url}${b.observar ? ` — observar: ${b.observar}` : ''}`).join('\n')}`)
  }
  const t = partes.join('\n\n')
  return t.length <= limite ? t : `${t.slice(0, limite - 1).trimEnd()}…`
}

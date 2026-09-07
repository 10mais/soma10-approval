// Texto BRUTO -> blocos legíveis (títulos, parágrafos, itens numerados).
//
// A "descrição do negócio" do cliente costuma ser um documento inteiro colado
// num campo só, sem quebra de linha: "…do negócio. Posicionamento A Universal
// ocupa… Tom de Voz Provocador… Narrativas Centrais 1. O problema… 2. …".
// Print do dono (07/09): "o texto aparece bruto, sem configuração. Organize
// com parágrafos". Aqui não se reescreve nada: só se descobre a estrutura que
// já está no texto (cabeçalhos conhecidos, numeração, fim de frase) e se
// devolve em blocos. Quem renderiza decide a tipografia.

export type Bloco = { tipo: 'titulo' | 'paragrafo' | 'item'; texto: string }

// Cabeçalhos que aparecem em documentos de marca/briefing. Casados no início
// de frase, seguidos de letra maiúscula ou aspas (o corpo colado logo depois).
export const CABECALHOS = [
  'Posicionamento', 'Tom de Voz', 'Tom de voz', 'Narrativas Centrais', 'Narrativas centrais', 'Narrativa Central', 'Narrativa central',
  'Público-alvo', 'Público alvo', 'Público', 'Persona', 'Missão', 'Visão', 'Valores', 'Pilares', 'Pilares de Conteúdo', 'Pilares de conteúdo',
  'Diferenciais', 'Proposta de Valor', 'Proposta de valor', 'Personalidade', 'Manifesto', 'Promessa', 'Propósito', 'Essência', 'Arquétipo',
  'Identidade', 'Objetivos', 'Objetivo', 'Palavras-chave', 'Sobre', 'Contexto', 'Desafio', 'Solução', 'Serviços', 'Produtos', 'Concorrentes',
  'Referências', 'O que não fazemos', 'O que fazemos', 'Linguagem', 'Estilo', 'Territórios', 'Território',
]

const MAX_PARAGRAFO = 380 // acima disso, quebra em grupos de frases

function limpar(s: string): string { return s.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim() }

// Quebra um texto sem quebras de linha em frases (fim de frase + espaço + maiúscula/aspas/número).
function frases(s: string): string[] {
  return s.split(/(?<=[.!?…])\s+(?=["“(]?[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9])/).map(f => f.trim()).filter(Boolean)
}

function agrupar(fs: string[], max: number): string[] {
  const saida: string[] = []
  let atual = ''
  for (const f of fs) {
    if (atual && (atual.length + 1 + f.length) > max) { saida.push(atual); atual = f }
    else atual = atual ? `${atual} ${f}` : f
  }
  if (atual) saida.push(atual)
  return saida
}

export function paragrafar(bruto: string | null | undefined): Bloco[] {
  let s = limpar(bruto || '')
  if (!s) return []

  // 1) Cabeçalho colado ao corpo: "…negócio. Posicionamento A Universal…" -> quebra antes E depois.
  const cabs = [...CABECALHOS].sort((a, b) => b.length - a.length).map(c => c.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'))
  const reCab = new RegExp(`(^|[.!?…:]\\s+|\\n\\s*)(${cabs.join('|')})(?=\\s+(?:\\d{1,2}\\.\\s|["“(]?[A-ZÁÉÍÓÚÂÊÔÃÕÇ]))`, 'g')
  s = s.replace(reCab, (_m, antes: string, cab: string) => `${antes.trim() ? antes.trimEnd() : ''}\n${cab}\n`)
  // Cabeçalho que já está sozinho numa linha (com ou sem dois-pontos) também vale.
  // 2) Itens numerados: " 1. O problema…" -> linha própria.
  s = s.replace(/(^|\s)(\d{1,2})\.\s+(?=["“(]?[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g, (_m, antes: string, n: string) => `${antes.trim() ? antes.trimEnd() : ''}\n${n}. `)

  const linhas = s.split(/\n+/).map(l => l.trim()).filter(Boolean)
  const blocos: Bloco[] = []
  const setCab = new Set(CABECALHOS.map(c => c.toLowerCase()))
  for (const l of linhas) {
    const semDoisPontos = l.replace(/:$/, '')
    if (setCab.has(semDoisPontos.toLowerCase()) || (semDoisPontos.length <= 40 && !/[.!?…]$/.test(semDoisPontos) && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(semDoisPontos) && semDoisPontos.split(' ').length <= 4 && setCab.has(semDoisPontos.toLowerCase()))) {
      blocos.push({ tipo: 'titulo', texto: semDoisPontos })
      continue
    }
    if (/^\d{1,2}\.\s/.test(l)) { blocos.push({ tipo: 'item', texto: l }); continue }
    if (l.length <= MAX_PARAGRAFO) { blocos.push({ tipo: 'paragrafo', texto: l }); continue }
    for (const g of agrupar(frases(l), MAX_PARAGRAFO)) blocos.push({ tipo: 'paragrafo', texto: g })
  }
  return blocos
}

// Resumo para o cartão fechado: as primeiras frases até `max` caracteres, cortando em fim de frase.
export function resumir(bruto: string | null | undefined, max = 240): { texto: string; cortado: boolean } {
  const blocos = paragrafar(bruto).filter(b => b.tipo !== 'titulo')
  const inteiro = blocos.map(b => b.texto).join(' ')
  if (inteiro.length <= max) return { texto: inteiro, cortado: paragrafar(bruto).length > blocos.length ? false : false }
  const fs = frases(inteiro)
  let out = ''
  for (const f of fs) {
    if (!out) { out = f.length > max ? `${f.slice(0, max - 1).trimEnd()}…` : f; if (f.length > max) break; continue }
    if ((out.length + 1 + f.length) > max) break
    out = `${out} ${f}`
  }
  return { texto: out, cortado: out.length < inteiro.length }
}

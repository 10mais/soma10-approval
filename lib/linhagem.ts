// Linhagem (árvore genealógica) de um processo de cidadania — a PROVA de
// descendência: a cadeia do requerente até o ascendente estrangeiro que carrega
// a nacionalidade. Puro, client-safe, testável: NÃO importa lib/redis.
//
// Modelo LINEAR de propósito: para cidadania por descendência prova-se UMA linha
// (a que leva ao ascendente qualificador), não a árvore inteira de 2^n antepassados.
// `geracao` posiciona na cadeia: 0 = a base da família (o requerente principal /
// ponto de partida), subindo até o ascendente. Datas são TEXTO livre — certidão
// antiga tem data parcial ("1878", "c. 1850") e um <input date> brigaria com isso.

export type PessoaLinhagem = {
  id: string
  nome: string
  papel?: string        // livre: "Requerente", "Pai", "Avô", "Bisavô", "Ascendente"…
  geracao: number       // 0 = base (requerente); sobe a cada geração até o ascendente
  sexo?: 'M' | 'F'
  nascimento?: string       // texto livre (pode ser parcial)
  nascimentoLocal?: string
  casamento?: string
  casamentoLocal?: string
  obito?: string
  obitoLocal?: string
  ascendente?: boolean  // marca o ascendente estrangeiro (raiz da prova)
  observacoes?: string
}

// Ordena da base (geração 0) ao topo. Empate de geração preserva a ordem de
// entrada (estável) — não reordena irmãos digitados na mesma geração.
export function ordenarLinhagem(pessoas: PessoaLinhagem[]): PessoaLinhagem[] {
  return pessoas
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.geracao - b.p.geracao) || (a.i - b.i))
    .map(x => x.p)
}

// O ascendente estrangeiro: o nó marcado; se nenhum, o de maior geração (o topo
// da cadeia). null se a linhagem está vazia.
export function ascendenteLinhagem(pessoas: PessoaLinhagem[]): PessoaLinhagem | null {
  if (!pessoas.length) return null
  const marcado = pessoas.find(p => p.ascendente)
  if (marcado) return marcado
  return ordenarLinhagem(pessoas)[pessoas.length - 1]
}

export type ResumoLinhagem = {
  total: number
  geracoes: number       // quantas gerações a cadeia cobre (maior geracao + 1)
  temAscendente: boolean  // há um nó marcado como ascendente estrangeiro
  ascendenteNome: string
}

export function resumoLinhagem(pessoas: PessoaLinhagem[]): ResumoLinhagem {
  const asc = ascendenteLinhagem(pessoas)
  const maxGer = pessoas.reduce((m, p) => Math.max(m, p.geracao), -1)
  return {
    total: pessoas.length,
    geracoes: maxGer + 1,
    temAscendente: pessoas.some(p => p.ascendente),
    ascendenteNome: asc?.nome || '',
  }
}

// Sanitiza a linhagem vinda do corpo de uma requisição. Vive AQUI, e não em cada
// rota, porque a árvore é gravada em DOIS lugares — no negócio do CRM (a análise
// de viabilidade, pré-venda) e no processo (a prova, pós-venda). Duas cópias da
// mesma regra divergiriam, e campo que existe num lado e não no outro já foi bug
// nesta base. Nó sem nome é lixo de formulário; só um ascendente marcado.
export function sanitizarLinhagem(arr: any, novoId: () => string): PessoaLinhagem[] {
  if (!Array.isArray(arr)) return []
  const txt = (v: any, max = 120) => (String(v ?? '').trim().slice(0, max) || undefined)
  let jaTemAsc = false
  return arr.map((p: any): PessoaLinhagem => {
    const asc = !!p?.ascendente && !jaTemAsc
    if (asc) jaTemAsc = true
    return {
      id: String(p?.id || novoId()),
      nome: String(p?.nome ?? '').trim().slice(0, 120),
      papel: txt(p?.papel, 40),
      geracao: Number.isFinite(Number(p?.geracao)) ? Math.max(0, Math.floor(Number(p.geracao))) : 0,
      sexo: p?.sexo === 'M' || p?.sexo === 'F' ? p.sexo : undefined,
      nascimento: txt(p?.nascimento, 40),
      nascimentoLocal: txt(p?.nascimentoLocal),
      casamento: txt(p?.casamento, 40),
      casamentoLocal: txt(p?.casamentoLocal),
      obito: txt(p?.obito, 40),
      obitoLocal: txt(p?.obitoLocal),
      ascendente: asc || undefined,
      observacoes: txt(p?.observacoes, 500),
    }
  }).filter((p: PessoaLinhagem) => p.nome).slice(0, 40)
}

// Gerações AUSENTES entre a base (0) e o topo — cada lacuna é um elo da prova
// que falta (ex.: tem requerente e bisavô, falta o avô). A UI avisa: buraco na
// linhagem derruba o reconhecimento. Vazio = cadeia contígua (ou linhagem vazia).
export function geracoesFaltando(pessoas: PessoaLinhagem[]): number[] {
  if (!pessoas.length) return []
  const presentes = new Set(pessoas.map(p => p.geracao))
  const maxGer = pessoas.reduce((m, p) => Math.max(m, p.geracao), 0)
  const faltando: number[] = []
  for (let g = 0; g <= maxGer; g++) if (!presentes.has(g)) faltando.push(g)
  return faltando
}

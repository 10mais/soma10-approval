// Layouts de poltrona de ônibus (predefinidos). Um Ônibus referencia um `layoutId`;
// a Excursão herda o mapa do ônibus e a Reserva ocupa poltronas por NÚMERO.
// DD = Duplo Deck (2 andares). Client-safe, puro, testável.
//
// ⚠️ Os presets abaixo são PONTOS DE PARTIDA — o dono confirma os layouts reais
// dos ônibus da Deny (nº de poltronas por andar, tipos, corredor). A ESTRUTURA e
// os helpers são estáveis; só os dados dos presets mudam.

export type TipoPoltrona = 'leito' | 'leito-cama' | 'semi-leito' | 'executivo' | 'convencional'

// `coluna` é a posição VISUAL da poltrona na fileira (1..N). A coluna do corredor
// fica vazia (sem poltrona), então o mapa é renderizado como grade fileira × coluna.
export type Poltrona = { numero: string; tipo: TipoPoltrona; andar: number; fileira: number; coluna: number }

export type LayoutOnibus = { id: string; nome: string; andares: number; poltronas: Poltrona[] }

// Config de um andar: fileiras × colunas-com-poltrona (as demais colunas = corredor).
type AndarConfig = { andar: number; nome?: string; fileiras: number; colunas: number[]; tipo: TipoPoltrona }

// Gera as poltronas de um andar numerando sequencialmente a partir de `inicio`
// (fileira a fileira, esquerda→direita). Retorna também o próximo número livre.
function gerarAndar(cfg: AndarConfig, inicio: number): { poltronas: Poltrona[]; proximo: number } {
  const poltronas: Poltrona[] = []
  let n = inicio
  for (let f = 1; f <= cfg.fileiras; f++) {
    for (const coluna of cfg.colunas) {
      poltronas.push({ numero: String(n), tipo: cfg.tipo, andar: cfg.andar, fileira: f, coluna })
      n++
    }
  }
  return { poltronas, proximo: n }
}

// Monta um layout a partir da config de cada andar (numeração contínua entre andares).
function montarLayout(id: string, nome: string, andares: AndarConfig[]): LayoutOnibus {
  let prox = 1
  const poltronas: Poltrona[] = []
  for (const a of andares) {
    const r = gerarAndar(a, prox)
    poltronas.push(...r.poltronas)
    prox = r.proximo
  }
  return { id, nome, andares: andares.length, poltronas }
}

// Presets (placeholders realistas de DD 2+1/2+2 — dono ajusta):
// - Inferior: leito 2+1 (colunas 1,2 [corredor=3] 4)
// - Superior: leito-cama/semi-leito 2+1
export const LAYOUTS: LayoutOnibus[] = [
  montarLayout('dd-leito-2x1', 'DD Leito 2+1 (44 lugares)', [
    { andar: 1, nome: 'Inferior', fileiras: 7, colunas: [1, 2, 4], tipo: 'leito' },       // 21
    { andar: 2, nome: 'Superior', fileiras: 8, colunas: [1, 2, 4], tipo: 'leito-cama' },   // 24 -> total 45
  ]),
  montarLayout('dd-leito-cama-2x1', 'DD Leito-Cama 2+1 (36 lugares)', [
    { andar: 1, nome: 'Inferior', fileiras: 6, colunas: [1, 2, 4], tipo: 'leito-cama' },   // 18
    { andar: 2, nome: 'Superior', fileiras: 6, colunas: [1, 2, 4], tipo: 'leito-cama' },   // 18 -> total 36
  ]),
  montarLayout('conv-2x2', 'Convencional 2+2 (46 lugares)', [
    { andar: 1, fileiras: 12, colunas: [1, 2, 4, 5], tipo: 'convencional' },               // 48
  ]),
]

export function layoutPorId(id?: string | null): LayoutOnibus | null {
  if (!id) return null
  return LAYOUTS.find(l => l.id === id) || null
}

export function totalPoltronas(layout: Pick<LayoutOnibus, 'poltronas'>): number {
  return layout.poltronas.length
}

// Números de poltrona válidos do layout — base para validar reserva (assento existe).
export function numerosPoltronas(layout: Pick<LayoutOnibus, 'poltronas'>): string[] {
  return layout.poltronas.map(p => p.numero)
}

export function poltronaExiste(layout: Pick<LayoutOnibus, 'poltronas'>, numero: string): boolean {
  return layout.poltronas.some(p => p.numero === numero)
}

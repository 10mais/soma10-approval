// Layouts de poltrona dos ônibus da Deny (DD = Duplo Deck). Reproduzem os croquis
// reais (Carro 2021 e Carro 2023): disposição 2+1 (par à esquerda + individual à
// direita, corredor no meio), 2 andares, com amenidades (chopeira/cafeteira/
// frigobar/geladeira/banheiro). Client-safe, puro, testável.
//
// Coordenadas: `coluna` é a posição visual na fileira — 1,2 = par esquerdo;
// 3 = corredor; 4 = individual direito; 5 = faixa de amenidades à direita.

export type TipoPoltrona = 'leito' | 'leito-cama' | 'semi-leito' | 'executivo' | 'convencional'

export type Poltrona = { numero: string; tipo: TipoPoltrona; andar: number; fileira: number; coluna: number }
// Elemento fixo (não-poltrona): amenidade/estrutura, para render fiel do croqui.
export type ElementoLayout = { label: string; andar: number; fileira: number; coluna: number }

export type LayoutOnibus = { id: string; nome: string; andares: number; poltronas: Poltrona[]; elementos?: ElementoLayout[] }

// atalho: poltrona
const P = (numero: number, andar: number, fileira: number, coluna: number, tipo: TipoPoltrona = 'leito'): Poltrona => ({ numero: String(numero), tipo, andar, fileira, coluna })

// ── Carro 2023 — 40 lugares (superior 1–31, inferior 32–40) ───────────────────
const CARRO_2023: LayoutOnibus = {
  id: 'carro-2023', nome: 'Carro 2023 (40 lugares)', andares: 2,
  poltronas: [
    // Piso superior (andar 2)
    P(1, 2, 1, 1), P(2, 2, 1, 2), P(3, 2, 1, 4),
    P(6, 2, 2, 4),
    P(4, 2, 3, 1), P(5, 2, 3, 2),
    P(7, 2, 4, 1), P(8, 2, 4, 2),
    P(9, 2, 5, 1), P(10, 2, 5, 2),
    P(11, 2, 7, 1), P(12, 2, 7, 2),
    P(14, 2, 8, 1), P(15, 2, 8, 2), P(13, 2, 8, 4),
    P(17, 2, 9, 1), P(18, 2, 9, 2), P(16, 2, 9, 4),
    P(20, 2, 10, 1), P(21, 2, 10, 2), P(19, 2, 10, 4),
    P(22, 2, 11, 4),
    P(23, 2, 12, 1), P(24, 2, 12, 2), P(25, 2, 12, 4),
    P(26, 2, 13, 1), P(27, 2, 13, 2), P(28, 2, 13, 4),
    P(29, 2, 14, 1),
    P(30, 2, 16, 1), P(31, 2, 16, 4),
    // Piso inferior (andar 1)
    P(32, 1, 2, 1, 'leito-cama'), P(33, 1, 2, 2, 'leito-cama'), P(34, 1, 2, 4, 'leito-cama'),
    P(35, 1, 3, 1, 'leito-cama'), P(36, 1, 3, 2, 'leito-cama'), P(37, 1, 3, 4, 'leito-cama'),
    P(38, 1, 4, 1, 'leito-cama'), P(39, 1, 4, 2, 'leito-cama'), P(40, 1, 4, 4, 'leito-cama'),
  ],
  elementos: [
    { label: 'Chopeira', andar: 2, fileira: 5, coluna: 5 },
    { label: 'Cafeteira', andar: 2, fileira: 6, coluna: 5 },
    { label: 'Frigobar', andar: 2, fileira: 7, coluna: 5 },
    { label: 'Frigobar', andar: 2, fileira: 15, coluna: 2 },
    { label: 'Banheiro', andar: 1, fileira: 1, coluna: 1 },
    { label: 'Geladeira', andar: 1, fileira: 4, coluna: 3 },
  ],
}

// ── Carro 2021 — 43 lugares (superior 1–31, inferior 32–43) ───────────────────
const CARRO_2021: LayoutOnibus = {
  id: 'carro-2021', nome: 'Carro 2021 (43 lugares)', andares: 2,
  poltronas: [
    // Piso superior (andar 2)
    P(1, 2, 1, 1), P(2, 2, 1, 2), P(3, 2, 1, 4),
    P(6, 2, 2, 4),
    P(4, 2, 3, 1), P(5, 2, 3, 2),
    P(7, 2, 4, 1), P(8, 2, 4, 2),
    P(10, 2, 5, 1), P(11, 2, 5, 2),
    P(13, 2, 7, 1), P(14, 2, 7, 2),
    P(16, 2, 8, 1), P(17, 2, 8, 2), P(9, 2, 8, 4),
    P(19, 2, 9, 1), P(20, 2, 9, 2), P(12, 2, 9, 4),
    P(22, 2, 10, 1), P(23, 2, 10, 2), P(15, 2, 10, 4),
    P(18, 2, 11, 4),
    P(25, 2, 12, 1), P(26, 2, 12, 2), P(21, 2, 12, 4),
    P(28, 2, 13, 1), P(29, 2, 13, 2), P(24, 2, 13, 4),
    P(30, 2, 14, 1),
    P(31, 2, 16, 2), P(27, 2, 16, 4),
    // Piso inferior (andar 1)
    P(32, 1, 2, 1, 'leito-cama'), P(33, 1, 2, 2, 'leito-cama'), P(34, 1, 2, 4, 'leito-cama'),
    P(35, 1, 3, 1, 'leito-cama'), P(36, 1, 3, 2, 'leito-cama'), P(37, 1, 3, 4, 'leito-cama'),
    P(38, 1, 4, 1, 'leito-cama'), P(39, 1, 4, 2, 'leito-cama'), P(40, 1, 4, 4, 'leito-cama'),
    P(41, 1, 5, 1, 'leito-cama'), P(42, 1, 5, 2, 'leito-cama'), P(43, 1, 5, 4, 'leito-cama'),
  ],
  elementos: [
    { label: 'Chopeira', andar: 2, fileira: 5, coluna: 5 },
    { label: 'Cafeteira', andar: 2, fileira: 6, coluna: 5 },
    { label: 'Frigobar', andar: 2, fileira: 7, coluna: 5 },
    { label: 'Frigobar', andar: 2, fileira: 15, coluna: 2 },
    { label: 'Banheiro', andar: 1, fileira: 1, coluna: 1 },
    { label: 'Geladeira', andar: 1, fileira: 5, coluna: 3 },
  ],
}

export const LAYOUTS: LayoutOnibus[] = [CARRO_2023, CARRO_2021]

export function layoutPorId(id?: string | null): LayoutOnibus | null {
  if (!id) return null
  return LAYOUTS.find(l => l.id === id) || null
}

export function totalPoltronas(layout: Pick<LayoutOnibus, 'poltronas'>): number {
  return layout.poltronas.length
}

export function numerosPoltronas(layout: Pick<LayoutOnibus, 'poltronas'>): string[] {
  return layout.poltronas.map(p => p.numero)
}

export function poltronaExiste(layout: Pick<LayoutOnibus, 'poltronas'>, numero: string): boolean {
  return layout.poltronas.some(p => p.numero === numero)
}

// Croqui (layout de poltronas) de um VEÍCULO da frota. Client-safe, puro, testável.
//
// Antes os layouts eram presets fixos no código e o veículo só guardava o `layoutId`
// — cadastrar veículo novo exigia deploy. Agora o croqui é DADO: cada veículo tem o
// seu (`Veiculo.layout`), editável na tela, e a capacidade é CONTADA dele. Os croquis
// da Deny viraram MODELOS_LAYOUT: ponto de partida do editor (e o que a migração usa
// para expandir o `layoutId` antigo em croqui real).
//
// Coordenadas: `coluna` é a posição visual na fileira — 1,2 = par esquerdo;
// 3 = corredor; 4 = individual direito; 5 = faixa de amenidades à direita.
// A numeração das poltronas é a chave da reserva (assento nominal): número duplicado
// ou inexistente quebra a unicidade de poltrona (lib/reservas.ts).

export type TipoPoltrona = 'leito' | 'leito-cama' | 'semi-leito' | 'executivo' | 'convencional'

export type Poltrona = { numero: string; tipo: TipoPoltrona; andar: number; fileira: number; coluna: number }
// Elemento fixo (não-poltrona): amenidade/estrutura, para render fiel do croqui.
export type ElementoLayout = { label: string; andar: number; fileira: number; coluna: number }

// O croqui em si. Sem id/nome: quem tem identidade é o Veículo dono dele.
export type LayoutVeiculo = { andares: number; poltronas: Poltrona[]; elementos?: ElementoLayout[] }

export type ModeloLayout = { id: string; nome: string; layout: LayoutVeiculo }

export type Celula = { andar: number; fileira: number; coluna: number }

export const TIPOS_POLTRONA: { key: TipoPoltrona; label: string }[] = [
  { key: 'leito', label: 'Leito' },
  { key: 'leito-cama', label: 'Leito-cama' },
  { key: 'semi-leito', label: 'Semi-leito' },
  { key: 'executivo', label: 'Executivo' },
  { key: 'convencional', label: 'Convencional' },
]

// Rótulos comuns de croqui — atalhos do editor (o campo aceita texto livre).
export const ELEMENTOS_COMUNS = ['Chopeira', 'Cafeteira', 'Frigobar', 'Geladeira', 'Banheiro', 'Escada', 'Motorista', 'Porta']

// atalho: poltrona
const P = (numero: number, andar: number, fileira: number, coluna: number, tipo: TipoPoltrona = 'leito'): Poltrona => ({ numero: String(numero), tipo, andar, fileira, coluna })

// ── Carro 2023 — 40 lugares (superior 1–31, inferior 32–40) ───────────────────
const CARRO_2023: LayoutVeiculo = {
  andares: 2,
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
const CARRO_2021: LayoutVeiculo = {
  andares: 2,
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

export const MODELOS_LAYOUT: ModeloLayout[] = [
  { id: 'carro-2023', nome: 'Carro 2023 (40 lugares)', layout: CARRO_2023 },
  { id: 'carro-2021', nome: 'Carro 2021 (43 lugares)', layout: CARRO_2021 },
  { id: 'em-branco', nome: 'Em branco', layout: { andares: 1, poltronas: [], elementos: [] } },
]

export function layoutVazio(andares = 1): LayoutVeiculo {
  return { andares: Math.min(2, Math.max(1, andares)), poltronas: [], elementos: [] }
}

// Cópia PROFUNDA — sem isto, editar um veículo mutaria o modelo compartilhado no
// módulo (e, por tabela, todo veículo criado a partir dele na mesma sessão).
export function clonarLayout(layout: LayoutVeiculo): LayoutVeiculo {
  return JSON.parse(JSON.stringify(layout))
}

export function expandirModelo(id?: string | null): LayoutVeiculo | null {
  if (!id) return null
  const m = MODELOS_LAYOUT.find(x => x.id === id)
  return m ? clonarLayout(m.layout) : null
}

export function capacidadeLayout(layout: Pick<LayoutVeiculo, 'poltronas'>): number {
  return layout.poltronas.length
}

// Compatibilidade com o código que já existia (Reservas, DashboardHome, rotas).
export const totalPoltronas = capacidadeLayout

export function numerosPoltronas(layout: Pick<LayoutVeiculo, 'poltronas'>): string[] {
  return layout.poltronas.map(p => p.numero)
}

export function poltronaExiste(layout: Pick<LayoutVeiculo, 'poltronas'>, numero: string): boolean {
  return layout.poltronas.some(p => p.numero === numero)
}

const chaveCelula = (c: Celula) => `${c.andar}-${c.fileira}-${c.coluna}`

// O que está numa célula do croqui — o editor usa para não empilhar duas coisas.
export function celulaOcupada(layout: LayoutVeiculo, celula: Celula): 'poltrona' | 'elemento' | null {
  const k = chaveCelula(celula)
  if (layout.poltronas.some(p => chaveCelula(p) === k)) return 'poltrona'
  if ((layout.elementos || []).some(e => chaveCelula(e) === k)) return 'elemento'
  return null
}

// Menor inteiro >= 1 ainda não usado. Numeração do croqui é irregular (segue o
// desenho real), então "próximo" não é `total + 1`.
export function proximoNumeroLivre(layout: Pick<LayoutVeiculo, 'poltronas'>): string {
  const usados = new Set(layout.poltronas.map(p => p.numero))
  let n = 1
  while (usados.has(String(n))) n++
  return String(n)
}

// Extensão do croqui num andar — quantas fileiras/colunas desenhar.
export function dimensoesLayout(layout: LayoutVeiculo, andar: number): { maxFileira: number; maxColuna: number } {
  const itens: Celula[] = [
    ...layout.poltronas.filter(p => p.andar === andar),
    ...(layout.elementos || []).filter(e => e.andar === andar),
  ]
  return {
    maxFileira: itens.reduce((m, i) => Math.max(m, i.fileira), 0),
    maxColuna: itens.reduce((m, i) => Math.max(m, i.coluna), 0),
  }
}

// Erros que impedem salvar. Em pt-BR: vão direto para a tela.
export function validarLayout(layout: LayoutVeiculo): string[] {
  const erros: string[] = []
  if (!layout || !Array.isArray(layout.poltronas)) return ['Croqui inválido.']
  if (layout.andares < 1 || layout.andares > 2) erros.push('O croqui deve ter 1 ou 2 andares.')

  const vistos = new Set<string>()
  const duplicados = new Set<string>()
  for (const p of layout.poltronas) {
    if (!String(p.numero || '').trim()) { erros.push('Há poltrona sem número.'); continue }
    if (vistos.has(p.numero)) duplicados.add(p.numero)
    vistos.add(p.numero)
  }
  if (duplicados.size) erros.push(`Número de poltrona repetido: ${Array.from(duplicados).sort((a, b) => Number(a) - Number(b)).join(', ')}.`)

  const ocupadas = new Set<string>()
  const colididas = new Set<string>()
  for (const item of [...layout.poltronas, ...(layout.elementos || [])]) {
    const k = chaveCelula(item)
    if (ocupadas.has(k)) colididas.add(k)
    ocupadas.add(k)
    if (item.andar < 1 || item.andar > layout.andares) {
      erros.push(`Há item no andar ${item.andar}, fora dos ${layout.andares} andar(es) do croqui.`)
    }
    if (item.fileira < 1 || item.coluna < 1) erros.push('Há item em posição inválida (fileira/coluna precisam ser >= 1).')
  }
  if (colididas.size) erros.push(`Há ${colididas.size} posição(ões) com dois itens sobrepostos.`)

  return Array.from(new Set(erros))
}

// ── Operações do editor ──────────────────────────────────────────────────────
// Todas puras (devolvem croqui novo) e devolvem `null` quando a operação é
// inválida — a tela avisa em vez de gravar um croqui quebrado.

export function adicionarPoltrona(layout: LayoutVeiculo, celula: Celula, tipo: TipoPoltrona = 'leito', numero?: string): LayoutVeiculo | null {
  if (celulaOcupada(layout, celula)) return null
  if (celula.andar < 1 || celula.andar > layout.andares) return null
  const n = String(numero ?? proximoNumeroLivre(layout)).trim()
  if (!n || poltronaExiste(layout, n)) return null
  return { ...layout, poltronas: [...layout.poltronas, { numero: n, tipo, ...celula }] }
}

export function removerPoltrona(layout: LayoutVeiculo, numero: string): LayoutVeiculo {
  return { ...layout, poltronas: layout.poltronas.filter(p => p.numero !== numero) }
}

export function moverPoltrona(layout: LayoutVeiculo, numero: string, destino: Celula): LayoutVeiculo | null {
  const p = layout.poltronas.find(x => x.numero === numero)
  if (!p) return null
  if (destino.andar < 1 || destino.andar > layout.andares) return null
  const ocupante = celulaOcupada(layout, destino)
  // Soltar na própria célula é no-op, não erro.
  if (ocupante && chaveCelula(p) !== chaveCelula(destino)) return null
  return { ...layout, poltronas: layout.poltronas.map(x => x.numero === numero ? { ...x, ...destino } : x) }
}

export function renumerarPoltrona(layout: LayoutVeiculo, de: string, para: string): LayoutVeiculo | null {
  const novo = String(para || '').trim()
  if (!novo) return null
  if (!poltronaExiste(layout, de)) return null
  if (novo !== de && poltronaExiste(layout, novo)) return null
  return { ...layout, poltronas: layout.poltronas.map(p => p.numero === de ? { ...p, numero: novo } : p) }
}

export function alterarTipoPoltrona(layout: LayoutVeiculo, numero: string, tipo: TipoPoltrona): LayoutVeiculo {
  return { ...layout, poltronas: layout.poltronas.map(p => p.numero === numero ? { ...p, tipo } : p) }
}

export function adicionarElemento(layout: LayoutVeiculo, celula: Celula, label: string): LayoutVeiculo | null {
  const l = String(label || '').trim()
  if (!l) return null
  if (celulaOcupada(layout, celula)) return null
  if (celula.andar < 1 || celula.andar > layout.andares) return null
  return { ...layout, elementos: [...(layout.elementos || []), { label: l.slice(0, 24), ...celula }] }
}

export function moverElemento(layout: LayoutVeiculo, origem: Celula, destino: Celula): LayoutVeiculo | null {
  const kOrigem = chaveCelula(origem)
  const el = (layout.elementos || []).find(e => chaveCelula(e) === kOrigem)
  if (!el) return null
  if (destino.andar < 1 || destino.andar > layout.andares) return null
  if (celulaOcupada(layout, destino) && kOrigem !== chaveCelula(destino)) return null
  return { ...layout, elementos: (layout.elementos || []).map(e => chaveCelula(e) === kOrigem ? { ...e, ...destino } : e) }
}

export function removerElemento(layout: LayoutVeiculo, celula: Celula): LayoutVeiculo {
  const k = chaveCelula(celula)
  return { ...layout, elementos: (layout.elementos || []).filter(e => chaveCelula(e) !== k) }
}

// Remove o que estiver na célula, seja poltrona ou elemento (ferramenta "Apagar").
export function limparCelula(layout: LayoutVeiculo, celula: Celula): LayoutVeiculo {
  const k = chaveCelula(celula)
  return {
    ...layout,
    poltronas: layout.poltronas.filter(p => chaveCelula(p) !== k),
    elementos: (layout.elementos || []).filter(e => chaveCelula(e) !== k),
  }
}

// Trocar o nº de andares para baixo descartaria itens do andar removido — a tela
// precisa avisar antes. `null` = tem item preso lá em cima.
export function definirAndares(layout: LayoutVeiculo, andares: number): LayoutVeiculo | null {
  const n = Math.min(2, Math.max(1, andares))
  if (n < layout.andares) {
    const presos = [...layout.poltronas, ...(layout.elementos || [])].some(i => i.andar > n)
    if (presos) return null
  }
  return { ...layout, andares: n }
}

// Croqui (mapa de assentos) de um VEÍCULO da frota. Client-safe, puro, testável.
//
// ── As três decisões que NÃO são estéticas (vieram da entrega do croqui) ──────
//
// 1. LAYOUT É DOCUMENTO, NÃO TABELA. O croqui mora em `Veiculo.layout` (JSON).
//    Não existe "tabela de poltrona" e não deve passar a existir: a numeração NÃO
//    é derivável de fórmula — no Carro 2021 a coluna da direita segue a numeração
//    de fábrica (09, 12, 15…) porque o módulo de bar ocupa as fileiras 2 e 3.
//    Layout é documento; ocupação é relação. Só o que muda por viagem vira registro.
// 2. `Viagem.layoutSnap`: toda viagem guarda a CÓPIA do croqui de quando foi
//    aberta. Reformar um carro não pode mudar o mapa de quem já comprou.
// 3. A unicidade de poltrona é do SERVIDOR, não da UI — dois atendentes clicam no
//    mesmo segundo. Aqui não há Postgres com @@unique: quem garante é a gravação
//    atômica em `lib/reservas.ts`.
//
// ── Formato ──────────────────────────────────────────────────────────────────
// `corredorApos: [1]` DECLARA onde passa o corredor (depois da 2ª coluna → 2+1),
// em vez de gastar uma coluna do desenho com ele. Elemento com `largura:'total'`
// atravessa o piso (frigobar de fundo) e `rowSpan` cobre fileiras (módulo de bar).
// Número é STRING ("01"): preserva o zero à esquerda do croqui de fábrica.

export type TipoPoltrona = 'leito' | 'leito-cama' | 'semi-leito' | 'executivo' | 'convencional'

// [linha, coluna, número] + tipo opcional (o croqui da Deny é leito; o formato
// original não previa tipo e perder isso seria regressão).
export type Assento = [number, number, string, TipoPoltrona?]

export type TipoElemento = 'bar' | 'banheiro' | 'escada' | 'porta' | 'volante' | 'amenidade'

export type ElementoLayout = {
  linha: number
  col?: number
  span?: number          // largura em colunas
  rowSpan?: number       // altura em fileiras
  largura?: 'total'      // faixa que atravessa o piso inteiro
  rotulo: string
  tipo?: TipoElemento    // ausente = 'amenidade'
}

export type Piso = {
  id: string
  nome: string
  colunas: number
  corredorApos: number[] // [1] = corredor depois da 2ª coluna (índice 0-based)
  assentos: Assento[]
  elementos: ElementoLayout[]
}

export type LayoutVeiculo = { pisos: Piso[] }

export type ModeloLayout = { id: string; nome: string; layout: LayoutVeiculo }

// Célula dentro de um piso.
export type Celula = { pisoId: string; linha: number; col: number }

export const TIPOS_POLTRONA: { key: TipoPoltrona; label: string }[] = [
  { key: 'leito', label: 'Leito' },
  { key: 'leito-cama', label: 'Leito-cama' },
  { key: 'semi-leito', label: 'Semi-leito' },
  { key: 'executivo', label: 'Executivo' },
  { key: 'convencional', label: 'Convencional' },
]

export const ESTRUTURA_PALETA: { tipo: TipoElemento; label: string; cor: string; bg: string }[] = [
  { tipo: 'bar', label: 'Bar / Frigobar', cor: '#7c2d12', bg: '#ffedd5' },
  { tipo: 'banheiro', label: 'Banheiro', cor: '#0e7490', bg: '#cffafe' },
  { tipo: 'escada', label: 'Escada', cor: '#4338ca', bg: '#e0e7ff' },
  { tipo: 'porta', label: 'Porta', cor: '#166534', bg: '#dcfce7' },
  { tipo: 'volante', label: 'Volante', cor: '#475569', bg: '#f1f5f9' },
]

export const ELEMENTOS_COMUNS = ['Chopeira', 'Cafeteira', 'Frigobar', 'Geladeira', 'TV', 'Ar-condicionado', 'Água', 'Bagageiro']

export const elementoInfo = (e: Pick<ElementoLayout, 'tipo'>) =>
  ESTRUTURA_PALETA.find(x => x.tipo === (e.tipo || 'amenidade')) || { tipo: 'amenidade' as TipoElemento, label: 'Amenidade', cor: '#94a3b8', bg: '#f1f5f9' }

// ── Frota da Deny — extraída dos PDFs originais (CROCKI DAS POLTRONAS 21/23) ──
// Fonte da verdade inicial; o editor grava direto em `Veiculo.layout` depois.
const MODULO_BAR: ElementoLayout = { linha: 2, col: 2, rowSpan: 2, rotulo: 'Chopeira · Cafeteira · Frigobar', tipo: 'bar' }
const FRIGOBAR_FUNDO: ElementoLayout = { linha: 11, largura: 'total', rotulo: 'Frigobar', tipo: 'bar' }
const BANHEIRO: ElementoLayout = { linha: 0, col: 0, span: 2, rotulo: 'Banheiro', tipo: 'banheiro' }

const L: TipoPoltrona = 'leito'
const LC: TipoPoltrona = 'leito-cama'

const CARRO_2023: LayoutVeiculo = {
  pisos: [
    {
      id: 'sup', nome: 'Piso Superior', colunas: 3, corredorApos: [1],
      assentos: [
        [0, 0, '01', L], [0, 1, '02', L], [0, 2, '03', L],
        [1, 0, '04', L], [1, 1, '05', L], [1, 2, '06', L],
        [2, 0, '07', L], [2, 1, '08', L],
        [3, 0, '09', L], [3, 1, '10', L],
        [4, 0, '11', L], [4, 1, '12', L], [4, 2, '13', L],
        [5, 0, '14', L], [5, 1, '15', L], [5, 2, '16', L],
        [6, 0, '17', L], [6, 1, '18', L], [6, 2, '19', L],
        [7, 0, '20', L], [7, 1, '21', L], [7, 2, '22', L],
        [8, 0, '23', L], [8, 1, '24', L], [8, 2, '25', L],
        [9, 0, '26', L], [9, 1, '27', L], [9, 2, '28', L],
        [10, 0, '29', L], [10, 1, '30', L], [10, 2, '31', L],
      ],
      elementos: [MODULO_BAR, FRIGOBAR_FUNDO],
    },
    {
      id: 'inf', nome: 'Piso Inferior', colunas: 3, corredorApos: [1],
      assentos: [
        [1, 0, '32', LC], [1, 1, '33', LC], [1, 2, '34', LC],
        [2, 0, '35', LC], [2, 1, '36', LC], [2, 2, '37', LC],
        [3, 0, '38', LC], [3, 1, '39', LC], [3, 2, '40', LC],
      ],
      elementos: [BANHEIRO, { linha: 4, largura: 'total', rotulo: 'Geladeira · Cafeteira', tipo: 'bar' }],
    },
  ],
}

const CARRO_2021: LayoutVeiculo = {
  pisos: [
    {
      id: 'sup', nome: 'Piso Superior', colunas: 3, corredorApos: [1],
      // A coluna da direita segue a numeração de FÁBRICA (09, 12, 15…) porque o
      // módulo de bar ocupa as fileiras 2 e 3. É assim no PDF. Não "corrija":
      // renumerar aqui manda o passageiro procurar um assento que não existe.
      assentos: [
        [0, 0, '01', L], [0, 1, '02', L], [0, 2, '03', L],
        [1, 0, '04', L], [1, 1, '05', L], [1, 2, '06', L],
        [2, 0, '07', L], [2, 1, '08', L],
        [3, 0, '10', L], [3, 1, '11', L],
        [4, 0, '13', L], [4, 1, '14', L], [4, 2, '09', L],
        [5, 0, '16', L], [5, 1, '17', L], [5, 2, '12', L],
        [6, 0, '19', L], [6, 1, '20', L], [6, 2, '15', L],
        [7, 0, '22', L], [7, 1, '23', L], [7, 2, '18', L],
        [8, 0, '25', L], [8, 1, '26', L], [8, 2, '21', L],
        [9, 0, '28', L], [9, 1, '29', L], [9, 2, '24', L],
        [10, 0, '30', L], [10, 1, '31', L], [10, 2, '27', L],
      ],
      elementos: [MODULO_BAR, FRIGOBAR_FUNDO],
    },
    {
      id: 'inf', nome: 'Piso Inferior', colunas: 3, corredorApos: [1],
      assentos: [
        [1, 0, '32', LC], [1, 1, '33', LC], [1, 2, '34', LC],
        [2, 0, '35', LC], [2, 1, '36', LC], [2, 2, '37', LC],
        [3, 0, '38', LC], [3, 1, '39', LC], [3, 2, '40', LC],
        [4, 0, '41', LC], [4, 1, '42', LC], [4, 2, '43', LC],
      ],
      elementos: [BANHEIRO, { linha: 5, largura: 'total', rotulo: 'Geladeira · Cafeteira', tipo: 'bar' }],
    },
  ],
}

// Rodoviário 2+2 clássico: par à esquerda, corredor, par à direita. A numeração
// ziguezagueia (esquerda sobe 01,02; direita desce 04,03) — numeração de fábrica.
const CONVENCIONAL_2X2: LayoutVeiculo = (() => {
  const assentos: Assento[] = []
  const C: TipoPoltrona = 'convencional'
  assentos.push([0, 0, '01', C], [0, 1, '02', C], [0, 2, '04', C], [0, 3, '03', C])
  assentos.push([1, 0, '05', C], [1, 1, '06', C]) // fileira da porta: sem par direito
  let esq = 9, dir = 8
  for (let l = 2; l <= 11; l++) {
    assentos.push([l, 0, pad(esq), C], [l, 1, pad(esq + 1), C], [l, 2, pad(dir), C], [l, 3, pad(dir - 1), C])
    esq += 4; dir += 4
  }
  assentos.push([12, 0, '47', C], [12, 1, '48', C]) // fundo: banheiro no lado direito
  return {
    pisos: [{
      id: 'unico', nome: 'Poltronas', colunas: 4, corredorApos: [1],
      assentos,
      elementos: [
        { linha: 1, col: 2, span: 2, rotulo: 'Porta', tipo: 'porta' },
        { linha: 12, col: 2, span: 2, rotulo: 'Banheiro', tipo: 'banheiro' },
      ],
    }],
  }
})()

function pad(n: number): string { return n < 10 ? `0${n}` : String(n) }

export const MODELOS_LAYOUT: ModeloLayout[] = [
  { id: 'carro-2023', nome: 'Carro 2023 — leito 2+1 (40 lugares)', layout: CARRO_2023 },
  { id: 'carro-2021', nome: 'Carro 2021 — leito 2+1 (43 lugares)', layout: CARRO_2021 },
  { id: 'convencional-2x2', nome: 'Convencional 2+2 (48 lugares)', layout: CONVENCIONAL_2X2 },
  { id: 'em-branco', nome: 'Em branco', layout: { pisos: [{ id: 'unico', nome: 'Poltronas', colunas: 3, corredorApos: [1], assentos: [], elementos: [] }] } },
]

export function layoutVazio(): LayoutVeiculo {
  return clonarLayout(MODELOS_LAYOUT[MODELOS_LAYOUT.length - 1].layout)
}

// ── Compatibilidade com o croqui do formato ANTERIOR ─────────────────────────
// Antes o croqui era `{ andares, poltronas: [{numero,tipo,andar,fileira,coluna}] }`,
// com a coluna 3 GASTA como corredor. Veículo já cadastrado tem esse formato no
// Redis — sem converter, a tela quebra. `normalizarLayout` roda na leitura e o
// dado se conserta sozinho no próximo salvamento.
// Mapa de colunas (1-based → 0-based, pulando o corredor): 1→0 · 2→1 · 3=corredor
// · 4→2 · 5→3.
type LayoutAntigo = {
  andares?: number
  poltronas?: { numero: string; tipo?: string; andar: number; fileira: number; coluna: number }[]
  elementos?: { label: string; tipo?: string; andar: number; fileira: number; coluna: number }[]
}

const COL_ANTIGA: Record<number, number> = { 1: 0, 2: 1, 4: 2, 5: 3 }

export function ehLayoutAntigo(raw: any): boolean {
  return !!raw && !Array.isArray(raw.pisos) && Array.isArray(raw.poltronas)
}

export function migrarLayoutAntigo(raw: LayoutAntigo): LayoutVeiculo {
  const andares = Math.max(1, Math.min(2, raw.andares || 1))
  // Andar 2 = superior e vem primeiro no desenho; andar 1 = inferior.
  const ordem = andares > 1 ? [2, 1] : [1]
  const pisos: Piso[] = ordem.map(andar => {
    const nome = andares > 1 ? (andar === 2 ? 'Piso Superior' : 'Piso Inferior') : 'Poltronas'
    const id = andares > 1 ? (andar === 2 ? 'sup' : 'inf') : 'unico'
    const assentos: Assento[] = (raw.poltronas || [])
      .filter(p => p.andar === andar && COL_ANTIGA[p.coluna] !== undefined)
      .map(p => [p.fileira - 1, COL_ANTIGA[p.coluna], rotuloPoltrona(p.numero), (p.tipo as TipoPoltrona) || 'leito'])
    const elementos: ElementoLayout[] = (raw.elementos || [])
      // O corredor deixa de ser elemento: vira `corredorApos`.
      .filter(e => e.andar === andar && e.tipo !== 'corredor' && COL_ANTIGA[e.coluna] !== undefined)
      .map(e => ({ linha: e.fileira - 1, col: COL_ANTIGA[e.coluna], rotulo: e.label, tipo: (e.tipo === 'volante' ? 'volante' : e.tipo === 'porta' ? 'porta' : e.tipo === 'escada' ? 'escada' : e.tipo === 'banheiro' ? 'banheiro' : 'amenidade') as TipoElemento }))
    return { id, nome, colunas: 4, corredorApos: [1], assentos, elementos }
  })
  return { pisos: pisos.filter(p => p.assentos.length || p.elementos.length) .length ? pisos : [{ id: 'unico', nome: 'Poltronas', colunas: 3, corredorApos: [1], assentos: [], elementos: [] }] }
}

// Ponto único de leitura: aceita croqui novo, antigo ou ausente.
export function normalizarLayout(raw: any): LayoutVeiculo {
  if (!raw) return layoutVazio()
  if (ehLayoutAntigo(raw)) return migrarLayoutAntigo(raw)
  if (Array.isArray(raw.pisos) && raw.pisos.length) return raw as LayoutVeiculo
  return layoutVazio()
}

// Cópia PROFUNDA — sem isto, editar um veículo mutaria o modelo do módulo (e todo
// veículo criado a partir dele na mesma sessão). É também o que `layoutSnap` usa.
export function clonarLayout(layout: LayoutVeiculo): LayoutVeiculo {
  return JSON.parse(JSON.stringify(layout))
}

export function expandirModelo(id?: string | null): LayoutVeiculo | null {
  if (!id) return null
  const m = MODELOS_LAYOUT.find(x => x.id === id)
  return m ? clonarLayout(m.layout) : null
}

// ── Leitura ──────────────────────────────────────────────────────────────────

// Capacidade SEMPRE derivada do layout — nunca digitada.
export function capacidadeLayout(layout: LayoutVeiculo): number {
  return (layout?.pisos || []).reduce((t, p) => t + (p.assentos?.length || 0), 0)
}
export const totalPoltronas = capacidadeLayout

// Todos os números, na ordem do manifesto (01, 02, 03…).
export function numerosPoltronas(layout: LayoutVeiculo): string[] {
  return (layout?.pisos || []).flatMap(p => (p.assentos || []).map(a => a[2])).sort((a, b) => Number(a) - Number(b))
}

export function poltronaExiste(layout: LayoutVeiculo, numero: string): boolean {
  return (layout?.pisos || []).some(p => (p.assentos || []).some(a => a[2] === numero))
}

export function pisoPorId(layout: LayoutVeiculo, pisoId: string): Piso | undefined {
  return (layout?.pisos || []).find(p => p.id === pisoId)
}

// Rótulo da poltrona: o croqui já guarda "01". Mantido para o dado antigo ("1"),
// que vinha do formato anterior. Só APRESENTAÇÃO — a reserva guarda o que foi
// cadastrado.
export function rotuloPoltrona(numero: string): string {
  const n = String(numero ?? '').trim()
  return /^\d$/.test(n) ? `0${n}` : n
}

// Quantas fileiras o piso ocupa (inclui elementos, que podem passar do último assento).
export function totalLinhas(piso: Piso): number {
  const deAssentos = (piso.assentos || []).reduce((m, a) => Math.max(m, a[0] + 1), 0)
  const deElementos = (piso.elementos || []).reduce((m, e) => Math.max(m, e.linha + (e.rowSpan || 1)), 0)
  return Math.max(deAssentos, deElementos)
}

const mesmaCelula = (linha: number, col: number, c: Celula) => c.linha === linha && c.col === col

export function assentoEm(piso: Piso, linha: number, col: number): Assento | undefined {
  return (piso.assentos || []).find(a => a[0] === linha && a[1] === col)
}

// Elemento que COBRE a célula — respeita span/rowSpan/largura total. Sem isto o
// módulo de bar (2 fileiras) deixaria colocar poltrona em cima dele.
export function elementoEm(piso: Piso, linha: number, col: number): ElementoLayout | undefined {
  return (piso.elementos || []).find(e => {
    const dentroLinha = linha >= e.linha && linha < e.linha + (e.rowSpan || 1)
    if (!dentroLinha) return false
    if (e.largura === 'total') return true
    const c0 = e.col ?? 0
    return col >= c0 && col < c0 + (e.span || 1)
  })
}

export function celulaOcupada(layout: LayoutVeiculo, celula: Celula): 'poltrona' | 'elemento' | null {
  const piso = pisoPorId(layout, celula.pisoId)
  if (!piso) return null
  if (assentoEm(piso, celula.linha, celula.col)) return 'poltrona'
  if (elementoEm(piso, celula.linha, celula.col)) return 'elemento'
  return null
}

// Menor número livre. A numeração do croqui é irregular (segue a fábrica), então
// "próximo" não é `total + 1`.
export function proximoNumeroLivre(layout: LayoutVeiculo): string {
  const usados = new Set(numerosPoltronas(layout).map(n => Number(n)))
  let n = 1
  while (usados.has(n)) n++
  return pad(n)
}

// ── Validação ────────────────────────────────────────────────────────────────
// Em pt-BR: vai direto para a tela.
export function validarLayout(layout: LayoutVeiculo): string[] {
  const erros: string[] = []
  if (!layout || !Array.isArray(layout.pisos) || !layout.pisos.length) return ['Croqui sem piso.']

  const vistos = new Set<string>()
  const duplicados = new Set<string>()
  for (const piso of layout.pisos) {
    if (!piso.colunas || piso.colunas < 1) erros.push(`${piso.nome}: precisa de ao menos 1 coluna.`)
    const celulas = new Set<string>()
    for (const a of piso.assentos || []) {
      const [linha, col, numero] = a
      if (!String(numero || '').trim()) { erros.push(`${piso.nome}: há poltrona sem número.`); continue }
      if (vistos.has(numero)) duplicados.add(numero)
      vistos.add(numero)
      if (linha < 0 || col < 0) erros.push(`${piso.nome}: há poltrona em posição inválida.`)
      if (col >= piso.colunas) erros.push(`${piso.nome}: poltrona ${numero} está fora das ${piso.colunas} colunas.`)
      const k = `${linha}-${col}`
      if (celulas.has(k)) erros.push(`${piso.nome}: duas poltronas na mesma posição.`)
      celulas.add(k)
      // Poltrona em cima de elemento (o módulo de bar cobre 2 fileiras).
      if (elementoEm(piso, linha, col)) erros.push(`${piso.nome}: poltrona ${numero} está sobre "${elementoEm(piso, linha, col)!.rotulo}".`)
    }
  }
  if (duplicados.size) erros.push(`Número de poltrona repetido: ${Array.from(duplicados).sort((a, b) => Number(a) - Number(b)).join(', ')}.`)
  return Array.from(new Set(erros))
}

// ── Operações do editor ──────────────────────────────────────────────────────
// Puras: devolvem croqui novo, ou `null` quando a operação corromperia o mapa.

function comPiso(layout: LayoutVeiculo, pisoId: string, fn: (p: Piso) => Piso): LayoutVeiculo {
  return { ...layout, pisos: layout.pisos.map(p => p.id === pisoId ? fn(p) : p) }
}

export function adicionarPoltrona(layout: LayoutVeiculo, celula: Celula, tipo: TipoPoltrona = 'leito', numero?: string): LayoutVeiculo | null {
  const piso = pisoPorId(layout, celula.pisoId)
  if (!piso) return null
  if (celulaOcupada(layout, celula)) return null
  if (celula.col >= piso.colunas || celula.col < 0 || celula.linha < 0) return null
  const n = String(numero ?? proximoNumeroLivre(layout)).trim()
  if (!n || poltronaExiste(layout, n)) return null
  return comPiso(layout, celula.pisoId, p => ({ ...p, assentos: [...p.assentos, [celula.linha, celula.col, n, tipo]] }))
}

export function removerPoltrona(layout: LayoutVeiculo, numero: string): LayoutVeiculo {
  return { ...layout, pisos: layout.pisos.map(p => ({ ...p, assentos: p.assentos.filter(a => a[2] !== numero) })) }
}

export function moverPoltrona(layout: LayoutVeiculo, numero: string, destino: Celula): LayoutVeiculo | null {
  const pisoDestino = pisoPorId(layout, destino.pisoId)
  if (!pisoDestino || destino.col >= pisoDestino.colunas || destino.col < 0 || destino.linha < 0) return null
  const origem = layout.pisos.find(p => p.assentos.some(a => a[2] === numero))
  if (!origem) return null
  const a = origem.assentos.find(x => x[2] === numero)!
  const naPropria = origem.id === destino.pisoId && mesmaCelula(a[0], a[1], destino)
  if (celulaOcupada(layout, destino) && !naPropria) return null
  const semEla = removerPoltrona(layout, numero)
  return comPiso(semEla, destino.pisoId, p => ({ ...p, assentos: [...p.assentos, [destino.linha, destino.col, numero, a[3]]] }))
}

export function renumerarPoltrona(layout: LayoutVeiculo, de: string, para: string): LayoutVeiculo | null {
  const novo = String(para || '').trim()
  if (!novo || !poltronaExiste(layout, de)) return null
  if (novo !== de && poltronaExiste(layout, novo)) return null
  return { ...layout, pisos: layout.pisos.map(p => ({ ...p, assentos: p.assentos.map(a => a[2] === de ? [a[0], a[1], novo, a[3]] as Assento : a) })) }
}

export function alterarTipoPoltrona(layout: LayoutVeiculo, numero: string, tipo: TipoPoltrona): LayoutVeiculo {
  return { ...layout, pisos: layout.pisos.map(p => ({ ...p, assentos: p.assentos.map(a => a[2] === numero ? [a[0], a[1], a[2], tipo] as Assento : a) })) }
}

export function adicionarElemento(layout: LayoutVeiculo, celula: Celula, rotulo: string, tipo: TipoElemento = 'amenidade', opcoes: { span?: number; rowSpan?: number; largura?: 'total' } = {}): LayoutVeiculo | null {
  const r = String(rotulo || '').trim()
  if (!r || !pisoPorId(layout, celula.pisoId)) return null
  if (celulaOcupada(layout, celula)) return null
  const el: ElementoLayout = {
    linha: celula.linha, rotulo: r.slice(0, 40), tipo,
    ...(opcoes.largura === 'total' ? { largura: 'total' as const } : { col: celula.col }),
    ...(opcoes.span && opcoes.span > 1 ? { span: opcoes.span } : {}),
    ...(opcoes.rowSpan && opcoes.rowSpan > 1 ? { rowSpan: opcoes.rowSpan } : {}),
  }
  return comPiso(layout, celula.pisoId, p => ({ ...p, elementos: [...p.elementos, el] }))
}

// Remove o que estiver na célula, poltrona ou elemento (ferramenta "Apagar").
export function limparCelula(layout: LayoutVeiculo, celula: Celula): LayoutVeiculo {
  const piso = pisoPorId(layout, celula.pisoId)
  if (!piso) return layout
  const a = assentoEm(piso, celula.linha, celula.col)
  if (a) return removerPoltrona(layout, a[2])
  const el = elementoEm(piso, celula.linha, celula.col)
  if (el) return comPiso(layout, celula.pisoId, p => ({ ...p, elementos: p.elementos.filter(e => e !== el) }))
  return layout
}

// Corredor: `corredorApos` DECLARA a passagem em vez de gastar uma coluna. Alternar
// não move poltrona nenhuma — o corredor é vão entre colunas, não célula.
export function alternarCorredor(layout: LayoutVeiculo, pisoId: string, aposColuna: number): LayoutVeiculo {
  return comPiso(layout, pisoId, p => ({
    ...p,
    corredorApos: p.corredorApos.includes(aposColuna)
      ? p.corredorApos.filter(c => c !== aposColuna)
      : [...p.corredorApos, aposColuna].sort((a, b) => a - b),
  }))
}

export function definirColunas(layout: LayoutVeiculo, pisoId: string, colunas: number): LayoutVeiculo | null {
  const n = Math.min(6, Math.max(1, Math.floor(colunas) || 1))
  const piso = pisoPorId(layout, pisoId)
  if (!piso) return null
  // Encolher com poltrona na coluna que sumiria descartaria assento vendido.
  if (piso.assentos.some(a => a[1] >= n)) return null
  return comPiso(layout, pisoId, p => ({ ...p, colunas: n, corredorApos: p.corredorApos.filter(c => c < n - 1) }))
}

export function adicionarPiso(layout: LayoutVeiculo): LayoutVeiculo | null {
  if (layout.pisos.length >= 2) return null
  return { ...layout, pisos: [...layout.pisos, { id: 'inf', nome: 'Piso Inferior', colunas: layout.pisos[0]?.colunas || 3, corredorApos: [...(layout.pisos[0]?.corredorApos || [1])], assentos: [], elementos: [] }] }
}

export function removerPiso(layout: LayoutVeiculo, pisoId: string): LayoutVeiculo | null {
  if (layout.pisos.length <= 1) return null
  const piso = pisoPorId(layout, pisoId)
  if (!piso) return null
  if (piso.assentos.length) return null // teria poltrona para descartar
  return { ...layout, pisos: layout.pisos.filter(p => p.id !== pisoId) }
}

// MÉTRICAS DE CAMPANHA (mídia paga) — dono, 09/09/2026: "o gestor de tráfego preenche as
// informações das contas de anúncio e as métricas viram dashboard", com a exigência que
// define o desenho inteiro:
//
//   "De acordo com o OBJETIVO da campanha, precisamos das métricas de saída certas:
//    campanha de visitas ao perfil > XXX visitas + custo por visita; campanha de
//    mensagens > XXX mensagens + custo por mensagem."
//
// Ou seja: `resultados` é um número só no banco, e o OBJETIVO decide como ele se chama e
// como se chama o seu custo. Nada de vinte colunas vazias por campanha.
//
// Preenchimento MANUAL agora (o gestor lança os números); a integração com Meta e Google
// entra depois sem mexer aqui — a API só vai passar a preencher os mesmos campos.
//
// Toda métrica DERIVADA (CTR, CPC, CPM, custo por resultado, ROAS, frequência) é calculada
// aqui e nunca digitada: número derivado que se digita é número que diverge.

export type CanalAds = 'meta' | 'google' | 'linkedin' | 'tiktok'

export const CANAIS: { chave: CanalAds; label: string; cor: string }[] = [
  { chave: 'meta', label: 'Meta Ads', cor: '#0866ff' },
  { chave: 'google', label: 'Google Ads', cor: '#34a853' },
  { chave: 'linkedin', label: 'LinkedIn Ads', cor: '#0a66c2' },
  { chave: 'tiktok', label: 'TikTok Ads', cor: '#111111' },
]
export const labelCanal = (c: string) => CANAIS.find(x => x.chave === c)?.label || c
export const corCanal = (c: string) => CANAIS.find(x => x.chave === c)?.cor || 'var(--v2-ink3)'

// Como cada canal chama o nível do meio (Meta: conjunto/público; Google: grupo de anúncios).
export const LABEL_PUBLICO: Record<string, { singular: string; plural: string }> = {
  meta: { singular: 'Público', plural: 'Públicos' },
  google: { singular: 'Grupo de anúncios', plural: 'Grupos de anúncios' },
  linkedin: { singular: 'Público', plural: 'Públicos' },
  tiktok: { singular: 'Público', plural: 'Públicos' },
}

export type ObjetivoDef = {
  chave: string
  label: string
  canais: CanalAds[]
  resultado: { singular: string; plural: string } // "visita ao perfil" / "visitas ao perfil"
  custoLabel: string // "Custo por visita"
  receita?: boolean // objetivo que gera receita: mostra ROAS
  semResultado?: boolean // o resultado É a entrega de mídia (alcance/impressões)
}

// O catálogo é a lei do dashboard. Acrescentar objetivo aqui basta para a tela inteira
// passar a falar a língua dele.
export const OBJETIVOS: ObjetivoDef[] = [
  // ---------------- Meta
  { chave: 'reconhecimento', label: 'Reconhecimento', canais: ['meta', 'tiktok', 'linkedin'], resultado: { singular: 'pessoa alcançada', plural: 'pessoas alcançadas' }, custoLabel: 'Custo por mil impressões', semResultado: true },
  { chave: 'trafego', label: 'Tráfego', canais: ['meta', 'google', 'linkedin', 'tiktok'], resultado: { singular: 'clique no link', plural: 'cliques no link' }, custoLabel: 'Custo por clique' },
  { chave: 'visitas_perfil', label: 'Visitas ao perfil', canais: ['meta', 'tiktok'], resultado: { singular: 'visita ao perfil', plural: 'visitas ao perfil' }, custoLabel: 'Custo por visita' },
  { chave: 'engajamento', label: 'Engajamento', canais: ['meta', 'linkedin', 'tiktok'], resultado: { singular: 'engajamento', plural: 'engajamentos' }, custoLabel: 'Custo por engajamento' },
  { chave: 'mensagens', label: 'Mensagens', canais: ['meta', 'tiktok'], resultado: { singular: 'conversa iniciada', plural: 'conversas iniciadas' }, custoLabel: 'Custo por mensagem' },
  { chave: 'leads', label: 'Cadastros (leads)', canais: ['meta', 'google', 'linkedin', 'tiktok'], resultado: { singular: 'lead', plural: 'leads' }, custoLabel: 'Custo por lead' },
  { chave: 'vendas', label: 'Vendas / conversões', canais: ['meta', 'google', 'linkedin', 'tiktok'], resultado: { singular: 'compra', plural: 'compras' }, custoLabel: 'Custo por compra', receita: true },
  { chave: 'video', label: 'Visualizações de vídeo', canais: ['meta', 'google', 'tiktok', 'linkedin'], resultado: { singular: 'visualização', plural: 'visualizações' }, custoLabel: 'Custo por visualização' },
  { chave: 'app', label: 'Instalações do app', canais: ['meta', 'google', 'tiktok'], resultado: { singular: 'instalação', plural: 'instalações' }, custoLabel: 'Custo por instalação' },
  // ---------------- Google (além dos compartilhados acima)
  { chave: 'ligacoes', label: 'Ligações', canais: ['google'], resultado: { singular: 'ligação', plural: 'ligações' }, custoLabel: 'Custo por ligação' },
  { chave: 'visitas_loja', label: 'Visitas à loja', canais: ['google'], resultado: { singular: 'visita à loja', plural: 'visitas à loja' }, custoLabel: 'Custo por visita' },
  { chave: 'conversoes', label: 'Conversões (geral)', canais: ['google', 'linkedin'], resultado: { singular: 'conversão', plural: 'conversões' }, custoLabel: 'Custo por conversão', receita: true },
]

export const objetivoDe = (chave?: string): ObjetivoDef =>
  OBJETIVOS.find(o => o.chave === chave) || { chave: chave || 'outro', label: 'Outro', canais: ['meta'], resultado: { singular: 'resultado', plural: 'resultados' }, custoLabel: 'Custo por resultado' }

export const objetivosDoCanal = (canal: string): ObjetivoDef[] => OBJETIVOS.filter(o => o.canais.includes(canal as CanalAds))

// Tipos de campanha do Google: a escolha que mais muda o que se cadastra depois
// (Pesquisa tem palavra-chave; Performance Max não tem, tem sinais de público).
export const TIPOS_GOOGLE: { chave: string; label: string; temPalavraChave: boolean }[] = [
  { chave: 'pesquisa', label: 'Pesquisa', temPalavraChave: true },
  { chave: 'pmax', label: 'Performance Max', temPalavraChave: false },
  { chave: 'display', label: 'Display', temPalavraChave: false },
  { chave: 'video', label: 'Vídeo (YouTube)', temPalavraChave: false },
  { chave: 'demand_gen', label: 'Demand Gen', temPalavraChave: false },
  { chave: 'shopping', label: 'Shopping', temPalavraChave: false },
]
export const CORRESPONDENCIAS = ['ampla', 'frase', 'exata', 'negativa'] as const
export type Correspondencia = typeof CORRESPONDENCIAS[number]

// ---------------------------------------------------------------- números
export type LancamentoMetrica = {
  investimento?: number
  impressoes?: number
  alcance?: number
  cliques?: number
  resultados?: number
  receita?: number
}

export type SomaMetricas = Required<LancamentoMetrica>

const n = (v: unknown): number => {
  const x = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(x) ? x : 0
}

export function somar(lista: LancamentoMetrica[] = []): SomaMetricas {
  return lista.reduce<SomaMetricas>((acc, m) => ({
    investimento: acc.investimento + n(m.investimento),
    impressoes: acc.impressoes + n(m.impressoes),
    alcance: acc.alcance + n(m.alcance),
    cliques: acc.cliques + n(m.cliques),
    resultados: acc.resultados + n(m.resultados),
    receita: acc.receita + n(m.receita),
  }), { investimento: 0, impressoes: 0, alcance: 0, cliques: 0, resultados: 0, receita: 0 })
}

export type Derivados = {
  ctr: number | null // % de cliques sobre impressões
  cpc: number | null // custo por clique
  cpm: number | null // custo por mil impressões
  custoPorResultado: number | null
  roas: number | null // receita / investimento
  frequencia: number | null // impressões / alcance
}

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null)

export function derivados(s: SomaMetricas): Derivados {
  return {
    ctr: s.impressoes > 0 ? (s.cliques / s.impressoes) * 100 : null,
    cpc: div(s.investimento, s.cliques),
    cpm: s.impressoes > 0 ? (s.investimento / s.impressoes) * 1000 : null,
    custoPorResultado: div(s.investimento, s.resultados),
    roas: div(s.receita, s.investimento),
    frequencia: div(s.impressoes, s.alcance),
  }
}

/** O NÚMERO QUE IMPORTA para o objetivo, já com o nome certo (o pedido do dono).
 *  Reconhecimento não tem "resultado" contado: a entrega é o alcance. */
export function resultadoDoObjetivo(objetivo: string | undefined, s: SomaMetricas): {
  valor: number
  rotulo: string // "12 mensagens" -> aqui só o rótulo: "conversas iniciadas"
  custo: number | null
  custoLabel: string
} {
  const o = objetivoDe(objetivo)
  const valor = o.semResultado ? s.alcance : s.resultados
  const d = derivados(s)
  return {
    valor,
    rotulo: valor === 1 ? o.resultado.singular : o.resultado.plural,
    custo: o.semResultado ? d.cpm : d.custoPorResultado,
    custoLabel: o.custoLabel,
  }
}

/** Variação percentual contra o período anterior. Sem base anterior, não inventa. */
export function variacao(atual: number, anterior: number): number | null {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior) || anterior === 0) return null
  return ((atual - anterior) / Math.abs(anterior)) * 100
}

/** Para custo, cair é bom; para resultado, subir é bom. Devolve se a variação é positiva. */
export function variacaoBoa(campo: 'custo' | 'resultado', pct: number | null): boolean | null {
  if (pct === null || pct === 0) return null
  return campo === 'custo' ? pct < 0 : pct > 0
}

const RE_YMD = /^\d{4}-\d{2}-\d{2}$/
/** Lançamento cobre o dia? Um lançamento pode cobrir um intervalo (semana fechada). */
export function cobreDia(l: { data: string; ate?: string }, dia: string): boolean {
  if (!RE_YMD.test(dia) || !RE_YMD.test(l.data || '')) return false
  const fim = l.ate && RE_YMD.test(l.ate) ? l.ate : l.data
  return dia >= l.data && dia <= fim
}

/** Lançamentos dentro do período [de, ate] (inclusivo), pela data de início do lançamento. */
export function noPeriodo<T extends { data: string }>(lista: T[], de: string, ate: string): T[] {
  return lista.filter(l => RE_YMD.test(l.data || '') && l.data >= de && l.data <= ate)
}

export function fmtDinheiro(v: number | null | undefined, moeda = 'BRL'): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: moeda, maximumFractionDigits: v < 100 ? 2 : 0 })
}
export function fmtNumero(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return Math.round(v).toLocaleString('pt-BR')
}
export function fmtPct(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return `${v.toFixed(casas).replace('.', ',')}%`
}

// ---------------------------------------------------------------- estrutura da campanha
// Público (conjunto no Meta / grupo de anúncios no Google) e anúncio vivem DENTRO da
// campanha. Sanitiza o que vem da tela: título obrigatório, ids estáveis, correspondência
// conhecida. Mesma ideia de normalizarSubetapas — o que vier torto não entra no banco.
export type AnuncioLimpo = {
  id: string; titulo: string; descricao?: string; textoPrincipal?: string; cta?: string
  urlDestino?: string; criativoUrl?: string; criativoTipo?: string; status?: 'ativo' | 'pausado'
}
export type PublicoLimpo = {
  id: string; titulo: string; descricao?: string
  palavrasChave?: { termo: string; correspondencia: Correspondencia }[]
  anuncios?: AnuncioLimpo[]
}

const txt = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function normalizarPublicos(bruto: unknown): PublicoLimpo[] {
  if (!Array.isArray(bruto)) return []
  const saida: PublicoLimpo[] = []
  bruto.forEach((p: any, i) => {
    const titulo = txt(p?.titulo, 160)
    if (!titulo) return
    const pub: PublicoLimpo = {
      id: txt(p?.id, 64) || `pub-${i + 1}`,
      titulo,
      ...(txt(p?.descricao, 1000) ? { descricao: txt(p?.descricao, 1000) } : {}),
    }
    if (Array.isArray(p?.palavrasChave)) {
      const pcs = p.palavrasChave
        .map((k: any) => ({ termo: txt(k?.termo, 120), correspondencia: (CORRESPONDENCIAS as readonly string[]).includes(k?.correspondencia) ? (k.correspondencia as Correspondencia) : ('ampla' as Correspondencia) }))
        .filter((k: { termo: string }) => !!k.termo)
      if (pcs.length) pub.palavrasChave = pcs
    }
    if (Array.isArray(p?.anuncios)) {
      const ans: AnuncioLimpo[] = []
      p.anuncios.forEach((a: any, j: number) => {
        const t = txt(a?.titulo, 160)
        if (!t) return
        ans.push({
          id: txt(a?.id, 64) || `an-${i + 1}-${j + 1}`,
          titulo: t,
          ...(txt(a?.descricao, 500) ? { descricao: txt(a?.descricao, 500) } : {}),
          ...(txt(a?.textoPrincipal, 2000) ? { textoPrincipal: txt(a?.textoPrincipal, 2000) } : {}),
          ...(txt(a?.cta, 60) ? { cta: txt(a?.cta, 60) } : {}),
          ...(txt(a?.urlDestino, 500) ? { urlDestino: txt(a?.urlDestino, 500) } : {}),
          ...(txt(a?.criativoUrl, 800) ? { criativoUrl: txt(a?.criativoUrl, 800) } : {}),
          ...(txt(a?.criativoTipo, 80) ? { criativoTipo: txt(a?.criativoTipo, 80) } : {}),
          status: a?.status === 'pausado' ? 'pausado' : 'ativo',
        })
      })
      if (ans.length) pub.anuncios = ans
    }
    saida.push(pub)
  })
  return saida
}

// ---------------------------------------------------------------- série do período
// Para o gráfico de evolução: agrupa os lançamentos em blocos (semana ou mês) dentro do
// período. Lançamento que cobre um intervalo entra no bloco da sua data de INÍCIO — não
// espalha o número por dias que ninguém mediu.
export type BlocoSerie = { inicio: string; rotulo: string; investimento: number; resultados: number }

function segundaDe(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const dia = d.getUTCDay() // 0 = domingo
  d.setUTCDate(d.getUTCDate() - (dia === 0 ? 6 : dia - 1))
  return d.toISOString().slice(0, 10)
}
const ddmm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`

export function serieDoPeriodo(
  lancamentos: (LancamentoMetrica & { data: string })[],
  de: string,
  ate: string,
): BlocoSerie[] {
  const dentro = noPeriodo(lancamentos, de, ate)
  if (!dentro.length) return []
  const dias = Math.max(1, Math.round((new Date(ate + 'T00:00:00Z').getTime() - new Date(de + 'T00:00:00Z').getTime()) / MS_DIA_SERIE) + 1)
  const porMes = dias > 92 // período longo: um bloco por mês
  const mapa = new Map<string, BlocoSerie>()
  for (const l of dentro) {
    const chave = porMes ? l.data.slice(0, 7) + '-01' : segundaDe(l.data)
    const rotulo = porMes
      ? new Date(chave + 'T00:00:00Z').toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '')
      : ddmm(chave)
    const b = mapa.get(chave) || { inicio: chave, rotulo, investimento: 0, resultados: 0 }
    b.investimento += Number(l.investimento) || 0
    b.resultados += Number(l.resultados) || 0
    mapa.set(chave, b)
  }
  return Array.from(mapa.values()).sort((a, b) => a.inicio.localeCompare(b.inicio))
}
const MS_DIA_SERIE = 24 * 60 * 60 * 1000

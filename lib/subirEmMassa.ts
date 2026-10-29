// SUBIR POSTAGENS EM MASSA no Programador de postagens — dono, 29/10/2026: "Preciso de uma opção
// de subir postagens em massa no programador de postagens. Subir criativos, reels, carrosseis,
// etc, preencher legendas separadas uma a uma, escolher dias e horários, marcar como colab em
// cada publicação".
//
// Regras puras do lote (client-safe); a tela é app/components/SubirEmMassa.tsx. Cada item vira
// um post pela MESMA rota do "Novo post" (/api/posts), com o mesmo corpo que o painel monta: o
// que vale para um post vale para cem. Testes em tests/subirEmMassa.test.ts.
import { MAX_COLAB, limparColaboradores } from './colab'
import { somarDias } from './datas'

export type FormatoLote = 'feed' | 'reel' | 'story'
export type AcaoLote = 'agendar' | 'aprovacao' | 'rascunho'
export type MidiaLote = {
  id: string; nome: string; tipo: 'imagem' | 'video'
  url?: string        // pronto no Blob
  capa?: string       // vídeo: capa (feita sozinha de um quadro do vídeo; dá para trocar)
  progresso?: number  // 0-100 enquanto sobe
  erro?: string
}
export type ItemLote = {
  id: string; midias: MidiaLote[]; formato: FormatoLote
  legenda: string; data: string; hora: string // data 'AAAA-MM-DD' e hora 'HH:MM' no fuso de quem usa
  colaboradores: string[]
}
export type Lote = {
  clienteId: string; marcoId: string; subetapaId: string
  redes: ('instagram' | 'facebook')[]; contaIds: string[]
  itens: ItemLote[]
}

export const MAX_CARROSSEL = 10 // limite da API de publicação da Meta
export const MAX_LEGENDA = 2200
export const MAX_HASHTAGS = 30

/** Ordem natural pelo nome do arquivo ("2.jpg" antes de "10.jpg"), como o "Novo post" já faz. */
export function ordenarPorNome<T extends { name: string }>(arquivos: T[]): T[] {
  return [...arquivos].sort((a, b) => a.name.localeCompare(b.name, 'pt', { numeric: true, sensitivity: 'base' }))
}

/** Imagem ou vídeo (o que as redes aceitam); null = arquivo que não vira post. */
export function tipoDoArquivo(mime: string, nome: string): 'imagem' | 'video' | null {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('video/') || /\.(mp4|mov|m4v)$/i.test(nome || '')) return 'video'
  if (m.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic)$/i.test(nome || '')) return 'imagem'
  return null
}

/** Um vídeo sozinho vira Reels; o resto começa como Feed (carrossel quando tem mais de uma mídia). */
export const formatoPadrao = (midias: MidiaLote[]): FormatoLote =>
  midias.length === 1 && midias[0].tipo === 'video' ? 'reel' : 'feed'

export const novoItem = (id: string, midias: MidiaLote[]): ItemLote =>
  ({ id, midias, formato: formatoPadrao(midias), legenda: '', data: '', hora: '', colaboradores: [] })

/** Por que a seleção não pode virar carrossel (null = pode). */
export function motivoParaNaoJuntar(itens: ItemLote[], ids: string[]): string | null {
  const sel = itens.filter(i => ids.includes(i.id))
  if (sel.length < 2) return 'Marque pelo menos 2 posts para juntar num carrossel.'
  const total = sel.reduce((n, i) => n + i.midias.length, 0)
  if (total > MAX_CARROSSEL) return `Um carrossel aceita até ${MAX_CARROSSEL} mídias; a seleção tem ${total}.`
  return null
}

/** Junta os marcados num carrossel, no lugar do primeiro e na ordem da lista. Legenda, data e
 *  hora vêm do primeiro que tiver; os colabs somam (até o limite). */
export function juntarEmCarrossel(itens: ItemLote[], ids: string[]): ItemLote[] {
  if (motivoParaNaoJuntar(itens, ids)) return itens
  const sel = itens.filter(i => ids.includes(i.id))
  const primeiro = sel[0]
  const junto: ItemLote = {
    id: primeiro.id,
    midias: sel.flatMap(i => i.midias),
    formato: 'feed',
    legenda: sel.find(i => i.legenda.trim())?.legenda || '',
    data: sel.find(i => i.data)?.data || '',
    hora: sel.find(i => i.hora)?.hora || '',
    colaboradores: limparColaboradores(sel.flatMap(i => i.colaboradores)),
  }
  return itens.flatMap(i => (i.id === primeiro.id ? [junto] : ids.includes(i.id) ? [] : [i]))
}

/** Desfaz o carrossel: cada mídia volta a ser um post. O primeiro fica com legenda, data e colab. */
export function separarCarrossel(itens: ItemLote[], id: string, novoId: () => string): ItemLote[] {
  return itens.flatMap(i => {
    if (i.id !== id || i.midias.length < 2) return [i]
    return i.midias.map((m, k) => (k === 0
      ? { ...i, midias: [m], formato: formatoPadrao([m]) }
      : novoItem(novoId(), [m])))
  })
}

/** Muda uma mídia de lugar dentro do carrossel. */
export function moverMidia(item: ItemLote, de: number, para: number): ItemLote {
  if (de === para || de < 0 || para < 0 || de >= item.midias.length || para >= item.midias.length) return item
  const midias = [...item.midias]
  const [m] = midias.splice(de, 1)
  midias.splice(para, 0, m)
  return { ...item, midias }
}

/** Muda um post de lugar na lista (a ordem da lista é a ordem de "distribuir datas"). */
export function moverItem(itens: ItemLote[], de: number, para: number): ItemLote[] {
  if (de === para || de < 0 || para < 0 || de >= itens.length || para >= itens.length) return itens
  const novo = [...itens]
  const [i] = novo.splice(de, 1)
  novo.splice(para, 0, i)
  return novo
}

export type Distribuicao =
  | { modo: 'dias'; inicio: string; hora: string; cadaDias: number }
  | { modo: 'semana'; inicio: string; hora: string; diasDaSemana: number[] } // 0 = domingo

/** Dia da semana de 'AAAA-MM-DD' sem depender do fuso de quem roda. */
export const diaDaSemana = (ymd: string): number => new Date(`${ymd}T12:00:00Z`).getUTCDay()

/** Distribui datas pelos posts escolhidos, na ordem da lista: um a cada N dias, ou só em certos
 *  dias da semana (ex.: seg, qua e sex). Hora vazia mantém a que cada post já tinha. */
export function distribuirDatas(itens: ItemLote[], ids: string[], d: Distribuicao): ItemLote[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.inicio)) return itens
  const alvos = itens.filter(i => !ids.length || ids.includes(i.id))
  const datas: string[] = []
  if (d.modo === 'dias') {
    const passo = Math.max(1, Math.floor(d.cadaDias || 1))
    for (let k = 0; k < alvos.length; k++) datas.push(somarDias(d.inicio, k * passo))
  } else {
    const dias = (d.diasDaSemana || []).filter(n => n >= 0 && n <= 6)
    if (!dias.length) return itens
    let dia = d.inicio
    for (let guarda = 0; datas.length < alvos.length && guarda < 3660; guarda++) {
      if (dias.includes(diaDaSemana(dia))) datas.push(dia)
      dia = somarDias(dia, 1)
    }
  }
  const porId = new Map(alvos.map((a, k) => [a.id, datas[k]]))
  return itens.map(i => (porId.has(i.id) ? { ...i, data: porId.get(i.id) || i.data, hora: d.hora || i.hora } : i))
}

/** Legendas coladas de uma vez (de um documento): separadas por uma linha só com "---". */
export function dividirLegendas(texto: string): string[] {
  return `\n${String(texto || '')}`
    .split(/\r?\n[ \t]*---+[ \t]*(?=\r?\n|$)/)
    .map(b => b.trim())
    .filter(Boolean)
}

/** Põe as legendas nos posts, na ordem da lista (Story fica de fora: não leva legenda). */
export function aplicarLegendas(itens: ItemLote[], legendas: string[], ids: string[] = []): { itens: ItemLote[]; usadas: number } {
  const alvos = itens.filter(i => i.formato !== 'story' && (!ids.length || ids.includes(i.id)))
  const porId = new Map(alvos.slice(0, legendas.length).map((a, k) => [a.id, legendas[k]]))
  return { itens: itens.map(i => (porId.has(i.id) ? { ...i, legenda: porId.get(i.id)! } : i)), usadas: porId.size }
}

export const contarHashtags = (legenda: string): number => (String(legenda || '').match(/(^|\s)#[^\s#]+/g) || []).length

/** 'AAAA-MM-DD' + 'HH:MM' no fuso de quem usa → ISO absoluto (o servidor roda em UTC). */
export function instanteDoItem(item: Pick<ItemLote, 'data' | 'hora'>): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.data) || !/^\d{2}:\d{2}$/.test(item.hora)) return ''
  const d = new Date(`${item.data}T${item.hora}`)
  return isNaN(d.getTime()) ? '' : d.toISOString()
}

export type ChaveFalta = 'midia' | 'enviando' | 'erro-envio' | 'story-uma-midia' | 'reel-video' | 'carrossel-limite'
  | 'legenda' | 'legenda-longa' | 'hashtags' | 'capa' | 'data' | 'data-passada' | 'colab'

export const TEXTO_FALTA: Record<ChaveFalta, string> = {
  midia: 'sem mídia',
  enviando: 'arquivo ainda subindo',
  'erro-envio': 'arquivo com erro: tire ou envie de novo',
  'story-uma-midia': 'Story leva uma mídia só',
  'reel-video': 'Reels precisa de um vídeo só',
  'carrossel-limite': `carrossel com mais de ${MAX_CARROSSEL} mídias`,
  legenda: 'falta a legenda',
  'legenda-longa': `legenda passa de ${MAX_LEGENDA} caracteres`,
  hashtags: `mais de ${MAX_HASHTAGS} hashtags`,
  capa: 'vídeo sem capa',
  data: 'falta dia e horário',
  'data-passada': 'horário já passou',
  colab: `mais de ${MAX_COLAB} colabs`,
}

/** O que impede o post de sair. Rascunho só exige a mídia pronta; agendar e enviar para
 *  aprovação seguem as mesmas exigências do "Novo post" (lib/composerPendencias). */
export function faltasDoItem(item: ItemLote, ctx: { acao: AcaoLote; temMeta: boolean; agora: number }): ChaveFalta[] {
  const out: ChaveFalta[] = []
  const story = item.formato === 'story'
  if (!item.midias.length) out.push('midia')
  if (item.midias.some(m => m.erro)) out.push('erro-envio')
  else if (item.midias.some(m => !m.url)) out.push('enviando')
  if (story && item.midias.length > 1) out.push('story-uma-midia')
  if (item.formato === 'reel' && !(item.midias.length === 1 && item.midias[0].tipo === 'video')) out.push('reel-video')
  if (item.midias.length > MAX_CARROSSEL) out.push('carrossel-limite')
  if (item.legenda.length > MAX_LEGENDA) out.push('legenda-longa')
  if (contarHashtags(item.legenda) > MAX_HASHTAGS) out.push('hashtags')
  if (item.colaboradores.length > MAX_COLAB) out.push('colab')
  if (ctx.acao === 'rascunho') return out
  if (ctx.temMeta && !story && !item.legenda.trim()) out.push('legenda')
  if (ctx.temMeta && !story && item.midias.some(m => m.tipo === 'video' && m.url && !m.capa)) out.push('capa')
  const quando = instanteDoItem(item)
  if (!quando) out.push('data')
  else if (new Date(quando).getTime() <= ctx.agora + 5 * 60 * 1000) out.push('data-passada')
  return out
}

/** Corpo do POST /api/posts — o mesmo que o painel monta no "Novo post" (dashboard criarPost). */
export function corpoDoPost(item: ItemLote, lote: Omit<Lote, 'itens'> & { clienteNome?: string }, acao: AcaoLote): Record<string, unknown> {
  const story = item.formato === 'story'
  const capas: Record<string, string> = {}
  for (const m of item.midias) if (m.tipo === 'video' && m.url && m.capa) capas[m.url] = m.capa
  return {
    clienteId: lote.clienteId,
    clienteNome: lote.clienteNome,
    ...(lote.marcoId ? { marcoId: lote.marcoId } : {}),
    ...(lote.subetapaId ? { subetapaId: lote.subetapaId } : {}),
    imagens: item.midias.map(m => m.url).filter(Boolean),
    legenda: story ? '' : item.legenda.trim(),
    dataAgendada: instanteDoItem(item),
    formato: item.midias.length > 1 ? 'feed' : item.formato,
    colaboradores: story ? [] : limparColaboradores(item.colaboradores),
    capasVideo: capas,
    redes: lote.redes,
    ...(lote.contaIds.length ? { contaIds: lote.contaIds } : {}),
    ...(acao === 'rascunho' ? { rascunhoInterno: true }
      : acao === 'agendar' ? { statusInicial: 'agendado' }
      : { statusInicial: 'aguardando_aprovacao', etapa: 'aprovacao_criativo' }),
  }
}

/** Rascunho do lote guardado no navegador: só o que já subiu (arquivo pela metade não volta). */
export function paraRascunho(lote: Lote): string {
  const itens = lote.itens
    .map(i => ({ ...i, midias: i.midias.filter(m => m.url && !m.erro).map(({ progresso, erro, ...m }) => m) }))
    .filter(i => i.midias.length)
  return JSON.stringify({ ...lote, itens })
}

export function deRascunho(json: string | null): Lote | null {
  if (!json) return null
  try {
    const l = JSON.parse(json)
    if (!l || !Array.isArray(l.itens)) return null
    return {
      clienteId: String(l.clienteId || ''), marcoId: String(l.marcoId || ''), subetapaId: String(l.subetapaId || ''),
      redes: Array.isArray(l.redes) ? l.redes.filter((r: string) => r === 'instagram' || r === 'facebook') : ['instagram', 'facebook'],
      contaIds: Array.isArray(l.contaIds) ? l.contaIds.filter((c: unknown) => typeof c === 'string') : [],
      itens: l.itens.filter((i: any) => i && i.id && Array.isArray(i.midias) && i.midias.length).map((i: any) => ({
        id: String(i.id), midias: i.midias.filter((m: any) => m && m.url), formato: ['feed', 'reel', 'story'].includes(i.formato) ? i.formato : 'feed',
        legenda: String(i.legenda || ''), data: String(i.data || ''), hora: String(i.hora || ''),
        colaboradores: limparColaboradores(i.colaboradores),
      })),
    }
  } catch {
    return null
  }
}

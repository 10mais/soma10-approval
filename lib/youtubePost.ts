// YOUTUBE — o que sobe, com que nome e quando (regras puras, sem rede).
//
// Dono, 27/09/2026: "quero fazer integração dos perfis dos clientes com youtube para postar
// vídeos e shorts. Inclusive, fazer programação de vídeos futuros (todos os formatos).
// Única coisa que não preciso de momento é fazer lives."
//
// O que o YouTube exige e o Instagram não:
//   • TÍTULO separado da legenda (até 100 caracteres, sem `<` nem `>`), porque no YouTube o
//     título é o que aparece na busca. O sistema usa a headline da pauta; sem ela, a primeira
//     linha da legenda; sem nada, o nome do cliente com a data;
//   • DESCRIÇÃO até 5.000 caracteres (a legenda inteira cabe);
//   • TAGS: o YouTube ignora hashtag dentro da descrição para efeito de busca, mas usa as
//     três primeiras acima do título — então as hashtags da legenda viram tags também;
//   • SHORT não é um endpoint diferente: é o MESMO upload. O vídeo vira Short quando é
//     vertical e curto (até 3 minutos). Por isso "publicar um Short" aqui é só uma conferência
//     do arquivo, não uma escolha de API — e é o que esta lib devolve para a tela avisar antes.
//
// AGENDAMENTO: o YouTube agenda sozinho. Subindo com `privacyStatus: 'private'` mais
// `publishAt`, ele publica na hora marcada mesmo que o nosso robô esteja dormindo. É mais
// seguro que segurar um arquivo de 500 MB para subir no minuto exato.
//
// LIVE fica de fora de propósito (pedido do dono): live é outro endpoint (liveBroadcasts),
// outro fluxo e outra cota.

export type FormatoYouTube = 'short' | 'video'

/** Limites do YouTube (Data API v3). */
export const LIMITE_TITULO = 100
export const LIMITE_DESCRICAO = 5000
export const LIMITE_TAGS_CHARS = 500
/** Short: vertical e até 3 minutos (regra do YouTube desde out/2024). */
export const SHORT_DURACAO_MAX_S = 180

export type MidiaVideo = { url: string; duracaoS?: number; largura?: number; altura?: number }

export type PostYouTube = {
  clienteNome?: string
  legenda?: string
  headline?: string
  dataAgendada?: string
  // Campos escritos na tela, quando a equipe quer mandar algo diferente da legenda.
  youtubeTitulo?: string
  youtubeDescricao?: string
  youtubeTags?: string[]
  youtubePlaylistId?: string
}

const limpar = (s?: string) => String(s || '').replace(/\s+/g, ' ').trim()

/** O YouTube recusa `<` e `>` no título e na descrição. */
export const semAngulares = (s: string) => s.replace(/[<>]/g, '')

/**
 * Título do vídeo. Ordem: o que a equipe escreveu → headline da pauta → primeira linha da
 * legenda → nome do cliente. Nunca volta vazio: vídeo sem título é recusado pela API.
 */
export function tituloDoPost(p: PostYouTube): string {
  const primeiraLinha = String(p.legenda || '').split('\n').map(l => l.trim()).find(Boolean) || ''
  const bruto = limpar(p.youtubeTitulo) || limpar(p.headline) || limpar(primeiraLinha) || limpar(p.clienteNome) || 'Vídeo'
  const t = semAngulares(bruto)
  return t.length <= LIMITE_TITULO ? t : `${t.slice(0, LIMITE_TITULO - 1).trimEnd()}…`
}

/** Descrição: o que a equipe escreveu ou a legenda inteira, cortada no limite do YouTube. */
export function descricaoDoPost(p: PostYouTube): string {
  const bruto = String(p.youtubeDescricao || p.legenda || '').trim()
  const d = semAngulares(bruto)
  return d.length <= LIMITE_DESCRICAO ? d : d.slice(0, LIMITE_DESCRICAO)
}

/** Hashtags da legenda viram tags (sem o #, sem repetir, respeitando o limite de 500 caracteres). */
export function tagsDoPost(p: PostYouTube): string[] {
  const daTela = (p.youtubeTags || []).map(t => limpar(t)).filter(Boolean)
  // Sem \p{L} de propósito: o tsconfig do projeto mira ES5 e a flag `u` não existe lá.
  // A classe cobre acento (à-ÿ), que é o que aparece em hashtag em português.
  const daLegenda = (String(p.legenda || '').match(/#[0-9A-Za-zÀ-ÿ_]{2,}/g) || []).map(h => h.slice(1))
  const out: string[] = []
  let total = 0
  for (const t of [...daTela, ...daLegenda]) {
    const tag = t.slice(0, 60)
    if (out.some(x => x.toLowerCase() === tag.toLowerCase())) continue
    if (total + tag.length + 1 > LIMITE_TAGS_CHARS) break
    out.push(tag)
    total += tag.length + 1
  }
  return out
}

/** Short ou vídeo longo — o arquivo é que decide (vertical e até 3 min = Short). */
export function formatoDaMidia(m?: MidiaVideo | null): FormatoYouTube {
  if (!m) return 'video'
  const vertical = !!(m.largura && m.altura && m.altura >= m.largura)
  const curto = typeof m.duracaoS === 'number' ? m.duracaoS <= SHORT_DURACAO_MAX_S : false
  return vertical && curto ? 'short' : 'video'
}

/**
 * Privacidade e agendamento. Data no futuro = sobe privado com `publishAt`, e o YouTube
 * publica sozinho na hora marcada. Sem data (ou data já passada) = público na hora.
 */
export function privacidadeDoPost(p: PostYouTube, agora = new Date()): { privacyStatus: 'public' | 'private'; publishAt?: string } {
  const t = p.dataAgendada ? new Date(p.dataAgendada).getTime() : NaN
  if (!isNaN(t) && t > agora.getTime()) return { privacyStatus: 'private', publishAt: new Date(t).toISOString() }
  return { privacyStatus: 'public' }
}

export type PendenciaYouTube = 'sem-video' | 'varios-videos' | 'video-muito-longo' | 'sem-titulo'

/**
 * O que falta para este post poder subir. A tela avisa ANTES de agendar — descobrir na hora
 * da publicação é descobrir tarde (o post fica em falha e ninguém vê até alguém abrir).
 */
export function pendenciasYouTube(p: PostYouTube, videos: MidiaVideo[]): PendenciaYouTube[] {
  const out: PendenciaYouTube[] = []
  if (!videos.length) out.push('sem-video')
  if (videos.length > 1) out.push('varios-videos')
  // 12 horas: teto do YouTube para conta verificada.
  if (videos.some(v => typeof v.duracaoS === 'number' && v.duracaoS > 12 * 3600)) out.push('video-muito-longo')
  if (!tituloDoPost(p)) out.push('sem-titulo')
  return out
}

/** Corpo do `videos.insert` (snippet + status), pronto para a chamada. */
export function corpoDoUpload(p: PostYouTube, agora = new Date()) {
  return {
    snippet: {
      title: tituloDoPost(p),
      description: descricaoDoPost(p),
      tags: tagsDoPost(p),
      categoryId: '22', // People & Blogs — categoria neutra; o cliente muda no Studio dele se quiser
    },
    status: {
      ...privacidadeDoPost(p, agora),
      selfDeclaredMadeForKids: false,
    },
  }
}

/** Link público do vídeo (Short tem URL própria, e é assim que o cliente espera receber). */
export function linkDoVideo(videoId: string, formato: FormatoYouTube = 'video'): string {
  return formato === 'short' ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`
}

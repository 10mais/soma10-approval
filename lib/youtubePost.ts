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

export type VisibilidadeYouTube = 'public' | 'unlisted' | 'private'

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
  // Configurações próprias do YouTube (dono, 27/09: "quando marcar youtube precisa aparecer
  // as configurações exatas para youtube"). Todas opcionais: ausente = comportamento antigo.
  youtubeFormato?: FormatoYouTube          // o que a equipe DISSE que é; o arquivo confirma
  youtubeVisibilidade?: VisibilidadeYouTube // padrão: público
  youtubePublicarEm?: string               // data própria no YouTube; vazio = a do post
  youtubeCategoria?: string                // id de categoria da Data API; padrão '22'
  youtubeInfantil?: boolean                // "conteúdo para crianças" — o YouTube exige a declaração
  youtubeMiniatura?: boolean               // usar a capa do vídeo como miniatura (padrão: sim, se houver capa)
}

/** Categorias válidas no Brasil (videoCategories da Data API, região BR). */
export const CATEGORIAS_YOUTUBE: { id: string; nome: string }[] = [
  { id: '22', nome: 'Pessoas e blogs' },
  { id: '27', nome: 'Educação' },
  { id: '26', nome: 'Guias e estilo' },
  { id: '24', nome: 'Entretenimento' },
  { id: '28', nome: 'Ciência e tecnologia' },
  { id: '25', nome: 'Notícias e política' },
  { id: '17', nome: 'Esportes' },
  { id: '19', nome: 'Viagens e eventos' },
  { id: '10', nome: 'Música' },
  { id: '23', nome: 'Comédia' },
  { id: '1', nome: 'Filmes e animação' },
  { id: '2', nome: 'Autos e veículos' },
  { id: '15', nome: 'Animais' },
  { id: '20', nome: 'Jogos' },
  { id: '29', nome: 'ONGs e ativismo' },
]
export const CATEGORIA_PADRAO = '22'
const categoriaValida = (id?: string) => (id && CATEGORIAS_YOUTUBE.some(c => c.id === id) ? id : CATEGORIA_PADRAO)

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
  // Hashtags do texto que vai de fato para o YouTube: a descrição própria, senão a legenda.
  const daLegenda = (String(p.youtubeDescricao || p.legenda || '').match(/#[0-9A-Za-zÀ-ÿ_]{2,}/g) || []).map(h => h.slice(1))
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
 * O que a equipe marcou (Short/Vídeo) bate com o arquivo? O YouTube não tem "botão de Short":
 * vertical e até 3 minutos vira Short, o resto vira vídeo. Então a escolha na tela é uma
 * INTENÇÃO, e isto avisa quando o arquivo vai contrariá-la. Sem medida do arquivo, não acusa.
 */
export type AvisoFormatoYouTube = 'short-horizontal' | 'short-longo' | 'video-vai-virar-short'
export function conferirFormato(escolhido: FormatoYouTube | undefined, m?: MidiaVideo | null): AvisoFormatoYouTube | null {
  if (!m || !escolhido) return null
  const medidas = !!(m.largura && m.altura)
  if (escolhido === 'short') {
    if (medidas && m.largura! > m.altura!) return 'short-horizontal'
    if (typeof m.duracaoS === 'number' && m.duracaoS > SHORT_DURACAO_MAX_S) return 'short-longo'
    return null
  }
  return formatoDaMidia(m) === 'short' ? 'video-vai-virar-short' : null
}

/** Quando o vídeo vai ao ar no YouTube: a data própria dele, ou a do post. */
export function dataNoYouTube(p: PostYouTube): string | undefined {
  return p.youtubePublicarEm || p.dataAgendada || undefined
}

/**
 * Privacidade e agendamento. Data no futuro = sobe privado com `publishAt`, e o YouTube
 * publica sozinho na hora marcada. Sem data (ou data já passada) = na hora.
 *
 * O YouTube só agenda vídeo PÚBLICO (publishAt vira o vídeo de privado para público). Não
 * listado ou privado sobem assim mesmo e ignoram a data — a tela avisa antes.
 */
export function privacidadeDoPost(p: PostYouTube, agora = new Date()): { privacyStatus: VisibilidadeYouTube; publishAt?: string } {
  const vis = p.youtubeVisibilidade || 'public'
  if (vis !== 'public') return { privacyStatus: vis }
  const d = dataNoYouTube(p)
  const t = d ? new Date(d).getTime() : NaN
  if (!isNaN(t) && t > agora.getTime()) return { privacyStatus: 'private', publishAt: new Date(t).toISOString() }
  return { privacyStatus: 'public' }
}

/**
 * Data própria do YouTube que não faz sentido: no passado, ou ANTES do post ir ao ar (o
 * vídeo só sobe quando o post publica — se a data do YouTube já passou nessa hora, ele sai
 * público na mesma hora, e a data escolhida foi ignorada sem ninguém saber).
 */
export type AvisoAgendaYouTube = 'yt-agenda-passada' | 'yt-agenda-antes-do-post'
export function conferirAgendaYouTube(publicarEm: string | undefined, dataPost: string | undefined, agora = new Date()): AvisoAgendaYouTube | null {
  if (!publicarEm) return null
  const t = new Date(publicarEm).getTime()
  if (isNaN(t)) return null
  if (t <= agora.getTime()) return 'yt-agenda-passada'
  const tp = dataPost ? new Date(dataPost).getTime() : NaN
  if (!isNaN(tp) && t < tp) return 'yt-agenda-antes-do-post'
  return null
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
      // Padrão People & Blogs — categoria neutra, quando a equipe não escolhe outra.
      categoryId: categoriaValida(p.youtubeCategoria),
    },
    status: {
      ...privacidadeDoPost(p, agora),
      selfDeclaredMadeForKids: !!p.youtubeInfantil,
    },
  }
}

/**
 * Campos do YouTube que chegam da tela, limpos (a API de posts grava só o que sai daqui).
 * Só entra no resultado o que veio no corpo — assim um PUT parcial (arrastar data no
 * calendário) não apaga a configuração do YouTube. String vazia = "voltar ao padrão".
 */
export function configYouTubeDoCorpo(b: any): Partial<PostYouTube> {
  const out: Partial<PostYouTube> = {}
  if (!b || typeof b !== 'object') return out
  const txt = (v: any, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)
  if ('youtubeTitulo' in b) out.youtubeTitulo = txt(b.youtubeTitulo, LIMITE_TITULO) || undefined
  if ('youtubeDescricao' in b) out.youtubeDescricao = txt(b.youtubeDescricao, LIMITE_DESCRICAO) || undefined
  if ('youtubeTags' in b) {
    const tags = Array.isArray(b.youtubeTags) ? b.youtubeTags.map((t: any) => String(t || '').replace(/^#/, '').trim()).filter(Boolean).slice(0, 30) : []
    out.youtubeTags = tags.length ? tags : undefined
  }
  if ('youtubeFormato' in b) out.youtubeFormato = b.youtubeFormato === 'short' || b.youtubeFormato === 'video' ? b.youtubeFormato : undefined
  if ('youtubeVisibilidade' in b) out.youtubeVisibilidade = ['public', 'unlisted', 'private'].includes(b.youtubeVisibilidade) ? b.youtubeVisibilidade : undefined
  if ('youtubePublicarEm' in b) {
    const t = typeof b.youtubePublicarEm === 'string' && b.youtubePublicarEm ? new Date(b.youtubePublicarEm).getTime() : NaN
    out.youtubePublicarEm = isNaN(t) ? undefined : new Date(t).toISOString()
  }
  if ('youtubeCategoria' in b) out.youtubeCategoria = CATEGORIAS_YOUTUBE.some(c => c.id === String(b.youtubeCategoria)) ? String(b.youtubeCategoria) : undefined
  if ('youtubeInfantil' in b) out.youtubeInfantil = b.youtubeInfantil === true ? true : undefined
  if ('youtubeMiniatura' in b) out.youtubeMiniatura = b.youtubeMiniatura === false ? false : undefined
  return out
}

/** Campos do YouTube de um post, para reabrir o compositor na edição sem perdê-los. */
const CAMPOS_YOUTUBE = ['youtubeTitulo', 'youtubeDescricao', 'youtubeTags', 'youtubeFormato', 'youtubeVisibilidade', 'youtubePublicarEm', 'youtubeCategoria', 'youtubeInfantil', 'youtubeMiniatura'] as const
export function camposYouTube(post: any): Partial<PostYouTube> {
  const out: any = {}
  for (const k of CAMPOS_YOUTUBE) if (post && post[k] !== undefined && post[k] !== null) out[k] = post[k]
  return out
}

/** Link público do vídeo (Short tem URL própria, e é assim que o cliente espera receber). */
export function linkDoVideo(videoId: string, formato: FormatoYouTube = 'video'): string {
  return formato === 'short' ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`
}

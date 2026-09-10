// TIPO DE UM ANEXO — imagem, vídeo ou arquivo.
//
// Dono, 10/09/2026: "o sistema está travando quando clica numa tarefa, fica em transparência
// e trava tudo". A causa era `anexo.tipo.startsWith('image')` num anexo gravado SEM `tipo`:
// TypeError no meio do render, o React derruba a árvore do modal (que vai por portal para o
// body) e sobra o fundo escurecido, sem painel e sem saída.
//
// Por isso a pergunta "isto é imagem?" passa a ser uma função que NUNCA lança: usa o `tipo`
// quando ele existe e cai na extensão da URL quando não existe — anexo antigo com .png
// volta a ser tratado como imagem, em vez de virar arquivo genérico.

export type AnexoLeve = { nome?: string; url?: string; tipo?: string }

const RE_IMAGEM = /\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?|#|$)/i
const RE_VIDEO = /\.(mp4|mov|m4v|webm|avi|mkv)(\?|#|$)/i

const tipoDe = (a?: AnexoLeve | null): string => (typeof a?.tipo === 'string' ? a.tipo.toLowerCase() : '')
const urlDe = (a?: AnexoLeve | null): string => (typeof a?.url === 'string' ? a.url : '')

export function ehImagem(a?: AnexoLeve | null): boolean {
  const t = tipoDe(a)
  if (t) return t.startsWith('image')
  return RE_IMAGEM.test(urlDe(a))
}

export function ehVideo(a?: AnexoLeve | null): boolean {
  const t = tipoDe(a)
  if (t) return t.startsWith('video')
  return RE_VIDEO.test(urlDe(a))
}

/** Imagem ou vídeo: o que pode virar mídia de uma pauta ou aparecer numa galeria. */
export function ehMidia(a?: AnexoLeve | null): boolean {
  return ehImagem(a) || ehVideo(a)
}

/** Rótulo curto para quem não é imagem nem vídeo (PDF, documento, áudio, planilha). */
export function rotuloArquivo(a?: AnexoLeve | null): string {
  const t = tipoDe(a)
  if (t.includes('pdf')) return 'PDF'
  if (t.startsWith('audio')) return 'Áudio'
  if (t.includes('sheet') || t.includes('excel') || t.includes('csv')) return 'Planilha'
  if (t.includes('word') || t.includes('document')) return 'Documento'
  const nome = typeof a?.nome === 'string' ? a.nome : ''
  const ext = (nome.split('.').pop() || '').toUpperCase()
  return ext && ext.length <= 5 ? ext : 'Arquivo'
}

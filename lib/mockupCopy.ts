// PRÉVIA DA ARTE na aprovação da COPY — o texto disposto como vai ficar na peça.
//
// Dono, 30/09/2026 (print do link de aprovação das copies): "A Copy de um, aparece em outro. O
// visual também não está ok. A 'copy (texto na imagem)' precisa retratar a dimensão exata da
// headline (maior), subheadline (secundária) e demais textos na tela. Como se fosse um mockup.
// Quase que um criativo final, porém com versão de amostra de disposição de espaços."
//
// A CAUSA do "aparece em outro": o link mostrava TODOS os campos de copy do post, mas o Studio
// mostra só os do formato (pedido do dono, 23/07). No carrossel, sub-headline e texto da arte
// ficam ESCONDIDOS no Studio — mas continuam gravados quando vêm do "Gerar copy" (que preenche
// tudo) ou de quando a pauta era Feed. O link exibia esse texto escondido e depois as lâminas:
// texto de lâminas diferentes repetido e fora de ordem. Aqui vale a MESMA regra do Studio.
//
// Regra por formato (espelho de app/components/StudioMes, "Formulário personalizado por formato"):
//   feed / story: headline, sub-headline, texto da arte, CTA — um quadro (4:5 / 9:16);
//   reel:        headline = abertura, sub-headline = gancho, CTA na tela (9:16); o texto da arte
//                é o ROTEIRO do vídeo, que não vai escrito na tela — sai à parte;
//   carrossel:   headline = capa, uma LÂMINA por quadro (4:5), CTA na última;
//   grafico:     só o texto da arte (todas as informações), proporção pelas medidas.
// Linha inteira entre parênteses é instrução para o designer ("(colocar uma seta…)"): aparece
// como nota de produção, não como texto da arte.

export type LinhaQuadro = { tipo: 'destaque' | 'corpo' | 'nota'; texto: string }

export type Quadro = {
  lamina?: number        // carrossel: 1 = capa, 2… (a tela traduz o rótulo)
  titulo?: string        // headline — o maior texto
  subtitulo?: string     // sub-headline / gancho — o secundário
  linhas: LinhaQuadro[]  // demais textos da arte (e notas de produção)
  cta?: string           // chamada — vira botão
}

export type PreviaCopy = {
  formato: string
  proporcao: string      // valor de CSS aspect-ratio ("4 / 5")
  quadros: Quadro[]
  roteiro?: string       // reel: o desenvolvimento do vídeo (fora da tela)
}

export type CopyDoPost = {
  formato?: string
  headline?: string
  subheadline?: string
  textoImagem?: string
  cta?: string
  laminas?: { texto?: string }[]
  medidas?: string
}

/** Campos que a equipe preenche no Studio para cada formato (os mesmos que o cliente pode editar). */
export type CampoCopy = 'headline' | 'subheadline' | 'textoImagem' | 'cta' | 'laminas'
export function camposDoFormato(formato?: string): CampoCopy[] {
  switch (normalizarFormato(formato)) {
    case 'carrossel': return ['headline', 'laminas', 'cta']
    case 'grafico': return ['textoImagem']
    default: return ['headline', 'subheadline', 'textoImagem', 'cta'] // feed, story, reel
  }
}

export function normalizarFormato(formato?: string): string {
  const f = String(formato || '').trim().toLowerCase()
  return f || 'feed'
}

const limpo = (s?: string) => String(s || '').trim()
const ehNota = (linha: string) => /^\(.*\)$/.test(linha.trim())

/**
 * Texto livre → linhas do quadro. Nota entre parênteses vira nota de produção. Com
 * `primeiraDestaque`, a primeira linha de texto vira o destaque (título da lâmina).
 */
export function linhasDoTexto(texto?: string, primeiraDestaque = false): LinhaQuadro[] {
  const out: LinhaQuadro[] = []
  let destaqueUsado = !primeiraDestaque
  for (const bruta of String(texto || '').replace(/\r\n/g, '\n').split('\n')) {
    const l = bruta.trim()
    if (!l) continue
    if (ehNota(l)) { out.push({ tipo: 'nota', texto: l.slice(1, -1).trim() }); continue }
    if (!destaqueUsado) { out.push({ tipo: 'destaque', texto: l }); destaqueUsado = true; continue }
    out.push({ tipo: 'corpo', texto: l })
  }
  return out
}

/** Proporção do quadro. Material gráfico usa as medidas quando dão ("90x50cm" → 90 / 50). */
export function proporcaoDoFormato(formato?: string, medidas?: string): string {
  const f = normalizarFormato(formato)
  if (f === 'story' || f === 'reel') return '9 / 16'
  if (f === 'grafico') {
    const m = String(medidas || '').replace(/,/g, '.').match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i)
    if (m && Number(m[1]) > 0 && Number(m[2]) > 0) return `${Number(m[1])} / ${Number(m[2])}`
    return '1 / 1.414' // A4 em pé
  }
  return '4 / 5'
}

/** A prévia inteira da copy de um post, só com o que o formato usa. */
export function previaDaCopy(p: CopyDoPost): PreviaCopy {
  const formato = normalizarFormato(p.formato)
  const proporcao = proporcaoDoFormato(formato, p.medidas)
  const titulo = limpo(p.headline) || undefined
  const cta = limpo(p.cta) || undefined

  if (formato === 'carrossel') {
    const laminas = (p.laminas || []).map(l => limpo(l?.texto)).filter(Boolean)
    // Carrossel sem lâmina escrita: a capa com o que houver (nada some da tela).
    if (!laminas.length) return { formato, proporcao, quadros: [{ lamina: 1, titulo, linhas: [], cta }] }
    const quadros: Quadro[] = laminas.map((texto, i) => {
      const capa = i === 0
      let linhas = linhasDoTexto(texto, true)
      if (!capa) return { lamina: i + 1, linhas }
      // CAPA: o título é a headline; sem headline, a primeira frase da lâmina 1 faz esse papel
      // (com tamanho de título, não de destaque). Lâmina que só repete a headline não duplica.
      let tituloCapa = titulo
      if (tituloCapa) linhas = linhas.filter(l => l.texto !== tituloCapa).map(l => l.tipo === 'destaque' ? { ...l, tipo: 'corpo' as const } : l)
      else {
        const i0 = linhas.findIndex(l => l.tipo === 'destaque')
        if (i0 >= 0) { tituloCapa = linhas[i0].texto; linhas = linhas.filter((_, j) => j !== i0) }
      }
      return { lamina: 1, ...(tituloCapa ? { titulo: tituloCapa } : {}), linhas }
    })
    if (cta) quadros[quadros.length - 1].cta = cta
    return { formato, proporcao, quadros }
  }

  if (formato === 'grafico') {
    return { formato, proporcao, quadros: [{ linhas: linhasDoTexto(p.textoImagem, true) }] }
  }

  const subtitulo = limpo(p.subheadline) || undefined
  if (formato === 'reel') {
    return { formato, proporcao, quadros: [{ titulo, subtitulo, linhas: [], cta }], ...(limpo(p.textoImagem) ? { roteiro: limpo(p.textoImagem) } : {}) }
  }
  // feed, story (e formato desconhecido, tratado como feed)
  return { formato, proporcao, quadros: [{ titulo, subtitulo, linhas: linhasDoTexto(p.textoImagem), cta }] }
}

/**
 * Letra da prévia por quantidade de texto: arte com muito texto encolhe a fonte (como o
 * designer faria), para caber no quadro sem cortar nada. 1 = tamanho cheio.
 */
export function escalaDoQuadro(q: Quadro): number {
  const total = (q.titulo || '').length * 2 + (q.subtitulo || '').length + q.linhas.reduce((s, l) => s + l.texto.length, 0) + (q.cta || '').length
  if (total > 520) return 0.62
  if (total > 360) return 0.72
  if (total > 220) return 0.84
  return 1
}

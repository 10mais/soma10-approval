// Mapa mental -> SVG standalone (string). Puro: mesma entrada, mesma saída.
//
// A tela desenha o mapa com <div>s posicionados por cima de um <svg> de linhas —
// serializar isso do DOM é frágil (html2canvas, fontes, escala do pan/zoom). Em
// vez disso, redesenhamos o mapa a partir dos DADOS: um SVG que qualquer
// navegador abre, e que o gerador de PNG/PDF rasteriza. O que o cliente recebe
// não depende de como a tela estava no momento do export.
//
// Fidelidade ao editor (MapasMentais.tsx): nó raiz (sem pai) é escuro com texto
// branco; filhos são "pills" brancas com um ponto colorido; ligações no amarelo
// da marca — curva no layout mapa, cotovelo no organograma.

export type NoMapa = { id: string; texto: string; x: number; y: number; cor?: string; colapsado?: boolean }
export type ConexaoMapa = { id: string; de: string; para: string }
export type MapaParaSvg = { titulo?: string; nos: NoMapa[]; conexoes: ConexaoMapa[]; layout?: 'mapa' | 'organograma' | 'lista' }

const LARG = 170
const LARG_RAIZ = 192 // LARG + 22 (padding maior do nó raiz)
const COR_LIGACAO = '#ffc00f'
const COR_PADRAO = '#ffc00f'
const PAD = 48 // margem em volta do desenho
const CHAR_W = 6.6 // largura média de caractere px (fonte ~12.5)
const LINE_H = 17
const PAD_V = 16 // padding vertical dentro do nó

function escapar(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Quebra o texto em linhas que cabem na largura do nó (aproximação por contagem
// de caracteres — sem medir fonte, que não existe fora do navegador).
export function quebrarTexto(texto: string, largura: number): string[] {
  const max = Math.max(1, Math.floor((largura - 28) / CHAR_W))
  const linhas: string[] = []
  for (const paragrafo of (texto || '').split('\n')) {
    if (paragrafo === '') { linhas.push(''); continue }
    let atual = ''
    for (const palavra of paragrafo.split(/\s+/)) {
      if (!atual) { atual = palavra }
      else if ((atual + ' ' + palavra).length <= max) { atual += ' ' + palavra }
      else { linhas.push(atual); atual = palavra }
      // palavra sozinha maior que a linha: corta no limite
      while (atual.length > max) { linhas.push(atual.slice(0, max)); atual = atual.slice(max) }
    }
    linhas.push(atual)
  }
  return linhas.length ? linhas : ['']
}

function alturaNo(linhas: string[]): number {
  return Math.max(46, linhas.length * LINE_H + PAD_V)
}

// Dimensões e caixa de cada nó, mais a viewBox total do desenho.
function medir(mapa: MapaParaSvg) {
  const temPai = (id: string) => mapa.conexoes.some(c => c.para === id)
  const caixas = mapa.nos.map(n => {
    const raiz = !temPai(n.id)
    const largura = raiz ? LARG_RAIZ : LARG
    const linhas = quebrarTexto(n.texto || (raiz ? 'Ideia central' : 'Ideia'), largura)
    const altura = alturaNo(linhas)
    return { no: n, raiz, largura, altura, linhas }
  })
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const c of caixas) {
    minX = Math.min(minX, c.no.x); minY = Math.min(minY, c.no.y)
    maxX = Math.max(maxX, c.no.x + c.largura); maxY = Math.max(maxY, c.no.y + c.altura)
  }
  if (!caixas.length) { minX = 0; minY = 0; maxX = 400; maxY = 300 }
  return { caixas, minX, minY, maxX, maxY }
}

function centro(caixa: { no: NoMapa; largura: number; altura: number }) {
  return { x: caixa.no.x + caixa.largura / 2, y: caixa.no.y + caixa.altura / 2 }
}

// SVG completo, pronto para abrir no navegador ou rasterizar.
export function mapaParaSvg(mapa: MapaParaSvg): string {
  const layout = mapa.layout || 'mapa'
  const { caixas, minX, minY, maxX, maxY } = medir(mapa)
  const porId = new Map(caixas.map(c => [c.no.id, c]))
  const tituloAltura = mapa.titulo?.trim() ? 40 : 0

  const w = (maxX - minX) + PAD * 2
  const h = (maxY - minY) + PAD * 2 + tituloAltura
  // Translada tudo para dentro da margem; o título ocupa o topo.
  const ox = PAD - minX
  const oy = PAD - minY + tituloAltura

  const partes: string[] = []
  partes.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}" viewBox="0 0 ${Math.round(w)} ${Math.round(h)}" font-family="Arial, Helvetica, sans-serif">`)
  partes.push(`<rect x="0" y="0" width="${Math.round(w)}" height="${Math.round(h)}" fill="#ffffff"/>`)

  if (tituloAltura) {
    partes.push(`<text x="${PAD}" y="30" font-size="18" font-weight="700" fill="#111">${escapar(mapa.titulo!.trim())}</text>`)
  }

  // Conexões primeiro (ficam atrás dos nós). Layout 'lista' não desenha linhas.
  if (layout !== 'lista') {
    for (const c of mapa.conexoes) {
      const a = porId.get(c.de), b = porId.get(c.para)
      if (!a || !b) continue
      let d: string
      if (layout === 'organograma') {
        const p1 = { x: a.no.x + a.largura / 2 + ox, y: a.no.y + a.altura + oy }
        const p2 = { x: b.no.x + b.largura / 2 + ox, y: b.no.y + oy }
        const midY = (p1.y + p2.y) / 2
        d = `M ${p1.x} ${p1.y} L ${p1.x} ${midY} L ${p2.x} ${midY} L ${p2.x} ${p2.y}`
      } else {
        const p1 = centro(a), p2 = centro(b)
        const x1 = p1.x + ox, y1 = p1.y + oy, x2 = p2.x + ox, y2 = p2.y + oy
        const dx = Math.abs(x2 - x1) / 2 + 20
        d = `M ${x1} ${y1} C ${x1 + (x2 > x1 ? dx : -dx)} ${y1}, ${x2 + (x2 > x1 ? -dx : dx)} ${y2}, ${x2} ${y2}`
      }
      partes.push(`<path d="${d}" stroke="${COR_LIGACAO}" stroke-width="2.75" fill="none" stroke-linecap="round"/>`)
    }
  }

  // Nós
  for (const c of caixas) {
    const x = c.no.x + ox, y = c.no.y + oy
    if (c.raiz) {
      partes.push(`<rect x="${x}" y="${y}" width="${c.largura}" height="${c.altura}" rx="22" fill="#1f2937"/>`)
    } else {
      partes.push(`<rect x="${x}" y="${y}" width="${c.largura}" height="${c.altura}" rx="22" fill="#ffffff" stroke="#ececf0" stroke-width="1"/>`)
      partes.push(`<circle cx="${x + 16}" cy="${y + c.altura / 2}" r="5" fill="${c.no.cor || COR_PADRAO}"/>`)
    }
    const corTexto = c.raiz ? '#ffffff' : '#222222'
    const peso = c.raiz ? '700' : '400'
    const txtX = c.raiz ? x + 18 : x + 28
    const totalTexto = c.linhas.length * LINE_H
    let ty = y + (c.altura - totalTexto) / 2 + LINE_H - 4
    for (const linha of c.linhas) {
      if (linha) partes.push(`<text x="${txtX}" y="${ty}" font-size="12.5" font-weight="${peso}" fill="${corTexto}">${escapar(linha)}</text>`)
      ty += LINE_H
    }
  }

  partes.push('</svg>')
  return partes.join('\n')
}

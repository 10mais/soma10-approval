import { describe, it, expect } from 'vitest'
import { mapaParaSvg, quebrarTexto, type MapaParaSvg } from '@/lib/mapaSvg'

const base: MapaParaSvg = {
  titulo: 'Estratégia Q3',
  nos: [
    { id: 'r', texto: 'Ideia central', x: 300, y: 200 },
    { id: 'a', texto: 'Conteúdo', x: 520, y: 140, cor: '#7c3aed' },
    { id: 'b', texto: 'Tráfego', x: 520, y: 260, cor: '#1d4ed8' },
  ],
  conexoes: [
    { id: 'c1', de: 'r', para: 'a' },
    { id: 'c2', de: 'r', para: 'b' },
  ],
}

describe('quebrarTexto', () => {
  it('mantém texto curto em uma linha', () => {
    expect(quebrarTexto('Oi', 170)).toEqual(['Oi'])
  })
  it('quebra em várias linhas quando não cabe', () => {
    const r = quebrarTexto('palavra '.repeat(20).trim(), 170)
    expect(r.length).toBeGreaterThan(1)
  })
  it('preserva quebras de linha manuais', () => {
    expect(quebrarTexto('a\nb', 170)).toEqual(['a', 'b'])
  })
  it('corta palavra única gigante em vez de estourar', () => {
    const r = quebrarTexto('x'.repeat(100), 170)
    expect(r.length).toBeGreaterThan(1)
    expect(r.every(l => l.length <= 30)).toBe(true)
  })
  it('string vazia devolve uma linha vazia, não quebra', () => {
    expect(quebrarTexto('', 170)).toEqual([''])
  })
})

describe('mapaParaSvg', () => {
  it('gera um SVG bem formado com namespace e dimensões', () => {
    const svg = mapaParaSvg(base)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.trim().endsWith('</svg>')).toBe(true)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toMatch(/width="\d+" height="\d+"/)
  })

  it('desenha o título quando há', () => {
    expect(mapaParaSvg(base)).toContain('Estratégia Q3')
  })

  it('sem título não gera <text> de título nem reserva espaço no topo', () => {
    const svg = mapaParaSvg({ ...base, titulo: '' })
    expect(svg).not.toContain('Estratégia')
  })

  it('desenha uma linha (path) por conexão', () => {
    const paths = mapaParaSvg(base).match(/<path /g) || []
    expect(paths.length).toBe(2)
  })

  it('conexão para nó inexistente é ignorada, não quebra', () => {
    const svg = mapaParaSvg({ ...base, conexoes: [...base.conexoes, { id: 'x', de: 'r', para: 'fantasma' }] })
    expect((svg.match(/<path /g) || []).length).toBe(2) // ainda 2, a órfã não conta
  })

  it('layout lista NÃO desenha conexões', () => {
    const svg = mapaParaSvg({ ...base, layout: 'lista' })
    expect((svg.match(/<path /g) || []).length).toBe(0)
  })

  it('organograma usa cotovelo (L), não curva (C)', () => {
    const svg = mapaParaSvg({ ...base, layout: 'organograma' })
    expect(svg).toContain(' L ')
    expect(svg).not.toMatch(/ C /)
  })

  it('mapa usa curva (C)', () => {
    expect(mapaParaSvg({ ...base, layout: 'mapa' })).toMatch(/ C /)
  })

  it('nó raiz (sem pai) é escuro; filhos têm ponto colorido', () => {
    const svg = mapaParaSvg(base)
    expect(svg).toContain('fill="#1f2937"') // raiz escura
    expect(svg).toContain('fill="#7c3aed"') // ponto do nó Conteúdo
    expect(svg).toContain('fill="#1d4ed8"') // ponto do nó Tráfego
  })

  it('ESCAPA caracteres perigosos no texto — sem isso o SVG quebra ou injeta', () => {
    const svg = mapaParaSvg({ nos: [{ id: 'r', texto: 'A & B <script>', x: 0, y: 0 }], conexoes: [] })
    expect(svg).toContain('A &amp; B &lt;script&gt;')
    expect(svg).not.toContain('<script>')
  })

  it('mapa vazio não quebra', () => {
    const svg = mapaParaSvg({ nos: [], conexoes: [] })
    expect(svg.startsWith('<svg')).toBe(true)
  })

  it('a viewBox cresce com o conteúdo (mapa maior = SVG maior)', () => {
    const p = (m: MapaParaSvg) => Number(mapaParaSvg(m).match(/width="(\d+)"/)![1])
    const pequeno = p({ nos: [{ id: 'a', texto: 'x', x: 0, y: 0 }], conexoes: [] })
    const grande = p({ nos: [{ id: 'a', texto: 'x', x: 0, y: 0 }, { id: 'b', texto: 'y', x: 1200, y: 0 }], conexoes: [] })
    expect(grande).toBeGreaterThan(pequeno)
  })
})

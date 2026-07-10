import { describe, it, expect } from 'vitest'
import { extrairHtml, sanitizarHtmlCriativo, aplicarTokens, injetarFontes, montarHtmlFinal, guiaDesign, CANVAS } from '@/lib/designCriativo'

// Pós-processamento do HTML do motor novo (Claude desenha). Guarda contra:
// HTML perdido na extração, script/URL externa passando batido e token órfão
// virando imagem quebrada no criativo final.

const HTML_MIN = '<!doctype html><html><head><style>body{margin:0}</style></head><body><img src="{{LOGO}}"/></body></html>'

describe('extrairHtml', () => {
  it('extrai HTML puro', () => {
    expect(extrairHtml(HTML_MIN)).toContain('<body>')
  })
  it('tolera cercas de markdown e texto em volta', () => {
    const resposta = 'Aqui está:\n```html\n' + HTML_MIN + '\n```\nEspero que goste!'
    const html = extrairHtml(resposta)
    expect(html).toBeTruthy()
    expect(html!).toContain('<!doctype html')
    expect(html!).not.toContain('```')
  })
  it('devolve null quando não há HTML', () => {
    expect(extrairHtml('não consegui gerar')).toBeNull()
  })
})

describe('sanitizarHtmlCriativo', () => {
  it('remove <script> e handlers on*', () => {
    const sujo = '<html><body onload="hack()"><script>alert(1)</script><p>ok</p></body></html>'
    const limpo = sanitizarHtmlCriativo(sujo)
    expect(limpo).not.toContain('<script')
    expect(limpo).not.toContain('onload')
    expect(limpo).toContain('<p>ok</p>')
  })
  it('neutraliza URLs http(s) em src e url(), preservando data: e tokens', () => {
    const sujo = '<img src="https://evil.com/x.png"/><div style="background:url(http://evil.com/b.jpg)"></div><img src="{{LOGO}}"/><img src="data:image/png;base64,AAA"/>'
    const limpo = sanitizarHtmlCriativo(sujo)
    expect(limpo).not.toContain('evil.com')
    expect(limpo).toContain('{{LOGO}}')
    expect(limpo).toContain('data:image/png;base64,AAA')
  })
})

describe('aplicarTokens', () => {
  it('substitui tokens conhecidos e neutraliza órfãos', () => {
    const html = '<img src="{{LOGO}}"/><img src="{{FUNDO}}"/><img src="{{INVENTADO}}"/>'
    const out = aplicarTokens(html, { LOGO: 'data:image/png;base64,LOGO123' })
    expect(out).toContain('data:image/png;base64,LOGO123')
    expect(out).not.toContain('{{LOGO}}')
    expect(out).not.toContain('{{FUNDO}}')
    expect(out).not.toContain('{{INVENTADO}}')
    // órfãos viram pixel transparente (nunca imagem quebrada)
    expect(out.match(/data:image\/png;base64,iVBOR/g)?.length).toBe(2)
  })
})

describe('injetarFontes', () => {
  it('injeta @font-face no head com as famílias da marca', () => {
    const out = injetarFontes(HTML_MIN, [
      { familia: 'TituloMarca', dataUri: 'data:font/ttf;base64,AAA', peso: 700 },
      { familia: 'TextoMarca', dataUri: 'data:font/ttf;base64,BBB', peso: 400, italico: true },
    ])
    expect(out).toContain("font-family:'TituloMarca'")
    expect(out).toContain("font-family:'TextoMarca'")
    expect(out).toContain('font-style:italic')
    expect(out.indexOf('@font-face')).toBeLessThan(out.indexOf('<body>'))
  })
  it('sem fontes, devolve o HTML intacto', () => {
    expect(injetarFontes(HTML_MIN, [])).toBe(HTML_MIN)
  })
})

describe('montarHtmlFinal', () => {
  it('pipeline completo: sanitiza + tokens + fontes', () => {
    const bruto = '<!doctype html><html><head></head><body><script>x</script><img src="{{LOGO}}"/></body></html>'
    const out = montarHtmlFinal(bruto, {
      tokens: { LOGO: 'data:image/png;base64,L' },
      fontes: [{ familia: 'TituloMarca', dataUri: 'data:font/ttf;base64,T', peso: 700 }],
    })
    expect(out).not.toContain('<script')
    expect(out).toContain('data:image/png;base64,L')
    expect(out).toContain('@font-face')
  })
})

describe('guiaDesign / CANVAS', () => {
  it('canvas é o feed 4:5 (1080x1350)', () => {
    expect(CANVAS).toEqual({ largura: 1080, altura: 1350 })
  })
  it('vibe conhecida acrescenta orientação; desconhecida não quebra', () => {
    expect(guiaDesign('premium')).toContain('VIBE PREMIUM')
    expect(guiaDesign('inexistente')).toBe(guiaDesign(undefined))
    expect(guiaDesign()).toContain('PRINCÍPIOS DE DESIGN')
  })
})

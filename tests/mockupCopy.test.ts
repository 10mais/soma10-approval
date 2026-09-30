import { describe, it, expect } from 'vitest'
import { previaDaCopy, linhasDoTexto, proporcaoDoFormato, camposDoFormato, escalaDoQuadro } from '@/lib/mockupCopy'

describe('prévia da copy — o bug de 30/09 ("a copy de um aparece em outro")', () => {
  // O carrossel do print: sub-headline e texto da arte ESCONDIDOS no Studio (sobra de quando a
  // pauta era Feed / do "Gerar copy") + as lâminas de verdade.
  const carrossel = {
    formato: 'carrossel',
    headline: '',
    subheadline: 'Confira as datas:\n01/10 – Dia Nacional do Idoso',
    textoImagem: 'Conhece alguém para presentear? Nos chame.',
    cta: 'Monte a sua cesta',
    laminas: [
      { texto: 'Outubro começou cheio de motivos para presentear.\n(Colocar uma seta para a pessoa arrastar para o lado)' },
      { texto: 'Confira as datas:\n01/10 – Dia Nacional do Idoso\n02/10 – Dia Mundial do Sorriso' },
      { texto: 'Conhece alguém para presentear? Nos chame e torne este momento ainda mais especial.' },
    ],
  }

  it('carrossel: uma lâmina por quadro, na ordem; os campos escondidos no Studio NÃO aparecem', () => {
    const p = previaDaCopy(carrossel)
    expect(p.quadros).toHaveLength(3)
    expect(p.quadros.map(q => q.lamina)).toEqual([1, 2, 3])
    const tudo = JSON.stringify(p)
    expect(tudo.split('Confira as datas:').length - 1).toBe(1) // só na lâmina 2, uma vez
    expect(p.quadros[0].subtitulo).toBeUndefined()
  })

  it('sem headline, a primeira frase da capa vira o título; a nota entre parênteses é de produção', () => {
    const [capa, l2] = previaDaCopy(carrossel).quadros
    expect(capa.titulo).toBe('Outubro começou cheio de motivos para presentear.')
    expect(capa.linhas).toEqual([{ tipo: 'nota', texto: 'Colocar uma seta para a pessoa arrastar para o lado' }])
    expect(l2.linhas[0]).toEqual({ tipo: 'destaque', texto: 'Confira as datas:' })
    expect(l2.linhas.slice(1).every(l => l.tipo === 'corpo')).toBe(true)
  })

  it('o CTA vai na última lâmina', () => {
    const q = previaDaCopy(carrossel).quadros
    expect(q[2].cta).toBe('Monte a sua cesta')
    expect(q[0].cta).toBeUndefined()
  })

  it('com headline, ela é o título da capa e a lâmina 1 não a repete', () => {
    const p = previaDaCopy({ ...carrossel, headline: 'Outubro começou cheio de motivos para presentear.' })
    expect(p.quadros[0].titulo).toBe('Outubro começou cheio de motivos para presentear.')
    expect(p.quadros[0].linhas.map(l => l.texto)).toEqual(['Colocar uma seta para a pessoa arrastar para o lado'])
  })

  it('carrossel sem lâmina escrita ainda mostra a capa', () => {
    expect(previaDaCopy({ formato: 'carrossel', headline: 'Capa' }).quadros).toEqual([{ lamina: 1, titulo: 'Capa', linhas: [], cta: undefined }])
  })
})

describe('prévia da copy — feed, story, reel e material gráfico', () => {
  it('feed: headline, sub-headline, texto e CTA num quadro 4:5', () => {
    const p = previaDaCopy({ formato: 'feed', headline: 'Outubro Rosa', subheadline: 'Cuidado e afeto', textoImagem: 'Escolha a cesta', cta: 'Peça já' })
    expect(p.proporcao).toBe('4 / 5')
    expect(p.quadros).toEqual([{ titulo: 'Outubro Rosa', subtitulo: 'Cuidado e afeto', linhas: [{ tipo: 'corpo', texto: 'Escolha a cesta' }], cta: 'Peça já' }])
  })

  it('reel: abertura e gancho na tela (9:16); o roteiro sai à parte', () => {
    const p = previaDaCopy({ formato: 'reel', headline: 'Abertura', subheadline: 'Gancho', textoImagem: 'Cena 1...', cta: 'Siga' })
    expect(p.proporcao).toBe('9 / 16')
    expect(p.quadros[0]).toEqual({ titulo: 'Abertura', subtitulo: 'Gancho', linhas: [], cta: 'Siga' })
    expect(p.roteiro).toBe('Cena 1...')
  })

  it('material gráfico: só o texto da arte, proporção pelas medidas', () => {
    const p = previaDaCopy({ formato: 'grafico', headline: 'escondida no Studio', textoImagem: 'Santa Cestas\nRua X, 10', medidas: '90 x 50 cm' })
    expect(p.proporcao).toBe('90 / 50')
    expect(p.quadros[0].titulo).toBeUndefined()
    expect(p.quadros[0].linhas[0]).toEqual({ tipo: 'destaque', texto: 'Santa Cestas' })
    expect(proporcaoDoFormato('grafico', 'sem medida')).toBe('1 / 1.414')
  })

  it('campos que o cliente pode editar = os do Studio para o formato', () => {
    expect(camposDoFormato('carrossel')).toEqual(['headline', 'laminas', 'cta'])
    expect(camposDoFormato('grafico')).toEqual(['textoImagem'])
    expect(camposDoFormato('story')).toEqual(['headline', 'subheadline', 'textoImagem', 'cta'])
    expect(camposDoFormato(undefined)).toEqual(['headline', 'subheadline', 'textoImagem', 'cta'])
  })

  it('texto livre: linhas vazias somem; muito texto encolhe a letra do quadro', () => {
    expect(linhasDoTexto('a\n\n  \nb')).toEqual([{ tipo: 'corpo', texto: 'a' }, { tipo: 'corpo', texto: 'b' }])
    expect(escalaDoQuadro({ titulo: 'Curto', linhas: [] })).toBe(1)
    expect(escalaDoQuadro({ linhas: [{ tipo: 'corpo', texto: 'x'.repeat(600) }] })).toBe(0.62)
  })
})

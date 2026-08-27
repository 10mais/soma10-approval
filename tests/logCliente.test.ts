import { describe, it, expect } from 'vitest'
import { diffCampos } from '@/lib/logCliente'

// O "antes -> depois" da tela de Solicitações. A regra crítica é NÃO inventar
// mudança: campo que o cliente não mexeu não pode aparecer no histórico, senão a
// tela volta a ficar ambígua (era o problema original: dois textos iguais, sem
// dizer qual é qual).
const CAMPOS = [
  { chave: 'headline', rotulo: 'Headline' },
  { chave: 'legenda', rotulo: 'Legenda' },
]

describe('diffCampos', () => {
  it('registra o campo alterado com os dois lados', () => {
    const r = diffCampos({ legenda: 'texto velho' }, { legenda: 'texto novo' }, CAMPOS)
    expect(r).toEqual([{ campo: 'Legenda', antes: 'texto velho', depois: 'texto novo' }])
  })

  it('ignora campo que não veio no pedido (undefined != apagar)', () => {
    const r = diffCampos({ legenda: 'continua', headline: 'titulo' }, { headline: 'outro' }, CAMPOS)
    expect(r.map(m => m.campo)).toEqual(['Headline'])
  })

  it('ignora alteração que é só espaço em branco', () => {
    const r = diffCampos({ legenda: 'igual' }, { legenda: '  igual  ' }, CAMPOS)
    expect(r).toEqual([])
  })

  it('registra quando o cliente ESVAZIA um campo', () => {
    const r = diffCampos({ headline: 'tinha titulo' }, { headline: '' }, CAMPOS)
    expect(r).toEqual([{ campo: 'Headline', antes: 'tinha titulo', depois: '' }])
  })

  it('registra quando o campo nasce vazio e o cliente preenche', () => {
    const r = diffCampos({}, { legenda: 'escreveu agora' }, CAMPOS)
    expect(r).toEqual([{ campo: 'Legenda', antes: '', depois: 'escreveu agora' }])
  })

  it('preserva o texto original (não corta espaços do que vai ser exibido)', () => {
    const r = diffCampos({ legenda: 'a' }, { legenda: '  b  ' }, CAMPOS)
    expect(r[0].depois).toBe('  b  ')
  })

  it('mantém a ordem declarada dos campos', () => {
    const r = diffCampos({ headline: 'h1', legenda: 'l1' }, { legenda: 'l2', headline: 'h2' }, CAMPOS)
    expect(r.map(m => m.campo)).toEqual(['Headline', 'Legenda'])
  })
})

import { describe, it, expect } from 'vitest'
import {
  limparProdutos, limparBenchmarks, normalizarLink, tipoDoLink, rotuloDoLink, textoMarcaExtras,
  LIMITE_PRODUTOS, LIMITE_BENCHMARKS, LIMITE_NOME,
} from '@/lib/marcaExtras'

let n = 0
const novoId = () => `id${++n}`

describe('Marca — produtos e serviços (nome + descrição)', () => {
  it('nome é obrigatório; descrição é opcional', () => {
    const r = limparProdutos([{ nome: '  Consulta  ', descricao: ' Avaliação completa \n 60 min ' }, { nome: '', descricao: 'sem nome' }, { descricao: 'x' }], novoId)
    expect(r).toHaveLength(1)
    expect(r[0].nome).toBe('Consulta')
    expect(r[0].descricao).toBe('Avaliação completa \n 60 min')
    expect(limparProdutos([{ nome: 'Kit' }], novoId)[0].descricao).toBeUndefined()
  })

  it('não repete nome (sem diferenciar maiúscula) e mantém o id que já existia', () => {
    const r = limparProdutos([{ id: 'abc', nome: 'Plano mensal' }, { nome: 'plano MENSAL', descricao: 'dup' }], novoId)
    expect(r).toEqual([{ id: 'abc', nome: 'Plano mensal' }])
  })

  it('corta o nome longo, recusa id estranho e respeita o limite da lista', () => {
    const r = limparProdutos([{ id: '<script>', nome: 'x'.repeat(200) }], novoId)
    expect(r[0].nome.length).toBe(LIMITE_NOME)
    expect(r[0].id).not.toBe('<script>')
    const muitos = Array.from({ length: LIMITE_PRODUTOS + 10 }, (_, i) => ({ nome: `Item ${i}` }))
    expect(limparProdutos(muitos, novoId)).toHaveLength(LIMITE_PRODUTOS)
    expect(limparProdutos('lixo', novoId)).toEqual([])
  })
})

describe('Marca — links de benchmark', () => {
  it('@perfil vira o Instagram; endereço sem https ganha https', () => {
    expect(normalizarLink('@clinica.norah')).toBe('https://www.instagram.com/clinica.norah/')
    expect(normalizarLink('site.com.br/servicos')).toBe('https://site.com.br/servicos')
    expect(normalizarLink('https://www.youtube.com/@canal')).toBe('https://www.youtube.com/@canal')
  })

  it('recusa o que não é link', () => {
    expect(normalizarLink('')).toBeNull()
    expect(normalizarLink('um texto qualquer')).toBeNull()
    expect(normalizarLink('javascript:alert(1)')).toBeNull()
    expect(normalizarLink('ftp://arquivo.com')).toBeNull()
    expect(normalizarLink('localhost')).toBeNull()
  })

  it('reconhece a rede pelo endereço', () => {
    expect(tipoDoLink('https://www.instagram.com/perfil/')).toBe('instagram')
    expect(tipoDoLink('https://youtu.be/abc')).toBe('youtube')
    expect(tipoDoLink('https://www.tiktok.com/@perfil')).toBe('tiktok')
    expect(tipoDoLink('https://m.facebook.com/pagina')).toBe('facebook')
    expect(tipoDoLink('https://www.linkedin.com/company/x')).toBe('linkedin')
    expect(tipoDoLink('https://concorrente.com.br')).toBe('site')
    // domínio que só CONTÉM o nome da rede não é a rede
    expect(tipoDoLink('https://instagram.com.golpe.net')).toBe('site')
  })

  it('rótulo curto: @perfil no Instagram, domínio no site', () => {
    expect(rotuloDoLink('https://www.instagram.com/clinica.norah/')).toBe('@clinica.norah')
    expect(rotuloDoLink('https://www.concorrente.com.br/precos')).toBe('concorrente.com.br')
  })

  it('limpa a lista: só link válido, sem repetir o mesmo endereço, tipo recalculado no servidor', () => {
    const r = limparBenchmarks([
      { url: '@perfil', nome: 'Concorrente', observar: 'stories', tipo: 'site' },
      { url: 'https://instagram.com/perfil' }, // mesmo perfil, outra grafia
      { url: 'texto solto' },
      { url: 'concorrente.com.br' },
    ], novoId)
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ url: 'https://www.instagram.com/perfil/', tipo: 'instagram', nome: 'Concorrente', observar: 'stories' })
    expect(r[1].tipo).toBe('site')
    const muitos = Array.from({ length: LIMITE_BENCHMARKS + 5 }, (_, i) => ({ url: `site${i}.com.br` }))
    expect(limparBenchmarks(muitos, novoId)).toHaveLength(LIMITE_BENCHMARKS)
  })
})

describe('Marca — o que vai para a IA', () => {
  it('sem nada cadastrado, o prompt fica igual ao de antes', () => {
    expect(textoMarcaExtras({})).toBe('')
    expect(textoMarcaExtras(null)).toBe('')
  })

  it('lista produtos pelo nome e benchmarks com a ordem de não copiar', () => {
    const t = textoMarcaExtras({
      produtosServicos: [{ id: '1', nome: 'Consulta de avaliação', descricao: 'Primeira visita,\n60 minutos' }],
      benchmarks: [{ id: '2', url: 'https://www.instagram.com/ref/', tipo: 'instagram', observar: 'bastidores' }],
    })
    expect(t).toContain('- Consulta de avaliação: Primeira visita, 60 minutos')
    expect(t).toContain('NUNCA copiar')
    expect(t).toContain('- @ref (Instagram): https://www.instagram.com/ref/ — observar: bastidores')
  })

  it('respeita o limite de tamanho do prompt', () => {
    const produtos = Array.from({ length: 40 }, (_, i) => ({ id: String(i), nome: `Produto ${i}`, descricao: 'd'.repeat(200) }))
    const t = textoMarcaExtras({ produtosServicos: produtos }, 500)
    expect(t.length).toBeLessThanOrEqual(500)
    expect(t.endsWith('…')).toBe(true)
  })
})

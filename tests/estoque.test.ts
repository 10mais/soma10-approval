import { describe, it, expect } from 'vitest'
import {
  chaveEstoque, faltasParaBaixa, podeBaixar, abaixoDoMinimo,
  validarTransferencia, limparProduto, totalVenda,
} from '@/lib/estoque'

describe('chaveEstoque', () => {
  it('é única por loja e produto', () => {
    expect(chaveEstoque('l1', 'p1')).toBe('estoque:l1:p1')
    expect(chaveEstoque('l2', 'p1')).not.toBe(chaveEstoque('l1', 'p1'))
  })
})

describe('faltasParaBaixa / podeBaixar', () => {
  it('deixa passar quando há saldo', () => {
    expect(podeBaixar([{ produtoId: 'a', quantidade: 2 }], { a: 5 })).toBe(true)
  })
  it('acusa falta com pedido e disponível', () => {
    const f = faltasParaBaixa([{ produtoId: 'a', quantidade: 5 }], { a: 3 })
    expect(f).toEqual([{ produtoId: 'a', pedido: 5, disponivel: 3 }])
  })
  it('SOMA o mesmo produto repetido no carrinho', () => {
    // 2 linhas de 3 unidades do mesmo item = 6; saldo 5 → falta
    expect(podeBaixar([{ produtoId: 'a', quantidade: 3 }, { produtoId: 'a', quantidade: 3 }], { a: 5 })).toBe(false)
    expect(podeBaixar([{ produtoId: 'a', quantidade: 3 }, { produtoId: 'a', quantidade: 2 }], { a: 5 })).toBe(true)
  })
  it('produto sem saldo cadastrado conta como zero', () => {
    expect(faltasParaBaixa([{ produtoId: 'x', quantidade: 1 }], {})).toEqual([{ produtoId: 'x', pedido: 1, disponivel: 0 }])
  })
  it('ignora quantidade zero/negativa/lixo', () => {
    expect(podeBaixar([{ produtoId: 'a', quantidade: 0 }, { produtoId: 'a', quantidade: -5 }], { a: 0 })).toBe(true)
  })
})

describe('abaixoDoMinimo', () => {
  it('alerta quando saldo < mínimo', () => {
    expect(abaixoDoMinimo(2, 5)).toBe(true)
    expect(abaixoDoMinimo(5, 5)).toBe(false)
    expect(abaixoDoMinimo(9, 5)).toBe(false)
  })
  it('mínimo ausente/zero = sem alerta', () => {
    expect(abaixoDoMinimo(0)).toBe(false)
    expect(abaixoDoMinimo(0, 0)).toBe(false)
  })
})

describe('validarTransferencia', () => {
  it('aceita transferência válida', () => {
    expect(validarTransferencia({ lojaOrigem: 'a', lojaDestino: 'b', quantidade: 3, saldoOrigem: 10 })).toBeNull()
  })
  it('recusa mesma loja', () => {
    expect(validarTransferencia({ lojaOrigem: 'a', lojaDestino: 'a', quantidade: 3, saldoOrigem: 10 })).toMatch(/não podem ser a mesma/)
  })
  it('recusa quantidade <= 0', () => {
    expect(validarTransferencia({ lojaOrigem: 'a', lojaDestino: 'b', quantidade: 0, saldoOrigem: 10 })).toMatch(/maior que zero/)
  })
  it('recusa saldo insuficiente na origem', () => {
    expect(validarTransferencia({ lojaOrigem: 'a', lojaDestino: 'b', quantidade: 12, saldoOrigem: 10 })).toMatch(/insuficiente/)
  })
  it('exige as duas lojas', () => {
    expect(validarTransferencia({ lojaOrigem: '', lojaDestino: 'b', quantidade: 1, saldoOrigem: 5 })).toMatch(/origem e a de destino/)
  })
})

describe('limparProduto', () => {
  it('aceita e normaliza um produto válido', () => {
    const r = limparProduto({ nome: '  iPhone 15  ', sku: ' IP15 ', categoria: 'smartphone', precoVenda: 4999.9, precoCusto: 3800, estoqueMinimo: 2 })
    expect(r).toMatchObject({ ok: true })
    if ('ok' in r) expect(r.campos).toMatchObject({ nome: 'iPhone 15', sku: 'IP15', categoria: 'smartphone', precoVenda: 4999.9, precoCusto: 3800, estoqueMinimo: 2, ativo: true })
  })
  it('exige nome', () => {
    expect(limparProduto({ nome: '  ', precoVenda: 10 })).toEqual({ erro: 'Informe o nome do produto.' })
  })
  it('recusa preço inválido ou negativo', () => {
    expect(limparProduto({ nome: 'X', precoVenda: -1 })).toMatchObject({ erro: expect.stringMatching(/Preço/) })
    expect(limparProduto({ nome: 'X', precoVenda: 'abc' })).toMatchObject({ erro: expect.stringMatching(/Preço/) })
  })
  it('categoria desconhecida vira "outro"', () => {
    const r = limparProduto({ nome: 'X', precoVenda: 10, categoria: 'inventada' })
    if ('ok' in r) expect(r.campos.categoria).toBe('outro')
  })
  it('custo/mínimo inválidos viram undefined, não zero espúrio', () => {
    const r = limparProduto({ nome: 'X', precoVenda: 10, precoCusto: 'x', estoqueMinimo: -5 })
    if ('ok' in r) { expect(r.campos.precoCusto).toBeUndefined(); expect(r.campos.estoqueMinimo).toBeUndefined() }
  })
})

describe('totalVenda', () => {
  it('soma itens e aplica desconto', () => {
    expect(totalVenda([{ quantidade: 2, precoUnit: 100 }, { quantidade: 1, precoUnit: 50 }], 30)).toBe(220)
  })
  it('nunca fica negativo mesmo com desconto gigante', () => {
    expect(totalVenda([{ quantidade: 1, precoUnit: 100 }], 999)).toBe(0)
  })
  it('arredonda para centavos', () => {
    expect(totalVenda([{ quantidade: 3, precoUnit: 9.99 }])).toBe(29.97)
  })
  it('carrinho vazio é zero', () => {
    expect(totalVenda([])).toBe(0)
  })
})

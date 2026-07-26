import { describe, it, expect } from 'vitest'
import { limparItensVenda, quantidadePorProduto, lancamentoDaVenda } from '@/lib/vendas'
import { totalVenda } from '@/lib/estoque'

describe('limparItensVenda', () => {
  it('recusa carrinho vazio', () => {
    expect(limparItensVenda([])).toEqual({ erro: 'Adicione ao menos um item à venda.' })
  })
  it('recusa quantidade zero/negativa', () => {
    expect(limparItensVenda([{ produtoId: 'p1', nome: 'X', quantidade: 0, precoUnit: 10 }])).toHaveProperty('erro')
    expect(limparItensVenda([{ produtoId: 'p1', nome: 'X', quantidade: -2, precoUnit: 10 }])).toHaveProperty('erro')
  })
  it('recusa item sem produto', () => {
    expect(limparItensVenda([{ nome: 'X', quantidade: 1, precoUnit: 10 }])).toHaveProperty('erro')
  })
  it('normaliza (arredonda preço, trunca quantidade) e mantém snapshot do nome', () => {
    const r = limparItensVenda([{ produtoId: 'p1', nome: ' iPhone ', quantidade: 2.9, precoUnit: 10.999 }])
    expect(r).toEqual({ ok: true, itens: [{ produtoId: 'p1', nome: 'iPhone', quantidade: 2, precoUnit: 11 }] })
  })
})

describe('quantidadePorProduto', () => {
  it('soma o mesmo produto repetido no carrinho', () => {
    const q = quantidadePorProduto([
      { produtoId: 'p1', nome: 'A', quantidade: 2, precoUnit: 5 },
      { produtoId: 'p1', nome: 'A', quantidade: 3, precoUnit: 5 },
      { produtoId: 'p2', nome: 'B', quantidade: 1, precoUnit: 9 },
    ])
    expect(q).toEqual({ p1: 5, p2: 1 })
  })
})

describe('totalVenda (reuso no PDV)', () => {
  it('soma qtd×preço menos desconto, nunca negativo', () => {
    const itens = [{ quantidade: 2, precoUnit: 10 }, { quantidade: 1, precoUnit: 5.5 }]
    expect(totalVenda(itens)).toBe(25.5)
    expect(totalVenda(itens, 5)).toBe(20.5)
    expect(totalVenda(itens, 999)).toBe(0)
  })
})

describe('lancamentoDaVenda', () => {
  it('gera entrada recebida no caixa da loja, id determinístico', () => {
    const l = lancamentoDaVenda({ id: 'v1', lojaId: 'L1', total: 199.9, data: '2026-07-26T14:30:00.000Z', contatoId: 'c1' }, 'Venda #v1')
    expect(l).toMatchObject({
      id: 'venda-v1', tipo: 'entrada', descricao: 'Venda #v1', valor: 199.9,
      data: '2026-07-26', recebido: true, clienteId: 'c1', vendaId: 'v1', lojaId: 'L1',
    })
  })
  it('sem contato não crava clienteId', () => {
    const l = lancamentoDaVenda({ id: 'v2', lojaId: 'L2', total: 50, data: '2026-07-26T00:00:00.000Z' }, 'Venda #v2')
    expect(l.clienteId).toBeUndefined()
    expect(l.lojaId).toBe('L2')
  })
})

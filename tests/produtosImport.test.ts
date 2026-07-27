import { describe, it, expect } from 'vitest'
import { parseProdutosColados, numBR, chaveMatchProduto } from '@/lib/produtosImport'

describe('numBR', () => {
  it('entende BR e US', () => {
    expect(numBR('1.234,56')).toBe(1234.56)
    expect(numBR('1234,56')).toBe(1234.56)
    expect(numBR('1234.56')).toBe(1234.56)
    expect(numBR('R$ 2.500,00')).toBe(2500)
    expect(numBR('99')).toBe(99)
    expect(numBR('')).toBeNaN()
    expect(numBR('abc')).toBeNaN()
  })
})

describe('parseProdutosColados', () => {
  it('parseia linhas com ; e pula cabeçalho', () => {
    const txt = [
      'Nome;SKU;Categoria;Preço;Custo;Estoque mínimo;Quantidade',
      'iPhone 15 128GB;IP15128;smartphone;5.999,00;4.200,00;2;10',
      'Cabo USB-C;CB-USBC;acessorio;39,90;15;5;50',
    ].join('\n')
    const { linhas, ignoradas } = parseProdutosColados(txt)
    expect(ignoradas).toBe(0)
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toEqual({ nome: 'iPhone 15 128GB', sku: 'IP15128', categoria: 'smartphone', precoVenda: 5999, precoCusto: 4200, estoqueMinimo: 2, quantidade: 10 })
    expect(linhas[1].categoria).toBe('acessorio')
    expect(linhas[1].quantidade).toBe(50)
  })
  it('categoria desconhecida vira "outro"; sem preço é ignorada', () => {
    const { linhas, ignoradas } = parseProdutosColados('Produto X;;gadget;100\nSem preço;;;')
    expect(linhas).toHaveLength(1)
    expect(linhas[0].categoria).toBe('outro')
    expect(ignoradas).toBe(1)
  })
  it('aceita TAB (colado do Excel) e vírgula', () => {
    expect(parseProdutosColados('Fone;;acessorio;120,00;;;3').linhas[0].precoVenda).toBe(120)
    expect(parseProdutosColados('Fone\t\tacessorio\t120\t\t\t3').linhas[0].quantidade).toBe(3)
  })
})

describe('chaveMatchProduto', () => {
  it('usa SKU quando existe, senão o nome', () => {
    expect(chaveMatchProduto({ sku: 'ABC', nome: 'X' })).toBe('sku:abc')
    expect(chaveMatchProduto({ nome: 'iPhone 15' })).toBe('nome:iphone 15')
  })
})

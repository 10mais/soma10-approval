import { describe, it, expect } from 'vitest'
import { parseProdutosColados } from '@/lib/produtosImport'
import { parseContatosPlanilha } from '@/lib/contatosImport'

describe('parseProdutosColados — export de ERP (mapeia por cabeçalho)', () => {
  const csv = [
    'Código;Descrição do Produto;Estoque;Preço Venda;Unid;NCM;Grupo;Código Barras;Meu Custo Compra;Est. Mínimo',
    '470;ADAPTADOR DE VIAGEM;1;49,90;UN;85182200;;789123;14;2',
    '677;FONE HREBOS;7;39,90;UN;85183000;;789456;12,50;3',
  ].join('\n')
  it('mapeia colunas do ERP na ordem que vierem', () => {
    const { linhas } = parseProdutosColados(csv)
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toEqual({ nome: 'ADAPTADOR DE VIAGEM', codigo: '470', sku: '789123', categoria: 'outro', precoVenda: 49.9, precoCusto: 14, estoqueMinimo: 2, quantidade: 1 })
    expect(linhas[1]).toMatchObject({ nome: 'FONE HREBOS', quantidade: 7, precoCusto: 12.5, estoqueMinimo: 3 })
  })
  it('mapeia Marca e Código Próprio quando presentes', () => {
    const csv = [
      'Descrição do Produto;Marca;Preço Venda;Grupo;Código Próprio;Estoque',
      'Fone JBL Tune;JBL;199,90;acessorio;INT-001;5',
    ].join('\n')
    const { linhas } = parseProdutosColados(csv)
    expect(linhas[0]).toMatchObject({ nome: 'Fone JBL Tune', marca: 'JBL', codigo: 'INT-001', categoria: 'acessorio', precoVenda: 199.9, quantidade: 5 })
  })
  it('ainda aceita o formato simples posicional (sem cabeçalho)', () => {
    const { linhas } = parseProdutosColados('Cabo USB;CB1;acessorio;29,90;10;5;50')
    expect(linhas[0]).toEqual({ nome: 'Cabo USB', sku: 'CB1', categoria: 'acessorio', precoVenda: 29.9, precoCusto: 10, estoqueMinimo: 5, quantidade: 50 })
  })
})

describe('parseContatosPlanilha — export de ERP', () => {
  const csv = [
    'Código;Nome;CPF/CNPJ;Nome Fantasia;Contato;DDD;Fone;DDD;Celular;Endereço;Nro;Bairro;Cidade;UF;E-mail;Nascimento',
    '313;ARTHUR VERRI;02800729023;;;;;55;997019034;AVENIDA GETULIO;2528;CENTRO;SANTO ANGELO;RS;arthur@x.com;06/09/1990',
  ].join('\n')
  it('junta DDD+Celular, data BR e monta observações com CPF/endereço', () => {
    const { linhas } = parseContatosPlanilha(csv)
    expect(linhas).toHaveLength(1)
    const c = linhas[0]
    expect(c.nome).toBe('ARTHUR VERRI')
    expect(c.telefone).toBe('55997019034')
    expect(c.email).toBe('arthur@x.com')
    expect(c.nascimento).toBe('1990-09-06')
    expect(c.observacoes).toContain('CPF/CNPJ: 02800729023')
    expect(c.observacoes).toContain('SANTO ANGELO/RS')
  })
  it('formato simples posicional quando não há cabeçalho', () => {
    const { linhas } = parseContatosPlanilha('João Silva;55999990000;joao@x.com;Loja X')
    expect(linhas[0]).toEqual({ nome: 'João Silva', telefone: '55999990000', email: 'joao@x.com', empresa: 'Loja X' })
  })
})

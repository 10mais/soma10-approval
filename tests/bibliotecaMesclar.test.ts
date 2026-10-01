import { describe, it, expect } from 'vitest'
import { mesclarSeed, vazia, type BibliotecaVendas } from '@/lib/bibliotecaVendas'
import { SEED_TURISMO } from '@/lib/bibliotecaSeeds/turismo'

// O que a Deny tem hoje na tela: dois itens digitados à mão para testar.
function bibliotecaDaDeny(): BibliotecaVendas {
  return {
    objecoes: [{
      id: 'o1', nome: 'Objeções',
      respostas: [
        { id: 'r1', titulo: 'VOU VER COM A ESPOSA', contexto: '', texto: 'MENSAGEM PRONTA' },
        { id: 'r2', titulo: 'MUITO CARO', contexto: '', texto: 'xxxx' },
      ],
    }],
    cadencias: [], roteiros: [], reaquecimento: { leads: [], clientes: [] },
  }
}

const nomes = (b: BibliotecaVendas) => b.objecoes.map(c => c.nome)

describe('mesclar o conteúdo do nicho sem perder o que já existe', () => {
  it('o que a equipe escreveu continua lá, com o mesmo id e o mesmo texto', () => {
    const antes = bibliotecaDaDeny()
    const depois = mesclarSeed(antes, instalado())
    const cat = depois.objecoes.find(c => c.id === 'o1')!
    expect(cat.respostas.find(r => r.id === 'r1')?.texto).toBe('MENSAGEM PRONTA')
    expect(cat.respostas.find(r => r.id === 'r2')?.titulo).toBe('MUITO CARO')
  })

  it('o conteúdo do nicho entra junto', () => {
    const depois = mesclarSeed(bibliotecaDaDeny(), instalado())
    expect(nomes(depois)).toContain('Preço e pagamento')
    expect(nomes(depois)).toContain('Documentos e Mercosul')
    expect(depois.cadencias.length).toBeGreaterThan(0)
    expect(depois.roteiros.length).toBeGreaterThan(0)
    expect(depois.reaquecimento.leads.length).toBeGreaterThan(0)
    expect(depois.reaquecimento.clientes.length).toBeGreaterThan(0)
  })

  it('instalar duas vezes não duplica nada', () => {
    const uma = mesclarSeed(bibliotecaDaDeny(), instalado())
    const duas = mesclarSeed(uma, instalado())
    expect(duas.objecoes.length).toBe(uma.objecoes.length)
    expect(duas.cadencias.flatMap(c => c.mensagens).length).toBe(uma.cadencias.flatMap(c => c.mensagens).length)
    expect(duas.roteiros.flatMap(r => r.perguntas).length).toBe(uma.roteiros.flatMap(r => r.perguntas).length)
  })

  it('item igual escrito em caixa alta ou sem acento é o MESMO item, não um novo', () => {
    const atual: BibliotecaVendas = {
      ...vazia(),
      objecoes: [{ id: 'x', nome: 'PRECO E PAGAMENTO', respostas: [{ id: 'y', titulo: 'ACHEI CARO', contexto: '', texto: 'meu texto' }] }],
    }
    const depois = mesclarSeed(atual, instalado())
    // Uma categoria só: "PRECO E PAGAMENTO" e "Preço e pagamento" são a mesma.
    const chave = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
    expect(depois.objecoes.filter(c => chave(c.nome) === 'preco e pagamento').length).toBe(1)
    const cat = depois.objecoes.find(c => c.id === 'x')!
    // O texto da equipe venceu; o do nicho não sobrescreveu.
    expect(cat.respostas.find(r => r.id === 'y')?.texto).toBe('meu texto')
    // E as outras respostas do nicho entraram na mesma categoria.
    expect(cat.respostas.length).toBeGreaterThan(1)
  })

  it('biblioteca vazia recebe o nicho inteiro', () => {
    const depois = mesclarSeed(vazia(), instalado())
    expect(depois.objecoes.length).toBe(SEED_TURISMO.objecoes.length)
  })

  it('o seed de turismo cobre as quatro seções e nenhum texto fica em branco', () => {
    const b = instalado()
    expect(b.objecoes.length).toBeGreaterThanOrEqual(6)
    expect(b.cadencias.length).toBeGreaterThanOrEqual(2)
    expect(b.roteiros.length).toBeGreaterThanOrEqual(2)
    const itens = [
      ...b.objecoes.flatMap(c => c.respostas),
      ...b.cadencias.flatMap(c => c.mensagens),
      ...b.reaquecimento.leads.flatMap(s => s.mensagens),
      ...b.reaquecimento.clientes.flatMap(s => s.mensagens),
    ]
    // `contexto` é a linha que diz QUANDO usar — item sem ela vira texto solto.
    for (const i of itens) {
      expect(i.titulo.trim()).not.toBe('')
      expect(i.contexto.trim()).not.toBe('')
      expect(i.texto.trim()).not.toBe('')
    }
    for (const r of b.roteiros.flatMap(r => r.perguntas)) {
      expect(r.pergunta.trim()).not.toBe('')
      expect(r.contexto.trim()).not.toBe('')
    }
  })

  it('toda mensagem de cadência tem uma fase válida', () => {
    const fases = ['abordagem', 'qualificacao', 'interesse', 'agendamento', 'fechamento']
    for (const m of instalado().cadencias.flatMap(c => c.mensagens)) expect(fases).toContain(m.fase)
  })
})

// Espelha o `instalar()` da rota: dá id ao que vem do seed.
let n = 0
const id = () => `id${++n}`
function instalado(): BibliotecaVendas {
  n = 0
  const s = SEED_TURISMO
  return {
    objecoes: s.objecoes.map(c => ({ id: id(), nome: c.nome, respostas: c.respostas.map(r => ({ id: id(), ...r })) })),
    cadencias: s.cadencias.map(c => ({ id: id(), nome: c.nome, descricao: c.descricao, mensagens: c.mensagens.map(m => ({ id: id(), ...m })) })),
    roteiros: s.roteiros.map(r => ({ id: id(), nome: r.nome, descricao: r.descricao, perguntas: r.perguntas.map(p => ({ id: id(), ...p })) })),
    reaquecimento: {
      leads: s.reaquecimento.leads.map(x => ({ id: id(), ...x, mensagens: x.mensagens.map(m => ({ id: id(), ...m })) })),
      clientes: s.reaquecimento.clientes.map(x => ({ id: id(), ...x, mensagens: x.mensagens.map(m => ({ id: id(), ...m })) })),
    },
  }
}

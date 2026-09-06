import { describe, it, expect } from 'vitest'
import {
  contaPrincipal, contasDoCliente, contaPorId, contasAlvo,
  redesDaConta, contaConectada, chavePublicacao, jaPublicou,
  upsertContaAdicional, removerConta,
  ID_CONTA_PRINCIPAL, type ContaSocial,
} from '@/lib/contasSociais'

// Cliente "de antes": só os campos escalares, nenhum contas[].
const antigo = {
  nome: 'Loja Centro',
  instagramToken: 'tok-ig', instagramUserId: '111', instagramUsername: 'lojacentro', instagramConectado: true,
  facebookPageId: 'pg-1', facebookPageToken: 'tok-fb', metaConectado: true,
}

const contaExtra: ContaSocial = {
  id: 'c2', nome: 'Loja Sul',
  instagramToken: 'tok-ig-2', instagramUserId: '222', instagramUsername: 'lojasul',
}

describe('contaPrincipal — os campos antigos viram conta, sem migrar dado', () => {
  it('sintetiza a principal a partir dos campos escalares', () => {
    const p = contaPrincipal(antigo)!
    expect(p.id).toBe(ID_CONTA_PRINCIPAL)
    expect(p.instagramToken).toBe('tok-ig')
    expect(p.facebookPageId).toBe('pg-1')
  })

  it('usa o @ do Instagram como rótulo, com o nome do cliente de reserva', () => {
    expect(contaPrincipal(antigo)!.nome).toBe('@lojacentro')
    expect(contaPrincipal({ nome: 'X', facebookPageId: 'p', facebookPageToken: 't' })!.nome).toBe('X')
  })

  it('cliente SEM nenhuma rede conectada não ganha conta fantasma', () => {
    expect(contaPrincipal({ nome: 'Sem rede' })).toBeNull()
    // token sem id (conexão pela metade) também não conta
    expect(contaPrincipal({ instagramToken: 'tok' })).toBeNull()
    expect(contaPrincipal({ facebookPageId: 'pg' })).toBeNull()
  })

  it('só Facebook, sem Instagram, ainda é uma conta', () => {
    expect(contaPrincipal({ facebookPageId: 'pg', facebookPageToken: 'tok' })).not.toBeNull()
  })

  it('nulo e indefinido não quebram', () => {
    expect(contaPrincipal(null)).toBeNull()
    expect(contaPrincipal(undefined)).toBeNull()
  })
})

describe('contasDoCliente', () => {
  it('a principal vem primeiro, depois as cadastradas', () => {
    const r = contasDoCliente({ ...antigo, contas: [contaExtra] })
    expect(r.map(c => c.id)).toEqual([ID_CONTA_PRINCIPAL, 'c2'])
  })

  it('cliente novo, sem campos antigos, tem só as de contas[]', () => {
    expect(contasDoCliente({ nome: 'Nova', contas: [contaExtra] }).map(c => c.id)).toEqual(['c2'])
  })

  it('ignora conta sem id e a que tenta se passar pela principal', () => {
    const r = contasDoCliente({ ...antigo, contas: [{ id: '', nome: 'sem id' } as any, { id: ID_CONTA_PRINCIPAL, nome: 'impostora' } as any, contaExtra] })
    expect(r.map(c => c.id)).toEqual([ID_CONTA_PRINCIPAL, 'c2'])
    expect(r[0].instagramToken).toBe('tok-ig') // a de verdade, não a impostora
  })

  it('não repete id duplicado dentro de contas[]', () => {
    const r = contasDoCliente({ nome: 'X', contas: [contaExtra, { ...contaExtra, nome: 'cópia' }] })
    expect(r.length).toBe(1)
    expect(r[0].nome).toBe('Loja Sul') // a primeira ganha
  })

  it('cliente sem nada devolve lista vazia', () => {
    expect(contasDoCliente({ nome: 'Vazio' })).toEqual([])
    expect(contasDoCliente(null)).toEqual([])
  })
})

describe('contaPorId', () => {
  const cli = { ...antigo, contas: [contaExtra] }
  it('acha a principal e a extra', () => {
    expect(contaPorId(cli, ID_CONTA_PRINCIPAL)!.instagramUserId).toBe('111')
    expect(contaPorId(cli, 'c2')!.instagramUserId).toBe('222')
  })
  it('id desconhecido ou vazio devolve null', () => {
    expect(contaPorId(cli, 'nao-existe')).toBeNull()
    expect(contaPorId(cli, undefined)).toBeNull()
  })
})

describe('redesDaConta — o que ESTA conta consegue publicar', () => {
  it('conta completa publica nas duas', () => {
    expect(redesDaConta(contaPrincipal(antigo))).toEqual(['instagram', 'facebook'])
  })

  it('conta só de Instagram não oferece Facebook', () => {
    expect(redesDaConta(contaExtra)).toEqual(['instagram'])
  })

  it('Facebook sem metaConectado não vale — é a mesma trava de publicar.ts', () => {
    const semMeta = { id: 'x', nome: 'x', facebookPageId: 'pg', facebookPageToken: 'tok' }
    expect(redesDaConta(semMeta)).toEqual([])
    expect(redesDaConta({ ...semMeta, metaConectado: true })).toEqual(['facebook'])
  })

  it('conta vazia não publica em lugar nenhum', () => {
    expect(redesDaConta({ id: 'x', nome: 'x' })).toEqual([])
    expect(contaConectada({ id: 'x', nome: 'x' })).toBe(false)
    expect(contaConectada(contaExtra)).toBe(true)
  })
})

describe('contasAlvo — para onde o post vai', () => {
  const cli = { ...antigo, contas: [contaExtra] }

  it('post ANTIGO (sem contaIds) vai para a principal, como sempre foi', () => {
    expect(contasAlvo(cli, undefined).map(c => c.id)).toEqual([ID_CONTA_PRINCIPAL])
    expect(contasAlvo(cli, []).map(c => c.id)).toEqual([ID_CONTA_PRINCIPAL])
  })

  it('cliente sem principal cai na primeira conta cadastrada', () => {
    expect(contasAlvo({ nome: 'Nova', contas: [contaExtra] }, undefined).map(c => c.id)).toEqual(['c2'])
  })

  it('escolhe exatamente os perfis pedidos', () => {
    expect(contasAlvo(cli, ['c2']).map(c => c.id)).toEqual(['c2'])
    expect(contasAlvo(cli, [ID_CONTA_PRINCIPAL, 'c2']).length).toBe(2)
  })

  it('conta REMOVIDA depois do agendamento é descartada, não publica em outra', () => {
    // O post pedia c9; ela não existe mais. Não pode cair na principal por engano.
    expect(contasAlvo(cli, ['c9'])).toEqual([])
  })

  it('mantém a ordem do cliente, não a ordem do pedido', () => {
    expect(contasAlvo(cli, ['c2', ID_CONTA_PRINCIPAL]).map(c => c.id)).toEqual([ID_CONTA_PRINCIPAL, 'c2'])
  })
})

describe('upsertContaAdicional', () => {
  it('adiciona um perfil novo', () => {
    const r = upsertContaAdicional([], { instagramToken: 't', instagramUserId: '99', instagramUsername: 'nova' }, 'id-1')
    expect(r.length).toBe(1)
    expect(r[0]).toMatchObject({ id: 'id-1', nome: '@nova', instagramUserId: '99', instagramConectado: true })
  })

  it('reconexão do MESMO Instagram atualiza o token e preserva id, nome e criadoEm', () => {
    const antiga: ContaSocial = { id: 'fixo', nome: 'Loja Sul', instagramUserId: '99', instagramToken: 'velho', criadoEm: '2020-01-01' }
    const r = upsertContaAdicional([antiga], { instagramToken: 'novo', instagramUserId: '99', instagramUsername: 'sul' }, 'id-ignorado')
    expect(r.length).toBe(1) // não duplicou
    expect(r[0].id).toBe('fixo') // id preservado — post agendado não perde a conta
    expect(r[0].nome).toBe('Loja Sul') // rótulo da equipe mantido
    expect(r[0].instagramToken).toBe('novo') // token renovado
    expect(r[0].criadoEm).toBe('2020-01-01')
  })

  it('reconhece a mesma conta pela Página do Facebook', () => {
    const antiga: ContaSocial = { id: 'fixo', nome: 'x', facebookPageId: 'pg-9', facebookPageToken: 'velho' }
    const r = upsertContaAdicional([antiga], { facebookPageId: 'pg-9', facebookPageToken: 'novo', instagramUsername: 'y' }, 'novo-id')
    expect(r.length).toBe(1)
    expect(r[0].id).toBe('fixo')
    expect(r[0].facebookPageToken).toBe('novo')
  })

  it('perfis diferentes convivem', () => {
    let r = upsertContaAdicional([], { instagramToken: 't1', instagramUserId: '1', instagramUsername: 'a' }, 'id-a')
    r = upsertContaAdicional(r, { instagramToken: 't2', instagramUserId: '2', instagramUsername: 'b' }, 'id-b')
    expect(r.map(c => c.id)).toEqual(['id-a', 'id-b'])
  })

  it('usa o nome dado pela equipe quando vem', () => {
    const r = upsertContaAdicional([], { nome: 'Loja Centro', instagramToken: 't', instagramUserId: '5' }, 'id')
    expect(r[0].nome).toBe('Loja Centro')
  })
})

describe('removerConta', () => {
  it('tira só a conta pedida', () => {
    const contas: ContaSocial[] = [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }]
    expect(removerConta(contas, 'a').map(c => c.id)).toEqual(['b'])
  })
  it('id inexistente não muda nada e não quebra', () => {
    expect(removerConta([{ id: 'a', nome: 'A' }], 'z').map(c => c.id)).toEqual(['a'])
    expect(removerConta(undefined, 'a')).toEqual([])
  })
})

describe('jaPublicou — a trava contra publicar duas vezes', () => {
  it('marca nova, por conta e rede', () => {
    const pub = [chavePublicacao('c2', 'instagram')]
    expect(jaPublicou(pub, 'c2', 'instagram')).toBe(true)
    expect(jaPublicou(pub, 'c2', 'facebook')).toBe(false)
    expect(jaPublicou(pub, ID_CONTA_PRINCIPAL, 'instagram')).toBe(false)
  })

  it('MARCA ANTIGA ("instagram" puro) vale para a principal', () => {
    // Post publicado antes deste deploy. Se isto falhar, ele republica no
    // perfil do cliente — irreversível, já saiu para o público.
    expect(jaPublicou(['instagram'], ID_CONTA_PRINCIPAL, 'instagram')).toBe(true)
    expect(jaPublicou(['instagram', 'facebook'], ID_CONTA_PRINCIPAL, 'facebook')).toBe(true)
  })

  it('marca antiga NÃO vale para as outras contas', () => {
    // "instagram" solto veio de quando só existia um perfil: não prova nada
    // sobre a Loja Sul, que nunca recebeu esse post.
    expect(jaPublicou(['instagram'], 'c2', 'instagram')).toBe(false)
  })

  it('lista vazia ou ausente nunca trava', () => {
    expect(jaPublicou(undefined, 'c2', 'instagram')).toBe(false)
    expect(jaPublicou([], ID_CONTA_PRINCIPAL, 'instagram')).toBe(false)
  })

  it('as chaves das contas não se confundem entre si', () => {
    const pub = [chavePublicacao('c2', 'instagram'), chavePublicacao('c3', 'facebook')]
    expect(jaPublicou(pub, 'c3', 'instagram')).toBe(false)
    expect(jaPublicou(pub, 'c2', 'facebook')).toBe(false)
    expect(jaPublicou(pub, 'c3', 'facebook')).toBe(true)
  })
})

// Cenário REAL relatado pelo dono (04/09): cliente com 3 perfis de Instagram e
// 3 Páginas de Facebook. A pergunta era "selecionando um, publica só nele ou em
// todos?". Publicar no perfil errado é irreversível — já saiu para o público —
// então o caso fica travado por teste, com os números do caso real.
describe('cliente com 3 perfis — publica SÓ no selecionado', () => {
  const conta = (id: string, nome: string) => ({
    id, nome,
    instagramToken: `tok-${id}`, instagramUserId: `ig-${id}`, instagramUsername: nome,
    facebookPageId: `fb-${id}`, facebookPageToken: `ptok-${id}`, metaConectado: true,
  })
  // A "principal" (campos antigos do cliente) + 2 cadastradas = 3 perfis, cada
  // um com Instagram e Página própria.
  const cliente3 = {
    nome: 'Rede com 3 lojas',
    instagramToken: 'tok-principal', instagramUserId: 'ig-principal', instagramUsername: 'lojacentro',
    facebookPageId: 'fb-principal', facebookPageToken: 'ptok-principal', metaConectado: true,
    contas: [conta('loja2', 'lojabairro'), conta('loja3', 'lojashopping')],
  }

  it('o cliente tem mesmo os 3 perfis', () => {
    expect(contasDoCliente(cliente3).map(c => c.id)).toEqual([ID_CONTA_PRINCIPAL, 'loja2', 'loja3'])
  })

  it('selecionar UM perfil devolve UM alvo — nunca os três', () => {
    const alvo = contasAlvo(cliente3, ['loja2'])
    expect(alvo.map(c => c.id)).toEqual(['loja2'])
    expect(alvo.length).toBe(1)
  })

  it('o alvo carrega o token DAQUELE perfil, não o da principal', () => {
    // É isto que garante que a API publica na conta certa: publishToInstagram
    // recebe a conta e lê conta.instagramToken/instagramUserId.
    const [a] = contasAlvo(cliente3, ['loja3'])
    expect(a.instagramToken).toBe('tok-loja3')
    expect(a.instagramUserId).toBe('ig-loja3')
    expect(a.facebookPageId).toBe('fb-loja3')
    expect(a.facebookPageToken).toBe('ptok-loja3')
  })

  it('selecionar dois devolve dois, e o terceiro fica de fora', () => {
    const ids = contasAlvo(cliente3, [ID_CONTA_PRINCIPAL, 'loja3']).map(c => c.id)
    expect(ids).toEqual([ID_CONTA_PRINCIPAL, 'loja3'])
    expect(ids).not.toContain('loja2')
  })

  it('id repetido no pedido não publica duas vezes no mesmo perfil', () => {
    expect(contasAlvo(cliente3, ['loja2', 'loja2', 'loja2']).map(c => c.id)).toEqual(['loja2'])
  })

  it('a chave do anti-duplicação separa perfil de perfil', () => {
    // Sem o contaId na chave, publicar no Instagram da loja2 marcaria "instagram"
    // como feito e o post NUNCA sairia na loja3.
    expect(chavePublicacao('loja2', 'instagram')).not.toBe(chavePublicacao('loja3', 'instagram'))
    expect(jaPublicou([chavePublicacao('loja2', 'instagram')], 'loja3', 'instagram')).toBe(false)
    expect(jaPublicou([chavePublicacao('loja2', 'instagram')], 'loja2', 'instagram')).toBe(true)
  })
})

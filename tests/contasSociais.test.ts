import { describe, it, expect } from 'vitest'
import {
  contaPrincipal, contasDoCliente, contaPorId, contasAlvo,
  redesDaConta, contaConectada, chavePublicacao, jaPublicou,
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

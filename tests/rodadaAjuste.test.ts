import { describe, it, expect } from 'vitest'
import {
  emRodadaDeAjuste, feedbackParaTarefa, itensDoPedido, novaVersaoDaTarefa, entregaNaRodada,
  descartarVersaoNova, patchDoReenvio, versaoNaAprovacao, pedidoDaEntrada, itensDaUltimaRodada,
  mensagemNovaVersao, type PostRodada,
} from '@/lib/rodadaAjuste'

const T0 = '2026-09-29T12:00:00.000Z'
const T1 = '2026-09-30T12:00:00.000Z'
const T2 = '2026-10-01T12:00:00.000Z'
const criativo = (url: string) => ({ nome: url, url, tipo: 'image/png', papel: 'criativo' as const })

// A peça como fica depois que o cliente pede ajuste pelo link.
const emAjuste: PostRodada = {
  status: 'corrigir',
  imagens: ['v1.png'],
  legenda: 'Legenda',
  motivoReprovacao: 'Trocar a cor do fundo',
  anotacoes: [{ x: 10, y: 20, text: 'Logo maior', img: 0 }],
}

describe('rodada de ajuste — o pedido chega ao designer', () => {
  it('link e portal mandam o MESMO texto à tarefa, com os pontos marcados', () => {
    expect(feedbackParaTarefa('Trocar a cor', [{ text: 'Logo maior' }, { text: 'Tirar o selo', img: 2 }]))
      .toBe('Trocar a cor — Pontos marcados na arte: 1) Logo maior; 2) Tirar o selo (lâmina 3)')
    expect(feedbackParaTarefa('', [{ text: 'Só um ponto' }])).toBe('Pontos marcados na arte: 1) Só um ponto')
    expect(feedbackParaTarefa('Só texto', [])).toBe('Só texto')
  })

  it('itens do pedido: recado geral primeiro, pontos em seguida, sem vazios', () => {
    expect(itensDoPedido('Geral', [{ text: 'A' }, { texto: 'B' }, { text: '  ' }])).toEqual(['Geral', 'A', 'B'])
  })

  it('só corrigir e reprovado contam como rodada aberta', () => {
    expect(emRodadaDeAjuste({ status: 'corrigir' })).toBe(true)
    expect(emRodadaDeAjuste({ status: 'reprovado' })).toBe(true)
    expect(emRodadaDeAjuste({ status: 'aguardando_aprovacao' })).toBe(false)
  })
})

describe('rodada de ajuste — o designer entrega (a QUEBRA de 29/09)', () => {
  it('concluir com arte nova vira versão PENDENTE: a arte do cliente não muda ainda', () => {
    const p = entregaNaRodada(emAjuste, [criativo('v1.png'), criativo('v2.png')], 'Ana', 't1', T1)!
    expect(p.versaoNova).toEqual({ imagens: ['v2.png'], completa: true, entregueEm: T1, por: 'Ana', tarefaId: 't1' })
    expect(p.criativoEntregueEm).toBe(T1)
    expect(p.imagens).toBeUndefined() // o link segue mostrando a v1 até a equipe revisar
  })

  it('o anexo da versão anterior (ainda marcado como criativo) não volta como novo', () => {
    expect(novaVersaoDaTarefa(emAjuste, [criativo('v1.png')])).toBeNull()
    expect(entregaNaRodada(emAjuste, [criativo('v1.png')], 'Ana', 't1', T1)).toBeNull()
  })

  it('fora da rodada não faz nada (a primeira entrega segue o fluxo do Studio)', () => {
    expect(entregaNaRodada({ ...emAjuste, status: 'rascunho' }, [criativo('v2.png')], 'Ana', 't1', T1)).toBeNull()
  })

  it('carrossel com menos arquivos que lâminas é entrega PARCIAL', () => {
    const carrossel = { ...emAjuste, imagens: ['a.png', 'b.png', 'c.png'] }
    expect(novaVersaoDaTarefa(carrossel, [criativo('b2.png')])).toEqual({ imagens: ['b2.png'], completa: false })
    expect(novaVersaoDaTarefa(carrossel, [criativo('a2.png'), criativo('b2.png'), criativo('c2.png')])?.completa).toBe(true)
  })

  it('entrega nova por cima de outra ainda não revisada: a anterior fica registrada e não volta', () => {
    const comPendente = { ...emAjuste, ...entregaNaRodada(emAjuste, [criativo('v2.png')], 'Ana', 't1', T1)! }
    const p = entregaNaRodada(comPendente, [criativo('v2.png'), criativo('v3.png')], 'Ana', 't1', T2)!
    expect(p.versaoNova.imagens).toEqual(['v3.png'])
    expect(p.versoes).toEqual([expect.objectContaining({ imagens: ['v2.png'], descartada: true })])
  })
})

describe('rodada de ajuste — volta ao cliente (qualquer botão de reenviar)', () => {
  const comPendente = { ...emAjuste, ...entregaNaRodada(emAjuste, [criativo('v2.png')], 'Ana', 't1', T1)! } as PostRodada

  it('troca a arte, arquiva a que o cliente viu COM o pedido, limpa o pedido e soma a rodada', () => {
    const p = patchDoReenvio(comPendente, undefined, T2)!
    expect(p.imagens).toEqual(['v2.png'])
    expect(p.versaoNova).toBeUndefined()
    expect(p.anotacoes).toEqual([])
    expect(p.motivoReprovacao).toBeUndefined()
    expect(p.rodada).toBe(2)
    expect(p.aguardandoDesde).toBe(T2)
    expect(p.criativoRevisaoInternaEm).toBe(T2)
    expect(p.versoes).toEqual([{ n: 1, imagens: ['v1.png'], legenda: 'Legenda', pedido: { texto: 'Trocar a cor do fundo', anotacoes: emAjuste.anotacoes }, arquivadaEm: T2, status: 'corrigir' }])
  })

  it('o editor manda as mesmas imagens de antes: a versão nova entra mesmo assim', () => {
    expect(patchDoReenvio(comPendente, ['v1.png'], T2)!.imagens).toEqual(['v2.png'])
  })

  it('a equipe montou a mídia à mão no reenvio: vale o que ela montou; a pendente fica registrada', () => {
    const p = patchDoReenvio(comPendente, ['manual.png'], T2)!
    expect(p.imagens).toBeUndefined() // o PUT mantém as imagens que vieram no envio
    expect(p.versoes.at(-1)).toMatchObject({ imagens: ['v2.png'], descartada: true })
  })

  it('entrega parcial de carrossel não troca sozinha', () => {
    const parcial = { ...comPendente, imagens: ['a.png', 'b.png'], versaoNova: { ...comPendente.versaoNova!, completa: false } }
    const p = patchDoReenvio(parcial, undefined, T2)!
    expect(p.imagens).toBeUndefined()
    expect(p.versoes.at(-1)).toMatchObject({ descartada: true })
  })

  it('reenvio sem arte nova (ajuste só de texto) também arquiva e limpa o pedido', () => {
    const p = patchDoReenvio(emAjuste, undefined, T2)!
    expect(p.imagens).toBeUndefined()
    expect(p.anotacoes).toEqual([])
    expect(p.versoes).toHaveLength(1)
  })

  it('fora da rodada não mexe em nada', () => {
    expect(patchDoReenvio({ ...emAjuste, status: 'rascunho' }, undefined, T2)).toBeNull()
  })
})

describe('rodada de ajuste — aprovação com versão pendente', () => {
  const comPendente = { ...emAjuste, ...entregaNaRodada(emAjuste, [criativo('v2.png')], 'Ana', 't1', T1)! } as PostRodada

  it('o CLIENTE aprovou assim mesmo: vale o que ele viu; a do designer é descartada, registrada', () => {
    const p = versaoNaAprovacao(comPendente, false, T2)
    expect(p.imagens).toBeUndefined()
    expect(p.versaoNova).toBeUndefined()
    expect(p.versoes.at(-1)).toMatchObject({ imagens: ['v2.png'], descartada: true, motivo: 'O cliente aprovou a versão anterior' })
  })

  it('a EQUIPE aprovou por cima: vale a versão nova', () => {
    expect(versaoNaAprovacao(comPendente, true, T2).imagens).toEqual(['v2.png'])
  })

  it('sem versão pendente não muda nada', () => {
    expect(versaoNaAprovacao(emAjuste, true, T2)).toEqual({})
    expect(descartarVersaoNova(emAjuste, 'x', T2)).toEqual({})
  })
})

describe('Solicitações — o pedido sobre a arte que o cliente VIU', () => {
  const tsPedido = new Date(T0).getTime()
  const comPendente = { ...emAjuste, ...entregaNaRodada(emAjuste, [criativo('v2.png')], 'Ana', 't1', T1)! } as PostRodada
  const reenviado = { ...comPendente, ...patchDoReenvio(comPendente, undefined, T2)!, status: 'aguardando_aprovacao' } as PostRodada

  it('rodada aberta: o pedido e a arte estão na peça', () => {
    expect(pedidoDaEntrada(tsPedido, emAjuste)).toEqual({ texto: 'Trocar a cor do fundo', anotacoes: emAjuste.anotacoes, imagens: ['v1.png'], encerrado: false })
  })

  it('rodada encerrada: pinos antigos ficam sobre a v1, não sobre a arte nova', () => {
    const r = pedidoDaEntrada(tsPedido, reenviado)
    expect(r.imagens).toEqual(['v1.png'])
    expect(r.anotacoes).toEqual(emAjuste.anotacoes)
    expect(r.encerrado).toBe(true)
  })

  it('o pedido que foi feito pelo portal (ajusteCriativo) também aparece', () => {
    expect(pedidoDaEntrada(tsPedido, { status: 'corrigir', ajusteCriativo: 'Pelo portal' }).texto).toBe('Pelo portal')
  })

  it('a mensagem de reenvio lista os ajustes da rodada encerrada', () => {
    expect(itensDaUltimaRodada(reenviado)).toEqual(['Trocar a cor do fundo', 'Logo maior'])
    expect(mensagemNovaVersao({ itens: ['Trocar a cor do fundo', 'Logo maior'], link: 'https://x/aprovacoes/tk', dataPostagem: '2026-10-03T15:00:00.000Z' }))
      .toBe('Olá! A nova versão do post do dia 03/10 está pronta para a sua aprovação, com os ajustes que você pediu:\n• Trocar a cor do fundo\n• Logo maior\n\nPara aprovar ou pedir outro ajuste: https://x/aprovacoes/tk')
    expect(mensagemNovaVersao({ itens: [], link: 'L' })).toBe('Olá! A nova versão do post está pronta para a sua aprovação.\n\nPara aprovar ou pedir outro ajuste: L')
  })
})

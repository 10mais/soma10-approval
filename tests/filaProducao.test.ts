import { describe, it, expect } from 'vitest'
import { colunaDoCriativo, alertaDoPrazo, prontoParaEnviar, ordenarFila, podeMoverCartao, diasDesde, COLUNAS_FILA, destinosDoCartao, destinoAoSoltar, colunaAposMover, destinoDaColuna } from '@/lib/filaProducao'
import { fimDoDiaBR } from '@/lib/datas'

// Dono, 26/10/2026: "Preciso de uma FILA DE PRODUÇÃO de criativos, onde os designers recebam os
// criativos para produzir e preencham qual o status".
const AGORA = Date.parse('2026-10-26T15:00:00Z') // segunda, meio-dia em Brasília
const pauta = (extra: Record<string, any> = {}) => ({ id: 'p1', etapa: 'criativo', status: 'rascunho', ...extra })
const tarefa = (extra: Record<string, any> = {}) => ({ id: 't1', status: 'a_fazer', ...extra })

describe('colunaDoCriativo — o designer move, o resto anda sozinho', () => {
  it('copy ainda não aprovada não entra na fila; excluída também não', () => {
    for (const etapa of ['briefing', 'copy', 'aprovacao_copy']) expect(colunaDoCriativo(pauta({ etapa }), tarefa(), AGORA)).toBeNull()
    expect(colunaDoCriativo(pauta({ etapa: undefined }), tarefa(), AGORA)).toBeNull()
    expect(colunaDoCriativo(pauta({ excluidoEm: '2026-10-25T10:00:00Z' }), tarefa(), AGORA)).toBeNull()
  })

  it('as colunas do designer saem da tarefa: na fila, em produção, aguardando material', () => {
    expect(colunaDoCriativo(pauta(), tarefa(), AGORA)).toBe('na_fila')
    expect(colunaDoCriativo(pauta(), tarefa({ status: 'em_andamento' }), AGORA)).toBe('em_producao')
    expect(colunaDoCriativo(pauta(), tarefa({ status: 'em_andamento', aguardandoMaterial: { motivo: 'Falta a foto', desde: '2026-10-25T10:00:00Z' } }), AGORA)).toBe('aguardando_material')
    expect(colunaDoCriativo(pauta(), undefined, AGORA)).toBe('na_fila') // sem designer: espera na fila
  })

  it('ajuste pedido volta ao designer; começou a refazer, vai para em produção', () => {
    expect(colunaDoCriativo(pauta({ status: 'corrigir' }), tarefa({ ajustePedidoEm: '2026-10-26T12:00:00Z' }), AGORA)).toBe('ajuste_pedido')
    expect(colunaDoCriativo(pauta({ status: 'corrigir' }), tarefa({ status: 'em_andamento', ajustePedidoEm: '2026-10-26T12:00:00Z' }), AGORA)).toBe('em_producao')
    expect(colunaDoCriativo(pauta({ status: 'corrigir' }), tarefa({ status: 'concluido' }), AGORA)).toBe('ajuste_pedido') // concluiu sem nova versão
  })

  it('entregou: revisão interna; na rodada de ajuste, a nova versão também espera a revisão', () => {
    expect(colunaDoCriativo(pauta({ criativoEntregueEm: '2026-10-26T13:00:00Z' }), tarefa({ status: 'concluido' }), AGORA)).toBe('revisao_interna')
    expect(colunaDoCriativo(pauta({ status: 'corrigir', versaoNova: { imagens: ['x'] } }), tarefa({ status: 'concluido' }), AGORA)).toBe('revisao_interna')
    expect(colunaDoCriativo(pauta(), tarefa({ status: 'em_revisao' }), AGORA)).toBe('revisao_interna')
  })

  it('com o cliente e aprovado (que sai do quadro depois de 7 dias)', () => {
    expect(colunaDoCriativo(pauta({ etapa: 'aprovacao_criativo', status: 'aguardando_aprovacao' }), tarefa({ status: 'concluido' }), AGORA)).toBe('com_cliente')
    expect(colunaDoCriativo(pauta({ etapa: 'pronto', status: 'agendado', criativoAprovadoEm: '2026-10-24T12:00:00Z' }), tarefa({ status: 'concluido' }), AGORA)).toBe('aprovado')
    expect(colunaDoCriativo(pauta({ etapa: 'pronto', status: 'publicado', criativoAprovadoEm: '2026-10-10T12:00:00Z' }), tarefa({ status: 'concluido' }), AGORA)).toBeNull()
  })

  it('a ordem da tela começa pelo ajuste pedido', () => {
    expect(COLUNAS_FILA.map(c => c.chave)).toEqual(['ajuste_pedido', 'na_fila', 'em_producao', 'aguardando_material', 'revisao_interna', 'com_cliente', 'aprovado'])
  })
})

describe('alertas, pronto para enviar e ordem', () => {
  it('atrasado e vence hoje só contam nas colunas do designer', () => {
    expect(alertaDoPrazo('em_producao', fimDoDiaBR('2026-10-23'), AGORA)).toBe('atrasado')
    expect(alertaDoPrazo('na_fila', fimDoDiaBR('2026-10-26'), AGORA)).toBe('hoje')
    expect(alertaDoPrazo('na_fila', fimDoDiaBR('2026-10-28'), AGORA)).toBeNull()
    expect(alertaDoPrazo('com_cliente', fimDoDiaBR('2026-10-23'), AGORA)).toBeNull()
  })

  it('revisão interna aprovada = falta só enviar ao cliente', () => {
    const entregue = pauta({ criativoEntregueEm: '2026-10-26T10:00:00Z' })
    expect(prontoParaEnviar('revisao_interna', entregue)).toBe(false)
    expect(prontoParaEnviar('revisao_interna', { ...entregue, criativoRevisaoInternaEm: '2026-10-26T11:00:00Z' })).toBe(true)
  })

  it('ordena pelo prazo do criativo, depois pela postagem', () => {
    const r = ordenarFila([
      { titulo: 'C', prazo: fimDoDiaBR('2026-10-29') },
      { titulo: 'sem prazo' },
      { titulo: 'A', prazo: fimDoDiaBR('2026-10-20') },
      { titulo: 'B', prazo: fimDoDiaBR('2026-10-29'), dataPostagem: '2026-11-03T13:00:00Z' },
    ])
    expect(r.map(x => x.titulo)).toEqual(['A', 'B', 'C', 'sem prazo'])
  })

  it('quem move: o designer da peça, gestores do squad, gerente e admin', () => {
    expect(podeMoverCartao({ email: 'des@x', role: 'usuario' }, 'DES@x')).toBe(true)
    expect(podeMoverCartao({ email: 'gp@x', role: 'usuario' }, 'des@x', ['gp@x'])).toBe(true)
    expect(podeMoverCartao({ email: 'outra@x', role: 'usuario' }, 'des@x', ['gp@x'])).toBe(false)
    expect(podeMoverCartao({ email: 'g@x', role: 'gerente' }, 'des@x')).toBe(true)
    expect(podeMoverCartao({ email: 'c@x', role: 'cliente' }, 'c@x')).toBe(false)
  })

  it('para onde o cartão vai: só entre as colunas do designer, e o ajuste volta para o ajuste', () => {
    expect(destinosDoCartao('na_fila')).toEqual(['em_producao', 'aguardando_material'])
    expect(destinosDoCartao('aguardando_material')).toEqual(['na_fila', 'em_producao'])
    expect(destinosDoCartao('revisao_interna')).toEqual([])
    expect(destinoAoSoltar('em_producao', { coluna: 'na_fila' })).toBe('em_producao')
    expect(destinoAoSoltar('com_cliente', { coluna: 'em_producao' })).toBeNull()
    expect(destinoAoSoltar('na_fila', { coluna: 'na_fila' })).toBeNull()
    // Em produção refazendo um ajuste: "voltar" é para Ajuste pedido, e Na fila não aceita.
    expect(destinoAoSoltar('ajuste_pedido', { coluna: 'em_producao', ajuste: true })).toBe('na_fila')
    expect(destinoAoSoltar('na_fila', { coluna: 'em_producao', ajuste: true })).toBeNull()
    expect(colunaAposMover('na_fila', true)).toBe('ajuste_pedido')
    expect(colunaAposMover('na_fila')).toBe('na_fila')
    expect(destinoDaColuna('ajuste_pedido')).toBe('na_fila')
    expect(destinoDaColuna('com_cliente')).toBeNull()
  })

  it('dias desde (para "há 2 dias")', () => {
    expect(diasDesde('2026-10-24T12:00:00Z', AGORA)).toBe(2)
    expect(diasDesde('2026-10-26T10:00:00Z', AGORA)).toBe(0)
    expect(diasDesde(undefined, AGORA)).toBeUndefined()
  })
})

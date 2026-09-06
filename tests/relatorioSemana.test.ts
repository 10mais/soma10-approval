import { describe, it, expect } from 'vitest'
import { semanaDe, deslocarSemana, montarRelatorio, textoRelatorio, tituloDoPost } from '@/lib/relatorioSemana'

// O relatório vai para o CLIENTE como evidência de serviço. Errar a classificação
// é prometer o que não foi feito (ou esconder o que foi) — por isso cada regra
// tem um teste.

const SEMANA = semanaDe(new Date(2026, 8, 2, 15, 0)) // quarta 02/09/2026 -> seg 31/08 a dom 06/09
const em = (dia: number, hora = 10) => new Date(2026, 8, dia, hora).toISOString()

describe('semanaDe', () => {
  it('vai de segunda 00:00 a domingo 23:59:59', () => {
    const ini = new Date(SEMANA.inicio), fim = new Date(SEMANA.fim)
    expect(ini.getDay()).toBe(1)
    expect(ini.getHours()).toBe(0)
    expect(fim.getDay()).toBe(0)
    expect(fim.getHours()).toBe(23)
    expect(ini.getDate()).toBe(31)
    expect(fim.getDate()).toBe(6)
  })
  it('domingo pertence à semana que começou na segunda anterior', () => {
    const s = semanaDe(new Date(2026, 8, 6, 20, 0))
    expect(new Date(s.inicio).getDate()).toBe(31)
  })
  it('deslocarSemana anda semanas inteiras', () => {
    const prox = deslocarSemana(SEMANA, 1)
    expect(new Date(prox.inicio).getDate()).toBe(7)
    const ant = deslocarSemana(SEMANA, -1)
    expect(new Date(ant.inicio).getDate()).toBe(24)
  })
})

describe('montarRelatorio — entregas', () => {
  it('post publicado na semana entra em publicados; fora da semana não', () => {
    const r = montarRelatorio({ semana: SEMANA, posts: [
      { id: 'a', status: 'publicado', dataAgendada: em(2), headline: 'Dia dos pais', formato: 'reel', redesPublicadas: ['instagram'] },
      { id: 'b', status: 'publicado', dataAgendada: em(20), headline: 'Fora' },
    ] })
    expect(r.entregas.publicados.map(i => i.id)).toEqual(['a'])
    expect(r.entregas.publicados[0].detalhe).toBe('Reel · Instagram')
  })
  it('post excluído nunca aparece', () => {
    const r = montarRelatorio({ semana: SEMANA, posts: [{ id: 'x', status: 'publicado', dataAgendada: em(2), excluidoEm: em(3) }] })
    expect(r.numeros.entregues).toBe(0)
  })
  it('criativo aprovado na semana conta como entrega (sem duplicar quem já foi publicado)', () => {
    const r = montarRelatorio({ semana: SEMANA, posts: [
      { id: 'a', etapa: 'pronto', criativoAprovadoEm: em(3), headline: 'Aprovado' },
      { id: 'b', status: 'publicado', dataAgendada: em(4), criativoAprovadoEm: em(3), headline: 'Publicado' },
    ] })
    expect(r.entregas.aprovados.map(i => i.id)).toEqual(['a'])
    expect(r.entregas.aprovados[0].detalhe).toBe('Criativo aprovado')
    expect(r.entregas.publicados.map(i => i.id)).toEqual(['b'])
  })
  it('tarefa concluída na semana entra; concluída antes não', () => {
    const r = montarRelatorio({ semana: SEMANA, tarefas: [
      { id: 't1', titulo: 'Landing', status: 'concluido', concluidoEm: em(1), responsavelNome: 'Ana' },
      { id: 't2', titulo: 'Velha', status: 'concluido', concluidoEm: new Date(2026, 7, 10).toISOString() },
    ] })
    expect(r.entregas.tarefasConcluidas.map(i => i.id)).toEqual(['t1'])
    expect(r.entregas.tarefasConcluidas[0].detalhe).toBe('Ana')
  })
  it('etapa do Playbook concluída na semana entra', () => {
    const r = montarRelatorio({ semana: SEMANA, marcos: [{ id: 'm', titulo: 'Onboarding', status: 'concluido', atualizadoEm: em(5), categoria: 'Estratégia' }] })
    expect(r.entregas.marcosConcluidos).toHaveLength(1)
    expect(r.numeros.entregues).toBe(1)
  })
  it('itens ficam em ordem cronológica', () => {
    const r = montarRelatorio({ semana: SEMANA, posts: [
      { id: 'b', status: 'publicado', dataAgendada: em(5) },
      { id: 'a', status: 'publicado', dataAgendada: em(1) },
    ] })
    expect(r.entregas.publicados.map(i => i.id)).toEqual(['a', 'b'])
  })
})

describe('montarRelatorio — em andamento e próximos', () => {
  it('aguardando cliente = etapas de aprovação; em produção = briefing/copy/criativo', () => {
    const r = montarRelatorio({ semana: SEMANA, posts: [
      { id: 'a', etapa: 'aprovacao_copy', headline: 'Copy' },
      { id: 'b', etapa: 'criativo', headline: 'Arte' },
      { id: 'c', etapa: 'pronto', headline: 'Pronto' },
    ] })
    expect(r.emAndamento.aguardandoCliente.map(i => i.id)).toEqual(['a'])
    expect(r.emAndamento.aguardandoCliente[0].detalhe).toBe('Copy em aprovação')
    expect(r.emAndamento.emProducao.map(i => i.id)).toEqual(['b'])
    expect(r.numeros.aguardandoCliente).toBe(1)
  })
  it('agendados nos 7 dias seguintes viram próximos passos; mais longe não', () => {
    const r = montarRelatorio({ semana: SEMANA, posts: [
      { id: 'a', status: 'agendado', dataAgendada: em(8) },
      { id: 'b', status: 'agendado', dataAgendada: em(25) },
      { id: 'c', status: 'agendado', dataAgendada: em(3) }, // dentro da semana, não é "próximo"
    ] })
    expect(r.proximos.agendados.map(i => i.id)).toEqual(['a'])
  })
  it('tarefas abertas com prazo até a próxima semana (inclusive atrasadas) entram em próximos', () => {
    const r = montarRelatorio({ semana: SEMANA, tarefas: [
      { id: 'atrasada', titulo: 'A', status: 'em_andamento', prazo: em(1) },
      { id: 'prox', titulo: 'B', status: 'a_fazer', prazo: em(9) },
      { id: 'longe', titulo: 'C', status: 'a_fazer', prazo: em(28) },
      { id: 'feita', titulo: 'D', status: 'concluido', prazo: em(9) },
    ] })
    expect(r.proximos.tarefasComPrazo.map(i => i.id)).toEqual(['atrasada', 'prox'])
    expect(r.emAndamento.tarefasAbertas).toHaveLength(3)
  })
})

describe('textoRelatorio', () => {
  it('semana vazia diz isso com todas as letras', () => {
    const t = textoRelatorio(montarRelatorio({ semana: SEMANA }), 'GL Joias')
    expect(t).toContain('RELATÓRIO DA SEMANA — GL Joias')
    expect(t).toContain('Nenhuma entrega registrada')
    expect(t).toContain('Próximos passos serão definidos')
  })
  it('lista entregas com detalhe e data', () => {
    const t = textoRelatorio(montarRelatorio({ semana: SEMANA, posts: [{ id: 'a', status: 'publicado', dataAgendada: em(2), headline: 'Dia dos pais', formato: 'feed' }] }), 'GL')
    expect(t).toContain('Publicações no ar (1):')
    expect(t).toContain('- Dia dos pais (Feed)')
  })
})

describe('tituloDoPost', () => {
  it('prefere headline, depois briefing, depois legenda; corta em 72', () => {
    expect(tituloDoPost({ id: '1', headline: 'H', legenda: 'L' })).toBe('H')
    expect(tituloDoPost({ id: '1', legenda: 'x'.repeat(100) })).toHaveLength(71)
    expect(tituloDoPost({ id: '1' })).toBe('Post sem título')
  })
})

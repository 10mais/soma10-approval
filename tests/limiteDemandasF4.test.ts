import { describe, it, expect } from 'vitest'
import {
  podeAssumir, podeForcarLimite, motivoExcecaoValido, textoExcecao, relogioProducao, metricasProducao, fmtDuracao,
  MAX_ENTREGAS_GUARDADAS, type TarefaLimite, type ConfigLimite,
} from '@/lib/limiteDemandas'

// LIMITADOR DE DEMANDAS — fase 4 (15/11/2026): exceção do gestor, relógio de produção e métricas
// da Carga da equipe. As fases 0-3 estão em tests/limiteDemandas.test.ts.

const cfg: ConfigLimite = { ligado: true, limite: 3, porPessoa: {} }
const LUCAS = 'lucas@10mais.com'
const t = (id: string, o: Partial<TarefaLimite> = {}): TarefaLimite =>
  ({ id, titulo: id, status: 'a_fazer', tipo: 'carrossel', responsavelEmail: LUCAS, responsavelNome: 'Lucas Souza', ...o })
const andando = (id: string, o: Partial<TarefaLimite> = {}) => t(id, { status: 'em_andamento', ...o })

describe('exceção do gestor', () => {
  it('admin e gerente podem; o gestor de projetos do squad pode; os outros não', () => {
    expect(podeForcarLimite({ email: 'x@x', role: 'admin' })).toBe(true)
    expect(podeForcarLimite({ email: 'x@x', role: 'gerente' })).toBe(true)
    expect(podeForcarLimite({ email: 'GP@10mais.com', role: 'colaborador' }, 'gp@10mais.com ')).toBe(true)
    expect(podeForcarLimite({ email: LUCAS, role: 'colaborador' }, 'gp@10mais.com')).toBe(false)
    expect(podeForcarLimite({ email: LUCAS, role: 'colaborador' })).toBe(false)
    expect(podeForcarLimite(undefined, 'gp@10mais.com')).toBe(false)
  })
  it('motivo precisa de texto de verdade', () => {
    expect(motivoExcecaoValido('urgente: cliente antecipou')).toBe(true)
    expect(motivoExcecaoValido('  ok  ')).toBe(false)
    expect(motivoExcecaoValido(undefined)).toBe(false)
  })
  it('o histórico diz quem passou, com quantas a pessoa ficou e o motivo', () => {
    const tarefas = [andando('a'), andando('b'), andando('c')]
    const v = podeAssumir(t('d'), andando('d'), tarefas, cfg)
    expect(v.ok).toBe(false)
    expect(textoExcecao(v, andando('d'), ' Cliente antecipou a campanha ', 'Ana'))
      .toBe('Limite de vagas passado por Ana: Lucas ficou com 4 de 3. Motivo: Cliente antecipou a campanha')
  })
})

describe('relógio de produção', () => {
  const H = 3600000
  const T0 = '2026-11-16T12:00:00.000Z'
  const T1 = '2026-11-16T15:00:00.000Z' // +3h
  const T2 = '2026-11-16T16:00:00.000Z'
  const T3 = '2026-11-16T17:30:00.000Z' // +1h30

  it('pescar liga o relógio; entregar soma o tempo e registra a entrega de quem fez', () => {
    const pescada = { ...andando('a'), ...relogioProducao(t('a'), andando('a'), T0) }
    expect(pescada.emProducaoDesde).toBe(T0)
    const r = relogioProducao(pescada, { ...pescada, status: 'em_revisao' }, T1)
    expect('emProducaoDesde' in r && r.emProducaoDesde === undefined).toBe(true) // apaga o campo
    expect('producaoMs' in r && r.producaoMs === undefined).toBe(true) // zera para a próxima rodada
    expect(r.entregas).toEqual([{ por: LUCAS, em: T1, ms: 3 * H }])
  })

  it('Aguardando material pausa; voltar retoma e soma', () => {
    const a = { ...andando('a'), emProducaoDesde: T0 }
    const parada = { ...a, aguardandoMaterial: { motivo: 'foto' } }
    const p = relogioProducao(a, parada, T1)
    expect(p.producaoMs).toBe(3 * H)
    const pausada = { ...parada, ...p }
    const volta = relogioProducao(pausada, { ...pausada, aguardandoMaterial: undefined }, T2)
    expect(volta.emProducaoDesde).toBe(T2)
    const retomada = { ...pausada, aguardandoMaterial: undefined, ...volta }
    const fim = relogioProducao(retomada, { ...retomada, status: 'concluido' }, T3)
    expect(fim.entregas?.[0].ms).toBe(4.5 * H)
  })

  it('copy do Social Media e criativo do designer na mesma tarefa contam para cada um', () => {
    const SM = 'sm@10mais.com'
    const copy = { ...t('a', { fasePauta: 'copy', status: 'em_andamento', responsavelEmail: SM }), emProducaoDesde: T0 }
    const entregue = { ...copy, status: 'em_revisao', ...relogioProducao(copy, { ...copy, status: 'em_revisao' }, T1) }
    const comDesigner = { ...entregue, status: 'a_fazer', responsavelEmail: LUCAS, fasePauta: 'criativo' }
    expect(relogioProducao(entregue, comDesigner, T1)).toEqual({}) // passar de mãos não conta nada
    const pescada = { ...comDesigner, status: 'em_andamento', ...relogioProducao(comDesigner, { ...comDesigner, status: 'em_andamento' }, T2) }
    const fim = relogioProducao(pescada, { ...pescada, status: 'em_revisao' }, T3)
    expect(fim.entregas).toEqual([{ por: SM, em: T1, ms: 3 * H }, { por: LUCAS, em: T3, ms: 1.5 * H }])
  })

  it('concluir o que já estava em revisão não conta de novo; tarefa geral não conta', () => {
    const rev = t('a', { status: 'em_revisao' })
    expect(relogioProducao(rev, { ...rev, status: 'concluido' }, T1)).toEqual({})
    const geral = andando('g', { tipo: 'tarefa' })
    expect(relogioProducao(geral, { ...geral, status: 'concluido' }, T1)).toEqual({})
  })

  it('entrega sem relógio (peça pescada antes da F4) conta sem tempo', () => {
    const antiga = andando('a')
    expect(relogioProducao(antiga, { ...antiga, status: 'em_revisao' }, T1).entregas).toEqual([{ por: LUCAS, em: T1 }])
  })

  it('guarda no máximo as últimas entregas', () => {
    const muitas = Array.from({ length: MAX_ENTREGAS_GUARDADAS }, (_, i) => ({ por: LUCAS, em: `2026-10-${String(i + 1).padStart(2, '0')}T12:00:00.000Z` }))
    const a = { ...andando('a'), entregas: muitas }
    const r = relogioProducao(a, { ...a, status: 'em_revisao' }, T1)
    expect(r.entregas).toHaveLength(MAX_ENTREGAS_GUARDADAS)
    expect(r.entregas?.[MAX_ENTREGAS_GUARDADAS - 1].em).toBe(T1)
  })
})

describe('métricas da Carga da equipe', () => {
  const H = 3600000
  const agora = new Date('2026-11-20T12:00:00.000Z').getTime()
  const tarefas = [
    t('a', { entregas: [{ por: LUCAS, em: '2026-11-19T12:00:00.000Z', ms: 2 * H }, { por: 'sm@x', em: '2026-11-18T12:00:00.000Z', ms: H }] }),
    t('b', { entregas: [{ por: LUCAS, em: '2026-11-01T12:00:00.000Z', ms: 4 * H }] }), // fora da semana, dentro de 30 dias
    t('c', { entregas: [{ por: LUCAS, em: '2026-09-01T12:00:00.000Z', ms: 40 * H }] }), // fora dos 30 dias
    t('d', { excluidoEm: '2026-11-19T00:00:00.000Z', entregas: [{ por: LUCAS, em: '2026-11-19T12:00:00.000Z', ms: 9 * H }] }),
  ]
  it('entregas da semana e tempo médio de 30 dias, por pessoa', () => {
    expect(metricasProducao(LUCAS, tarefas, agora)).toEqual({ entregasSemana: 1, tempoMedioMs: 3 * H, amostra: 2 })
    expect(metricasProducao('SM@x', tarefas, agora)).toEqual({ entregasSemana: 1, tempoMedioMs: H, amostra: 1 })
    expect(metricasProducao('ninguem@x', tarefas, agora)).toEqual({ entregasSemana: 0, tempoMedioMs: null, amostra: 0 })
  })
  it('duração curta', () => {
    expect(fmtDuracao(null)).toBe('—')
    expect(fmtDuracao(40 * 60000)).toBe('40min')
    expect(fmtDuracao(3 * H + 20 * 60000)).toBe('3h20')
    expect(fmtDuracao(28 * H)).toBe('1d 4h')
  })
})

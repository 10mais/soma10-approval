import { describe, it, expect } from 'vitest'
import {
  ehDemandaCriativa, ocupaVaga, limiteDe, vagasDe, precisaDeVaga, podeAssumir, statusDoAjuste,
  ajusteEsperandoVaga, filaDe, pulouPrioridade, normalizarConfigLimite, emRiscoDeAtraso,
  CONFIG_LIMITE_PADRAO, type TarefaLimite, type ConfigLimite,
} from '@/lib/limiteDemandas'

const cfg: ConfigLimite = { ligado: true, limite: 3, porPessoa: {} }
const LUCAS = 'lucas@10mais.com'
const t = (id: string, o: Partial<TarefaLimite> = {}): TarefaLimite =>
  ({ id, titulo: id, status: 'a_fazer', tipo: 'carrossel', responsavelEmail: LUCAS, responsavelNome: 'Lucas Souza', ...o })
const andando = (id: string, o: Partial<TarefaLimite> = {}) => t(id, { status: 'em_andamento', ...o })

describe('ehDemandaCriativa', () => {
  it('pauta do Estúdio e tipos de peça contam', () => {
    expect(ehDemandaCriativa({ tipo: 'tarefa', origemPostId: 'p1' })).toBe(true)
    expect(ehDemandaCriativa({ tipo: 'tarefa', fasePauta: 'copy' })).toBe(true)
    for (const tipo of ['carrossel', 'reel', 'story', 'video', 'post', 'criativo', 'copy', 'briefing']) expect(ehDemandaCriativa({ tipo })).toBe(true)
  })
  it('reunião, planejamento, financeiro e tarefa geral não contam', () => {
    for (const tipo of ['tarefa', 'planejamento', 'estrategia', 'reuniao_interna', 'financeiro_clinica', undefined]) expect(ehDemandaCriativa({ tipo })).toBe(false)
  })
})

describe('ocupaVaga', () => {
  it('Em andamento e Em ajuste ocupam', () => {
    expect(ocupaVaga(t('a', { status: 'em_andamento' }))).toBe(true)
    expect(ocupaVaga(t('a', { status: 'em_ajuste' }))).toBe(true)
  })
  it('fila, entregue, concluída, descartada não ocupam', () => {
    for (const status of ['a_fazer', 'em_revisao', 'concluido', 'descartado']) expect(ocupaVaga(t('a', { status }))).toBe(false)
  })
  it('Aguardando material libera a vaga', () => {
    expect(ocupaVaga(andando('a', { aguardandoMaterial: { motivo: 'foto' } }))).toBe(false)
  })
  it('sem responsável, na lixeira ou fora da produção criativa não ocupam', () => {
    expect(ocupaVaga(andando('a', { responsavelEmail: '' }))).toBe(false)
    expect(ocupaVaga(andando('a', { excluidoEm: '2026-11-15' }))).toBe(false)
    expect(ocupaVaga(andando('a', { tipo: 'tarefa' }))).toBe(false)
  })
})

describe('limiteDe e vagasDe', () => {
  it('limite padrão e limite próprio da pessoa (e-mail sem diferenciar maiúscula)', () => {
    expect(limiteDe(LUCAS, cfg)).toBe(3)
    expect(limiteDe('LUCAS@10mais.com', { ...cfg, porPessoa: { [LUCAS]: 2 } })).toBe(2)
  })
  it('conta só as que ocupam vaga da pessoa', () => {
    const tarefas = [andando('a'), t('b', { status: 'em_ajuste' }), t('c'), andando('d', { responsavelEmail: 'outra@x.com' }), andando('e', { tipo: 'tarefa' })]
    const v = vagasDe(LUCAS, tarefas, cfg)
    expect(v.ocupadas).toBe(2)
    expect(v.livres).toBe(1)
    expect(v.acima).toBe(false)
    expect(v.tarefas.map(x => x.id)).toEqual(['a', 'b'])
  })
  it('ignora a tarefa que está sendo movida', () => {
    expect(vagasDe(LUCAS, [andando('a'), andando('b')], cfg, 'a').ocupadas).toBe(1)
  })
  it('acima do limite (já estava assim quando o limitador ligou)', () => {
    const v = vagasDe(LUCAS, [andando('a'), andando('b'), andando('c'), andando('d')], cfg)
    expect(v.acima).toBe(true)
    expect(v.livres).toBe(0)
  })
})

describe('precisaDeVaga', () => {
  it('pescar (A fazer -> Em andamento) precisa', () => {
    expect(precisaDeVaga(t('a'), andando('a'))).toBe(true)
  })
  it('material chegou (Aguardando -> em produção) precisa', () => {
    expect(precisaDeVaga(andando('a', { aguardandoMaterial: { motivo: 'x' } }), andando('a'))).toBe(true)
  })
  it('editar tarefa que já ocupa vaga não precisa (regra nova não trava item antigo)', () => {
    expect(precisaDeVaga(andando('a'), andando('a', { titulo: 'novo' }))).toBe(false)
    expect(precisaDeVaga(andando('a'), t('a', { status: 'em_ajuste' }))).toBe(false)
  })
  it('trocar o responsável de uma peça em andamento precisa de vaga na pessoa nova', () => {
    expect(precisaDeVaga(andando('a'), andando('a', { responsavelEmail: 'ana@x.com' }))).toBe(true)
  })
  it('entregar, devolver ou concluir nunca precisa', () => {
    expect(precisaDeVaga(andando('a'), t('a', { status: 'em_revisao' }))).toBe(false)
    expect(precisaDeVaga(andando('a'), t('a'))).toBe(false)
  })
  it('tarefa nova já criada em andamento precisa', () => {
    expect(precisaDeVaga(null, andando('a'))).toBe(true)
  })
})

describe('podeAssumir', () => {
  const tres = [andando('a'), andando('b'), t('c', { status: 'em_ajuste' })]
  it('a quarta bloqueia, com o motivo escrito para a própria pessoa', () => {
    const v = podeAssumir(t('d'), andando('d'), [...tres, t('d')], cfg, { email: LUCAS })
    expect(v.ok).toBe(false)
    expect(v.motivo).toContain('Você está com 3 de 3')
    expect(v.vagas?.tarefas.map(x => x.id)).toEqual(['a', 'b', 'c'])
  })
  it('quando outra pessoa move, o motivo diz o nome do responsável', () => {
    const v = podeAssumir(t('d'), andando('d'), [...tres, t('d')], cfg, { email: 'gestor@x.com' })
    expect(v.motivo).toContain('Lucas está com 3 de 3')
  })
  it('com vaga livre, pesca', () => {
    expect(podeAssumir(t('d'), andando('d'), [andando('a'), andando('b'), t('d')], cfg).ok).toBe(true)
  })
  it('entregar uma libera a vaga para a próxima', () => {
    const depoisDeEntregar = [andando('a'), andando('b'), t('c', { status: 'em_revisao' }), t('d')]
    expect(podeAssumir(t('d'), andando('d'), depoisDeEntregar, cfg).ok).toBe(true)
  })
  it('limitador desligado não bloqueia', () => {
    expect(podeAssumir(t('d'), andando('d'), [...tres, t('d')], { ...cfg, ligado: false }).ok).toBe(true)
  })
  it('tarefa fora da produção criativa nunca bloqueia', () => {
    expect(podeAssumir(t('d', { tipo: 'tarefa' }), andando('d', { tipo: 'tarefa' }), tres, cfg).ok).toBe(true)
  })
  it('limite próprio da pessoa vale', () => {
    expect(podeAssumir(t('d'), andando('d'), [andando('a'), andando('b')], { ...cfg, porPessoa: { [LUCAS]: 2 } }).ok).toBe(false)
    expect(podeAssumir(t('d'), andando('d'), tres, { ...cfg, porPessoa: { [LUCAS]: 5 } }).ok).toBe(true)
  })
})

describe('statusDoAjuste', () => {
  it('com vaga, o ajuste vira Em ajuste', () => {
    expect(statusDoAjuste(t('d', { status: 'em_revisao' }), [andando('a')], cfg)).toBe('em_ajuste')
  })
  it('sem vaga, espera na fila (A fazer)', () => {
    expect(statusDoAjuste(t('d', { status: 'em_revisao' }), [andando('a'), andando('b'), andando('c')], cfg)).toBe('a_fazer')
  })
  it('peça que já ocupa vaga continua (ajuste interno durante a produção)', () => {
    expect(statusDoAjuste(andando('a'), [andando('a'), andando('b'), andando('c')], cfg)).toBe('em_ajuste')
  })
  it('ajusteEsperandoVaga reconhece a marca', () => {
    expect(ajusteEsperandoVaga({ status: 'a_fazer', ajustePedidoEm: '2026-11-15' })).toBe(true)
    expect(ajusteEsperandoVaga({ status: 'em_ajuste', ajustePedidoEm: '2026-11-15' })).toBe(false)
  })
})

describe('filaDe e pulouPrioridade', () => {
  const fila = [
    t('normal', { prioridade: 'media', prazo: '2026-11-20T02:59:59.000Z' }),
    t('cedo', { prioridade: 'media', prazo: '2026-11-18T02:59:59.000Z' }),
    t('urgente', { prioridade: 'urgente', prazo: '2026-11-25T02:59:59.000Z' }),
    t('ajuste', { prioridade: 'baixa', ajustePedidoEm: '2026-11-15T12:00:00.000Z' }),
    andando('andando'),
    t('outra', { responsavelEmail: 'ana@x.com' }),
    t('reuniao', { tipo: 'tarefa' }),
  ]
  it('ajuste esperando vaga no topo, depois prioridade, depois prazo', () => {
    expect(filaDe(LUCAS, fila).map(x => x.id)).toEqual(['ajuste', 'urgente', 'cedo', 'normal'])
  })
  it('pescar pulando uma Prioridade avisa', () => {
    const minha = filaDe(LUCAS, fila)
    expect(pulouPrioridade(minha.find(x => x.id === 'cedo')!, minha)?.id).toBe('urgente')
    expect(pulouPrioridade(minha.find(x => x.id === 'urgente')!, minha)).toBeNull()
  })
})

describe('normalizarConfigLimite', () => {
  it('padrão: ligado, 3', () => {
    expect(normalizarConfigLimite(null)).toEqual(CONFIG_LIMITE_PADRAO)
  })
  it('limpa valores inválidos e e-mail em maiúscula', () => {
    const c = normalizarConfigLimite({ ligado: false, limite: 0, porPessoa: { 'ANA@X.com': 4, 'b@x.com': 0, '': 2 } })
    expect(c).toEqual({ ligado: false, limite: 3, porPessoa: { 'ana@x.com': 4 } })
  })
})

describe('emRiscoDeAtraso', () => {
  // 15/11/2026 é domingo; segunda 16, terça 17, quarta 18.
  it('na fila com prazo a 2 dias úteis ou menos', () => {
    expect(emRiscoDeAtraso(t('a', { prazo: '2026-11-18T02:59:59.000Z' }), '2026-11-16')).toBe(true) // prazo terça 17
    expect(emRiscoDeAtraso(t('a', { prazo: '2026-11-19T02:59:59.000Z' }), '2026-11-16')).toBe(true) // quarta 18
    expect(emRiscoDeAtraso(t('a', { prazo: '2026-11-20T02:59:59.000Z' }), '2026-11-16')).toBe(false) // quinta 19
  })
  it('já pescada, sem prazo ou fora da produção não entra', () => {
    expect(emRiscoDeAtraso(andando('a', { prazo: '2026-11-17T02:59:59.000Z' }), '2026-11-16')).toBe(false)
    expect(emRiscoDeAtraso(t('a'), '2026-11-16')).toBe(false)
    expect(emRiscoDeAtraso(t('a', { tipo: 'tarefa', prazo: '2026-11-17T02:59:59.000Z' }), '2026-11-16')).toBe(false)
  })
})

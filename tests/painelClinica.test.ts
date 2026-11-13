import { describe, it, expect } from 'vitest'
import {
  pipelinesDaClinica, classificarNovaRetorno, normalizaMetasSemana, metaContagemNoIntervalo, metasDoPeriodo,
  semanaDaComercial, chaveTelefone, paradosHaDias, funilDoMes, conversao, passaMesFunil, CHAVE_SEM_AUTOR,
  type AgendamentoP, type NegocioP,
} from '@/lib/painelClinica'
import { intervaloSemana, intervaloMes, metaVazia } from '@/lib/metas'

// Datas pelo construtor LOCAL (sem 'Z'): o build da Vercel roda em UTC e a
// máquina do dono em Brasília — o teste não pode depender de qual dos dois.
const em = (mes: number, dia: number, h = 10) => new Date(2026, mes - 1, dia, h, 0).toISOString()
const [SEG, DOM] = intervaloSemana(new Date(2026, 10, 13)) // semana de 9 a 15/11/2026
const AGORA = new Date(2026, 10, 13, 12, 0)
const ag = (id: string, contatoId: string | undefined, status: string, dataInicio: string, criadoEm: string, criadoPor?: string): AgendamentoP =>
  ({ id, contatoId, status, dataInicio, criadoEm, criadoPor })

describe('funis da clínica', () => {
  it('acha Agendamentos e Tratamentos pelo nome, em qualquer ordem', () => {
    expect(pipelinesDaClinica([{ id: 'p2', nome: 'Tratamentos', ordem: 0 }, { id: 'p1', nome: 'Agendamentos', ordem: 1 }])).toEqual({ entrada: 'p1', tratamentos: 'p2' })
  })
  it('sem nome reconhecível, o 1º é a entrada e o 2º o de tratamento', () => {
    expect(pipelinesDaClinica([{ id: 'a', nome: 'Leads', ordem: 0 }, { id: 'b', nome: 'Vendas', ordem: 1 }])).toEqual({ entrada: 'a', tratamentos: 'b' })
    expect(pipelinesDaClinica([])).toEqual({ entrada: undefined, tratamentos: undefined })
  })
})

describe('nova × retorno', () => {
  it('a primeira consulta é nova; a seguinte da mesma pessoa é retorno', () => {
    const c = classificarNovaRetorno([ag('a1', 'ana', 'atendido', em(10, 1), em(9, 25)), ag('a2', 'ana', 'agendado', em(11, 20), em(11, 10))])
    expect(c.get('a1')).toBe('nova')
    expect(c.get('a2')).toBe('retorno')
  })
  it('consulta cancelada ou falta antes NÃO transforma a próxima em retorno', () => {
    const c = classificarNovaRetorno([ag('x1', 'bia', 'cancelado', em(10, 1), em(9, 20)), ag('x2', 'bia', 'faltou', em(10, 8), em(9, 30)), ag('x3', 'bia', 'agendado', em(11, 20), em(11, 10))])
    expect(c.get('x3')).toBe('nova')
  })
  it('"Último procedimento" anotado na ficha (sistema anterior) já é retorno', () => {
    const c = classificarNovaRetorno([ag('y1', 'cris', 'agendado', em(11, 20), em(11, 10))], [{ id: 'cris', ultimoProcedimento: 'Botox' }])
    expect(c.get('y1')).toBe('retorno')
  })
  it('sem paciente vinculado conta como nova; empate no horário desempata pelo id', () => {
    const c = classificarNovaRetorno([ag('z1', undefined, 'agendado', em(11, 20), em(11, 10)), ag('b', 'dani', 'agendado', em(11, 20), em(11, 10)), ag('a', 'dani', 'agendado', em(11, 20), em(11, 10))])
    expect(c.get('z1')).toBe('nova')
    expect(c.get('a')).toBe('nova')
    expect(c.get('b')).toBe('retorno')
  })
})

describe('metas da semana', () => {
  it('limpa o que veio do banco', () => {
    expect(normalizaMetasSemana({ consultasNovas: '15', retornos: -3, comparecimentos: 7.6, lixo: 1 })).toEqual({ consultasNovas: 15, retornos: 0, comparecimentos: 8 })
    expect(normalizaMetasSemana(null)).toEqual({ consultasNovas: 0, retornos: 0, comparecimentos: 0 })
  })
  it('vale para qualquer período na proporção dos dias', () => {
    expect(metaContagemNoIntervalo(15, SEG, DOM)).toBe(15)
    const [ini, fim] = intervaloMes(2026, 10) // novembro: 30 dias
    expect(metaContagemNoIntervalo(7, ini, fim)).toBe(30)
    expect(metaContagemNoIntervalo(0, ini, fim)).toBe(0)
  })

  it('conta nova e retorno pelo dia em que foi MARCADO; comparecimento e falta pelo dia da consulta', () => {
    const agendamentos = [
      ag('a0', 'bia', 'atendido', em(10, 1), em(9, 25)),          // histórico da Bia
      ag('a1', 'ana', 'agendado', em(11, 20), em(11, 10)),        // nova, marcada na semana
      ag('a2', 'bia', 'confirmado', em(11, 12), em(11, 11)),      // retorno, marcada na semana
      ag('a3', 'cris', 'cancelado', em(11, 18), em(11, 10)),      // cancelada: não conta
      ag('a4', 'dani', 'atendido', em(11, 12), em(11, 2)),        // marcada antes, veio na semana
      ag('a5', 'eva', 'faltou', em(11, 13), em(11, 3)),           // falta na semana
    ]
    const negocios: NegocioP[] = [
      { id: 'n1', status: 'ganho', pipelineId: 'trat', valor: 3000, fechadoEm: em(11, 12) },
      { id: 'n2', status: 'ganho', pipelineId: 'agend', valor: 200, fechadoEm: em(11, 12) },
    ]
    const meta = metaVazia(2026); meta.meses[10] = 30000
    const cards = metasDoPeriodo({ agendamentos, contatos: [], negocios, pipelineTratamentosId: 'trat', metasSemana: { consultasNovas: 5, retornos: 4, comparecimentos: 3 }, metasAno: [meta], de: SEG, ate: DOM, agora: AGORA })
    const por = Object.fromEntries(cards.map(c => [c.chave, c]))
    expect([por.consultasNovas.realizado, por.consultasNovas.meta]).toEqual([1, 5])
    expect([por.retornos.realizado, por.retornos.meta]).toEqual([1, 4])
    expect([por.comparecimentos.realizado, por.comparecimentos.faltas]).toEqual([1, 1])
    expect(por.tratamentos).toMatchObject({ realizado: 3000, meta: 7000, moeda: true })
    expect(por.consultasNovas.progresso.situacao).toBe('atrasado') // esperado ~3,6 até sexta
  })
})

describe('semana da comercial', () => {
  const usuarios = [
    { email: 'ana@x', nome: 'Ana Souza', role: 'vendas' },
    { email: 'bia@x', nome: 'Bia Recepção', role: 'usuario' },
    { email: 'dra@x', nome: 'Dra Norah', role: 'admin' },
  ]
  const linhas = semanaDaComercial({
    usuarios,
    mensagens: [
      { tel: 't1', em: em(11, 10), autor: 'Ana Souza' }, { tel: 't1', em: em(11, 11), autor: 'ana souza' },
      { tel: 't2', em: em(11, 12), autor: 'Ana Souza' }, { tel: 't9', em: em(11, 2), autor: 'Ana Souza' }, // fora da semana
      { tel: 't3', em: em(11, 12), autor: 'Bia Recepção' },
      { tel: 't4', em: em(11, 12) }, // saiu do celular, sem autor
    ],
    tarefas: [
      { id: 't-a', tipo: 'retorno_paciente', status: 'concluido', responsavelEmail: 'ana@x', concluidoEm: em(11, 10) },
      { id: 't-b', tipo: 'followup_orcamento', status: 'a_fazer', responsavelEmail: 'ana@x', prazo: em(11, 11, 23) },
      { id: 't-c', tipo: 'administrativo', status: 'concluido', responsavelEmail: 'ana@x', concluidoEm: em(11, 10) },
      { id: 't-d', tipo: 'retorno_paciente', status: 'a_fazer', responsavelEmail: 'ana@x', prazo: em(11, 20, 23) },
    ],
    negocios: [{
      id: 'n1', status: 'aberto', dono: 'ana@x', donoNome: 'Ana Souza', proximoFollowUp: '2026-11-08',
      atividades: [{ tipo: 'whatsapp', autor: 'Ana Souza', criadoEm: em(11, 12) }, { tipo: 'estagio', autor: 'Ana Souza', criadoEm: em(11, 12) }],
      agendamentos: [{ quando: '2026-11-10', feito: true, feitoEm: em(11, 11), feitoPor: 'Bia Recepção' }, { quando: '2026-11-05', feito: false }],
    }],
    agendamentos: [
      ag('g1', 'c1', 'agendado', em(11, 20), em(11, 10), 'Ana Souza'),
      ag('g2', 'c2', 'cancelado', em(11, 20), em(11, 11), 'ana@x'),
      ag('g3', 'c3', 'atendido', em(11, 12), em(11, 2), 'Bia Recepção'),
    ],
    de: SEG, ate: DOM, agora: AGORA,
  })

  it('uma linha por pessoa, a comercial primeiro, quem não fez nada fica de fora', () => {
    expect(linhas.map(l => l.nome)).toEqual(['Ana Souza', 'Bia Recepção', ''])
    expect(linhas.some(l => l.nome === 'Dra Norah')).toBe(false)
  })
  it('conta conversas, follow-ups feitos e atrasados, agendou, veio e a conversão', () => {
    expect(linhas[0]).toMatchObject({ conversas: 2, followupsFeitos: 2, followupsAtrasados: 3, agendou: 1, veio: 0, conversao: 50 })
    expect(linhas[1]).toMatchObject({ conversas: 1, followupsFeitos: 1, followupsAtrasados: 0, agendou: 0, veio: 1, conversao: 0 })
  })
  it('mensagem sem autor (celular) vai numa linha à parte, no fim', () => {
    expect(linhas[2]).toMatchObject({ chave: CHAVE_SEM_AUTOR, semAutor: true, conversas: 1 })
  })
  it('a comercial aparece mesmo com a semana zerada', () => {
    const vazio = semanaDaComercial({ usuarios, mensagens: [], tarefas: [], negocios: [], agendamentos: [], de: SEG, ate: DOM, agora: AGORA })
    expect(vazio.map(l => [l.nome, l.agendou, l.conversao])).toEqual([['Ana Souza', 0, null]])
  })
  it('nome que não é de ninguém da equipe vira a própria linha', () => {
    const r = semanaDaComercial({ usuarios: [], mensagens: [{ tel: 'x', em: em(11, 10), autor: 'Fulano' }], tarefas: [], negocios: [], agendamentos: [], de: SEG, ate: DOM, agora: AGORA })
    expect(r[0]).toMatchObject({ chave: 'nome:fulano', nome: 'Fulano', conversas: 1 })
  })
})

describe('oportunidades paradas', () => {
  it('o mesmo celular com e sem o 9 da frente casa', () => {
    expect(chaveTelefone('+55 (55) 99999-0001')).toBe(chaveTelefone('555599990001'))
    expect(chaveTelefone('')).toBe('')
  })
  const estagios = [{ id: 'e1', nome: 'Lead', pipelineId: 'p1' }, { id: 'e2', nome: 'Avaliação', pipelineId: 'p1' }, { id: 'eg', nome: 'Compareceu', ganho: true, pipelineId: 'p1' }]
  const pipelines = [{ id: 'p1', nome: 'Agendamentos' }]
  const contatos = [
    { id: 'c1', nome: 'Juliana', telefone: '+55 55 99999-0001', ultimoContato: em(10, 25) },
    { id: 'c2', nome: 'Rafaela', telefone: '+55 55 99999-0002' },
    { id: 'c4', nome: 'Paula' },
  ]
  const negocios: NegocioP[] = [
    { id: 'n1', status: 'aberto', estagioId: 'e1', pipelineId: 'p1', contatoId: 'c1', criadoEm: em(10, 20) },
    { id: 'n2', status: 'aberto', estagioId: 'e1', pipelineId: 'p1', contatoId: 'c2', criadoEm: em(10, 1) },
    { id: 'n3', status: 'ganho', estagioId: 'eg', pipelineId: 'p1', contatoId: 'c1', criadoEm: em(9, 1) },
    { id: 'n4', status: 'aberto', estagioId: 'e2', pipelineId: 'p1', contatoId: 'c4', criadoEm: em(11, 1), atividades: [{ tipo: 'nota', criadoEm: em(11, 3) }] },
    { id: 'n5', status: 'aberto', estagioId: 'e1', pipelineId: 'p1', criadoEm: em(11, 10), titulo: 'Lead novo' },
  ]
  const ultimaMsgPorTel = { '555599990002': em(11, 12) } // conversa da Rafaela, gravada sem o 9

  it('lista quem está sem toque há 7 dias ou mais, do mais antigo para o mais novo', () => {
    const r = paradosHaDias({ negocios, contatos, estagios, pipelines, ultimaMsgPorTel, agora: AGORA })
    expect(r.itens.map(i => [i.negocioId, i.dias])).toEqual([['n1', 19], ['n4', 10]])
    expect(r.itens[0]).toMatchObject({ nome: 'Juliana', estagio: 'Lead', pipeline: 'Agendamentos' })
    expect(r.total).toBe(2)
  })
  it('a conversa do WhatsApp conta como toque, e o limite corta a lista mas não o total', () => {
    const r = paradosHaDias({ negocios, contatos, estagios, pipelines, ultimaMsgPorTel, agora: AGORA, limite: 1 })
    expect(r.itens).toHaveLength(1)
    expect(r.total).toBe(2)
  })
  it('conversa vinculada ao contato também conta', () => {
    const r = paradosHaDias({ negocios, contatos, estagios, pipelines, ultimaMsgPorContato: { c1: em(11, 12) }, agora: AGORA })
    expect(r.itens.map(i => i.negocioId)).toEqual(['n2', 'n4'])
  })
})

describe('funil do mês', () => {
  const [ini, fim] = intervaloMes(2026, 10)
  const agendamentos = [
    ag('b0', 'c2', 'atendido', em(10, 1), em(9, 25)),
    ag('b1', 'c1', 'atendido', em(11, 10), em(11, 4)),
    ag('b2', 'c3', 'cancelado', em(11, 20), em(11, 8)),
    ag('b3', 'c2', 'agendado', em(11, 22), em(11, 9)),
  ]
  const negocios: NegocioP[] = [
    { id: 'x1', pipelineId: 'p1', criadoEm: em(11, 3) },
    { id: 'x2', pipelineId: 'p1', criadoEm: em(11, 5) },
    { id: 'x3', pipelineId: 'p1', criadoEm: em(10, 30) },
    { id: 'x4', pipelineId: 'p2', criadoEm: em(11, 6) },
    { id: 'x5', criadoEm: em(11, 7) }, // sem funil = padrão (Agendamentos)
    { id: 'x6', pipelineId: 'p2', status: 'ganho', valor: 3000, fechadoEm: em(11, 12), criadoEm: em(11, 6) },
  ]
  it('entraram → agendaram (1ª consulta) → compareceram (1ª consulta) → fecharam tratamento', () => {
    expect(funilDoMes({ negocios, agendamentos, contatos: [], pipelineEntradaId: 'p1', pipelineTratamentosId: 'p2', pipelinePadraoId: 'p1', de: ini, ate: fim }))
      .toEqual({ entraram: 3, agendaram: 1, compareceram: 1, fecharam: 1, valorFechado: 3000 })
  })
  it('conversão entre etapas, sem base não há número', () => {
    expect(conversao(10, 5)).toBe(50)
    expect(conversao(0, 3)).toBeNull()
  })
})

describe('quadro do funil por mês', () => {
  const [ini, fim] = intervaloMes(2026, 10)
  it('mostra o que entrou no mês, o que fechou no mês e o aberto de antes (com a chave ligada)', () => {
    expect(passaMesFunil({ id: '1', status: 'aberto', criadoEm: em(11, 3) }, ini, fim)).toBe(true)
    expect(passaMesFunil({ id: '2', status: 'aberto', criadoEm: em(10, 3) }, ini, fim)).toBe(true)
    expect(passaMesFunil({ id: '2', status: 'aberto', criadoEm: em(10, 3) }, ini, fim, false)).toBe(false)
    expect(passaMesFunil({ id: '3', status: 'ganho', criadoEm: em(10, 3), fechadoEm: em(11, 2) }, ini, fim)).toBe(true)
    expect(passaMesFunil({ id: '4', status: 'ganho', criadoEm: em(10, 3), fechadoEm: em(10, 20) }, ini, fim)).toBe(false)
    expect(passaMesFunil({ id: '5', status: 'perdido', criadoEm: em(10, 3), atividades: [{ tipo: 'perdido', criadoEm: em(11, 5) }] }, ini, fim)).toBe(true)
    expect(passaMesFunil({ id: '6', status: 'perdido', criadoEm: em(10, 3), atividades: [{ tipo: 'perdido', criadoEm: em(10, 5) }] }, ini, fim)).toBe(false)
    expect(passaMesFunil({ id: '7', status: 'aberto', criadoEm: em(12, 3) }, ini, fim)).toBe(false)
  })
})

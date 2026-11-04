import { describe, it, expect } from 'vitest'
import { chaveProcedimento, procedimentosPorContato, casaProcedimento, opcoesFiltroProcedimento, type AtendimentoProc } from '@/lib/procedimentosPaciente'

// Datas montadas com o construtor local (sem 'Z'): o teste só compara instantes,
// mas assim não depende do fuso da máquina nem do da Vercel.
const em = (dia: number, mes = 10) => new Date(2026, mes - 1, dia, 10, 0).toISOString()
const atendido = (contatoId: string, dia: number, procs: string[], status = 'atendido'): AtendimentoProc =>
  ({ contatoId, status, dataInicio: em(dia), procedimentosRealizados: procs })

describe('chaveProcedimento', () => {
  it('ignora acento, caixa e espaço sobrando', () => {
    expect(chaveProcedimento('  Bioestimulador de  Colágeno ')).toBe('bioestimulador de colageno')
    expect(chaveProcedimento('BOTOX')).toBe(chaveProcedimento('botox'))
  })
})

describe('procedimentosPorContato', () => {
  it('conta as vezes por pessoa, guarda a data mais recente e põe o mais recente primeiro', () => {
    const mapa = procedimentosPorContato([
      atendido('ana', 5, ['Botox']),
      atendido('ana', 20, ['botox', 'Preenchimento labial']),
      atendido('ana', 12, ['Limpeza de pele']),
    ])
    const ana = mapa.get('ana')!
    expect(ana.map(p => p.chave)).toEqual(['botox', 'preenchimento labial', 'limpeza de pele'])
    expect(ana[0].vezes).toBe(2)
    expect(ana[0].ultima).toBe(em(20))
    expect(ana[0].nome).toBe('botox') // grafia do registro mais recente
  })

  it('só atendimento CONCLUÍDO conta: agendado, cancelado e falta não são procedimento feito', () => {
    const mapa = procedimentosPorContato([
      atendido('bia', 1, ['Botox'], 'agendado'),
      atendido('bia', 2, ['Botox'], 'cancelado'),
      atendido('bia', 3, ['Botox'], 'faltou'),
    ])
    expect(mapa.has('bia')).toBe(false)
  })

  it('o mesmo procedimento marcado duas vezes no mesmo atendimento conta uma vez', () => {
    const mapa = procedimentosPorContato([atendido('cris', 4, ['Botox', 'BOTOX '])])
    expect(mapa.get('cris')![0].vezes).toBe(1)
  })

  it('atendimento sem paciente vinculado ou com data inválida fica de fora', () => {
    const mapa = procedimentosPorContato([
      { status: 'atendido', dataInicio: em(1), procedimentosRealizados: ['Botox'] },
      { contatoId: 'dani', status: 'atendido', dataInicio: 'ontem', procedimentosRealizados: ['Botox'] },
    ])
    expect(mapa.size).toBe(0)
  })

  it('o "Último procedimento" anotado na ficha entra, sem data, depois dos registros da Agenda', () => {
    const mapa = procedimentosPorContato(
      [atendido('eva', 8, ['Limpeza de pele'])],
      [{ id: 'eva', ultimoProcedimento: 'Botox e preenchimento' }, { id: 'fabi', ultimoProcedimento: 'Peeling' }, { id: 'gabi' }],
    )
    expect(mapa.get('eva')!.map(p => [p.nome, p.vezes, !!p.anotado])).toEqual([['Limpeza de pele', 1, false], ['Botox e preenchimento', 0, true]])
    expect(mapa.get('fabi')![0]).toMatchObject({ nome: 'Peeling', vezes: 0, anotado: true })
    expect(mapa.has('gabi')).toBe(false)
  })

  it('anotado igual ao que veio da Agenda não duplica: só ganha a marca', () => {
    const mapa = procedimentosPorContato([atendido('hel', 3, ['Botox'])], [{ id: 'hel', ultimoProcedimento: 'botox' }])
    expect(mapa.get('hel')).toHaveLength(1)
    expect(mapa.get('hel')![0]).toMatchObject({ vezes: 1, anotado: true })
  })
})

describe('casaProcedimento', () => {
  const mapa = procedimentosPorContato(
    [atendido('ivy', 9, ['Toxina botulínica (Botox)', 'Bioestimulador de colágeno'])],
    [{ id: 'ivy', ultimoProcedimento: 'Botox full face' }],
  )
  it('acha por trecho, sem acento e sem caixa', () => {
    expect(casaProcedimento(mapa.get('ivy'), 'botox').map(p => p.nome)).toEqual(['Toxina botulínica (Botox)', 'Botox full face'])
    expect(casaProcedimento(mapa.get('ivy'), 'COLAGENO')).toHaveLength(1)
  })
  it('termo vazio ou pessoa sem procedimento não casa nada', () => {
    expect(casaProcedimento(mapa.get('ivy'), '  ')).toEqual([])
    expect(casaProcedimento(undefined, 'botox')).toEqual([])
  })
})

describe('opcoesFiltroProcedimento', () => {
  it('junta catálogo e o que apareceu na Agenda, conta PACIENTES e deixa quem ninguém fez no fim', () => {
    const mapa = procedimentosPorContato([
      atendido('ana', 1, ['Botox']),
      atendido('ana', 2, ['Botox']),
      atendido('bia', 3, ['Botox full face']),
      atendido('bia', 4, ['Microagulhamento']),
    ], [{ id: 'cris', ultimoProcedimento: 'Botox e preenchimento' }])
    const opcoes = opcoesFiltroProcedimento(mapa, ['Botox', 'Peeling químico'])
    // "Botox" casa por trecho: ana, bia (Botox full face) e cris (anotado) = 3 pacientes
    expect(opcoes[0]).toEqual({ nome: 'Botox', pacientes: 3 })
    expect(opcoes.map(o => o.nome)).toEqual(['Botox', 'Botox full face', 'Microagulhamento', 'Peeling químico'])
    expect(opcoes[opcoes.length - 1]).toEqual({ nome: 'Peeling químico', pacientes: 0 })
  })

  it('o texto livre do "Último procedimento" não vira opção (seguiria achável pela busca)', () => {
    const mapa = procedimentosPorContato([], [{ id: 'cris', ultimoProcedimento: 'Botox e preenchimento' }])
    expect(opcoesFiltroProcedimento(mapa, [])).toEqual([])
  })
})

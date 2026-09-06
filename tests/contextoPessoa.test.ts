import { describe, it, expect } from 'vitest'
import { montarContexto, participa, reguaDoDia, mesmoDia, hora } from '@/lib/contextoPessoa'

// O contexto alimenta a manchete PESSOAL. Se pegar tarefa de outro ou post de
// outro, a frase acusa a pessoa errada de estar atrasada — na frente da equipe.

const AGORA = new Date('2026-09-04T09:10:00').getTime()
const iso = (h: number, m = 0, dia = 0) => { const d = new Date(AGORA); d.setDate(d.getDate() + dia); d.setHours(h, m, 0, 0); return d.toISOString() }

const willian = { nome: 'Willian Pires', email: 'willian@grupo10mais.com.br' }

describe('participa (texto livre de participantes)', () => {
  it('acha o nome completo e o primeiro nome', () => {
    expect(participa('Willian Pires, Marco', 'Willian Pires')).toBe(true)
    expect(participa('Willian e Marco', 'Willian Pires')).toBe(true)
    expect(participa('willian, théo', 'Willian Pires')).toBe(true)
  })
  it('não confunde nome contido em outra palavra', () => {
    expect(participa('Marcos Walker', 'Marco Walker')).toBe(false) // "marcos" não é "marco"
    expect(participa('Ana Théo', 'Théo Grassel')).toBe(true)
    expect(participa('Théodoro', 'Théo Grassel')).toBe(false)
  })
  it('vazio nunca participa', () => {
    expect(participa('', 'Willian')).toBe(false)
    expect(participa(undefined, 'Willian')).toBe(false)
  })
})

describe('montarContexto', () => {
  it('tarefa é da pessoa pelo E-MAIL; post é da pessoa pelo NOME', () => {
    const c = montarContexto(willian,
      [{ id: 'p1', criadoPor: 'Willian Pires', status: 'aguardando_aprovacao', clienteNome: 'Universal' }, { id: 'p2', criadoPor: 'Marco Walker', status: 'aguardando_aprovacao' }],
      [{ id: 't1', responsavelEmail: 'willian@grupo10mais.com.br', status: 'a_fazer', titulo: 'minha' }, { id: 't2', responsavelEmail: 'marco@grupo10mais.com.br', status: 'a_fazer', titulo: 'dele' }],
      [], AGORA)
    expect(c.tarefas.map(t => t.titulo)).toEqual(['minha'])
    expect(c.aprovacoes).toHaveLength(1)
    expect(c.aprovacoes[0].clienteNome).toBe('Universal')
  })

  it('e-mail e nome casam sem caixa e sem acento', () => {
    const c = montarContexto({ nome: 'Théo Grassel', email: 'THEO@grupo10mais.com.br' },
      [{ id: 'p', criadoPor: 'theo grassel', status: 'corrigir' }],
      [{ id: 't', responsavelEmail: 'theo@grupo10mais.com.br', status: 'em_andamento' }], [], AGORA)
    expect(c.tarefas).toHaveLength(1)
    expect(c.ajustes).toHaveLength(1)
  })

  it('tarefa concluída/descartada fica fora', () => {
    const c = montarContexto(willian, [], [
      { id: '1', responsavelEmail: willian.email, status: 'concluido' },
      { id: '2', responsavelEmail: willian.email, status: 'descartado' },
    ], [], AGORA)
    expect(c.tarefas).toHaveLength(0)
  })

  it('post que voltou para ajuste não conta como aprovação pendente', () => {
    const c = montarContexto(willian, [{ id: 'p', criadoPor: 'Willian Pires', status: 'corrigir', etapa: 'aprovacao_criativo' }], [], [], AGORA)
    expect(c.aprovacoes).toHaveLength(0)
    expect(c.ajustes).toHaveLength(1)
  })

  it('post na lixeira não conta para nada', () => {
    const c = montarContexto(willian, [{ id: 'p', criadoPor: 'Willian Pires', status: 'aguardando_aprovacao', excluidoEm: iso(8) }], [], [], AGORA)
    expect(c.aprovacoes).toHaveLength(0)
  })

  it('publicaHoje conta só o que é DELA e sai HOJE', () => {
    const c = montarContexto(willian, [
      { id: '1', criadoPor: 'Willian Pires', status: 'agendado', dataAgendada: iso(15) },
      { id: '2', criadoPor: 'Willian Pires', status: 'publicado', dataAgendada: iso(9) },
      { id: '3', criadoPor: 'Willian Pires', status: 'agendado', dataAgendada: iso(15, 0, 1) }, // amanhã
      { id: '4', criadoPor: 'Marco Walker', status: 'agendado', dataAgendada: iso(15) },
      { id: '5', criadoPor: 'Willian Pires', status: 'rascunho', dataAgendada: iso(16) },
    ], [], [], AGORA)
    expect(c.publicaHoje).toBe(2)
  })

  it('reunião de hoje só entra se a pessoa participa, com a hora formatada', () => {
    const c = montarContexto(willian, [], [], [
      { id: 'r1', titulo: 'Segunda Comercial', data: iso(9, 30), participantes: 'Willian, Marco' },
      { id: 'r2', titulo: 'Deny', data: iso(17), participantes: 'Marco' },
      { id: 'r3', titulo: 'Ontem', data: iso(9, 30, -1), participantes: 'Willian' },
    ], AGORA)
    expect(c.reunioes).toEqual([{ hora: '09:30', titulo: 'Segunda Comercial' }])
  })
})

describe('reguaDoDia', () => {
  it('junta posts, reuniões e agenda de HOJE, em ordem de hora', () => {
    const r = reguaDoDia(
      [{ id: 'p', clienteNome: 'GL Joias', status: 'agendado', dataAgendada: iso(11, 30), briefing: 'Anúncio' }],
      [{ id: 'm', titulo: 'Comercial', data: iso(9, 30), participantes: 'Willian' }],
      [{ id: 'g', titulo: 'Dentista', inicio: iso(14), fim: iso(15), calendario: 'Willian' }],
      AGORA)
    expect(r.map(e => `${e.hora} ${e.tipo}`)).toEqual(['09:30 reuniao', '11:30 post', '14:00 agenda'])
    expect(r[1].titulo).toBe('GL Joias')
    expect(r[1].detalhe).toBe('Anúncio')
  })

  it('post publicado aparece como feito; agendado não', () => {
    const r = reguaDoDia([
      { id: '1', status: 'publicado', dataAgendada: iso(9) },
      { id: '2', status: 'agendado', dataAgendada: iso(15) },
    ], [], [], AGORA)
    expect(r[0].feito).toBe(true)
    expect(r[1].feito).toBe(false)
  })

  it('rascunho e post de outro dia ficam fora', () => {
    const r = reguaDoDia([
      { id: '1', status: 'rascunho', dataAgendada: iso(9) },
      { id: '2', status: 'agendado', dataAgendada: iso(9, 0, 1) },
    ], [], [], AGORA)
    expect(r).toHaveLength(0)
  })

  it('reunião que acabou há mais de 1h conta como passada', () => {
    const r = reguaDoDia([], [{ id: 'm', titulo: 'Cedo', data: iso(7) }], [], AGORA)
    expect(r[0].feito).toBe(true)
  })
})

describe('utilitários', () => {
  it('mesmoDia e hora', () => {
    expect(mesmoDia(iso(23, 59), AGORA)).toBe(true)
    expect(mesmoDia(iso(0, 0, 1), AGORA)).toBe(false)
    expect(mesmoDia(undefined, AGORA)).toBe(false)
    expect(hora(iso(8, 5))).toBe('08:05')
  })
})

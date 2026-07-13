import { describe, it, expect } from 'vitest'
import { sobrepoe, acharConflito, ocupaAgenda, normalizaNome, acharContatoPorNome, horaParaMin, componentesLocais, bloqueioNoDia, acharBloqueioConflitante, Bloqueio, domingoDePascoa, feriadosBR, feriadoDoDia, ehProfissionalAgenda } from '@/lib/agenda'

// Conflito de horário da Agenda. Guarda contra: encaixe silencioso em cima de
// outro paciente e falso conflito entre profissionais diferentes/cancelados.

const às = (h: string, dur = 30, extra: any = {}) => ({
  profissionalEmail: 'dra@x.com', dataInicio: `2026-07-12T${h}:00.000Z`, duracaoMin: dur, ...extra,
})

describe('sobrepoe', () => {
  it('intervalos cruzados conflitam', () => {
    expect(sobrepoe(às('09:00', 60), às('09:30', 30))).toBe(true)
    expect(sobrepoe(às('09:30', 30), às('09:00', 60))).toBe(true)
    expect(sobrepoe(às('09:00', 30), às('09:00', 30))).toBe(true)
  })
  it('fim às 10h e início às 10h NÃO conflitam (meio-aberto)', () => {
    expect(sobrepoe(às('09:00', 60), às('10:00', 30))).toBe(false)
  })
  it('data inválida nunca conflita (não trava o fluxo)', () => {
    expect(sobrepoe(às('09:00'), { ...às('09:00'), dataInicio: 'inválida' })).toBe(false)
  })
})

describe('acharConflito', () => {
  const marcados = [
    { id: 'a1', ...às('09:00', 30, { status: 'confirmado' }) },
    { id: 'a2', ...às('10:00', 30, { status: 'cancelado' }) },
    { id: 'a3', ...às('11:00', 30, { status: 'agendado', profissionalEmail: 'dr2@x.com' }) },
  ]
  it('acha conflito com horário ocupado do MESMO profissional', () => {
    expect(acharConflito(às('09:15', 30), marcados)?.id).toBe('a1')
  })
  it('cancelado não ocupa a agenda', () => {
    expect(acharConflito(às('10:00', 30), marcados)).toBeNull()
  })
  it('outro profissional no mesmo horário não é conflito', () => {
    expect(acharConflito(às('11:00', 30), marcados)).toBeNull()
  })
  it('editar a si mesmo não conflita consigo', () => {
    expect(acharConflito({ id: 'a1', ...às('09:00', 30) }, marcados)).toBeNull()
  })
})

describe('ocupaAgenda', () => {
  it('agendado/confirmado/atendido ocupam; faltou/cancelado não', () => {
    expect(ocupaAgenda('agendado')).toBe(true)
    expect(ocupaAgenda('confirmado')).toBe(true)
    expect(ocupaAgenda('atendido')).toBe(true)
    expect(ocupaAgenda('faltou')).toBe(false)
    expect(ocupaAgenda('cancelado')).toBe(false)
    expect(ocupaAgenda(undefined)).toBe(true) // default seguro
  })
})

// Vínculo agenda↔paciente (perfil clínica): o match por nome decide entre ligar a
// um cadastro existente ou criar paciente novo — errar aqui duplica pacientes.
describe('acharContatoPorNome (vínculo com o cadastro)', () => {
  const contatos = [
    { id: '1', nome: 'Maria José da Silva' },
    { id: '2', nome: 'João Pedro' },
  ]

  it('casa ignorando caixa, espaços extras e acentos', () => {
    expect(acharContatoPorNome(contatos, 'maria jose da silva')?.id).toBe('1')
    expect(acharContatoPorNome(contatos, '  MARIA JOSÉ  DA SILVA ')?.id).toBe('1')
    expect(acharContatoPorNome(contatos, 'Joao Pedro')?.id).toBe('2')
  })

  it('não casa nome diferente nem parcial', () => {
    expect(acharContatoPorNome(contatos, 'Maria José')).toBeNull()
    expect(acharContatoPorNome(contatos, 'Pedro')).toBeNull()
    expect(acharContatoPorNome(contatos, '')).toBeNull()
  })

  it('normalizaNome padroniza acentos/espaços/caixa', () => {
    expect(normalizaNome('  Á RVORE   grande ')).toBe('a rvore grande')
    expect(normalizaNome('')).toBe('')
  })
})

// Bloqueios/compromissos da profissional: expandir a faixa e recusar marcar por
// cima. Errar aqui deixa marcar em horário de folga/almoço (ou bloqueia à toa).
describe('horaParaMin', () => {
  it('converte HH:MM em minutos e tolera lixo', () => {
    expect(horaParaMin('12:30')).toBe(750)
    expect(horaParaMin('00:00')).toBe(0)
    expect(horaParaMin('23:59')).toBe(1439)
    expect(horaParaMin(undefined)).toBe(0)
    expect(horaParaMin('99:99')).toBe(1440) // saturado no teto de um dia
  })
})

describe('componentesLocais (fuso da clínica, UTC-3)', () => {
  it('lê o relógio de parede local de um instante UTC', () => {
    // 2026-07-13 é segunda. 15:30Z = 12:30 BRT (UTC-3).
    const c = componentesLocais('2026-07-13T15:30:00.000Z')
    expect(c).toEqual({ dow: 1, min: 12 * 60 + 30, ymd: '2026-07-13' })
  })
  it('vira o dia local quando o UTC já passou da meia-noite mas o BRT não', () => {
    // 2026-07-14T02:00Z = 2026-07-13 23:00 BRT (ainda segunda).
    const c = componentesLocais('2026-07-14T02:00:00.000Z')
    expect(c).toEqual({ dow: 1, min: 23 * 60, ymd: '2026-07-13' })
  })
  it('data inválida devolve null', () => {
    expect(componentesLocais('nada')).toBeNull()
  })
})

describe('acharBloqueioConflitante', () => {
  const almoco: Bloqueio = { id: 'b1', profissionalEmail: 'dra@x.com', recorrente: true, diasSemana: [1, 2, 3, 4, 5], horaInicio: '12:00', horaFim: '13:00', criadoEm: '' }
  const folga: Bloqueio = { id: 'b2', profissionalEmail: 'dra@x.com', recorrente: false, dataInicio: '2026-07-15T14:00:00.000Z', duracaoMin: 120, criadoEm: '' }
  const lista = [almoco, folga]

  it('recorrente pega agendamento que cai no almoço (seg 12:30 BRT = 15:30Z)', () => {
    expect(acharBloqueioConflitante({ profissionalEmail: 'dra@x.com', dataInicio: '2026-07-13T15:30:00.000Z', duracaoMin: 30 }, lista)?.id).toBe('b1')
  })
  it('recorrente NÃO pega fora da faixa (seg 14:00 BRT = 17:00Z)', () => {
    expect(acharBloqueioConflitante({ profissionalEmail: 'dra@x.com', dataInicio: '2026-07-13T17:00:00.000Z', duracaoMin: 30 }, lista)).toBeNull()
  })
  it('recorrente NÃO pega em dia fora da recorrência (domingo)', () => {
    // 2026-07-12 é domingo, 12:30 BRT = 15:30Z
    expect(acharBloqueioConflitante({ profissionalEmail: 'dra@x.com', dataInicio: '2026-07-12T15:30:00.000Z', duracaoMin: 30 }, lista)).toBeNull()
  })
  it('respeita a data-limite (ate)', () => {
    const comAte: Bloqueio = { ...almoco, ate: '2026-07-10' }
    expect(acharBloqueioConflitante({ profissionalEmail: 'dra@x.com', dataInicio: '2026-07-13T15:30:00.000Z', duracaoMin: 30 }, [comAte])).toBeNull()
  })
  it('pontual pega por sobreposição absoluta e ignora outro profissional', () => {
    // folga 14:00–16:00Z (11:00–13:00 BRT); 14:00Z (11:00 BRT) cai só na folga, não no almoço (12:00 BRT).
    expect(acharBloqueioConflitante({ profissionalEmail: 'dra@x.com', dataInicio: '2026-07-15T14:00:00.000Z', duracaoMin: 30 }, lista)?.id).toBe('b2')
    expect(acharBloqueioConflitante({ profissionalEmail: 'outro@x.com', dataInicio: '2026-07-15T14:00:00.000Z', duracaoMin: 30 }, lista)).toBeNull()
  })
})

describe('bloqueioNoDia (expansão p/ a grade)', () => {
  const diaLocal = (y: number, m: number, d: number) => { const x = new Date(); x.setFullYear(y, m - 1, d); x.setHours(0, 0, 0, 0); return x }
  it('recorrente incide no dia da semana certo e devolve o intervalo do dia', () => {
    const b: Bloqueio = { id: 'b', profissionalEmail: 'x', recorrente: true, diasSemana: [1], horaInicio: '12:00', horaFim: '13:00', criadoEm: '' }
    const seg = diaLocal(2026, 7, 13) // segunda
    const intr = bloqueioNoDia(b, seg)
    expect(intr).not.toBeNull()
    expect(new Date(intr!.inicio).getHours()).toBe(12)
    expect(new Date(intr!.fim).getHours()).toBe(13)
    expect(bloqueioNoDia(b, diaLocal(2026, 7, 14))).toBeNull() // terça, fora
  })
  it('recorrente some depois da data-limite', () => {
    const b: Bloqueio = { id: 'b', profissionalEmail: 'x', recorrente: true, diasSemana: [1], horaInicio: '12:00', horaFim: '13:00', ate: '2026-07-06', criadoEm: '' }
    expect(bloqueioNoDia(b, diaLocal(2026, 7, 13))).toBeNull()
  })
})

// Disponibilidade de agenda: decide quem aparece como profissional agendável.
// Errar aqui faz a gestão receber pacientes ou some a profissional do seletor.
describe('ehProfissionalAgenda', () => {
  it('opção explícita manda sobre a área', () => {
    expect(ehProfissionalAgenda({ recebeAgenda: true })).toBe(true)
    expect(ehProfissionalAgenda({ recebeAgenda: false, areaSaude: 'Estética' })).toBe(false) // Não vence área preenchida
  })
  it('sem opção, infere pela área (retrocompat)', () => {
    expect(ehProfissionalAgenda({ areaSaude: 'Dermato' })).toBe(true)
    expect(ehProfissionalAgenda({})).toBe(false)
    expect(ehProfissionalAgenda({ areaSaude: '' })).toBe(false)
  })
})

// Feriados nacionais: marcar o dia certo na agenda. Móveis dependem da Páscoa —
// errar o cômputo desloca Carnaval/Sexta Santa/Corpus Christi.
describe('feriados BR', () => {
  it('Páscoa de 2026 é 05/04 (móveis derivam dela)', () => {
    const p = domingoDePascoa(2026)
    expect([p.getMonth() + 1, p.getDate()]).toEqual([4, 5])
  })
  it('mapa do ano tem fixos e móveis nas datas corretas (2026)', () => {
    const f = feriadosBR(2026)
    expect(f['2026-01-01']).toBe('Confraternização Universal')
    expect(f['2026-12-25']).toBe('Natal')
    expect(f['2026-02-17']).toBe('Carnaval')       // terça = Páscoa−47
    expect(f['2026-04-03']).toBe('Sexta-feira Santa') // Páscoa−2
    expect(f['2026-06-04']).toBe('Corpus Christi')    // Páscoa+60
  })
  it('feriadoDoDia usa e popula o cache por ano', () => {
    const cache: Record<number, Record<string, string>> = {}
    const dia = (() => { const x = new Date(); x.setFullYear(2026, 11, 25); x.setHours(0, 0, 0, 0); return x })()
    expect(feriadoDoDia(dia, cache)).toBe('Natal')
    expect(cache[2026]?.['2026-12-25']).toBe('Natal')
    const naoFeriado = (() => { const x = new Date(); x.setFullYear(2026, 6, 13); x.setHours(0, 0, 0, 0); return x })()
    expect(feriadoDoDia(naoFeriado, cache)).toBeNull()
  })
})

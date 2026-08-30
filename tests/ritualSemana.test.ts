import { describe, it, expect } from 'vitest'
import {
  normalizaRitual, RITUAL_PADRAO, diaDaSemana, ritualDoDia, tituloDoDia,
  semanaDe, gradeMes, ocorrenciasSemanais, dataComHora, ymd,
} from '@/lib/ritualSemana'

// O calendário da reunião diária. Um erro de dia da semana aqui não dá erro de
// tela: dá reunião marcada no dia errado, com a área errada.

describe('ritual da semana', () => {
  it('segunda é 1 e domingo é 7 (não o getDay do JS)', () => {
    expect(diaDaSemana(new Date(2026, 7, 31))).toBe(1) // segunda
    expect(diaDaSemana(new Date(2026, 8, 5))).toBe(6)  // sábado
    expect(diaDaSemana(new Date(2026, 8, 6))).toBe(7)  // domingo
  })

  it('a área do dia sai do ritual configurado', () => {
    const ritual = [{ dia: 1, area: 'Comercial' }, { dia: 2, area: 'Posicionamento' }]
    expect(ritualDoDia(ritual, new Date(2026, 7, 31))!.area).toBe('Comercial')
    expect(ritualDoDia(ritual, new Date(2026, 8, 1))!.area).toBe('Posicionamento')
    expect(ritualDoDia(ritual, new Date(2026, 8, 2))).toBeUndefined() // quarta sem ritual
  })

  it('o título sugerido junta dia e área', () => {
    const ritual = [{ dia: 1, area: 'Comercial' }]
    expect(tituloDoDia(ritual, new Date(2026, 7, 31))).toBe('Segunda Comercial')
    expect(tituloDoDia(ritual, new Date(2026, 8, 2))).toBe('') // sem ritual, sem título pronto
  })

  it('ritual do banco corrompido não derruba a tela', () => {
    const r = normalizaRitual({ dias: [{ dia: 9, area: 'X' }, { dia: 1, area: '  ' }, { dia: 2, area: 'Posicionamento', hora: 'meio-dia' }, { dia: 2, area: 'Duplicado' }] })
    expect(r).toHaveLength(1)
    expect(r[0]).toEqual({ dia: 2, area: 'Posicionamento' }) // hora inválida sai; dia repetido não entra
  })

  it('sem nada salvo, vem a semente (a tela nunca nasce vazia)', () => {
    expect(normalizaRitual(undefined)).toEqual(RITUAL_PADRAO)
    expect(normalizaRitual({}).length).toBe(RITUAL_PADRAO.length)
  })

  it('dia sem área some do ritual em vez de virar dia em branco', () => {
    expect(normalizaRitual({ dias: [{ dia: 1, area: 'Comercial' }, { dia: 3, area: '' }] }).map(d => d.dia)).toEqual([1])
  })
})

describe('grades do calendário', () => {
  it('a semana vai de segunda a domingo, qualquer que seja o dia clicado', () => {
    for (const d of [new Date(2026, 8, 2), new Date(2026, 7, 31), new Date(2026, 8, 6)]) {
      const s = semanaDe(d)
      expect(s).toHaveLength(7)
      expect(diaDaSemana(s[0])).toBe(1)
      expect(diaDaSemana(s[6])).toBe(7)
      expect(s.map(ymd)).toContain(ymd(d))
    }
  })

  it('o mês vem em semanas inteiras, sem buraco nas bordas', () => {
    const g = gradeMes(2026, 8) // setembro/2026 começa numa terça
    expect(g.every(sem => sem.length === 7)).toBe(true)
    expect(diaDaSemana(g[0][0])).toBe(1)
    const todos = g.flat().map(ymd)
    // todo dia do mês aparece uma vez
    for (let dia = 1; dia <= 30; dia++) {
      expect(todos.filter(x => x === `2026-09-${String(dia).padStart(2, '0')}`)).toHaveLength(1)
    }
  })

  it('nenhum mês passa de 6 semanas na grade', () => {
    for (let m = 0; m < 12; m++) expect(gradeMes(2026, m).length).toBeLessThanOrEqual(6)
  })
})

describe('recorrência semanal', () => {
  it('repete no MESMO dia da semana até a data final', () => {
    const datas = ocorrenciasSemanais(new Date(2026, 7, 31), new Date(2026, 8, 28))
    expect(datas.map(ymd)).toEqual(['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'])
    expect(datas.every(d => diaDaSemana(d) === 1)).toBe(true)
  })

  it('inclui o último dia quando ele cai certo', () => {
    expect(ocorrenciasSemanais(new Date(2026, 7, 31), new Date(2026, 7, 31))).toHaveLength(1)
  })

  it('fim antes do início não cria nada', () => {
    expect(ocorrenciasSemanais(new Date(2026, 8, 10), new Date(2026, 7, 1))).toEqual([])
  })

  it('um "até 2099" digitado sem querer não cria milhares de reuniões', () => {
    expect(ocorrenciasSemanais(new Date(2026, 0, 1), new Date(2099, 0, 1)).length).toBe(53)
  })
})

describe('data + hora', () => {
  it('junta o dia com a hora do ritual', () => {
    const d = dataComHora('2026-08-31', '14:30')
    expect(d.getHours()).toBe(14)
    expect(d.getMinutes()).toBe(30)
    expect(ymd(d)).toBe('2026-08-31')
  })

  it('sem hora, 09:00 — e nunca meia-noite', () => {
    expect(dataComHora('2026-08-31').getHours()).toBe(9)
    expect(dataComHora('2026-08-31', 'qualquer coisa').getHours()).toBe(9)
  })
})

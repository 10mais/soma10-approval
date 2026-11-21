import { describe, it, expect } from 'vitest'
import { gradeDoMes, horaDe, postsPorDia, horariosDoDia, horariosSugeridos, postsNoHorario, valorLocal, lerValorLocal, diaPassado, instantePassado, HORARIOS_PADRAO } from '@/lib/calendarioPosts'

// Mudança 1 (21/11/2026): o seletor de data do agendamento mostra o que já está programado.
// Instantes montados com new Date(ano, mes, dia, h, m) — local — para o teste valer em
// qualquer fuso (a Vercel roda em UTC).
const iso = (a: number, m: number, d: number, h: number, mi = 0) => new Date(a, m, d, h, mi).toISOString()
const P = (id: string, dataAgendada?: string, formato = 'feed') => ({ id, dataAgendada, formato })

describe('grade do mês', () => {
  it('novembro de 2026 começa num domingo e fecha em semanas inteiras', () => {
    const g = gradeDoMes(2026, 10)
    expect(g[0]).toBe(1)
    expect(g.length % 7).toBe(0)
    expect(g.filter(Boolean)).toHaveLength(30)
  })
  it('dezembro de 2026 começa numa terça: duas casas vazias antes', () => {
    expect(gradeDoMes(2026, 11).slice(0, 3)).toEqual([null, null, 1])
  })
  it('fevereiro de 2028 tem 29 dias', () => {
    expect(gradeDoMes(2028, 1).filter(Boolean)).toHaveLength(29)
  })
})

describe('posts por dia e horários', () => {
  const posts = [
    P('a', iso(2026, 10, 18, 18, 30), 'reel'), P('b', iso(2026, 10, 18, 10)), P('c', iso(2026, 10, 18, 10), 'story'),
    P('d', iso(2026, 10, 20, 12, 15)), P('e', iso(2026, 11, 1, 9)), P('f'), P('g', 'lixo'),
  ]
  it('agrupa só o mês pedido, em ordem de horário; sem data e data inválida ficam de fora', () => {
    const m = postsPorDia(posts, 2026, 10)
    expect(Array.from(m.keys()).sort((a, b) => a - b)).toEqual([18, 20])
    expect(m.get(18)!.map(p => p.id)).toEqual(['b', 'c', 'a'])
  })
  it('horários usados no dia, com total e formatos', () => {
    expect(horariosDoDia(postsPorDia(posts, 2026, 10).get(18)!)).toEqual([
      { hora: '10:00', total: 2, formatos: ['feed', 'story'] },
      { hora: '18:30', total: 1, formatos: ['reel'] },
    ])
  })
  it('mesmo horário só informa quantos já existem', () => {
    const dia = postsPorDia(posts, 2026, 10).get(18)!
    expect(postsNoHorario(dia, '10:00')).toBe(2)
    expect(postsNoHorario(dia, '11:00')).toBe(0)
  })
  it('hora do instante; inválido vira vazio', () => {
    expect(horaDe(iso(2026, 10, 18, 7, 5))).toBe('07:05')
    expect(horaDe('lixo')).toBe('')
    expect(horaDe(undefined)).toBe('')
  })
})

describe('atalhos de horário', () => {
  it('os mais usados pelo cliente primeiro, completados com o padrão, em ordem do dia', () => {
    const posts = [P('1', iso(2026, 9, 1, 18, 30)), P('2', iso(2026, 9, 2, 18, 30)), P('3', iso(2026, 9, 3, 11)), P('4', iso(2026, 9, 4, 12))]
    expect(horariosSugeridos(posts)).toEqual(['09:00', '11:00', '12:00', '18:30'])
  })
  it('cliente sem histórico recebe o padrão', () => {
    expect(horariosSugeridos([])).toEqual(HORARIOS_PADRAO)
  })
})

describe('valor do campo de data', () => {
  it('monta e lê o valor do datetime-local', () => {
    expect(valorLocal(2026, 10, 18, '10:00')).toBe('2026-11-18T10:00')
    expect(valorLocal(2026, 0, 5, 'xx')).toBe('2026-01-05T09:00')
    expect(lerValorLocal('2026-11-18T10:00')).toEqual({ ano: 2026, mes: 10, dia: 18, hora: '10:00' })
    expect(lerValorLocal('')).toBeNull()
  })
  it('dia passado e instante passado', () => {
    const agora = new Date(2026, 10, 21, 14, 0)
    expect(diaPassado(2026, 10, 20, agora)).toBe(true)
    expect(diaPassado(2026, 10, 21, agora)).toBe(false) // hoje ainda vale
    expect(instantePassado('2026-11-21T10:00', agora)).toBe(true)
    expect(instantePassado('2026-11-21T18:00', agora)).toBe(false)
  })
})

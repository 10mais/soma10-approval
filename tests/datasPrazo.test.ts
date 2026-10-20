import { describe, it, expect } from 'vitest'
import { diaDoInstante, fimDoDiaBR, inicioDoDiaBR, fmtDiaDoInstante, horaBR } from '@/lib/datas'

// Dono, 20/10/2026: "Quando criamos tarefa e colocamos DATA, ele automaticamente adiciona mais um
// dia." O prazo era gravado como 23:59 de Brasília (= dia seguinte em UTC) e a edição lia o dia
// pelo texto UTC — cada salvamento empurrava o prazo +1. O dia agora sai SEMPRE de diaDoInstante,
// no horário de Brasília, igual no navegador e no servidor (que roda em UTC).

describe('prazo de tarefa — o dia escolhido é o dia que volta', () => {
  it('ida e volta: gravar e reabrir dá o MESMO dia (o bug somava +1 a cada edição)', () => {
    for (const dia of ['2026-10-20', '2026-12-31', '2027-01-01', '2026-02-28', '2028-02-29']) {
      expect(diaDoInstante(fimDoDiaBR(dia))).toBe(dia)
      expect(diaDoInstante(inicioDoDiaBR(dia))).toBe(dia)
    }
  })

  it('o prazo é o FIM do dia em Brasília (atrasada só depois que o dia acaba)', () => {
    expect(fimDoDiaBR('2026-10-20')).toBe('2026-10-21T02:59:59.000Z')
    expect(inicioDoDiaBR('2026-10-20')).toBe('2026-10-20T03:00:00.000Z')
  })

  it('lê os formatos que já estão gravados', () => {
    // modal antigo: 23:59:59 no navegador em Brasília
    expect(diaDoInstante('2026-10-21T02:59:59.000Z')).toBe('2026-10-20')
    // "definir prazo" em massa: meio-dia local
    expect(diaDoInstante('2026-10-20T15:00:00.000Z')).toBe('2026-10-20')
    // agentes (servidor em UTC): 23:59:59Z
    expect(diaDoInstante('2026-10-20T23:59:59.000Z')).toBe('2026-10-20')
    // decisão de reunião: o dia puro
    expect(diaDoInstante('2026-10-20')).toBe('2026-10-20')
  })

  it('formata para quem lê, sem depender do fuso da máquina', () => {
    expect(fmtDiaDoInstante('2026-10-21T02:59:59.000Z')).toBe('20/10/2026')
    expect(fmtDiaDoInstante('2026-10-21T02:59:59.000Z', false)).toBe('20/10')
  })

  it('vazio ou inválido não inventa data', () => {
    expect(diaDoInstante('')).toBe('')
    expect(diaDoInstante(undefined)).toBe('')
    expect(diaDoInstante('amanhã')).toBe('')
    expect(fimDoDiaBR('')).toBe('')
    expect(inicioDoDiaBR('20/10/2026')).toBe('')
    expect(fmtDiaDoInstante(null)).toBe('')
  })
})

describe('horaBR — o servidor roda em UTC', () => {
  it('11h UTC são 8h em Brasília; meia-noite fica 0 (nunca 24)', () => {
    expect(horaBR(Date.parse('2026-10-20T11:00:00Z'))).toBe(8)
    expect(horaBR(Date.parse('2026-10-21T03:00:00Z'))).toBe(0)
    expect(horaBR(Date.parse('2026-10-21T02:59:00Z'))).toBe(23)
  })
})

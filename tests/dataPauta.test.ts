import { describe, it, expect } from 'vitest'
import { dataDaPauta, diaMinimo } from '@/lib/dataPauta'

// Queixa do dono (2026-07-17): plano gerado no dia 17 espalhava pautas desde o
// dia 1 — nasciam atrasadas e sujavam o painel de entregas com atraso falso.

const agora = new Date(2026, 6, 17, 14, 0, 0) // 17/07/2026, 14h

describe('diaMinimo', () => {
  it('mês corrente começa HOJE, não no dia 1', () => {
    expect(diaMinimo(2026, 7, agora)).toBe(17)
  })

  it('mês futuro começa no dia 1', () => {
    expect(diaMinimo(2026, 8, agora)).toBe(1)
    expect(diaMinimo(2027, 1, agora)).toBe(1)
  })

  it('mês passado não é empurrado para hoje — a pauta sairia do próprio plano', () => {
    expect(diaMinimo(2026, 6, agora)).toBe(1)
  })
})

describe('dataDaPauta', () => {
  const iso = (s: string) => new Date(s)

  it('dia no passado do mês corrente sobe para hoje', () => {
    const d = iso(dataDaPauta({ ano: 2026, mes: 7, dia: 3, hora: 17, minuto: 0 }, agora))
    expect(d.getDate()).toBe(17)
    expect(d.getHours()).toBe(17)
  })

  it('dia futuro do mês é respeitado', () => {
    const d = iso(dataDaPauta({ ano: 2026, mes: 7, dia: 25, hora: 10, minuto: 30 }, agora))
    expect(d.getDate()).toBe(25)
    expect(d.getHours()).toBe(10)
    expect(d.getMinutes()).toBe(30)
  })

  it('HOJE em hora que já passou vai para amanhã, no mesmo horário', () => {
    const d = iso(dataDaPauta({ ano: 2026, mes: 7, dia: 17, hora: 10, minuto: 0 }, agora))
    expect(d.getDate()).toBe(18)
    expect(d.getHours()).toBe(10)
  })

  it('nunca gera no passado — varrendo o mês inteiro', () => {
    for (let dia = 1; dia <= 31; dia++) {
      for (const hora of [6, 12, 17, 23]) {
        const d = iso(dataDaPauta({ ano: 2026, mes: 7, dia, hora, minuto: 0 }, agora))
        expect(d.getTime()).toBeGreaterThan(agora.getTime())
      }
    }
  })

  it('último dia do mês à noite não escapa do plano — fica hoje mesmo', () => {
    const fim = new Date(2026, 6, 31, 22, 0, 0) // 31/07 às 22h
    const d = iso(dataDaPauta({ ano: 2026, mes: 7, dia: 31, hora: 10, minuto: 0 }, fim))
    expect(d.getMonth()).toBe(6) // julho — não vazou para agosto
    expect(d.getTime()).toBeGreaterThan(fim.getTime())
  })

  it('dia além do fim do mês é preso no último dia (fevereiro não vira março)', () => {
    const jan = new Date(2026, 0, 5, 9, 0, 0)
    const d = iso(dataDaPauta({ ano: 2026, mes: 2, dia: 31, hora: 10, minuto: 0 }, jan))
    expect(d.getMonth()).toBe(1)
    expect(d.getDate()).toBe(28)
  })

  it('mês futuro pode começar no dia 1', () => {
    const d = iso(dataDaPauta({ ano: 2026, mes: 8, dia: 1, hora: 9, minuto: 0 }, agora))
    expect(d.getDate()).toBe(1)
    expect(d.getMonth()).toBe(7)
  })

  it('hora fora da faixa é corrigida (madrugada não publica)', () => {
    const d = iso(dataDaPauta({ ano: 2026, mes: 8, dia: 10, hora: 3, minuto: 0 }, agora))
    expect(d.getHours()).toBe(6)
  })

  it('minuto quebrado vira hora cheia', () => {
    const d = iso(dataDaPauta({ ano: 2026, mes: 8, dia: 10, hora: 9, minuto: 47 }, agora))
    expect(d.getMinutes()).toBe(0)
  })

  it('dia inválido não quebra — cai no mínimo do mês', () => {
    const d = iso(dataDaPauta({ ano: 2026, mes: 8, dia: 0, hora: 9, minuto: 0 }, agora))
    expect(d.getDate()).toBe(1)
  })
})

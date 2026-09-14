import { describe, it, expect } from 'vitest'
import { foraDaJanela, inicioParaMostrar, etapasComTitulo, rotuloPeriodoLista } from '@/lib/playbookLista'

// "Quando lanço, não aparece": marco fora da janela do Gantt virava lasca invisível e
// etapa sem título sumia ao salvar. As duas regras que evitam isso vivem aqui.

const DIA = 86400000
const J_INI = new Date(2026, 8, 1).getTime() // 01/09/2026
const J_FIM = new Date(2026, 8, 30).getTime()

describe('foraDaJanela', () => {
  it('dentro da janela = null', () => {
    expect(foraDaJanela('2026-09-10', '2026-09-20', J_INI, J_FIM)).toBeNull()
  })
  it('atravessando a borda ainda aparece (parte dentro)', () => {
    expect(foraDaJanela('2026-08-20', '2026-09-05', J_INI, J_FIM)).toBeNull()
    expect(foraDaJanela('2026-09-25', '2026-10-20', J_INI, J_FIM)).toBeNull()
  })
  it('inteiro antes ou inteiro depois', () => {
    expect(foraDaJanela('2026-07-01', '2026-08-15', J_INI, J_FIM)).toBe('antes')
    expect(foraDaJanela('2026-10-01', '2026-10-30', J_INI, J_FIM)).toBe('depois')
  })
  it('sem fim usa o início; fim antes do início não engana', () => {
    expect(foraDaJanela('2026-10-05', undefined, J_INI, J_FIM)).toBe('depois')
    expect(foraDaJanela('2026-09-10', '2026-09-01', J_INI, J_FIM)).toBeNull()
  })
  it('data inválida não é "fora"', () => {
    expect(foraDaJanela('', undefined, J_INI, J_FIM)).toBeNull()
  })
})

describe('inicioParaMostrar', () => {
  it('começa um pouco antes do item, mantendo a largura da janela', () => {
    const ini = inicioParaMostrar('2026-10-05T12:00:00.000Z', 30)
    const alvo = new Date('2026-10-05T12:00:00.000Z').getTime() - 3 * DIA
    expect(Math.abs(ini - alvo)).toBeLessThan(DIA) // arredonda para o começo do dia local
    const d = new Date(ini); expect(d.getHours()).toBe(0)
  })
})

describe('etapasComTitulo', () => {
  it('título vazio vira "Etapa N" e os demais ficam', () => {
    const r = etapasComTitulo([{ titulo: 'Auditoria' }, { titulo: '  ' }, { titulo: '' }])
    expect(r.map(x => x.titulo)).toEqual(['Auditoria', 'Etapa 2', 'Etapa 3'])
  })
})

describe('rotuloPeriodoLista', () => {
  it('formatos', () => {
    expect(rotuloPeriodoLista('2026-09-08T12:00:00', '2026-09-20T12:00:00')).toBe('08/09 – 20/09')
    expect(rotuloPeriodoLista('2026-09-08T12:00:00', undefined)).toBe('08/09')
    expect(rotuloPeriodoLista(undefined, undefined)).toBe('sem prazo')
  })
})

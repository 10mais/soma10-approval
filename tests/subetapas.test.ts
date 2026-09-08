import { describe, it, expect } from 'vitest'
import { normalizarSubetapas, progressoMarco, fimEfetivoDoMarco, statusSugerido, kpiPct } from '@/lib/subetapas'

const AGORA = new Date('2026-09-07T12:00:00Z').getTime()

describe('subetapas — etapas dentro do marco', () => {
  it('normaliza: título obrigatório, status conhecido, datas e números válidos', () => {
    const subs = normalizarSubetapas([
      { id: 'a', titulo: '  Auditoria  ', status: 'em_andamento', dataInicio: '2026-09-01T00:00:00.000Z', dataFim: '2026-09-10', kpi: 'Leads', kpiMeta: '50', kpiAtual: 12.5 },
      { titulo: '', status: 'concluido' },
      { titulo: 'Sem id', status: 'inventado', dataFim: 'ontem', kpiMeta: 'x', cor: 'azul' },
      { titulo: 'Com cor', cor: '#1E90FF' },
    ])
    expect(subs).toEqual([
      { id: 'a', titulo: 'Auditoria', status: 'em_andamento', dataInicio: '2026-09-01', dataFim: '2026-09-10', kpi: 'Leads', kpiMeta: 50, kpiAtual: 12.5 },
      { id: 'se-3', titulo: 'Sem id', status: 'pendente' },
      { id: 'se-4', titulo: 'Com cor', status: 'pendente', cor: '#1e90ff' },
    ])
    expect(normalizarSubetapas(null)).toEqual([])
  })

  it('progresso: concluídas, %, atrasadas, próxima, KPIs e prazo efetivo', () => {
    const subs = normalizarSubetapas([
      { id: '1', titulo: 'Briefing', status: 'concluido', dataFim: '2026-09-02', kpi: 'Docs', kpiMeta: 1, kpiAtual: 1 },
      { id: '2', titulo: 'Copy', status: 'em_andamento', dataFim: '2026-09-05', kpi: 'Textos', kpiMeta: 10, kpiAtual: 4 },
      { id: '3', titulo: 'Arte', status: 'pendente', dataFim: '2026-09-20' },
    ])
    const p = progressoMarco(subs, AGORA)
    expect([p.total, p.concluidas, p.pct]).toEqual([3, 1, 33])
    expect(p.atrasadas.map(s => s.id)).toEqual(['2']) // venceu 05/09 e não concluiu
    expect(p.proxima?.id).toBe('2')
    expect(p.kpis).toEqual({ total: 2, atingidos: 1 })
    expect(p.fimEfetivo).toBe('2026-09-20')
  })

  it('sem sub-etapas: progresso vazio e nada atrasado', () => {
    const p = progressoMarco(undefined, AGORA)
    expect(p).toMatchObject({ total: 0, concluidas: 0, pct: 0, atrasadas: [], kpis: { total: 0, atingidos: 0 } })
    expect(p.proxima).toBeUndefined()
  })

  it('prazo efetivo do marco = o mais tarde entre o marco e as sub-etapas', () => {
    const subs = normalizarSubetapas([{ titulo: 'x', dataFim: '2026-09-25' }])
    expect(fimEfetivoDoMarco({ dataFim: '2026-09-15T00:00:00.000Z' }, subs)).toBe('2026-09-25')
    expect(fimEfetivoDoMarco({ dataFim: '2026-09-30T00:00:00.000Z' }, subs)).toBe('2026-09-30')
    expect(fimEfetivoDoMarco({}, subs)).toBe('2026-09-25')
    expect(fimEfetivoDoMarco({ dataFim: '2026-09-30' }, [])).toBe('2026-09-30')
  })

  it('status sugerido segue as sub-etapas, sem tocar em cancelado', () => {
    const todas = normalizarSubetapas([{ titulo: 'a', status: 'concluido' }, { titulo: 'b', status: 'concluido' }])
    expect(statusSugerido('em_andamento', todas, AGORA)).toBe('concluido')
    const atrasada = normalizarSubetapas([{ titulo: 'a', status: 'pendente', dataFim: '2026-09-01' }])
    expect(statusSugerido('planejado', atrasada, AGORA)).toBe('atrasado')
    const comecou = normalizarSubetapas([{ titulo: 'a', status: 'em_andamento' }, { titulo: 'b' }])
    expect(statusSugerido('planejado', comecou, AGORA)).toBe('em_andamento')
    expect(statusSugerido('planejado', normalizarSubetapas([{ titulo: 'a' }]), AGORA)).toBe('planejado')
    expect(statusSugerido('cancelado', todas, AGORA)).toBe('cancelado')
    expect(statusSugerido('planejado', [], AGORA)).toBe('planejado')
  })

  it('kpiPct: proporção limitada a 0–100; sem meta não há percentual', () => {
    expect(kpiPct({ id: '1', titulo: 'x', status: 'pendente', kpiMeta: 40, kpiAtual: 10 })).toBe(25)
    expect(kpiPct({ id: '1', titulo: 'x', status: 'pendente', kpiMeta: 40, kpiAtual: 90 })).toBe(100)
    expect(kpiPct({ id: '1', titulo: 'x', status: 'pendente', kpiAtual: 90 })).toBeNull()
  })
})

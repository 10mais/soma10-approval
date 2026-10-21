import { describe, it, expect } from 'vitest'
import { proximasDaPessoa, quandoDoPrazo } from '@/lib/proximasTarefas'
import { fimDoDiaBR } from '@/lib/datas'

// Barra "Próximas tarefas" (dono, 20/10/2026). 20/10/2026 ao meio-dia de Brasília.
const AGORA = Date.parse('2026-10-20T15:00:00Z')
const ANA = 'ana@10mais.com.br'

const t = (id: string, extra: Record<string, any> = {}) => ({ id, titulo: `Tarefa ${id}`, status: 'a_fazer', responsavelEmail: ANA, ...extra })

describe('quandoDoPrazo — faixas por dia de Brasília', () => {
  it('atrasada, hoje, amanhã, semana, depois e sem prazo', () => {
    const hoje = '2026-10-20'
    expect(quandoDoPrazo(fimDoDiaBR('2026-10-19'), hoje)).toBe('atrasada')
    expect(quandoDoPrazo(fimDoDiaBR('2026-10-20'), hoje)).toBe('hoje')
    expect(quandoDoPrazo(fimDoDiaBR('2026-10-21'), hoje)).toBe('amanha')
    expect(quandoDoPrazo(fimDoDiaBR('2026-10-27'), hoje)).toBe('semana')
    expect(quandoDoPrazo(fimDoDiaBR('2026-10-28'), hoje)).toBe('depois')
    expect(quandoDoPrazo(undefined, hoje)).toBe('sem_prazo')
  })
})

describe('proximasDaPessoa', () => {
  it('só o que está ABERTO e é da pessoa (e-mail sem diferenciar maiúscula)', () => {
    const r = proximasDaPessoa([
      t('1'),
      t('2', { responsavelEmail: 'ANA@10mais.com.br ' }),
      t('3', { status: 'concluido' }),
      t('4', { status: 'descartado' }),
      t('5', { excluidoEm: '2026-10-19T10:00:00Z' }),
      t('6', { responsavelEmail: 'outra@10mais.com.br' }),
      t('7', { status: 'em_revisao' }),
    ], ANA, AGORA)
    expect(r.itens.map(i => i.id).sort()).toEqual(['1', '2', '7'])
    expect(r.total).toBe(3)
  })

  it('atrasadas primeiro, depois pelo prazo; sem prazo no fim', () => {
    const r = proximasDaPessoa([
      t('sem'),
      t('semana', { prazo: fimDoDiaBR('2026-10-24') }),
      t('atrasada', { prazo: fimDoDiaBR('2026-10-15') }),
      t('hoje', { prazo: fimDoDiaBR('2026-10-20') }),
      t('amanha', { prazo: fimDoDiaBR('2026-10-21') }),
    ], ANA, AGORA)
    expect(r.itens.map(i => i.id)).toEqual(['atrasada', 'hoje', 'amanha', 'semana', 'sem'])
    expect(r.itens[0].quando).toBe('atrasada')
    expect(r.atrasadas).toBe(1)
  })

  it('subtarefa aparece com o título da tarefa-mãe (a lição de julho: ela sumia)', () => {
    const r = proximasDaPessoa([
      t('mae', { titulo: 'Plano de conteúdo — Santa Cestas — Outubro/2026', responsavelEmail: 'social@10mais.com.br' }),
      t('pauta', { titulo: 'Carrossel Dia das Crianças', tarefaPaiId: 'mae', prazo: fimDoDiaBR('2026-10-22') }),
    ], ANA, AGORA)
    expect(r.itens).toHaveLength(1)
    expect(r.itens[0]).toMatchObject({ id: 'pauta', maeTitulo: 'Plano de conteúdo — Santa Cestas — Outubro/2026', quando: 'semana' })
  })

  it('23h30 de Brasília ainda é HOJE (o servidor em UTC já está no dia seguinte)', () => {
    const r = proximasDaPessoa([t('x', { prazo: fimDoDiaBR('2026-10-20') })], ANA, Date.parse('2026-10-21T02:30:00Z'))
    expect(r.itens[0].quando).toBe('hoje')
  })

  it('limite e totais: a barra mostra 5, mas conta todas', () => {
    const lista = Array.from({ length: 8 }, (_, i) => t(String(i), { prazo: fimDoDiaBR(`2026-10-${String(10 + i).padStart(2, '0')}`) }))
    const r = proximasDaPessoa(lista, ANA, AGORA)
    expect(r.itens).toHaveLength(5)
    expect(r.total).toBe(8)
    expect(r.atrasadas).toBe(8)
  })

  it('sem e-mail não devolve nada', () => {
    expect(proximasDaPessoa([t('1')], '', AGORA)).toEqual({ itens: [], total: 0, atrasadas: 0 })
  })
})

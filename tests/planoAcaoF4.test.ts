import { describe, it, expect } from 'vitest'
import { normalizarSla, SLA_PADRAO, combinados, avisosDePrazo, textoAviso } from '@/lib/planoAcao'
import type { SubEtapa } from '@/lib/subetapas'

// F4 do plano de ação (17/11/2026): os combinados (SLAs) escritos e os avisos de véspera e
// atraso para quem está com a bola.

const e = (id: string, extra: Partial<SubEtapa> = {}): SubEtapa => ({ id, titulo: id, status: 'pendente', ...extra })

describe('SLAs configuráveis', () => {
  it('padrão aprovado pelo dono', () => {
    expect(SLA_PADRAO).toEqual({ clienteMaterialDiasUteis: 3, clienteIndicadoresDiaUtil: 5, equipeAjusteDiasUteis: 2, relatorioDiaUtil: 5, ataReuniaoHoras: 24, avisoVesperaDias: 1 })
  })
  it('valor inválido volta ao padrão; fora do limite é grampeado; texto vira número', () => {
    const s = normalizarSla({ clienteMaterialDiasUteis: 'abc', equipeAjusteDiasUteis: 99, relatorioDiaUtil: '7', avisoVesperaDias: 0, ataReuniaoHoras: '' })
    expect(s.clienteMaterialDiasUteis).toBe(3)
    expect(s.equipeAjusteDiasUteis).toBe(15)
    expect(s.relatorioDiaUtil).toBe(7)
    expect(s.avisoVesperaDias).toBe(0) // 0 = sem aviso de véspera
    expect(s.ataReuniaoHoras).toBe(24)
    expect(normalizarSla(null)).toEqual(SLA_PADRAO)
  })
  it('combinados em frases, com singular e plural', () => {
    const c = combinados({ ...SLA_PADRAO, equipeAjusteDiasUteis: 1 }, 24)
    expect(c.cliente[0]).toBe('Aprovar copy e criativo em até 24 horas.')
    expect(c.cliente[1]).toBe('Enviar material ou acesso pedido em até 3 dias úteis.')
    expect(c.equipe).toContain('Devolver o ajuste pedido em até 1 dia útil.')
    expect(c.equipe).toContain('Enviar o relatório do mês até o 5º dia útil.')
  })
})

describe('avisos de prazo', () => {
  const hoje = '2026-11-17'
  const marcos = [
    { id: 'm4', tipo: 'semana', dataInicio: '2026-11-09', subetapas: [
      e('fotos', { responsavelTipo: 'cliente', responsavelNome: 'Cliente', dataFim: '2026-11-12' }),
      e('ligada', { responsavelTipo: 'equipe', responsavelEmail: 'ana@x', dataFim: '2026-11-13', vinculo: { tipo: 'tarefa', id: 't1' } }),
      e('feita', { responsavelTipo: 'cliente', status: 'concluido', dataFim: '2026-11-12' }),
    ] },
    { id: 'm5', tipo: 'semana', dataInicio: '2026-11-16', subetapas: [
      e('Reunião semanal (17/11)', { responsavelTipo: 'equipe', responsavelEmail: 'w@x', dataFim: '2026-11-17' }),
      e('gilberto', { dataFim: '2026-11-16' }),
      e('verba', { responsavelTipo: 'cliente', dataFim: '2026-11-18' }),
      e('ata', { responsavelTipo: 'equipe', responsavelEmail: 'w@x', dataFim: '2026-11-18' }),
      e('longe', { responsavelTipo: 'cliente', dataFim: '2026-11-21' }),
    ] },
    { id: 'm11', tipo: 'semana', recesso: true, dataInicio: '2026-12-28', subetapas: [e('recesso', { dataFim: '2026-11-10' })] },
  ]
  const a = avisosDePrazo(marcos, hoje)
  it('atraso e véspera, só para entrega aberta sem tarefa e fora do recesso', () => {
    expect(a.map(x => [x.entregaId, x.tipo, x.para])).toEqual([
      ['fotos', 'atraso', 'cliente'],
      ['gilberto', 'atraso', 'dono'],
      ['verba', 'vespera', 'cliente'],
      ['ata', 'vespera', 'equipe'],
    ])
  })
  it('vence hoje não avisa (o dia ainda não acabou); a reunião de hoje fica quieta', () => {
    expect(a.some(x => x.entregaId.startsWith('Reunião'))).toBe(false)
  })
  it('véspera configurável: 3 dias pega o sábado; 0 desliga', () => {
    expect(avisosDePrazo(marcos, hoje, { ...SLA_PADRAO, avisoVesperaDias: 4 }).map(x => x.entregaId)).toContain('longe')
    expect(avisosDePrazo(marcos, hoje, { ...SLA_PADRAO, avisoVesperaDias: 0 }).every(x => x.tipo === 'atraso')).toBe(true)
  })
  it('atraso de mais de 14 dias não avisa (histórico de plano importado)', () => {
    const velho = [{ id: 'v', tipo: 'semana', dataInicio: '2026-10-19', subetapas: [e('antiga', { responsavelTipo: 'cliente', dataFim: '2026-10-23' })] }]
    expect(avisosDePrazo(velho, hoje)).toEqual([])
  })
  it('a equipe recebe com o e-mail do responsável', () => {
    expect(a.find(x => x.entregaId === 'ata')?.responsavelEmail).toBe('w@x')
    expect(a.find(x => x.entregaId === 'fotos')?.responsavelEmail).toBeUndefined()
  })
  it('texto no tom de quem recebe', () => {
    const cli = textoAviso(a[0], 'Dr. Angelo')
    expect(cli.titulo).toBe('Uma entrega sua está atrasada')
    expect(cli.mensagem).toContain('o prazo era 12/11')
    expect(cli.mensagem).toContain('"Já fiz"')
    expect(textoAviso(a[1], 'Dr. Angelo').titulo).toBe('Entrega sem responsável atrasada há 1 dia')
    expect(textoAviso(a[3], 'Dr. Angelo').mensagem).toBe('ata (Dr. Angelo): vence amanhã (prazo 18/11).')
  })
})

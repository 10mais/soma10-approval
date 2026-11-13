import { describe, it, expect } from 'vitest'
import { STATUS_TAREFA, STATUS_ABERTOS, statusAberto, rotuloStatusTarefa, corStatusTarefa } from '@/lib/statusTarefa'
import { STATUS_ABERTOS as ABERTOS_PROXIMAS } from '@/lib/proximasTarefas'

// Status da tarefa: uma lista só. "Em ajuste" (dono, 13/11) esquecido numa tela faria a tarefa
// sumir dela — por isso as telas leem daqui.

describe('statusTarefa', () => {
  it('seis status na ordem do quadro, com Em ajuste entre Em andamento e Em revisão', () => {
    expect(STATUS_TAREFA.map(s => s.chave)).toEqual(['a_fazer', 'em_andamento', 'em_ajuste', 'em_revisao', 'concluido', 'descartado'])
  })
  it('Em ajuste conta como aberta; concluída e descartada não; sem status conta como aberta', () => {
    expect(statusAberto('em_ajuste')).toBe(true)
    expect(statusAberto('em_revisao')).toBe(true)
    expect(statusAberto('concluido')).toBe(false)
    expect(statusAberto('descartado')).toBe(false)
    expect(statusAberto(undefined)).toBe(true)
  })
  it('rótulos com acento e cor de cada status', () => {
    expect(rotuloStatusTarefa('em_ajuste')).toBe('Em ajuste')
    expect(rotuloStatusTarefa('em_revisao')).toBe('Em revisão')
    expect(corStatusTarefa('em_ajuste')).toBe('var(--v2-hot)')
    expect(rotuloStatusTarefa('desconhecido')).toBe('desconhecido')
  })
  it('a barra Próximas tarefas usa os mesmos abertos', () => {
    expect([...ABERTOS_PROXIMAS].sort()).toEqual([...STATUS_ABERTOS].sort())
  })
})

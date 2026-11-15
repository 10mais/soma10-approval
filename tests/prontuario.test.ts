import { describe, it, expect } from 'vitest'
import { podeLerProntuario, semProntuario, temProntuarioEscrito } from '@/lib/prontuario'

describe('quem lê o prontuário', () => {
  it('admin (a dona da clínica) e quem atende leem', () => {
    expect(podeLerProntuario({ role: 'admin' })).toBe(true)
    expect(podeLerProntuario({ role: 'usuario', areaSaude: 'Estética' })).toBe(true)
    expect(podeLerProntuario({ role: 'gerente', recebeAgenda: true })).toBe(true)
  })

  it('Comercial, recepção e gerente sem área de saúde não leem', () => {
    expect(podeLerProntuario({ role: 'vendas' })).toBe(false)
    expect(podeLerProntuario({ role: 'usuario' })).toBe(false)
    expect(podeLerProntuario({ role: 'gerente' })).toBe(false)
  })

  it('"não atende na agenda" desligado à mão vale mais que a área cadastrada', () => {
    expect(podeLerProntuario({ role: 'usuario', areaSaude: 'Nutrição', recebeAgenda: false })).toBe(false)
  })

  it('cliente e sessão sem usuário nunca leem', () => {
    expect(podeLerProntuario({ role: 'cliente', areaSaude: 'Estética' })).toBe(false)
    expect(podeLerProntuario(null)).toBe(false)
  })
})

describe('atendimento sem o prontuário', () => {
  it('tira o texto e deixa só o aviso de que existe', () => {
    const r = semProntuario({ id: 'a1', status: 'atendido', registroAtendimento: 'Aplicação 20U.', procedimentosRealizados: ['Botox'] })
    expect(r).toEqual({ id: 'a1', status: 'atendido', procedimentosRealizados: ['Botox'], temProntuario: true })
    expect('registroAtendimento' in r).toBe(false)
  })

  it('sem prontuário escrito, nada de aviso', () => {
    expect(semProntuario({ id: 'a2', registroAtendimento: '   ' })).toEqual({ id: 'a2' })
    expect(semProntuario({ id: 'a3' })).toEqual({ id: 'a3' })
  })

  it('reconhece prontuário escrito', () => {
    expect(temProntuarioEscrito({ registroAtendimento: 'x' })).toBe(true)
    expect(temProntuarioEscrito({ registroAtendimento: ' ' })).toBe(false)
    expect(temProntuarioEscrito(null)).toBe(false)
  })
})

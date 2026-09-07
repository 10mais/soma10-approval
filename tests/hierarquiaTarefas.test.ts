import { describe, it, expect } from 'vitest'
import { podeSerFilha, camposAoVincular, progressoDaMae, prazoEstoura, validarEmMassa, filhasDe } from '@/lib/hierarquiaTarefas'

// "Puxar tarefas para dentro de outras" mexe na estrutura do trabalho da equipe.
// Um vínculo errado (ciclo, dois níveis, mãe na lixeira) quebra a Lista e o
// Kanban, que foram desenhados para mãe → filhas. Por isso a regra é testada.

const T = [
  { id: 'mae', titulo: 'Conteúdos do mês', clienteId: 'c1', clienteNome: 'Universal', prazo: '2026-09-08T23:59:59.000Z', status: 'a_fazer' },
  { id: 'f1', titulo: 'Post 1', clienteId: 'c1', clienteNome: 'Universal', tarefaPaiId: 'mae', status: 'concluido' },
  { id: 'f2', titulo: 'Post 2', clienteId: 'c1', clienteNome: 'Universal', tarefaPaiId: 'mae', status: 'em_andamento', prazo: '2026-09-20T23:59:59.000Z' },
  { id: 'solta', titulo: 'Landing', clienteId: 'c2', clienteNome: 'GL', status: 'a_fazer' },
  { id: 'lixo', titulo: 'Velha', clienteId: 'c1', status: 'a_fazer', excluidoEm: '2026-09-01T00:00:00.000Z' },
  { id: 'outraMae', titulo: 'Campanha', clienteId: 'c1', status: 'a_fazer' },
  { id: 'f3', titulo: 'Arte', clienteId: 'c1', tarefaPaiId: 'outraMae', status: 'a_fazer' },
]

describe('podeSerFilha', () => {
  it('tarefa solta pode entrar numa mãe', () => {
    expect(podeSerFilha('solta', 'mae', T)).toEqual({ ok: true })
  })
  it('não pode ser filha de si mesma', () => {
    expect(podeSerFilha('solta', 'solta', T).ok).toBe(false)
  })
  it('só um nível: uma subtarefa não vira mãe', () => {
    const v = podeSerFilha('solta', 'f1', T)
    expect(v.ok).toBe(false)
    expect(v.motivo).toMatch(/já é uma subtarefa/)
  })
  it('só um nível: quem tem filhas não vira filha', () => {
    const v = podeSerFilha('mae', 'outraMae', T)
    expect(v.ok).toBe(false)
    expect(v.motivo).toMatch(/tem subtarefas/)
  })
  it('mãe na lixeira não recebe filhas', () => {
    expect(podeSerFilha('solta', 'lixo', T).ok).toBe(false)
  })
  it('já é filha dessa mãe = recusa (nada a fazer)', () => {
    expect(podeSerFilha('f2', 'mae', T).ok).toBe(false)
  })
  it('mover uma filha para OUTRA mãe é permitido', () => {
    expect(podeSerFilha('f2', 'outraMae', T)).toEqual({ ok: true })
  })
  it('ids desconhecidos são recusados com motivo', () => {
    expect(podeSerFilha('x', 'mae', T).ok).toBe(false)
    expect(podeSerFilha('solta', 'y', T).ok).toBe(false)
  })
})

describe('camposAoVincular', () => {
  it('cliente diferente: a filha assume o cliente da mãe e avisa', () => {
    const c = camposAoVincular(T[3], T[0])
    expect(c).toEqual({ tarefaPaiId: 'mae', clienteId: 'c1', clienteNome: 'Universal', clienteMudou: true })
  })
  it('mesmo cliente: só o vínculo', () => {
    expect(camposAoVincular(T[6], T[0])).toEqual({ tarefaPaiId: 'mae', clienteMudou: false })
  })
})

describe('progresso e prazo', () => {
  it('conta filhas, concluídas e abertas (lixeira fora)', () => {
    const p = progressoDaMae('mae', T)
    expect(p.total).toBe(2)
    expect(p.concluidas).toBe(1)
    expect(p.abertas.map(a => a.id)).toEqual(['f2'])
    expect(filhasDe('outraMae', T)).toHaveLength(1)
  })
  it('prazo da filha depois do da mãe estoura; sem prazo não estoura', () => {
    expect(prazoEstoura(T[2], T[0])).toBe(true)
    expect(prazoEstoura(T[1], T[0])).toBe(false)
  })
})

describe('validarEmMassa', () => {
  it('separa as que podem das recusadas, com motivo', () => {
    const r = validarEmMassa(['solta', 'mae', 'f2', 'x'], 'outraMae', T)
    expect(r.podem).toEqual(['solta', 'f2'])
    expect(r.recusadas.map(x => x.id)).toEqual(['mae', 'x'])
    expect(r.recusadas[0].motivo).toMatch(/tem subtarefas/)
  })
})

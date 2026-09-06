import { describe, it, expect } from 'vitest'
import { montarManchete, textoDaManchete, fatosDe, sementeDoDia, type ContextoPessoa } from '@/lib/manchete'

// A manchete é a primeira coisa que cada pessoa lê ao abrir o sistema. Ela
// precisa (1) falar da fila DELA, (2) pôr o mais urgente primeiro, (3) não
// repetir a mesma fraseologia todo dia, e (4) nunca mentir sobre o que é
// urgente. Errar o 4 é pior que errar o 3.

const AGORA_MANHA = new Date('2026-09-04T09:00:00').getTime()
const AGORA_TARDE = new Date('2026-09-04T15:00:00').getTime()
const iso = (diasAPartirDeHoje: number) => new Date(AGORA_MANHA + diasAPartirDeHoje * 86400000).toISOString()

const vazio: ContextoPessoa = { tarefas: [], aprovacoes: [], ajustes: [], publicaHoje: 0, reunioes: [] }

describe('ordem de urgência', () => {
  it('atrasado vem antes de tudo', () => {
    const f = fatosDe({ ...vazio, tarefas: [{ titulo: 'x', prazo: iso(-2) }], publicaHoje: 3, reunioes: [{ hora: '09:30', titulo: 'Comercial' }] }, AGORA_MANHA)
    expect(f[0].partes.some(p => p.quente)).toBe(true)
    expect(f[0].partes.map(p => p.texto).join('')).toMatch(/atrasad|vencid/)
  })

  it('material que voltou do cliente vence "vence hoje"', () => {
    const f = fatosDe({ ...vazio, ajustes: [{ titulo: 'a', clienteNome: 'GL Joias' }], tarefas: [{ titulo: 'x', prazo: iso(0) }] }, AGORA_MANHA)
    expect(f[0].partes.map(p => p.texto).join('')).toMatch(/voltou|pediu ajuste/)
  })

  it('aprovação parada (3+ dias) é quente; recente não é', () => {
    const parada = fatosDe({ ...vazio, aprovacoes: [{ titulo: 'a', desde: iso(-5), clienteNome: 'Universal' }] }, AGORA_MANHA)
    const recente = fatosDe({ ...vazio, aprovacoes: [{ titulo: 'a', desde: iso(-1) }] }, AGORA_MANHA)
    expect(parada[0].partes.some(p => p.quente)).toBe(true)
    expect(recente[0].partes.some(p => p.quente)).toBe(false)
  })

  it('reunião nas próximas 3h pesa mais do que reunião no fim do dia', () => {
    const perto = fatosDe({ ...vazio, reunioes: [{ hora: '10:00', titulo: 'Comercial' }] }, AGORA_MANHA)
    const longe = fatosDe({ ...vazio, reunioes: [{ hora: '17:00', titulo: 'Deny' }] }, AGORA_MANHA)
    expect(perto[0].peso).toBeGreaterThan(longe[0].peso)
  })

  it('reunião que já passou não entra', () => {
    const f = fatosDe({ ...vazio, reunioes: [{ hora: '08:00', titulo: 'Passou' }] }, AGORA_MANHA)
    expect(f).toHaveLength(0)
  })
})

describe('a frase', () => {
  it('só os 3 fatos mais urgentes entram; o resto vai para o subtítulo', () => {
    const c: ContextoPessoa = {
      tarefas: [{ titulo: 'a', prazo: iso(-1) }, { titulo: 'b', prazo: iso(0) }],
      aprovacoes: [{ titulo: 'c', desde: iso(-4), clienteNome: 'Universal' }],
      ajustes: [{ titulo: 'd', clienteNome: 'GL' }],
      publicaHoje: 2,
      reunioes: [{ hora: '10:00', titulo: 'Comercial' }],
    }
    const m = montarManchete(c, AGORA_MANHA)
    const destaques = m.partes.filter(p => p.destaque)
    expect(destaques.length).toBe(3)
    expect(m.subtitulo.length).toBeGreaterThan(0)
    expect(m.tom).toBe('urgente')
  })

  it('cada destaque aponta para um bloco da tela', () => {
    const m = montarManchete({ ...vazio, tarefas: [{ titulo: 'a', prazo: iso(0) }], publicaHoje: 1 }, AGORA_MANHA)
    m.partes.filter(p => p.destaque).forEach(p => expect(p.alvo).toBeDefined())
  })

  it('fala da fila da PESSOA — tarefa de outro não aparece', () => {
    // O contexto já vem filtrado pela rota; aqui garantimos que nada é inventado.
    const m = montarManchete(vazio, AGORA_MANHA)
    expect(textoDaManchete(m)).not.toMatch(/\d+ tarefa/)
  })

  it('termina com ponto e começa com maiúscula', () => {
    const m = montarManchete({ ...vazio, publicaHoje: 2 }, AGORA_MANHA)
    const t = textoDaManchete(m)
    expect(t.endsWith('.')).toBe(true)
    expect(t[0]).toBe(t[0].toUpperCase())
  })

  it('singular e plural corretos', () => {
    expect(textoDaManchete(montarManchete({ ...vazio, publicaHoje: 1 }, AGORA_MANHA))).toMatch(/1 (post seu sai|publicação sua)/)
    expect(textoDaManchete(montarManchete({ ...vazio, publicaHoje: 4 }, AGORA_MANHA))).toMatch(/4 (posts seus saem|publicações suas)/)
  })
})

describe('não repetir', () => {
  it('a fraseologia muda de um dia para o outro com os MESMOS fatos', () => {
    const c: ContextoPessoa = { ...vazio, tarefas: [{ titulo: 'a', prazo: iso(0) }], publicaHoje: 2 }
    const hoje = textoDaManchete(montarManchete(c, AGORA_MANHA))
    const amanha = textoDaManchete(montarManchete({ ...c, tarefas: [{ titulo: 'a', prazo: iso(1) }] }, AGORA_MANHA + 86400000))
    expect(hoje).not.toBe(amanha)
  })

  it('mas é estável dentro do mesmo dia (não pula a cada reload)', () => {
    const c: ContextoPessoa = { ...vazio, tarefas: [{ titulo: 'a', prazo: iso(0) }] }
    expect(textoDaManchete(montarManchete(c, AGORA_MANHA))).toBe(textoDaManchete(montarManchete(c, AGORA_MANHA + 60000)))
  })

  it('a abertura muda com a hora do dia', () => {
    const c: ContextoPessoa = { ...vazio, publicaHoje: 1 }
    const manha = textoDaManchete(montarManchete(c, AGORA_MANHA))
    const tarde = textoDaManchete(montarManchete(c, AGORA_TARDE))
    expect(manha).not.toBe(tarde)
  })

  it('a semente é por dia', () => {
    expect(sementeDoDia(AGORA_MANHA)).toBe(sementeDoDia(AGORA_TARDE))
    expect(sementeDoDia(AGORA_MANHA)).not.toBe(sementeDoDia(AGORA_MANHA + 86400000))
  })
})

describe('dia tranquilo', () => {
  it('sem urgência, aponta o próximo prazo em vez de inventar drama', () => {
    const m = montarManchete({ ...vazio, tarefas: [{ titulo: 'Página Rhema Lab', prazo: iso(3) }, { titulo: 'Outra', prazo: iso(7) }] }, AGORA_MANHA)
    expect(m.tom).toBe('tranquilo')
    expect(textoDaManchete(m)).toContain('Nada vence hoje')
    expect(textoDaManchete(m)).toContain('Página Rhema Lab')
    expect(textoDaManchete(m)).toContain('em 3 dias')
  })

  it('prazo amanhã diz "amanhã"', () => {
    expect(textoDaManchete(montarManchete({ ...vazio, tarefas: [{ titulo: 'x', prazo: iso(1) }] }, AGORA_MANHA))).toContain('amanhã')
  })

  it('fila vazia de verdade tem frase própria, sem número', () => {
    const m = montarManchete(vazio, AGORA_MANHA)
    expect(m.tom).toBe('tranquilo')
    expect(textoDaManchete(m)).not.toMatch(/\d/)
  })

  it('tarefa concluída não conta como aberta', () => {
    const m = montarManchete({ ...vazio, tarefas: [{ titulo: 'x', prazo: iso(0), status: 'concluido' }] }, AGORA_MANHA)
    expect(m.tom).toBe('tranquilo')
  })
})

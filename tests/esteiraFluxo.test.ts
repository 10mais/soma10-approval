import { describe, it, expect } from 'vitest'
import { aoConcluirTarefa, deveCriarTarefaDesigner, descricaoTarefaDesigner, tituloTarefaMae, tituloSubtarefa, prazoTarefaMae } from '@/lib/esteiraFluxo'
import { apareceNoPlanner } from '@/lib/plannerFiltro'

// Linha de montagem Studio > Tarefa > Planner: as transicoes do fluxo.
// O plannerFiltro entra como ORACULO (intocavel): o que a transicao produz
// precisa de fato aparecer no Planner — senao a peca some entre as estacoes.

describe('aoConcluirTarefa', () => {
  it('criativo (designer terminou) -> Planner como rascunho', () => {
    expect(aoConcluirTarefa('criativo')).toEqual({ etapa: 'pronto', status: 'rascunho' })
  })

  it('qualquer outra etapa nao mexe na pauta (nunca regride, nunca pula aprovacao)', () => {
    for (const etapa of ['briefing', 'copy', 'aprovacao_copy', 'aprovacao_criativo', 'pronto']) {
      expect(aoConcluirTarefa(etapa), `etapa ${etapa}`).toBeNull()
    }
  })

  it('pauta avulsa (sem etapa) e valor invalido -> nada', () => {
    expect(aoConcluirTarefa(undefined)).toBeNull()
    expect(aoConcluirTarefa('')).toBeNull()
    expect(aoConcluirTarefa('qualquer_coisa')).toBeNull()
  })

  it('ORACULO plannerFiltro: antes da conclusao a pauta NAO esta no Planner; depois ESTA', () => {
    const antes = { status: 'rascunho', etapa: 'criativo', rascunhoInterno: true }
    expect(apareceNoPlanner(antes)).toBe(false)
    const av = aoConcluirTarefa(antes.etapa)!
    const depois = { ...antes, etapa: av.etapa, status: av.status }
    expect(apareceNoPlanner(depois)).toBe(true)
  })
})

describe('deveCriarTarefaDesigner', () => {
  it('copy aprovada (pauta entrou em criativo) sem tarefa -> cria', () => {
    expect(deveCriarTarefaDesigner({ etapa: 'criativo' })).toBe(true)
  })

  it('pauta ja com tarefa vinculada -> nao duplica (copy reaprovada reabre a existente)', () => {
    expect(deveCriarTarefaDesigner({ etapa: 'criativo', tarefaId: 't1' })).toBe(false)
  })

  it('fora da etapa criativo -> nao cria', () => {
    for (const etapa of ['briefing', 'copy', 'aprovacao_copy', 'aprovacao_criativo', 'pronto', undefined]) {
      expect(deveCriarTarefaDesigner({ etapa }), `etapa ${etapa}`).toBe(false)
    }
  })
})

describe('descricaoTarefaDesigner', () => {
  it('leva a copy aprovada inteira, campo a campo', () => {
    const d = descricaoTarefaDesigner({
      briefing: 'Dia das maes', headline: 'Mae merece mais', subheadline: 'Presente com proposito',
      textoImagem: '20% OFF', cta: 'Agende agora', legenda: 'Linha 1\nLinha 2 #hashtag', sugestaoImagem: 'Foto quente, tons terrosos',
    })
    for (const trecho of ['Copy aprovada', 'Dia das maes', 'Mae merece mais', 'Presente com proposito', '20% OFF', 'Agende agora', 'Foto quente', 'Linha 1<br>Linha 2']) {
      expect(d).toContain(trecho)
    }
  })

  it('campo vazio nao vira linha vazia', () => {
    const d = descricaoTarefaDesigner({ briefing: 'So briefing' })
    expect(d).toContain('So briefing')
    expect(d).not.toContain('Headline')
    expect(d).not.toContain('CTA')
  })

  it('escapa HTML vindo da copy (descricao e texto rico)', () => {
    const d = descricaoTarefaDesigner({ briefing: 'a < b & c' })
    expect(d).toContain('a &lt; b &amp; c')
  })

  it('carrossel: leva as laminas numeradas, na ordem; lamina vazia nao vira linha', () => {
    const d = descricaoTarefaDesigner({ briefing: 'Carrossel do agro', laminas: [{ texto: 'Abertura' }, { texto: '' }, { texto: 'Fechamento com CTA' }] })
    expect(d).toContain('Lâmina 1:</strong> Abertura')
    expect(d).toContain('Lâmina 3:</strong> Fechamento com CTA')
    expect(d).not.toContain('Lâmina 2')
  })
})

describe('tituloTarefaMae', () => {
  it('cliente + mes por extenso + ano', () => {
    expect(tituloTarefaMae({ clienteNome: 'Norah', mes: 8, ano: 2026 })).toBe('Plano de conteúdo — Norah — Agosto/2026')
  })

  it('usa o titulo do plano quando houver', () => {
    expect(tituloTarefaMae({ clienteNome: 'Norah', mes: 8, ano: 2026, titulo: 'Campanha Pais' }))
      .toBe('Plano de conteúdo — Norah — Agosto/2026 · Campanha Pais')
  })

  it('mes invalido nao explode', () => {
    expect(tituloTarefaMae({ clienteNome: 'X', mes: 13, ano: 2026 })).toContain('13/2026')
  })
})

describe('tituloSubtarefa', () => {
  it('precedencia briefing > headline > legenda', () => {
    expect(tituloSubtarefa({ briefing: 'B', headline: 'H', legenda: 'L' })).toBe('B')
    expect(tituloSubtarefa({ headline: 'H', legenda: 'L' })).toBe('H')
    expect(tituloSubtarefa({ legenda: 'L' })).toBe('L')
    expect(tituloSubtarefa({})).toBe('Pauta')
  })

  it('colapsa espacos e corta em 80', () => {
    expect(tituloSubtarefa({ briefing: '  muito \n espaco   aqui ' })).toBe('muito espaco aqui')
    expect(tituloSubtarefa({ briefing: 'x'.repeat(200) })).toHaveLength(80)
  })
})

describe('prazoTarefaMae', () => {
  it('maior dataAgendada entre as pautas', () => {
    const r = prazoTarefaMae([
      { dataAgendada: '2026-08-05T13:00:00.000Z' },
      { dataAgendada: '2026-08-28T18:30:00.000Z' },
      { dataAgendada: '2026-08-11T10:00:00.000Z' },
    ], { mes: 8, ano: 2026 })
    expect(r).toBe('2026-08-28T18:30:00.000Z')
  })

  it('data invalida e pauta sem data sao ignoradas', () => {
    const r = prazoTarefaMae([
      { dataAgendada: 'nao-e-data' }, {}, { dataAgendada: '2026-08-10T12:00:00.000Z' },
    ], { mes: 8, ano: 2026 })
    expect(r).toBe('2026-08-10T12:00:00.000Z')
  })

  it('sem nenhuma data -> ultimo dia do mes do plano (fevereiro incluso)', () => {
    expect(prazoTarefaMae([], { mes: 2, ano: 2026 })).toBe('2026-02-28T23:59:00.000Z')
    expect(prazoTarefaMae([], { mes: 12, ano: 2026 })).toBe('2026-12-31T23:59:00.000Z')
  })
})

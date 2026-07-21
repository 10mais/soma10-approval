import { describe, it, expect } from 'vitest'
import { planejarModelo, removerEtapaDoModelo } from '@/lib/aplicarModelo'

const BASE = new Date('2026-08-03T00:00:00.000Z') // segunda-feira

describe('planejarModelo — cascata de datas', () => {
  it('cada etapa começa onde a anterior terminou', () => {
    const { etapas } = planejarModelo({
      marcos: [
        { titulo: 'Briefing', diasDuracao: 3 },
        { titulo: 'Produção', diasDuracao: 7 },
      ],
    }, BASE)
    expect(etapas[0].dataInicio).toBe('2026-08-03T00:00:00.000Z')
    expect(etapas[0].dataFim).toBe('2026-08-06T00:00:00.000Z')
    expect(etapas[1].dataInicio).toBe('2026-08-06T00:00:00.000Z') // = fim da anterior
    expect(etapas[1].dataFim).toBe('2026-08-13T00:00:00.000Z')
  })

  it('duração 0 é marco pontual: sem dataFim e sem empurrar o cursor', () => {
    const { etapas } = planejarModelo({
      marcos: [
        { titulo: 'Kickoff', diasDuracao: 0 },
        { titulo: 'Alinhamento', diasDuracao: 0 },
        { titulo: 'Produção', diasDuracao: 5 },
      ],
    }, BASE)
    expect(etapas[0].dataFim).toBe('')
    expect(etapas[1].dataFim).toBe('')
    // os três começam no mesmo dia — reunião não consome prazo
    expect(etapas[1].dataInicio).toBe(BASE.toISOString())
    expect(etapas[2].dataInicio).toBe(BASE.toISOString())
    expect(etapas[2].dataFim).toBe('2026-08-08T00:00:00.000Z')
  })

  it('duração ausente, negativa ou lixo conta como 0 — rascunho não derruba a aplicação', () => {
    const { etapas } = planejarModelo({
      marcos: [
        { titulo: 'Sem duração' },
        { titulo: 'Negativa', diasDuracao: -5 },
        { titulo: 'Lixo', diasDuracao: NaN },
      ],
    }, BASE)
    expect(etapas.map(e => e.dataFim)).toEqual(['', '', ''])
    expect(etapas.every(e => e.dataInicio === BASE.toISOString())).toBe(true)
  })

  it('preenche os padrões de categoria e descrição', () => {
    const { etapas } = planejarModelo({ marcos: [{ titulo: 'X' }] }, BASE)
    expect(etapas[0].categoria).toBe('outro')
    expect(etapas[0].descricao).toBe('')
  })

  it('modelo vazio não quebra', () => {
    expect(planejarModelo({}, BASE)).toEqual({ etapas: [], tarefas: [] })
  })

  it('não muta a data recebida', () => {
    const base = new Date(BASE.getTime())
    planejarModelo({ marcos: [{ titulo: 'A', diasDuracao: 10 }] }, base)
    expect(base.toISOString()).toBe(BASE.toISOString())
  })
})

describe('planejarModelo — vínculo das tarefas', () => {
  it('liga a tarefa à etapa pelo índice', () => {
    const { tarefas } = planejarModelo({
      marcos: [{ titulo: 'A' }, { titulo: 'B' }],
      tarefas: [{ titulo: 'T', marcoIndice: 1 }],
    }, BASE)
    expect(tarefas[0].etapaIndice).toBe(1)
  })

  it('índice apontando para etapa inexistente vira tarefa solta, não erro', () => {
    const { tarefas } = planejarModelo({
      marcos: [{ titulo: 'A' }],
      tarefas: [{ titulo: 'Órfã', marcoIndice: 7 }],
    }, BASE)
    expect(tarefas[0].etapaIndice).toBeUndefined()
    expect(tarefas[0].titulo).toBe('Órfã')
  })

  it('preenche tipo e prioridade padrão', () => {
    const { tarefas } = planejarModelo({ tarefas: [{ titulo: 'T' }] }, BASE)
    expect(tarefas[0]).toEqual({ titulo: 'T', tipo: 'tarefa', prioridade: 'media' })
  })
})

describe('removerEtapaDoModelo', () => {
  const modelo = {
    marcos: [{ titulo: 'A' }, { titulo: 'B' }, { titulo: 'C' }],
    tarefas: [
      { titulo: 'daA', marcoIndice: 0 },
      { titulo: 'daB', marcoIndice: 1 },
      { titulo: 'daC', marcoIndice: 2 },
      { titulo: 'solta' },
    ],
  }

  it('desvincula as tarefas da etapa removida', () => {
    const r = removerEtapaDoModelo(modelo, 1)
    expect(r.tarefas.find(t => t.titulo === 'daB')?.marcoIndice).toBeUndefined()
  })

  it('DESCE o índice das tarefas das etapas seguintes — o bug que existia', () => {
    const r = removerEtapaDoModelo(modelo, 1)
    // 'daC' apontava para a etapa 2; com B fora, C virou a etapa 1.
    expect(r.tarefas.find(t => t.titulo === 'daC')?.marcoIndice).toBe(1)
    expect(r.marcos[1].titulo).toBe('C') // e continua sendo a etapa certa
  })

  it('não mexe em quem está antes nem em quem já era solta', () => {
    const r = removerEtapaDoModelo(modelo, 1)
    expect(r.tarefas.find(t => t.titulo === 'daA')?.marcoIndice).toBe(0)
    expect(r.tarefas.find(t => t.titulo === 'solta')?.marcoIndice).toBeUndefined()
  })

  it('remover a última etapa não desloca ninguém', () => {
    const r = removerEtapaDoModelo(modelo, 2)
    expect(r.tarefas.find(t => t.titulo === 'daA')?.marcoIndice).toBe(0)
    expect(r.tarefas.find(t => t.titulo === 'daB')?.marcoIndice).toBe(1)
    expect(r.tarefas.find(t => t.titulo === 'daC')?.marcoIndice).toBeUndefined()
  })

  it('sobrevive a modelo sem etapas ou sem tarefas', () => {
    expect(removerEtapaDoModelo({}, 0)).toEqual({ marcos: [], tarefas: [] })
  })

  it('o vínculo continua correto depois de aplicar o modelo editado', () => {
    const r = removerEtapaDoModelo(modelo, 1)
    const plano = planejarModelo(r, BASE)
    const daC = plano.tarefas.find(t => t.titulo === 'daC')!
    expect(plano.etapas[daC.etapaIndice!].titulo).toBe('C')
  })
})

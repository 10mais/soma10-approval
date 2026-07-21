import { describe, it, expect } from 'vitest'
import { planejarModelo, removerEtapaDoModelo, moverEtapaDoModelo, moverNaLista, avancarData, duracaoDaEtapa, atribuirResponsavelNaEtapa, type EtapaModelo, type TarefaModelo } from '@/lib/aplicarModelo'

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

describe('avancarData — dias, semanas e CALENDÁRIO', () => {
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  it('dias e semanas são aritmética simples', () => {
    expect(iso(avancarData(BASE, 5, 'dias'))).toBe('2026-08-08')
    expect(iso(avancarData(BASE, 2, 'semanas'))).toBe('2026-08-17')
  })

  it('mês é calendário, não 30 dias', () => {
    expect(iso(avancarData(BASE, 1, 'meses'))).toBe('2026-09-03') // mesmo dia do mês seguinte
    expect(iso(avancarData(BASE, 6, 'meses'))).toBe('2027-02-03') // vira o ano sozinho
  })

  it('ano é calendário', () => {
    expect(iso(avancarData(BASE, 1, 'anos'))).toBe('2027-08-03')
  })

  it('FIM DE MÊS: 31/jan + 1 mês é 28/fev, não 03/mar', () => {
    // setMonth cru transborda: fevereiro não tem dia 31 e o JS empurra para março.
    expect(iso(avancarData(new Date('2026-01-31T00:00:00.000Z'), 1, 'meses'))).toBe('2026-02-28')
  })

  it('FIM DE MÊS em ano bissexto: 31/jan/2028 + 1 mês é 29/fev', () => {
    expect(iso(avancarData(new Date('2028-01-31T00:00:00.000Z'), 1, 'meses'))).toBe('2028-02-29')
  })

  it('31/mar + 1 mês é 30/abr (mês de 30 dias)', () => {
    expect(iso(avancarData(new Date('2026-03-31T00:00:00.000Z'), 1, 'meses'))).toBe('2026-04-30')
  })

  it('29/fev + 1 ano cai em 28/fev', () => {
    expect(iso(avancarData(new Date('2028-02-29T00:00:00.000Z'), 1, 'anos'))).toBe('2029-02-28')
  })

  it('zero e lixo devolvem a mesma data, sem mutar a original', () => {
    const base = new Date(BASE.getTime())
    expect(avancarData(base, 0, 'meses').toISOString()).toBe(BASE.toISOString())
    expect(avancarData(base, NaN, 'dias').toISOString()).toBe(BASE.toISOString())
    expect(avancarData(base, -3, 'semanas').toISOString()).toBe(BASE.toISOString())
    expect(base.toISOString()).toBe(BASE.toISOString())
  })
})

describe('duracaoDaEtapa — formato novo e o antigo', () => {
  it('lê duracao + unidade', () => {
    expect(duracaoDaEtapa({ titulo: 'X', duracao: 2, unidade: 'semanas' })).toEqual({ quantidade: 2, unidade: 'semanas' })
  })

  it('modelo ANTIGO (só diasDuracao) continua valendo, em dias', () => {
    expect(duracaoDaEtapa({ titulo: 'X', diasDuracao: 7 })).toEqual({ quantidade: 7, unidade: 'dias' })
  })

  it('etapa sem duração nenhuma é marco pontual', () => {
    expect(duracaoDaEtapa({ titulo: 'X' })).toEqual({ quantidade: 0, unidade: 'dias' })
  })

  it('duracao sem unidade assume dias', () => {
    expect(duracaoDaEtapa({ titulo: 'X', duracao: 4 })).toEqual({ quantidade: 4, unidade: 'dias' })
  })
})

describe('planejarModelo — cascata com unidades', () => {
  it('mistura semanas e meses na mesma cascata', () => {
    const { etapas } = planejarModelo({
      marcos: [
        { titulo: 'Diagnóstico', duracao: 2, unidade: 'semanas' },
        { titulo: 'Execução', duracao: 1, unidade: 'meses' },
      ],
    }, BASE)
    expect(etapas[0].dataFim.slice(0, 10)).toBe('2026-08-17')
    expect(etapas[1].dataInicio.slice(0, 10)).toBe('2026-08-17')
    expect(etapas[1].dataFim.slice(0, 10)).toBe('2026-09-17') // mês de calendário a partir do 17
  })

  it('modelo antigo em diasDuracao produz exatamente o que produzia antes', () => {
    const { etapas } = planejarModelo({ marcos: [{ titulo: 'A', diasDuracao: 3 }, { titulo: 'B', diasDuracao: 7 }] }, BASE)
    expect(etapas[0].dataFim).toBe('2026-08-06T00:00:00.000Z')
    expect(etapas[1].dataFim).toBe('2026-08-13T00:00:00.000Z')
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
    expect(tarefas[0]).toEqual({ titulo: 'T', tipo: 'tarefa', prioridade: 'media', responsavelEmail: '' })
  })
})

describe('responsável — etapa manda, tarefa pode discordar', () => {
  const modelo = {
    marcos: [{ titulo: 'Criação', responsavelEmail: 'ana@x.com' }, { titulo: 'Tráfego' }],
    tarefas: [
      { titulo: 'Arte 1', marcoIndice: 0 },
      { titulo: 'Arte 2', marcoIndice: 0, responsavelEmail: 'bruno@x.com' }, // exceção
      { titulo: 'Campanha', marcoIndice: 1 },
      { titulo: 'Solta' },
    ],
  }

  it('a tarefa sem dono herda o da etapa', () => {
    const { tarefas } = planejarModelo(modelo, BASE)
    expect(tarefas.find(t => t.titulo === 'Arte 1')!.responsavelEmail).toBe('ana@x.com')
  })

  it('a tarefa COM dono próprio não é sobrescrita pela etapa', () => {
    const { tarefas } = planejarModelo(modelo, BASE)
    expect(tarefas.find(t => t.titulo === 'Arte 2')!.responsavelEmail).toBe('bruno@x.com')
  })

  it('etapa sem dono deixa a tarefa sem dono, e não quebra', () => {
    const { tarefas } = planejarModelo(modelo, BASE)
    expect(tarefas.find(t => t.titulo === 'Campanha')!.responsavelEmail).toBe('')
  })

  it('tarefa solta nunca herda de ninguém', () => {
    const { tarefas } = planejarModelo(modelo, BASE)
    expect(tarefas.find(t => t.titulo === 'Solta')!.responsavelEmail).toBe('')
  })

  it('a herança vale para modelo salvo ANTES do campo existir', () => {
    // Modelo antigo: ninguém tem responsavelEmail. Não pode virar undefined solto.
    const { etapas, tarefas } = planejarModelo({ marcos: [{ titulo: 'A' }], tarefas: [{ titulo: 'T', marcoIndice: 0 }] }, BASE)
    expect(etapas[0].responsavelEmail).toBe('')
    expect(tarefas[0].responsavelEmail).toBe('')
  })
})

describe('atribuirResponsavelNaEtapa', () => {
  const modelo: { marcos: EtapaModelo[]; tarefas: TarefaModelo[] } = {
    marcos: [{ titulo: 'A' }, { titulo: 'B' }],
    tarefas: [
      { titulo: 'a1', marcoIndice: 0 },
      { titulo: 'a2', marcoIndice: 0, responsavelEmail: 'antigo@x.com' },
      { titulo: 'b1', marcoIndice: 1 },
      { titulo: 'solta' },
    ],
  }

  it('marca a etapa e TODAS as tarefas dela', () => {
    const r = atribuirResponsavelNaEtapa(modelo, 0, 'ana@x.com')
    expect(r.marcos[0].responsavelEmail).toBe('ana@x.com')
    expect(r.tarefas.find(t => t.titulo === 'a1')!.responsavelEmail).toBe('ana@x.com')
  })

  it('sobrescreve quem já tinha outro dono na mesma etapa', () => {
    const r = atribuirResponsavelNaEtapa(modelo, 0, 'ana@x.com')
    expect(r.tarefas.find(t => t.titulo === 'a2')!.responsavelEmail).toBe('ana@x.com')
  })

  it('não encosta em outra etapa nem na tarefa solta', () => {
    const r = atribuirResponsavelNaEtapa(modelo, 0, 'ana@x.com')
    expect(r.marcos[1].responsavelEmail).toBeUndefined()
    expect(r.tarefas.find(t => t.titulo === 'b1')!.responsavelEmail).toBeUndefined()
    expect(r.tarefas.find(t => t.titulo === 'solta')!.responsavelEmail).toBeUndefined()
  })

  it('atribuir vazio limpa a etapa e as tarefas dela', () => {
    const cheio = atribuirResponsavelNaEtapa(modelo, 0, 'ana@x.com')
    const limpo = atribuirResponsavelNaEtapa(cheio, 0, '')
    expect(limpo.marcos[0].responsavelEmail).toBe('')
    expect(limpo.tarefas.find(t => t.titulo === 'a1')!.responsavelEmail).toBe('')
  })

  it('não muta o modelo recebido', () => {
    atribuirResponsavelNaEtapa(modelo, 0, 'ana@x.com')
    expect(modelo.marcos[0].responsavelEmail).toBeUndefined()
  })

  it('o responsável acompanha a etapa quando ela é movida', () => {
    const comDono = atribuirResponsavelNaEtapa(modelo, 0, 'ana@x.com')
    const movido = moverEtapaDoModelo(comDono, 0, 1)
    expect(movido.marcos[1].responsavelEmail).toBe('ana@x.com')
    const plano = planejarModelo(movido, BASE)
    expect(plano.tarefas.find(t => t.titulo === 'a1')!.responsavelEmail).toBe('ana@x.com')
  })
})

describe('moverEtapaDoModelo', () => {
  const modelo = {
    marcos: [{ titulo: 'A' }, { titulo: 'B' }, { titulo: 'C' }, { titulo: 'D' }],
    tarefas: [
      { titulo: 'daA', marcoIndice: 0 },
      { titulo: 'daB', marcoIndice: 1 },
      { titulo: 'daC', marcoIndice: 2 },
      { titulo: 'daD', marcoIndice: 3 },
      { titulo: 'solta' },
    ],
  }
  // O que importa não é o número do índice: é a tarefa continuar embaixo da
  // MESMA etapa depois do movimento. É isso que cada teste verifica.
  const etapaDe = (r: { marcos: { titulo: string }[]; tarefas: { titulo: string; marcoIndice?: number }[] }, tarefa: string) => {
    const t = r.tarefas.find(x => x.titulo === tarefa)!
    return typeof t.marcoIndice === 'number' ? r.marcos[t.marcoIndice].titulo : undefined
  }

  it('subir a última para o topo leva as tarefas dela junto', () => {
    const r = moverEtapaDoModelo(modelo, 3, 0)
    expect(r.marcos.map(m => m.titulo)).toEqual(['D', 'A', 'B', 'C'])
    expect(etapaDe(r, 'daD')).toBe('D')
    expect(etapaDe(r, 'daA')).toBe('A')
    expect(etapaDe(r, 'daB')).toBe('B')
    expect(etapaDe(r, 'daC')).toBe('C')
  })

  it('descer a primeira para o fim mantém todo mundo no lugar certo', () => {
    const r = moverEtapaDoModelo(modelo, 0, 3)
    expect(r.marcos.map(m => m.titulo)).toEqual(['B', 'C', 'D', 'A'])
    for (const [tarefa, etapa] of [['daA', 'A'], ['daB', 'B'], ['daC', 'C'], ['daD', 'D']]) {
      expect(etapaDe(r, tarefa)).toBe(etapa)
    }
  })

  it('mover uma casa para cima troca só as duas vizinhas', () => {
    const r = moverEtapaDoModelo(modelo, 2, 1)
    expect(r.marcos.map(m => m.titulo)).toEqual(['A', 'C', 'B', 'D'])
    expect(etapaDe(r, 'daC')).toBe('C')
    expect(etapaDe(r, 'daB')).toBe('B')
  })

  it('tarefa solta continua solta', () => {
    expect(etapaDe(moverEtapaDoModelo(modelo, 3, 0), 'solta')).toBeUndefined()
  })

  it('mover para a mesma posição ou para fora da faixa não muda nada', () => {
    for (const [de, para] of [[1, 1], [-1, 0], [0, 9], [9, 0]]) {
      const r = moverEtapaDoModelo(modelo, de, para)
      expect(r.marcos.map(m => m.titulo)).toEqual(['A', 'B', 'C', 'D'])
      expect(etapaDe(r, 'daC')).toBe('C')
    }
  })

  it('não muta o modelo recebido', () => {
    moverEtapaDoModelo(modelo, 3, 0)
    expect(modelo.marcos.map(m => m.titulo)).toEqual(['A', 'B', 'C', 'D'])
    expect(modelo.tarefas[0].marcoIndice).toBe(0)
  })

  it('sobrevive a modelo vazio', () => {
    expect(moverEtapaDoModelo({}, 0, 1)).toEqual({ marcos: [], tarefas: [] })
  })

  it('depois de mover, o modelo aplicado põe a tarefa na etapa certa', () => {
    const r = moverEtapaDoModelo(modelo, 3, 0)
    const plano = planejarModelo(r, BASE)
    const daD = plano.tarefas.find(t => t.titulo === 'daD')!
    expect(plano.etapas[daD.etapaIndice!].titulo).toBe('D')
  })

  it('uma sequência de movimentos não desalinha nada', () => {
    let r: any = modelo
    for (const [de, para] of [[3, 0], [1, 2], [0, 3], [2, 1]]) r = moverEtapaDoModelo(r, de, para)
    for (const letra of ['A', 'B', 'C', 'D']) expect(etapaDe(r, `da${letra}`)).toBe(letra)
  })
})

describe('moverNaLista', () => {
  const l = ['a', 'b', 'c']
  it('move para cima e para baixo', () => {
    expect(moverNaLista(l, 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moverNaLista(l, 0, 2)).toEqual(['b', 'c', 'a'])
  })
  it('ignora posição igual ou fora da faixa, sem mutar', () => {
    expect(moverNaLista(l, 1, 1)).toEqual(['a', 'b', 'c'])
    expect(moverNaLista(l, 0, 7)).toEqual(['a', 'b', 'c'])
    expect(l).toEqual(['a', 'b', 'c'])
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

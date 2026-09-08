import { describe, it, expect } from 'vitest'
import { avaliarTexto, semanaUtil, doDia, diasUteisSemComunicar, candidatosDoDia, previstoNaSemana, type Comunicado } from '@/lib/comunicacao'

// Quarta-feira, 09/09/2026, meio-dia LOCAL. Todas as datas do teste são locais de
// propósito: o build da Vercel roda em UTC e um horário 'Z' faz o teste passar aqui e
// quebrar lá (aconteceu em 08/09 com a reunião de amanhã).
const AGORA = new Date(2026, 8, 9, 12, 0, 0).getTime()
const com = (p: Partial<Comunicado>): Comunicado => ({
  id: p.id || 'c1', clienteId: 'c', tipo: p.tipo || 'processo', texto: p.texto || 'x',
  assunto: p.assunto || 'livre:1', estado: p.estado || 'unico', em: p.em || new Date(AGORA).toISOString(),
})

describe('comunicação — o que conta como comunicação', () => {
  it('saudação sozinha não conta, nem com emoji ou várias saudações', () => {
    expect(avaliarTexto('Bom dia! Excelente semana a todos!!').ok).toBe(false)
    expect(avaliarTexto('Oi, bom dia. Abraço!').ok).toBe(false)
    expect(avaliarTexto('bom dia').ok).toBe(false)
  })

  it('cobrança sem consequência nem prazo não conta, e a dica ensina a virar questionamento', () => {
    const v = avaliarTexto('Vocês já conseguiram levantar a informação que solicitamos na semana passada?')
    expect(v.ok).toBe(false)
    expect(v.motivo).toMatch(/cobrança/i)
    expect(v.dica).toMatch(/trava|prazo/i)
  })

  it('a mesma pergunta COM consequência e prazo conta', () => {
    expect(avaliarTexto('Sem o faturamento de agosto a campanha de setembro entra sem meta. Conseguem me enviar até quinta?').ok).toBe(true)
    expect(avaliarTexto('Aguardo o retorno do jurídico, sem isso a landing não pode ir ao ar.').ok).toBe(true)
  })

  it('saudação + fato conta; texto curto demais não', () => {
    expect(avaliarTexto('Bom dia! O reel de reciclagem foi publicado hoje e já está com 1.200 visualizações.').ok).toBe(true)
    expect(avaliarTexto('Publicamos.').ok).toBe(false)
  })

  it('confirmação de reunião não é barrada mesmo lembrando algo', () => {
    expect(avaliarTexto('Lembrando que nossa reunião é amanhã às 10h, com pauta de setembro.', 'reuniao').ok).toBe(true)
  })
})

describe('comunicação — a semana', () => {
  it('semanaUtil devolve segunda a sexta e marca hoje e futuro', () => {
    const s = semanaUtil(AGORA)
    expect(s.map(d => d.diaCurto)).toEqual(['seg', 'ter', 'qua', 'qui', 'sex'])
    expect(s.map(d => d.data)).toEqual(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'])
    expect(s.find(d => d.hoje)?.data).toBe('2026-09-09')
    expect(s.filter(d => d.futuro).map(d => d.data)).toEqual(['2026-09-10', '2026-09-11'])
    expect(s[2].rotulo).toBe('09/09')
  })

  it('doDia separa por dia e diasUteisSemComunicar ignora o fim de semana', () => {
    const ontem = com({ id: 'a', em: new Date(2026, 8, 8, 9, 0).toISOString() })
    expect(doDia([ontem], '2026-09-08')).toHaveLength(1)
    expect(doDia([ontem], '2026-09-09')).toHaveLength(0)
    // comunicou ontem (terça) e nada hoje: 1 dia útil sem comunicar
    expect(diasUteisSemComunicar([ontem], AGORA)).toBe(1)
    // comunicou hoje: zero
    expect(diasUteisSemComunicar([com({ em: new Date(AGORA).toISOString() })], AGORA)).toBe(0)
    // último foi na sexta anterior (04/09): seg, ter, qua = 3 dias úteis
    expect(diasUteisSemComunicar([com({ em: new Date(2026, 8, 4, 15, 0).toISOString() })], AGORA)).toBe(3)
    expect(diasUteisSemComunicar([], AGORA)).toBeGreaterThan(3)
  })
})

describe('comunicação — candidatos, sem repetir e podendo evoluir', () => {
  const post = { id: 'p1', headline: 'Reel da reciclagem', etapa: 'aprovacao_criativo', status: 'aguardando_aprovacao', aguardandoDesde: new Date(2026, 8, 8, 12, 0).toISOString() }

  it('material recém-enviado vira convite para aprovar', () => {
    const c = candidatosDoDia({ posts: [post], agora: AGORA })
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ assunto: 'post:p1', tipo: 'material', anteriores: 0 })
    expect(c[0].texto).toMatch(/Reel da reciclagem/)
  })

  it('o mesmo material no MESMO estado não volta como sugestão', () => {
    const feito = com({ assunto: 'post:p1', estado: 'aguardando:aprovacao_criativo' })
    expect(candidatosDoDia({ posts: [post], comunicados: [feito], agora: AGORA })).toHaveLength(0)
  })

  it('quando o assunto EVOLUI, ele volta — e sabe quantas vezes já foi falado', () => {
    const feito = com({ assunto: 'post:p1', estado: 'aguardando:aprovacao_criativo' })
    const publicado = { ...post, status: 'publicado', publicadoEm: new Date(2026, 8, 9, 11, 30).toISOString() }
    const c = candidatosDoDia({ posts: [publicado], comunicados: [feito], agora: AGORA })
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ assunto: 'post:p1', estado: 'publicado', tipo: 'vitoria', anteriores: 1 })
  })

  it('material parado há dias vira questionamento com consequência e prazo, uma vez por semana', () => {
    const parado = { ...post, aguardandoDesde: new Date(2026, 8, 1, 12, 0).toISOString() }
    const c = candidatosDoDia({ posts: [parado], agora: AGORA })
    expect(c[0]).toMatchObject({ tipo: 'questionamento', estado: 'parado:2026-09-07' })
    expect(avaliarTexto(c[0].texto).ok).toBe(true) // a própria sugestão passa na regra
    const feito = com({ assunto: 'post:p1', estado: 'parado:2026-09-07' })
    expect(candidatosDoDia({ posts: [parado], comunicados: [feito], agora: AGORA })).toHaveLength(0)
  })

  it('tarefa concluída, etapa e marco do Playbook viram candidatos; reunião só hoje ou amanhã', () => {
    const c = candidatosDoDia({
      tarefas: [{ id: 't1', titulo: 'Auditoria dos perfis', status: 'concluido', concluidoEm: new Date(2026, 8, 9, 10, 0).toISOString() }],
      marcos: [
        { id: 'm1', titulo: 'Lançamento', status: 'em_andamento', subetapas: [{ id: 's1', titulo: 'Setup', status: 'concluido', dataFim: '2026-09-08' }] },
        { id: 'm2', titulo: 'Alinhamento mensal', categoria: 'reuniao', dataInicio: new Date(2026, 8, 10, 14, 0).toISOString() },
        { id: 'm3', titulo: 'Reunião antiga', categoria: 'reuniao', dataInicio: new Date(2026, 7, 10, 14, 0).toISOString() },
      ],
      agora: AGORA,
    })
    expect(c.map(x => x.assunto).sort()).toEqual(['etapa:m1:s1', 'marco:m2', 'tarefa:t1'])
    expect(c.find(x => x.assunto === 'marco:m2')?.tipo).toBe('reuniao')
  })

  it('os dias futuros da semana já mostram o que está previsto', () => {
    const s = semanaUtil(AGORA)
    const p = previstoNaSemana({
      posts: [{ id: 'p9', headline: 'Carrossel', dataAgendada: new Date(2026, 8, 11, 11, 30).toISOString(), status: 'agendado' }],
      tarefas: [{ id: 't9', titulo: 'Enviar relatório', status: 'a_fazer', prazo: new Date(2026, 8, 10, 18, 0).toISOString() }],
      marcos: [{ id: 'm9', titulo: 'Antigo', dataFim: '2026-09-07' }],
    }, s)
    expect(p.map(x => x.data)).toEqual(['2026-09-11', '2026-09-10'])
    expect(p[0].texto).toMatch(/Publicação/)
  })
})

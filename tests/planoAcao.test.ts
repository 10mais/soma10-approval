import { describe, it, expect } from 'vitest'
import {
  chaveFrente, segundaDaSemana, numeroDaSemana, semanasDoPlano, semanaAtual,
  statusPelaLigacao, statusDaEntrega, relogioDaEntrega, progressoDoPlano,
  lerProgresso, lerEntregas, diaMesPerto, prazoEscrito, acharPessoa, inicioPelaPlanilha, montarPlanoImportado,
} from '@/lib/planoAcao'
import { normalizarSubetapas } from '@/lib/subetapas'

// A planilha real do 10+ ("Playbook de Entregas por Semana — Dr. Angelo Cortez", 17/11/2026),
// do jeito que sai ao copiar as abas no Google Sheets e colar: separada por TAB.
const t = (...linhas: string[][]) => linhas.map(l => l.join('\t')).join('\n')

const PROGRESSO = t(
  ['Progresso geral', '█░░░░░░░░░░░░░░░░░░░ 5%'],
  ['Semana atual', 'W5'],
  [''],
  ['Semana', 'Período', 'Foco da semana', 'Previstas', 'Concluídas', 'Progresso'],
  ['W1', '19/10 a 25/10', 'Onboarding: acessos, materiais e kickoff', '6', '6', '100%'],
  ['W2', '26/10 a 05/11', 'Plano de conteúdo e primeira captação', '5', '5', '100%'],
  ['W3', '02/11 a 08/11', 'Landing page no Ar, campanha Meta e Google Meu Negócio', '3', '2', '67%'],
  ['W4', '09/11 a 18/11', 'Materiais de prova social, conteúdos Feed e Cliente oculto', '3', '2', '67%'],
  ['W5', '16/11 a 22/11', 'Adicionar Verba e Ativar campanhas (Google e Meta Ads)', '2', '0', '0%'],
  ['W10', '19/12 20/12', 'Conteúdos final do ano e início de janeiro', '2', '0', '0%'],
  ['W11', '21/12 a 03/01', 'Recesso: conteúdo agendado', '1', '0', '0%'],
  ['W12', '04/01 a 10/01', 'Relatório de dezembro e captação de janeiro', '4', '0', '0%'],
  ['W14', '18/01 a 24/01', '', '4', '0', '0%'],
)

const ENTREGAS = t(
  ['Semana', 'Entrega', 'Frente', 'Responsável', 'Status', 'Observação'],
  ['W1', 'Documento de kickoff com cenários de mídia', 'Consultoria', 'Willian Pires', 'A confirmar', ''],
  ['W1', 'Grupo de WhatsApp do projeto criado', 'Consultoria', 'Willian Pires', 'A confirmar', ''],
  ['W1', 'Acessos recebidos: KingHost, Facebook e Instagram', 'Onboarding', 'Cliente', 'A confirmar', ''],
  ['W1', 'Business Manager criada no perfil do Dr. Angelo', 'Tráfego', 'Cliente', 'A confirmar', ''],
  ['W1', 'Materiais recebidos', 'Onboarding', 'Cliente', 'A confirmar', ''],
  ['W1', 'Reunião semanal (20/10)', 'Consultoria', 'Willian Pires', 'A confirmar', ''],
  ['W3', 'Estrutura e texto da landing page', 'Landing page', 'Willian Pires', 'A confirmar', ''],
  ['W3', 'Primeiros criativos e campanha Meta no ar', 'Tráfego', '', 'A confirmar', ''],
  ['W3', 'Perfil do Google Meu Negócio otimizado', 'Google Meu Negócio', '', 'A confirmar', ''],
  ['W3', 'Reunião semanal (03/11)', 'Consultoria', 'Willian Pires', 'A confirmar', ''],
  ['W4', 'Anúncio de rádio', 'Social media', 'Willian Pires', 'Concluído', 'Concluído no SOMA10'],
  ['W4', 'Vídeos de novembro (mínimo de 8)', 'Vídeos', 'Ana Turcato', 'Em andamento', 'Prazo no SOMA10: 10/11'],
  ['W4', 'Briefing de fotos de prova social', 'Social media', 'Ana Turcato', 'A fazer', 'Prazo no SOMA10: 13/11'],
  ['W4', 'Reunião semanal (10/11)', 'Consultoria', 'Willian Pires', 'A confirmar', ''],
  ['W5', 'Post de prova social (caso Gilberto)', 'Social media', '', 'A fazer', 'Sem responsável no SOMA10; prazo 16/11'],
  ['W5', 'Planejamento de campanhas', 'Tráfego', 'Ana Turcato', 'A fazer', 'Prazo no SOMA10: 17/11'],
  ['W10', 'Reunião semanal (22/12)', 'Consultoria', 'Willian Pires', 'A fazer', 'Confirmar por causa do recesso'],
  ['W11', 'Conteúdo do recesso agendado', 'Social media', '', 'A fazer', ''],
  ['W12', 'Reunião semanal (05/01)', 'Consultoria', 'Willian Pires', 'A fazer', ''],
)

const EQUIPE = [
  { email: 'willian@10mais.com', nome: 'Willian Pires' },
  { email: 'ana@10mais.com', nome: 'Ana Turcato' },
  { email: 'theo@10mais.com', nome: 'Théo Grassel' },
]

describe('semana do plano', () => {
  it('a semana começa na segunda; domingo é da semana anterior', () => {
    expect(segundaDaSemana('2026-11-16')).toBe('2026-11-16') // segunda
    expect(segundaDaSemana('2026-11-20')).toBe('2026-11-16') // sexta
    expect(segundaDaSemana('2026-11-22')).toBe('2026-11-16') // domingo
    expect(segundaDaSemana('2026-11-23')).toBe('2026-11-23')
  })
  it('número conta a partir da semana de início e atravessa o ano', () => {
    expect(numeroDaSemana('2026-10-19', '2026-10-19')).toBe(1)
    expect(numeroDaSemana('2026-10-19', '2026-11-18')).toBe(5)
    expect(numeroDaSemana('2026-10-19', '2027-01-05')).toBe(12)
  })
  it('semanasDoPlano numera só as semanas e ignora marco comum', () => {
    const s = semanasDoPlano([
      { id: 'b', tipo: 'semana', dataInicio: '2026-10-26T03:00:00.000Z' },
      { id: 'x', dataInicio: '2026-10-01' },
      { id: 'a', tipo: 'semana', dataInicio: '2026-10-19' },
      { id: 'c', tipo: 'semana', dataInicio: '2026-11-09' },
    ])
    expect(s.map(x => [x.id, x.numero])).toEqual([['a', 1], ['b', 2], ['c', 4]])
  })
  it('semana atual: a que contém hoje; fora do plano, a ponta mais próxima', () => {
    const s = [{ segunda: '2026-10-19' }, { segunda: '2026-10-26' }, { segunda: '2026-11-16' }]
    expect(semanaAtual(s, '2026-10-28')?.segunda).toBe('2026-10-26')
    expect(semanaAtual(s, '2026-11-04')?.segunda).toBe('2026-10-26') // semana sem marco: a última que passou
    expect(semanaAtual(s, '2026-09-01')?.segunda).toBe('2026-10-19')
    expect(semanaAtual(s, '2027-03-01')?.segunda).toBe('2026-11-16')
    expect(semanaAtual([], '2026-11-16')).toBeUndefined()
  })
})

describe('status da entrega pela ligação', () => {
  it('tarefa manda no status; descartada não decide', () => {
    expect(statusPelaLigacao({ tipo: 'tarefa', status: 'concluido' })).toBe('concluido')
    expect(statusPelaLigacao({ tipo: 'tarefa', status: 'a_fazer' })).toBe('pendente')
    expect(statusPelaLigacao({ tipo: 'tarefa', status: 'em_ajuste' })).toBe('em_andamento')
    expect(statusPelaLigacao({ tipo: 'tarefa', status: 'descartado' })).toBeNull()
    expect(statusDaEntrega({ status: 'em_andamento' }, { tipo: 'tarefa', status: 'descartado' })).toBe('em_andamento')
  })
  it('post aprovado, agendado ou publicado conta como entregue', () => {
    for (const st of ['aprovado', 'agendado', 'publicado']) expect(statusPelaLigacao({ tipo: 'post', status: st })).toBe('concluido')
    expect(statusPelaLigacao({ tipo: 'post', status: 'rascunho' })).toBe('pendente')
    expect(statusPelaLigacao({ tipo: 'post', status: 'aguardando_aprovacao' })).toBe('em_andamento')
  })
  it('sem ligação vale o marcado à mão', () => {
    expect(statusDaEntrega({ status: 'concluido' }, null)).toBe('concluido')
  })
})

describe('relógio do SLA', () => {
  const hoje = '2026-11-17'
  it('no prazo, vence hoje, atrasada', () => {
    expect(relogioDaEntrega('pendente', '2026-11-20', hoje)).toEqual({ estado: 'no_prazo', dias: 3 })
    expect(relogioDaEntrega('em_andamento', '2026-11-17', hoje)).toEqual({ estado: 'vence_hoje', dias: 0 })
    expect(relogioDaEntrega('pendente', '2026-11-10', hoje)).toEqual({ estado: 'atrasada', dias: 7 })
  })
  it('concluída, recesso e sem prazo não atrasam', () => {
    expect(relogioDaEntrega('concluido', '2026-11-10', hoje).estado).toBe('concluida')
    expect(relogioDaEntrega('pendente', '2026-11-10', hoje, true).estado).toBe('recesso')
    expect(relogioDaEntrega('pendente', undefined, hoje).estado).toBe('sem_prazo')
  })
})

describe('progresso do plano', () => {
  const hoje = '2026-11-17'
  const semanas = [
    { id: 'w1', numero: 1, entregas: [{ status: 'concluido' as const, prazo: '2026-10-23', concluidaEm: '2026-10-22' }, { status: 'concluido' as const, prazo: '2026-10-23', concluidaEm: '2026-10-25' }] },
    { id: 'w4', numero: 4, entregas: [{ status: 'pendente' as const, prazo: '2026-11-13' }, { status: 'concluido' as const, prazo: '2026-11-13' }] },
    { id: 'w5', numero: 5, entregas: [{ status: 'pendente' as const, prazo: '2026-11-20' }] },
    { id: 'w11', numero: 11, recesso: true, entregas: [{ status: 'pendente' as const, prazo: '2026-11-01' }] },
  ]
  const p = progressoDoPlano(semanas, hoje)
  it('conta previstas e concluídas de verdade (a planilha dizia 5%)', () => {
    expect(p.previstas).toBe(6)
    expect(p.concluidas).toBe(3)
    expect(p.pct).toBe(50)
    expect(p.porSemana.map(s => s.pct)).toEqual([100, 50, 0, 0])
  })
  it('atraso ignora recesso e o que ainda não venceu', () => {
    expect(p.atrasadas).toBe(1)
    expect(p.porSemana.find(s => s.id === 'w11')?.atrasadas).toBe(0)
  })
  it('% no prazo: concluída depois do prazo conta contra; sem data de conclusão conta a favor', () => {
    // vencidas: w1 (2), w4 (2) = 4; no prazo: w1 a 1ª, w4 a concluída sem data = 2
    expect(p.vencidas).toBe(4)
    expect(p.noPrazo).toBe(2)
    expect(p.pctNoPrazo).toBe(50)
    expect(progressoDoPlano([], hoje).pctNoPrazo).toBeNull()
  })
})

describe('importar a planilha', () => {
  const progresso = lerProgresso(PROGRESSO)
  const entregas = lerEntregas(ENTREGAS)

  it('acha o cabeçalho abaixo das linhas de resumo e lê as colunas pelo nome', () => {
    expect(progresso.map(p => p.numero)).toEqual([1, 2, 3, 4, 5, 10, 11, 12, 14])
    expect(progresso[0]).toMatchObject({ periodo: '19/10 a 25/10', previstas: 6, concluidas: 6 })
    expect(entregas).toHaveLength(19)
    expect(entregas[2]).toMatchObject({ numero: 1, frente: 'Onboarding', responsavel: 'Cliente' })
  })

  it('frente pelo nome, com ou sem acento', () => {
    expect(chaveFrente('Tráfego')).toBe('trafego')
    expect(chaveFrente('Google Meu Negócio')).toBe('google_meu_negocio')
    expect(chaveFrente('social media')).toBe('social_media')
    expect(chaveFrente('Astrologia')).toBeUndefined()
  })

  it('dia/mês escolhe o ano mais perto (virada de ano)', () => {
    expect(diaMesPerto('05/01', '2026-12-28')).toBe('2027-01-05')
    expect(diaMesPerto('28/12', '2027-01-04')).toBe('2026-12-28')
    expect(diaMesPerto('31/11', '2026-11-16')).toBeUndefined()
  })

  it('prazo escrito na observação ou no título', () => {
    expect(prazoEscrito('Vídeos', 'Prazo no SOMA10: 10/11', '2026-11-09')).toBe('2026-11-10')
    expect(prazoEscrito('Post', 'Sem responsável no SOMA10; prazo 16/11', '2026-11-16')).toBe('2026-11-16')
    expect(prazoEscrito('Reunião semanal (20/10)', '', '2026-10-19')).toBe('2026-10-20')
    expect(prazoEscrito('Relatório', '', '2026-10-19')).toBeUndefined()
  })

  it('pessoa pelo nome completo ou primeiro nome sem acento', () => {
    expect(acharPessoa('Theo Grassel', EQUIPE)?.email).toBe('theo@10mais.com')
    expect(acharPessoa('ana', EQUIPE)?.email).toBe('ana@10mais.com')
    expect(acharPessoa('Mariana', EQUIPE)).toBeUndefined()
  })

  it('início do plano sai do período da W1', () => {
    expect(inicioPelaPlanilha(progresso, '2026-11-17')).toBe('2026-10-19')
  })

  const plano = montarPlanoImportado(progresso, entregas, '2026-10-19', EQUIPE)
  const sem = (n: number) => plano.semanas.find(s => s.numero === n)!

  it('semanas fixas de segunda a domingo (o período sobreposto da planilha é ignorado)', () => {
    expect(sem(2)).toMatchObject({ dataInicio: '2026-10-26', dataFim: '2026-11-01' })
    expect(sem(5)).toMatchObject({ dataInicio: '2026-11-16', dataFim: '2026-11-22' })
    // as reuniões semanais caem na semana certa por esta conta
    expect(sem(10).entregas[0].dataFim).toBe('2026-12-22')
    expect(sem(10).dataInicio <= '2026-12-22' && '2026-12-22' <= sem(10).dataFim).toBe(true)
    expect(sem(12).entregas[0].dataFim).toBe('2027-01-05')
  })

  it('semana dada como toda concluída no resumo entra concluída', () => {
    expect(sem(1).entregas.every(e => e.status === 'concluido')).toBe(true)
    expect(sem(3).entregas.every(e => e.status === 'pendente')).toBe(true) // 2 de 3 no resumo: não dá para saber quais
  })

  it('status, frente, responsável e prazo de cada entrega', () => {
    const radio = sem(4).entregas[0]
    expect(radio).toMatchObject({ status: 'concluido', frente: 'social_media', responsavelTipo: 'equipe', responsavelEmail: 'willian@10mais.com', dataFim: '2026-11-13' })
    const videos = sem(4).entregas[1]
    expect(videos).toMatchObject({ status: 'em_andamento', responsavelEmail: 'ana@10mais.com', dataFim: '2026-11-10' })
    expect(sem(1).entregas[2]).toMatchObject({ responsavelTipo: 'cliente', responsavelNome: 'Cliente' })
    expect(sem(5).entregas[0].responsavelTipo).toBeUndefined()
  })

  it('recesso e foco vazio', () => {
    expect(sem(11).recesso).toBe(true)
    expect(sem(5).recesso).toBe(false)
    expect(sem(14).foco).toBe('Semana 14')
  })

  it('avisa o que precisa de atenção', () => {
    expect(plano.avisos.some(a => a.startsWith('4 entregas estão sem responsável'))).toBe(true)
    expect(plano.avisos.some(a => a.includes('"A confirmar"'))).toBe(true)
    expect(plano.avisos.some(a => a.includes('W14'))).toBe(true)
  })

  it('as entregas importadas sobrevivem ao salvar do Playbook (normalizarSubetapas)', () => {
    const salvo = normalizarSubetapas(sem(4).entregas)
    expect(salvo[1]).toMatchObject({ frente: 'videos', responsavelTipo: 'equipe', responsavelEmail: 'ana@10mais.com' })
    const comVinculo = normalizarSubetapas([{ titulo: 'x', vinculo: { tipo: 'tarefa', id: 't1' }, concluidaEm: '2026-11-10', responsavelTipo: 'chefe' }])
    expect(comVinculo[0]).toMatchObject({ vinculo: { tipo: 'tarefa', id: 't1' }, concluidaEm: '2026-11-10' })
    expect(comVinculo[0].responsavelTipo).toBeUndefined()
  })
})

import { describe, it, expect } from 'vitest'
import { pendenciasDoPost, pendenciasDaAcao, frasePendencias, statusAoSalvarEdicao, minimoDatetimeLocal } from '@/lib/composerPendencias'

const completo = { clienteId: 'c1', marcoId: 'm1', legenda: 'Texto', totalMidias: 1, redes: ['instagram'], videosSemCapa: 0 }

describe('o que falta para o post sair — a tela diz, não só apaga o botão', () => {
  it('post completo não tem pendência', () => {
    expect(pendenciasDoPost(completo)).toEqual([])
    expect(frasePendencias([])).toBe('')
  })

  it('post agendado antes da etapa virar obrigatória: a única pendência é a etapa (o caso de 17/09)', () => {
    const p = pendenciasDoPost({ ...completo, marcoId: '' })
    expect(p.map(x => x.chave)).toEqual(['etapa'])
    expect(frasePendencias(p)).toBe('Para liberar os botões: escolher a etapa do Playbook.')
  })

  it('lista várias pendências em frase', () => {
    const p = pendenciasDoPost({ ...completo, marcoId: '', legenda: ' ', redes: [] })
    expect(frasePendencias(p)).toBe('Para liberar os botões: escolher a etapa do Playbook, escrever a legenda e marcar Instagram ou Facebook.')
  })

  it('story não pede legenda nem capa; cliente com vários perfis pede o perfil', () => {
    expect(pendenciasDoPost({ ...completo, legenda: '', videosSemCapa: 1, ehStory: true })).toEqual([])
    expect(pendenciasDoPost({ ...completo, videosSemCapa: 2 }).map(x => x.texto)).toEqual(['definir a capa de cada vídeo'])
    expect(pendenciasDoPost({ ...completo, multiPerfil: true, contaIds: [] }).map(x => x.chave)).toEqual(['perfil'])
    expect(pendenciasDoPost({ ...completo, enviandoArquivo: true, totalMidias: 0 }).map(x => x.chave)).toEqual(['midia', 'upload'])
    expect(pendenciasDoPost({ ...completo, clienteId: '' }).map(x => x.chave)).toEqual(['cliente'])
  })
})

describe('salvar a edição não desagenda o post', () => {
  it('agendado com data nova continua agendado', () => {
    expect(statusAoSalvarEdicao('agendado', 'salvar', true)).toBe('agendado')
  })
  it('agendado sem data volta a rascunho (não existe agendamento sem horário)', () => {
    expect(statusAoSalvarEdicao('agendado', 'salvar', false)).toBe('rascunho')
  })
  it('salvar mantém aprovação, publicado e rascunho como estão', () => {
    expect(statusAoSalvarEdicao('aguardando_aprovacao', 'salvar', true)).toBe('aguardando_aprovacao')
    expect(statusAoSalvarEdicao('publicado', 'salvar', true)).toBe('publicado')
    expect(statusAoSalvarEdicao('rascunho', 'salvar', true)).toBe('rascunho')
    expect(statusAoSalvarEdicao(undefined, 'salvar', false)).toBe('rascunho')
  })
  it('Agendar e Enviar para aprovação mudam o status de propósito', () => {
    expect(statusAoSalvarEdicao('rascunho', 'agendar', true)).toBe('agendado')
    expect(statusAoSalvarEdicao('agendado', 'aprovacao', true)).toBe('aguardando_aprovacao')
  })
})

describe('mínimo do campo de data', () => {
  it('usa a hora LOCAL, não UTC', () => {
    expect(minimoDatetimeLocal(new Date(2026, 8, 17, 9, 5))).toBe('2026-09-17T09:05')
  })
})

describe('cada botão com a sua regra — trocar a data de um post que já existe', () => {
  const semEtapa = pendenciasDoPost({ ...completo, marcoId: '' })
  it('EDIÇÃO: salvar e agendar liberam sem a etapa (o pedido de 17/09); aprovação continua pedindo', () => {
    expect(pendenciasDaAcao(semEtapa, 'salvar', true)).toEqual([])
    expect(pendenciasDaAcao(semEtapa, 'agendar', true)).toEqual([])
    expect(pendenciasDaAcao(semEtapa, 'aprovacao', true).map(x => x.chave)).toEqual(['etapa'])
    expect(frasePendencias(pendenciasDaAcao(semEtapa, 'aprovacao', true), 'Para enviar ao cliente')).toBe('Para enviar ao cliente: escolher a etapa do Playbook.')
  })
  it('POST NOVO: a etapa segue obrigatória para tudo', () => {
    expect(pendenciasDaAcao(semEtapa, 'agendar', false).map(x => x.chave)).toEqual(['etapa'])
    expect(pendenciasDaAcao(semEtapa, 'salvar', false).map(x => x.chave)).toEqual(['etapa'])
  })
  it('EDIÇÃO: agendar ainda exige conteúdo publicável; salvar só espera o upload', () => {
    const semLegenda = pendenciasDoPost({ ...completo, marcoId: '', legenda: '', enviandoArquivo: true })
    expect(pendenciasDaAcao(semLegenda, 'agendar', true).map(x => x.chave)).toEqual(['legenda', 'upload'])
    expect(pendenciasDaAcao(semLegenda, 'salvar', true).map(x => x.chave)).toEqual(['upload'])
  })
})

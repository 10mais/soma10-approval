import { describe, it, expect } from 'vitest'
import { estadoDaPauta, resumoProducao, tarefaDaPauta, anexosParaCriativo, midiasParaPauta, ehTarefaDeProducao } from '@/lib/producaoVinculo'

// O hub do cliente mostrava "0 em produção" com 10 tarefas de criativo abertas:
// a pauta estava "pronta" no Studio enquanto a tarefa do designer seguia aberta.
// A verdade tem de ser uma só, e vem daqui.

const TAREFAS = [
  { id: 't1', tipo: 'post', status: 'a_fazer', origemPostId: 'p1', anexos: [{ nome: 'arte.png', url: 'https://x/arte.png', tipo: 'image/png' }] },
  { id: 't2', tipo: 'carrossel', status: 'concluido', origemPostId: 'p2' },
  { id: 't3', tipo: 'estrategia', status: 'a_fazer', origemPostId: 'p3' },
  { id: 't4', tipo: 'reel', status: 'em_andamento' }, // sem pauta
  { id: 't5', tipo: 'criativo', status: 'a_fazer', excluidoEm: '2026-09-01T00:00:00.000Z' },
]

describe('estadoDaPauta', () => {
  it('pauta "pronta" com tarefa de produção ABERTA está em produção', () => {
    expect(estadoDaPauta({ id: 'p1', etapa: 'pronto' }, TAREFAS)).toBe('em_producao')
  })
  it('pauta pronta com tarefa concluída é pronta', () => {
    expect(estadoDaPauta({ id: 'p2', etapa: 'pronto' }, TAREFAS)).toBe('pronta')
  })
  it('tarefa aberta que NÃO é de produção não muda o estado da pauta', () => {
    expect(estadoDaPauta({ id: 'p3', etapa: 'pronto' }, TAREFAS)).toBe('pronta')
  })
  it('vínculo pelo lado da pauta (post.tarefaId) também vale', () => {
    expect(estadoDaPauta({ id: 'px', etapa: 'pronto', tarefaId: 't1' }, TAREFAS)).toBe('em_producao')
    expect(tarefaDaPauta({ id: 'px', tarefaId: 't1' }, TAREFAS)?.id).toBe('t1')
  })
  it('aprovação e publicação vêm antes da tarefa', () => {
    expect(estadoDaPauta({ id: 'p1', etapa: 'aprovacao_criativo' }, TAREFAS)).toBe('aguardando_cliente')
    expect(estadoDaPauta({ id: 'p1', status: 'publicado', etapa: 'pronto' }, TAREFAS)).toBe('publicada')
  })
  it('etapas de produção sem tarefa continuam em produção; excluída é outra', () => {
    expect(estadoDaPauta({ id: 'n', etapa: 'copy' })).toBe('em_producao')
    expect(estadoDaPauta({ id: 'n', etapa: 'pronto', excluidoEm: 'x' }, TAREFAS)).toBe('outra')
  })
})

describe('resumoProducao', () => {
  it('conta pautas em produção + tarefas de produção sem pauta, sem duplicar', () => {
    const r = resumoProducao([
      { id: 'p1', etapa: 'pronto' }, // em produção via t1
      { id: 'p2', etapa: 'pronto' }, // pronta (t2 concluída)
      { id: 'p9', etapa: 'copy' }, // em produção por etapa
    ], TAREFAS)
    expect(r.pautasEmProducao.map(p => p.id)).toEqual(['p1', 'p9'])
    expect(r.prontas.map(p => p.id)).toEqual(['p2'])
    expect(r.tarefasSemPauta.map(t => t.id)).toEqual(['t4']) // t3 não é produção; t5 excluída; t1 já contou pela pauta
    expect(r.emProducao).toBe(3)
  })
  it('tipos de produção', () => {
    expect(ehTarefaDeProducao({ tipo: 'reel' })).toBe(true)
    expect(ehTarefaDeProducao({ tipo: 'landing_page' })).toBe(false)
    expect(ehTarefaDeProducao({})).toBe(false)
  })
})

describe('anexos → criativo', () => {
  it('só imagem e vídeo (por mime ou extensão)', () => {
    const a = anexosParaCriativo([
      { nome: 'a', url: 'https://x/a.png', tipo: 'image/png' },
      { nome: 'b', url: 'https://x/b.pdf', tipo: 'application/pdf' },
      { nome: 'c', url: 'https://x/c.mp4', tipo: '' },
      { nome: 'd', url: 'https://x/d.docx', tipo: '' },
    ])
    expect(a.map(x => x.nome)).toEqual(['a', 'c'])
  })
  it('pauta sem mídia recebe as mídias da tarefa; com mídia não é sobrescrita', () => {
    expect(midiasParaPauta({ id: 'p' }, TAREFAS[0].anexos)).toEqual({ imagens: ['https://x/arte.png'] })
    expect(midiasParaPauta({ id: 'p', imagens: ['https://x/ja.png'] }, TAREFAS[0].anexos)).toEqual({})
    expect(midiasParaPauta({ id: 'p' }, [{ nome: 'x', url: 'https://x/x.pdf', tipo: 'application/pdf' }])).toEqual({})
  })
})

import { describe, it, expect } from 'vitest'
import { somarAnexos, anexosParaNovaRodada, pautaLivrePara, soltaPautaAntiga, planoDeEntregasDaPauta, type AnexoV } from '@/lib/vinculoTarefa'

// Vínculo pauta ↔ tarefa: os dois lados precisam concordar, senão o ajuste do cliente
// reabre a tarefa errada; e vincular nunca pode apagar o que o designer já anexou.

const ref: AnexoV = { nome: 'ref.png', url: 'https://x/ref.png', tipo: 'image/png' }
const arte: AnexoV = { nome: 'arte.png', url: 'https://x/arte.png', tipo: 'image/png', papel: 'criativo' }
const daPauta: AnexoV = { nome: 'briefing.pdf', url: 'https://x/briefing.pdf', tipo: 'application/pdf' }

describe('somarAnexos', () => {
  it('mantém os anexos da tarefa e acrescenta os da pauta', () => {
    expect(somarAnexos([ref, arte], [daPauta])).toEqual([ref, arte, daPauta])
  })
  it('não duplica pela URL e preserva o papel de criativo pronto', () => {
    const out = somarAnexos([arte], [{ ...arte, papel: 'referencia' }, daPauta])
    expect(out).toHaveLength(2)
    expect(out[0].papel).toBe('criativo')
  })
  it('aceita listas vazias ou ausentes e ignora itens sem URL', () => {
    expect(somarAnexos(undefined, [daPauta])).toEqual([daPauta])
    expect(somarAnexos([ref], undefined)).toEqual([ref])
    expect(somarAnexos([], [{ nome: 'x', url: '', tipo: '' }])).toEqual([])
  })
})

describe('anexosParaNovaRodada', () => {
  it('copy reaprovada: nada some, a arte anterior vira referência e os da pauta entram', () => {
    const out = anexosParaNovaRodada([ref, arte], [daPauta])
    expect(out.map(a => a.url)).toEqual([ref.url, arte.url, daPauta.url])
    expect(out.find(a => a.url === arte.url)?.papel).toBe('referencia')
    expect(out.some(a => a.papel === 'criativo')).toBe(false)
  })
  it('não altera a lista original da tarefa', () => {
    const daTarefa = [arte]
    anexosParaNovaRodada(daTarefa, [])
    expect(daTarefa[0].papel).toBe('criativo')
  })
})

describe('pautaLivrePara', () => {
  it('pauta sem tarefa ou já desta tarefa está livre', () => {
    expect(pautaLivrePara({ id: 'p1' }, 't1')).toBe(true)
    expect(pautaLivrePara({ id: 'p1', tarefaId: 't1' }, 't1')).toBe(true)
  })
  it('vínculo morto libera: tarefa dona apagada, na lixeira ou apontando para outra pauta', () => {
    expect(pautaLivrePara({ id: 'p1', tarefaId: 't9' }, 't1', null)).toBe(true)
    expect(pautaLivrePara({ id: 'p1', tarefaId: 't9' }, 't1', { id: 't9', origemPostId: 'p1', excluidoEm: '2026-11-01T00:00:00Z' })).toBe(true)
    expect(pautaLivrePara({ id: 'p1', tarefaId: 't9' }, 't1', { id: 't9', origemPostId: 'p2' })).toBe(true)
    expect(pautaLivrePara({ id: 'p1', tarefaId: 't9' }, 't1', { id: 't9' })).toBe(true)
  })
  it('tarefa dona viva e apontando de volta segura o vínculo', () => {
    expect(pautaLivrePara({ id: 'p1', tarefaId: 't9' }, 't1', { id: 't9', origemPostId: 'p1' })).toBe(false)
  })
})

describe('soltaPautaAntiga', () => {
  it('trocar de pauta solta a antiga quando ela aponta para esta tarefa', () => {
    expect(soltaPautaAntiga('p1', 'p2', { id: 'p1', tarefaId: 't1' }, 't1')).toBe(true)
  })
  it('tirar a pauta (vazio) também solta', () => {
    expect(soltaPautaAntiga('p1', '', { id: 'p1', tarefaId: 't1' }, 't1')).toBe(true)
    expect(soltaPautaAntiga('p1', undefined, { id: 'p1', tarefaId: 't1' }, 't1')).toBe(true)
  })
  it('nunca solta o vínculo de outra tarefa nem age sem troca', () => {
    expect(soltaPautaAntiga('p1', '', { id: 'p1', tarefaId: 't9' }, 't1')).toBe(false)
    expect(soltaPautaAntiga('p1', 'p1', { id: 'p1', tarefaId: 't1' }, 't1')).toBe(false)
    expect(soltaPautaAntiga('', 'p2', null, 't1')).toBe(false)
    expect(soltaPautaAntiga('p1', 'p2', null, 't1')).toBe(false)
  })
})

describe('planoDeEntregasDaPauta', () => {
  it('leva o marco e a etapa da pauta', () => {
    expect(planoDeEntregasDaPauta({ marcoId: 'm1', subetapaId: 'se-2' })).toEqual({ marcoId: 'm1', subetapaId: 'se-2' })
  })
  it('sem etapa leva só o marco; etapa sem marco não vale', () => {
    expect(planoDeEntregasDaPauta({ marcoId: 'm1' })).toEqual({ marcoId: 'm1' })
    expect(planoDeEntregasDaPauta({ subetapaId: 'se-2' })).toEqual({ marcoId: '' })
    expect(planoDeEntregasDaPauta({})).toEqual({ marcoId: '' })
  })
})

import { describe, it, expect } from 'vitest'
import { camposDoCorpo, CAMPOS_TAREFA } from '@/lib/tarefaCampos'

// Regressão relatada em 2026-07-16: "os anexos somem na primeira vez; na segunda
// salva". Causa: a criação (POST) montava a tarefa campo a campo e não copiava
// `anexos`; a edição (PUT) tinha a própria lista, com `anexos` dentro. Duas
// listas para a mesma coisa divergiram — e o anexo era descartado sem erro.

describe('camposDoCorpo', () => {
  it('leva os anexos (o campo que se perdia ao CRIAR)', () => {
    const anexos = [{ nome: 'briefing.pdf', url: 'https://x.vercel-storage.com/a.pdf', tipo: 'application/pdf' }]
    expect(camposDoCorpo({ titulo: 'Nova', anexos }).anexos).toEqual(anexos)
  })

  it('leva os outros que também só existiam no PUT', () => {
    const body = { checklist: [{ id: '1', texto: 'conferir', feito: false }], documentoId: 'doc1', mapaId: 'mapa1' }
    const r = camposDoCorpo(body)
    expect(r.checklist).toEqual(body.checklist)
    expect(r.documentoId).toBe('doc1')
    expect(r.mapaId).toBe('mapa1')
  })

  it('IGNORA o que é do servidor — cliente não reescreve autoria nem histórico', () => {
    const r = camposDoCorpo({
      titulo: 'ok', id: 'outro-id', criadoPor: 'Fulano', criadoEm: '2020-01-01',
      atividades: [{ tipo: 'falso' }], comentarios: [{ texto: 'injetado' }], excluidoEm: 'x',
    }) as Record<string, unknown>
    expect(r.titulo).toBe('ok')
    for (const proibido of ['id', 'criadoPor', 'criadoEm', 'atividades', 'comentarios', 'excluidoEm']) {
      expect(proibido in r).toBe(false)
    }
  })

  it('campo AUSENTE não vira chave — o PUT parcial (arrastar no kanban) depende disso', () => {
    const r = camposDoCorpo({ status: 'concluido' })
    expect(Object.keys(r)).toEqual(['status'])
    expect('anexos' in r).toBe(false) // senão arrastar o card apagaria os anexos
  })

  it('campo presente e VAZIO é respeitado (limpar o responsável de propósito)', () => {
    const r = camposDoCorpo({ responsavelEmail: '', anexos: [] })
    expect(r.responsavelEmail).toBe('')
    expect(r.anexos).toEqual([])
  })

  it('corpo inválido não explode', () => {
    for (const v of [null, undefined, 'texto', 42]) expect(camposDoCorpo(v)).toEqual({})
  })

  it('a lista cobre o formulário inteiro', () => {
    for (const c of ['titulo', 'descricao', 'tipo', 'status', 'prioridade', 'prazo', 'anexos', 'checklist', 'marcoId', 'recorrencia']) {
      expect(CAMPOS_TAREFA).toContain(c as any)
    }
  })
})

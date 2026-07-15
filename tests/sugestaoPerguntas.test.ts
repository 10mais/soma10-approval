import { describe, it, expect } from 'vitest'
import { parseSugestoes, MAX_SUGESTOES } from '@/lib/sugestaoPerguntas'

// Parse da resposta da IA no assistente de perguntas do inbox. Guarda contra:
// resposta embrulhada em markdown, JSON quebrado e sugestão vazia chegando na
// tela do atendente (o texto vai para a paciente — lixo silencioso é o pior caso).

const uma = (p: string) => `[{"pergunta":"${p}","porque":"abre a motivação","fase":"Fase 2"}]`

describe('parseSugestoes', () => {
  it('lê o array JSON puro', () => {
    const r = parseSugestoes(uma('O que mais te incomoda hoje?'))
    expect(r).toEqual([{ pergunta: 'O que mais te incomoda hoje?', porque: 'abre a motivação', fase: 'Fase 2' }])
  })

  it('desembrulha a cerca de markdown', () => {
    expect(parseSugestoes('```json\n' + uma('E o que te fez procurar agora?') + '\n```')).toHaveLength(1)
    expect(parseSugestoes('```\n' + uma('E o que te fez procurar agora?') + '\n```')).toHaveLength(1)
  })

  it('ignora conversa em volta do JSON', () => {
    const r = parseSugestoes('Claro! Aqui estão as perguntas:\n' + uma('Como você se sente?') + '\nEspero ter ajudado.')
    expect(r[0].pergunta).toBe('Como você se sente?')
  })

  it('corta em MAX_SUGESTOES (a IA às vezes manda mais)', () => {
    const muitas = JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ pergunta: `P${i}?`, porque: 'x', fase: 'y' })))
    expect(parseSugestoes(muitas)).toHaveLength(MAX_SUGESTOES)
  })

  it('descarta item sem pergunta, mantém os válidos', () => {
    const misto = '[{"pergunta":"","porque":"x","fase":"y"},{"pergunta":"Vale?","porque":"z","fase":"w"}]'
    expect(parseSugestoes(misto)).toEqual([{ pergunta: 'Vale?', porque: 'z', fase: 'w' }])
  })

  it('aceita item sem porque/fase (campos são enfeite)', () => {
    expect(parseSugestoes('[{"pergunta":"Só isso?"}]')).toEqual([{ pergunta: 'Só isso?', porque: '', fase: '' }])
  })

  it('devolve [] em vez de explodir quando a resposta não presta', () => {
    expect(parseSugestoes('')).toEqual([])
    expect(parseSugestoes('desculpe, não posso ajudar')).toEqual([])
    expect(parseSugestoes('[{"pergunta": quebrado}]')).toEqual([]) // JSON inválido
    expect(parseSugestoes('{"pergunta":"objeto, não array"}')).toEqual([])
    expect(parseSugestoes('[]')).toEqual([])
    expect(parseSugestoes(null as any)).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import { tituloDe, limitarMensagens, chaveIndice, chaveConversa, MsgSalva } from '@/lib/assistenteConversas'

// O histórico só serve se a pessoa RECONHECE a conversa na lista — daí o título
// vir da primeira pergunta dela, e não da data.

describe('tituloDe', () => {
  it('usa a primeira pergunta do usuário', () => {
    const msgs: MsgSalva[] = [
      { role: 'user', content: 'Escreva a legenda do post da Universal' },
      { role: 'assistant', content: 'Claro! Aqui está...' },
    ]
    expect(tituloDe(msgs)).toBe('Escreva a legenda do post da Universal')
  })

  it('ignora a resposta do assistente (senão toda conversa se chamaria "Claro!")', () => {
    expect(tituloDe([{ role: 'assistant', content: 'Claro! Aqui está...' }, { role: 'user', content: 'Preciso de ideias' }]))
      .toBe('Preciso de ideias')
  })

  it('corta título longo com reticências', () => {
    const t = tituloDe([{ role: 'user', content: 'x'.repeat(200) }])
    expect(t).toHaveLength(71) // 70 + '…'
    expect(t.endsWith('…')).toBe(true)
  })

  it('junta quebras de linha — título é uma linha só', () => {
    expect(tituloDe([{ role: 'user', content: 'Oi\n\n  tudo   bem' }])).toBe('Oi tudo bem')
  })

  it('conversa só com imagem (sem texto) não fica sem nome', () => {
    expect(tituloDe([{ role: 'user', content: '', imagens: ['https://x/y.png'] }])).toBe('Conversa sem título')
    expect(tituloDe([])).toBe('Conversa sem título')
  })
})

describe('limitarMensagens', () => {
  const msg = (i: number): MsgSalva => ({ role: 'user', content: `m${i}` })

  it('conversa normal passa inteira', () => {
    const msgs = Array.from({ length: 50 }, (_, i) => msg(i))
    expect(limitarMensagens(msgs)).toHaveLength(50)
  })

  it('conversa gigante corta do COMEÇO — o fim é o que importa ao retomar', () => {
    const msgs = Array.from({ length: 260 }, (_, i) => msg(i))
    const r = limitarMensagens(msgs)
    expect(r).toHaveLength(200)
    expect(r[r.length - 1].content).toBe('m259')
    expect(r[0].content).toBe('m60')
  })
})

describe('chaves', () => {
  it('o índice é por usuário e não distingue maiúscula', () => {
    expect(chaveIndice('Willian@Grupo10mais.com.br')).toBe(chaveIndice('willian@grupo10mais.com.br'))
  })

  it('conversa tem chave própria', () => {
    expect(chaveConversa('abc')).toBe('ia:conversa:abc')
  })
})

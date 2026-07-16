import { describe, it, expect } from 'vitest'
import { explicaFalhaConexao } from '@/lib/whatsapp'

// Cada instância nova pareia o WhatsApp uma vez, e é sempre aí que aparece o
// erro. A mensagem tem que dizer O QUE FAZER — "não foi possível gerar o QR"
// mandava o dono adivinhar entre instância ausente, chave errada e host fora.

describe('explicaFalhaConexao', () => {
  it('404 = a instância não existe no host (o caso mais comum)', () => {
    const msg = explicaFalhaConexao(404, { response: { message: ['The "agencia" instance does not exist'] } }, 'agencia')
    expect(msg).toContain('agencia')
    expect(msg).toContain('não existe')
    expect(msg).toContain('EVOLUTION_INSTANCE')
  })

  it('404 sem corpo ainda explica o que fazer', () => {
    expect(explicaFalhaConexao(404, {}, 'norah')).toContain('/manager')
  })

  it('401 e 403 apontam a chave, não a instância', () => {
    for (const s of [401, 403]) {
      const msg = explicaFalhaConexao(s, {}, 'agencia')
      expect(msg).toContain('EVOLUTION_API_KEY')
      expect(msg).not.toContain('não existe')
    }
  })

  it('repassa a mensagem do Evolution quando ele explica o problema', () => {
    const msg = explicaFalhaConexao(400, { message: 'Instance already connected' }, 'agencia')
    expect(msg).toContain('Instance already connected')
  })

  it('junta as mensagens em lista e ignora o que não é texto', () => {
    const msg = explicaFalhaConexao(400, { response: { message: ['erro um', 'erro dois'] }, error: null }, 'x')
    expect(msg).toContain('erro um · erro dois')
  })

  it('sem pista nenhuma, sugere o Desconectar (instância já pareada não devolve QR)', () => {
    const msg = explicaFalhaConexao(500, {}, 'agencia')
    expect(msg).toContain('500')
    expect(msg).toContain('Desconectar')
  })

  it('corpo com string vazia não vira "O Evolution respondeu: "', () => {
    expect(explicaFalhaConexao(500, { message: '  ' }, 'x')).toContain('Desconectar')
  })
})

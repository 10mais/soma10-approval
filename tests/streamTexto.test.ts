import { describe, it, expect } from 'vitest'
import { SENTINELA, LIMPAR, textoVisivel, dadosDaSentinela, lerStreamDeTexto } from '@/lib/streamTexto'

// Monta um corpo de resposta que entrega os pedaços na ordem, como a rota faz.
function fluxo(pedacos: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(c) {
      for (const p of pedacos) c.enqueue(enc.encode(p))
      c.close()
    },
  })
}

// Entrega BYTE a byte: é assim que o acento e os caracteres de controle chegam
// partidos no meio de um pedaço.
function fluxoPorByte(texto: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(texto)
  return new ReadableStream({
    start(c) {
      // Índice em vez de for-of: o target do tsconfig é anterior a es2015 e
      // iterar Uint8Array não compila (TS2802).
      for (let i = 0; i < bytes.length; i++) c.enqueue(new Uint8Array([bytes[i]]))
      c.close()
    },
  })
}

describe('o que a tela mostra enquanto o texto chega', () => {
  it('sem sentinela, mostra tudo que chegou', () => {
    expect(textoVisivel('# Marca\n\nA Deny')).toBe('# Marca\n\nA Deny')
  })

  it('corta no ␞: o dado final não vaza para a tela', () => {
    expect(textoVisivel(`Documento pronto${SENTINELA}{"ok":true}`)).toBe('Documento pronto')
  })

  it('␜ manda esquecer o que veio antes (pause_turn recomeçou o turno)', () => {
    expect(textoVisivel(`rascunho velho${LIMPAR}texto bom`)).toBe('texto bom')
  })

  it('vale o ÚLTIMO ␜ quando o turno recomeça duas vezes', () => {
    expect(textoVisivel(`a${LIMPAR}b${LIMPAR}c`)).toBe('c')
  })

  it('␜ depois do ␞ é dado, não comando: não apaga o texto', () => {
    expect(textoVisivel(`texto${SENTINELA}{"x":"${LIMPAR}"}`)).toBe('texto')
  })

  it('quebra de linha no começo não vira buraco no topo da caixa', () => {
    // O modelo quase sempre abre com "\n\n". Com `pre-wrap` isso apareceria.
    expect(textoVisivel('\n\n# Documento')).toBe('# Documento')
    expect(textoVisivel('   ')).toBe('')
  })

  it('o espaço do FIM fica: é ele que separa a palavra da próxima', () => {
    // Cortar o fim faria "o ônibus" virar "oônibus" conforme os pedaços chegam.
    expect(textoVisivel('A Deny opera ')).toBe('A Deny opera ')
  })

  it('depois do ␜ o começo também vem limpo', () => {
    expect(textoVisivel(`rascunho${LIMPAR}\n\nversão final`)).toBe('versão final')
  })

  it('vazio, nulo e indefinido não explodem', () => {
    expect(textoVisivel('')).toBe('')
    expect(textoVisivel(undefined as any)).toBe('')
    expect(textoVisivel(null as any)).toBe('')
  })
})

describe('o resultado final', () => {
  it('lê o objeto depois do ␞', () => {
    const d = dadosDaSentinela<{ ok: boolean; documentoMarca: string }>(`texto${SENTINELA}{"ok":true,"documentoMarca":"# M"}`)
    expect(d).toEqual({ ok: true, documentoMarca: '# M' })
  })

  it('ainda sem sentinela devolve null', () => {
    expect(dadosDaSentinela('ainda escrevendo')).toBeNull()
  })

  it('JSON pela metade devolve null em vez de quebrar a tela', () => {
    // Acontece o tempo todo: a sentinela chega partida entre dois pedaços.
    expect(dadosDaSentinela(`t${SENTINELA}{"ok":tr`)).toBeNull()
  })

  it('o que não for objeto não passa por dado', () => {
    expect(dadosDaSentinela(`t${SENTINELA}"só um texto"`)).toBeNull()
    expect(dadosDaSentinela(`t${SENTINELA}42`)).toBeNull()
    expect(dadosDaSentinela(`t${SENTINELA}null`)).toBeNull()
  })

  it('o erro da rota viaja pela mesma sentinela', () => {
    // Depois que o fluxo começou não dá mais para mudar o status HTTP.
    expect(dadosDaSentinela(`${SENTINELA}{"erro":"saldo de IA esgotado"}`)).toEqual({ erro: 'saldo de IA esgotado' })
  })
})

describe('ler o fluxo inteiro', () => {
  it('avisa a tela a cada pedaço, com o texto já pronto para exibir', async () => {
    const vistos: string[] = []
    const r = await lerStreamDeTexto(fluxo(['Oi', ' Deny', `!${SENTINELA}{"ok":true}`]), t => vistos.push(t))
    expect(vistos).toEqual(['Oi', 'Oi Deny', 'Oi Deny!', 'Oi Deny!'])
    expect(r.texto).toBe('Oi Deny!')
    expect(r.dados).toEqual({ ok: true })
  })

  it('acento e ␞ partidos entre pedaços chegam inteiros', async () => {
    const r = await lerStreamDeTexto(fluxoPorByte(`Posicionamento é força${SENTINELA}{"ok":true,"n":"ação"}`))
    expect(r.texto).toBe('Posicionamento é força')
    expect(r.dados).toEqual({ ok: true, n: 'ação' })
    // E nenhum passo intermediário mostrou caractere quebrado.
    const passos: string[] = []
    await lerStreamDeTexto(fluxoPorByte('é'), t => passos.push(t))
    expect(passos.every(p => !p.includes('�'))).toBe(true)
  })

  it('corpo vazio devolve texto vazio sem dado', async () => {
    expect(await lerStreamDeTexto(null)).toEqual({ texto: '', dados: null })
    expect(await lerStreamDeTexto(fluxo([]))).toEqual({ texto: '', dados: null })
  })

  it('o ␜ no meio do fluxo some com o rascunho e a tela vê a troca', async () => {
    const vistos: string[] = []
    const r = await lerStreamDeTexto(fluxo(['rascunho', `${LIMPAR}versão final`, `${SENTINELA}{"ok":true}`]), t => vistos.push(t))
    expect(vistos[0]).toBe('rascunho')
    expect(vistos[1]).toBe('versão final')
    expect(r.texto).toBe('versão final')
  })

  it('fluxo que termina sem sentinela ainda entrega o texto', async () => {
    const r = await lerStreamDeTexto(fluxo(['metade do documento']))
    expect(r.texto).toBe('metade do documento')
    expect(r.dados).toBeNull()
  })
})

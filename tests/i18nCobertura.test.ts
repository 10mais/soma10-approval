import { describe, it, expect } from 'vitest'
import { TEXTOS } from '@/lib/i18n'

// Rede de segurança da tradução. O dono cobrou, em 20/09/2026, que "o sistema não alterou
// o idioma, apenas mascarou com os nomes de cada menu". Estes testes não conferem o
// português — conferem que o INGLÊS existe e que ele não é português disfarçado.

const ACENTO_PT = /[ãõçáéíóúâêôàÁÉÍÓÚÃÕÇÂÊÔÀ]/

// Palavras que ficam iguais nos dois idiomas de propósito (nome próprio, marca, sigla).
const PERMITIDOS = new Set(['Pix', 'Grupo 10+', 'SOMA10 APPROVAL · GRUPO 10+'])

describe('i18n — o inglês existe e é inglês', () => {
  // 'tempo.ha' é vazio em inglês de propósito: "há 1h" vira "1h ago", sem prefixo.
  const VAZIO_DE_PROPOSITO = new Set(['tempo.ha'])

  it('toda chave tem texto nos três idiomas', () => {
    const faltando = Object.entries(TEXTOS)
      .filter(([k]) => !VAZIO_DE_PROPOSITO.has(k))
      .filter(([, e]) => !e.pt?.trim() || !e.en?.trim() || !e.es?.trim())
      .map(([k]) => k)
    expect(faltando).toEqual([])
  })

  it('nenhum texto em inglês ficou com acento de português', () => {
    const suspeitos = Object.entries(TEXTOS)
      .filter(([, e]) => ACENTO_PT.test(e.en || '') && !PERMITIDOS.has(e.en || ''))
      .map(([k, e]) => `${k}: ${e.en}`)
    expect(suspeitos).toEqual([])
  })

  it('a mesma FRASE em português não tem duas traduções diferentes', () => {
    // Chave duplicada o TypeScript já pega; aqui o alvo é o contrário: a MESMA frase
    // escrita com traduções DIFERENTES, que é como um rótulo começa a divergir entre
    // telas (a lição do carrossel que virava STORY no link do cliente).
    //
    // Só frases: uma PALAVRA solta muda de sentido conforme a tela ("Entrada" é
    // onboarding no cadastro e entrada de estoque no varejo), e isso é correto.
    const porPt = new Map<string, Set<string>>()
    for (const e of Object.values(TEXTOS)) {
      const pt = (e.pt || '').trim()
      if (pt.length < 25 || pt.includes('{')) continue
      if (!porPt.has(pt)) porPt.set(pt, new Set())
      porPt.get(pt)!.add(e.en || '')
    }
    const divergentes = [...porPt.entries()]
      .filter(([, ens]) => ens.size > 1)
      .map(([pt, ens]) => `${pt} → ${[...ens].join(' | ')}`)
    expect(divergentes).toEqual([])
  })
})

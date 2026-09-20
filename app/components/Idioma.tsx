'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { IDIOMA_PADRAO, normalizarIdioma, nomeDaArea, t, type Idioma } from '@/lib/i18n'
import { ehRotaPublica } from '@/lib/rotasPublicas'

// IDIOMA DE QUEM ESTÁ USANDO (dono, 20/09/2026: "cada pessoa escolhe o seu"). A equipe
// trabalha em português e um sócio ou cliente estrangeiro lê a mesma tela em inglês.
//
// Onde fica guardado: no PERFIL da pessoa (`Usuario.idioma`, via /api/meu-perfil) para
// seguir de um computador a outro, e no `localStorage` deste navegador para a tela já nascer
// no idioma certo, sem esperar a rede. O localStorage manda na primeira pintura; o perfil
// corrige logo depois, se divergir.
//
// As regras (o que cada chave quer dizer em cada idioma) estão em lib/i18n, pura e testada.

const CHAVE_LOCAL = 'soma10-idioma'

type Ctx = { idioma: Idioma; definirIdioma: (i: Idioma) => void }
const IdiomaCtx = createContext<Ctx>({ idioma: IDIOMA_PADRAO, definirIdioma: () => {} })

export function ProvedorIdioma({ children }: { children: React.ReactNode }) {
  const [idioma, setIdioma] = useState<Idioma>(IDIOMA_PADRAO)

  useEffect(() => {
    let vivo = true
    let local: string | null = null
    try { local = localStorage.getItem(CHAVE_LOCAL) } catch {}
    if (local) setIdioma(normalizarIdioma(local))
    // Em página pública (link de aprovação, login, status) não há perfil para consultar:
    // pedir daria 401 a cada abertura, de graça.
    if (ehRotaPublica(typeof window === 'undefined' ? '' : window.location.pathname)) return
    // O perfil é a fonte da verdade entre navegadores; só sobrescreve se for diferente.
    fetch('/api/meu-perfil').then(r => (r.ok ? r.json() : null)).then(d => {
      if (!vivo || !d?.idioma) return
      const doPerfil = normalizarIdioma(d.idioma)
      setIdioma(doPerfil)
      try { localStorage.setItem(CHAVE_LOCAL, doPerfil) } catch {}
    }).catch(() => {})
    return () => { vivo = false }
  }, [])

  function definirIdioma(novo: Idioma) {
    const limpo = normalizarIdioma(novo)
    setIdioma(limpo)
    try { localStorage.setItem(CHAVE_LOCAL, limpo) } catch {}
    fetch('/api/meu-perfil', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idioma: limpo }),
    }).catch(() => {})
  }

  return <IdiomaCtx.Provider value={{ idioma, definirIdioma }}>{children}</IdiomaCtx.Provider>
}

export function useIdioma() {
  return useContext(IdiomaCtx)
}

/** `const tr = useT()` → `tr('nav.planner')` no idioma de quem está usando. */
export function useT() {
  const { idioma } = useIdioma()
  return (chave: string) => t(chave, idioma)
}

/** Nome da área (aba) no idioma de quem está usando: `useArea()('planner')`. */
export function useArea() {
  const { idioma } = useIdioma()
  return (chave: string) => nomeDaArea(chave, idioma)
}

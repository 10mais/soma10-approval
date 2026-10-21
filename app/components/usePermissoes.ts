'use client'
// PERMISSÕES NA TELA fora do painel (hub do cliente, Equipe) — a mesma conta do painel
// (podeNivelDash / podeAcaoDash / podeAbaDash), com a config por papel buscada uma vez.
// Dono, 21/10/2026: a Ana ("usuario") não excluía pauta nem abria telas da equipe no hub, que
// só reconhecia admin e gerente. Regra pura em lib/permissoesHub (testada).
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { podeNivel, type GrupoPermissao, type Nivel } from '@/lib/permissoesCatalogo'
import { podeAcaoGranular, type AcaoPerm } from '@/lib/permissoesGranular'
import { ehEquipeDoHub, podeTelaDoHub } from '@/lib/permissoesHub'

type Configs = { papel: any; granular: any; em: number }
let cache: Configs | null = null

async function carregarConfigs(): Promise<Configs> {
  if (cache && Date.now() - cache.em < 60000) return cache
  const j = (u: string) => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null)
  const [papel, granular] = await Promise.all([j('/api/permissoes-papel'), j('/api/permissoes-granular')])
  cache = { papel: papel && !papel.error ? papel : {}, granular: granular && !granular.error ? granular : {}, em: Date.now() }
  return cache
}

export function usePermissoes() {
  const { data: session, status } = useSession()
  const u = (session?.user || {}) as any
  const role = String(u.role || '')
  const ehEquipe = ehEquipeDoHub(role)
  const [cfg, setCfg] = useState<Configs | null>(cache)

  useEffect(() => {
    if (!ehEquipe || role === 'admin') return
    let vivo = true
    carregarConfigs().then(c => { if (vivo) setCfg(c) })
    return () => { vivo = false }
  }, [ehEquipe, role])

  const pode = (grupo: GrupoPermissao, nivel: Nivel = 'ver') => podeNivel(role, grupo, nivel, u.permissoes, cfg?.papel)
  const podeAcao = (acao: AcaoPerm) => podeAcaoGranular(role, acao, u.permissoesGranular, cfg?.granular)
  return {
    role,
    ehEquipe,
    /** Sessão e config carregadas — antes disso, não redirecionar ninguém. */
    pronto: status !== 'loading' && (role === 'admin' || !ehEquipe || !!cfg),
    pode,
    podeAcao,
    /** Excluir = nível "Excluir" do grupo + ação "Excluir" das permissões detalhadas (o que a rota confere). */
    podeExcluir: (grupo: GrupoPermissao) => pode(grupo, 'excluir') && podeAcao('excluir'),
    podeTela: (subpath: string) => podeTelaDoHub(subpath, { role, permissoes: u.permissoes, permissoesGranular: u.permissoesGranular, permPapel: cfg?.papel, permGranularPapel: cfg?.granular }),
  }
}

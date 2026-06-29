'use client'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { isViewAsClient, setViewAsClient } from '@/lib/modoCliente'

// `perm` liga o item a uma flag de permissao do cliente (cliente.permissoes).
// Ausente/undefined = liberado. Itens sem `perm` (Início) ficam sempre visíveis.
const NAV_ITEMS = [
  { key: '', label: 'Início', todos: true },
  { key: '/entregas', label: 'Entregas', todos: true, perm: 'entregas' as const },
  { key: '/aprovacoes', label: 'Aprovações', todos: true, perm: 'aprovacoes' as const },
  { key: '/solicitar', label: 'Solicitar conteúdo', todos: true, perm: 'solicitar' as const },
  { key: '/esteira', label: 'Esteira', todos: true, perm: 'esteira' as const },
  { key: '/planner', label: 'Planner', todos: true, perm: 'planner' as const },
  { key: '/playbook', label: 'Playbook', equipe: true },
  { key: '/marca', label: 'Marca', equipe: true },
  { key: '/listening', label: 'Social Listening', equipe: true },
  { key: '/analytics', label: 'Analytics', equipe: true },
]

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const clienteId = params.clienteId as string
  const [cliente, setCliente] = useState<any>(null)
  const role = (session?.user as any)?.role
  const isTeam = role === 'admin' || role === 'gerente'
  // Modo "Visualizar como cliente": equipe ve o portal como o cliente (read-only)
  const [viewAs, setViewAs] = useState(false)
  useEffect(() => { setViewAs(isViewAsClient()) }, [])
  const ehEquipe = isTeam && !viewAs
  function alternarViewAs(on: boolean) { setViewAsClient(on); window.location.reload() }

  useEffect(() => {
    fetch(`/api/clientes?id=${clienteId}`).then(r => r.json()).then(d => {
      if (d && !d.error) setCliente(d)
    }).catch(() => {})
  }, [clienteId])

  const basePath = `/cliente/${clienteId}`
  const subpath = pathname.replace(basePath, '') || ''

  // Permissao do portal: ausente/undefined = liberado. Equipe editando ve tudo.
  const clientePode = (perm?: string) => {
    if (!perm) return true
    if (ehEquipe) return true
    return (cliente?.permissoes?.[perm]) !== false
  }
  // Guard de acesso direto por URL: se a pagina atual nao e permitida, volta ao Inicio.
  useEffect(() => {
    if (!cliente || ehEquipe) return
    const item = NAV_ITEMS.find(i => i.key === subpath)
    if (item && (item as any).perm && cliente.permissoes?.[(item as any).perm] === false) {
      router.replace(basePath)
    }
  }, [cliente, subpath, ehEquipe])

  // Pendências de aprovação do cliente (banner "o que está esperando você", em todo o portal)
  const [pendentesAprov, setPendentesAprov] = useState(0)
  useEffect(() => {
    fetch(`/api/posts?clienteId=${clienteId}`).then(r => r.json()).then(d => {
      setPendentesAprov(Array.isArray(d) ? d.filter((p: any) => p.etapa === 'aprovacao_copy' || p.etapa === 'aprovacao_criativo').length : 0)
    }).catch(() => {})
  }, [clienteId, subpath])

  // Extrai cor dominante da imagem de perfil
  // Extrai a cor DOMINANTE (mais frequente) da imagem de perfil
  const [corExtraida, setCorExtraida] = useState<string | null>(null)
  useEffect(() => {
    if (!cliente?.logo) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 40; canvas.height = 40
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, 40, 40)
        const data = ctx.getImageData(0, 0, 40, 40).data
        // Histograma quantizado (agrupa cores similares em buckets de 32)
        const buckets: Record<string, { r: number; g: number; b: number; count: number }> = {}
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3]
          if (a < 128) continue
          const soma = r + g + b
          if (soma > 700 || soma < 50) continue // ignora brancos e pretos
          if (Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && soma > 200) continue // ignora cinzas
          const qr = Math.round(r / 32) * 32
          const qg = Math.round(g / 32) * 32
          const qb = Math.round(b / 32) * 32
          const key = `${qr},${qg},${qb}`
          if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, count: 0 }
          buckets[key].r += r; buckets[key].g += g; buckets[key].b += b; buckets[key].count++
        }
        let melhor = null as { r: number; g: number; b: number; count: number } | null
        for (const b of Object.values(buckets)) {
          if (!melhor || b.count > melhor.count) melhor = b
        }
        if (melhor && melhor.count > 10) {
          const r = Math.round(melhor.r / melhor.count)
          const g = Math.round(melhor.g / melhor.count)
          const b = Math.round(melhor.b / melhor.count)
          setCorExtraida(`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`)
        }
      } catch {}
    }
    img.src = cliente.logo
  }, [cliente?.logo])

  const corPrimaria = cliente?.corPrimaria || corExtraida || '#111'

  // Calcula se o fundo e claro ou escuro para escolher texto branco ou preto
  function corEscura(hex: string): boolean {
    const c = hex.replace('#', '')
    const r = parseInt(c.substring(0, 2), 16) || 0
    const g = parseInt(c.substring(2, 4), 16) || 0
    const b = parseInt(c.substring(4, 6), 16) || 0
    return (r * 299 + g * 587 + b * 114) / 1000 < 128
  }
  const fundoEscuro = corEscura(corPrimaria)
  const corTextoHeader = fundoEscuro ? '#fff' : '#111'
  const logoSrc = fundoEscuro ? '/logo-branco.svg' : '/logo.svg'

  // Texto que contrasta com a cor da marca (para botoes primarios)
  const corTextoMarca = corEscura(corPrimaria) ? '#fff' : '#111'

  return (
    <div style={{ ['--marca' as any]: corPrimaria, ['--marca-texto' as any]: corTextoMarca }}>
      {/* Header personalizado com a cor do cliente */}
      <div style={{ background: corPrimaria, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 100 }}>
        <div onClick={() => router.push(ehEquipe ? '/dashboard' : basePath)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <img src={logoSrc} alt="Soma10" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, color: corTextoHeader, fontSize: 15 }}>Soma10 Approval</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push(`${basePath}/conta`)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <span style={{ fontSize: 13, color: corTextoHeader, opacity: 0.8 }}>{session?.user?.name}</span>
          </button>
          {isTeam && (
            <button onClick={() => alternarViewAs(!viewAs)} title={viewAs ? 'Voltar a editar como equipe' : 'Ver o portal como o cliente ve (somente leitura)'}
              style={{ background: viewAs ? corTextoHeader : 'none', border: `1px solid ${corTextoHeader}`, borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: viewAs ? corPrimaria : corTextoHeader }}>
              {viewAs ? 'Editar como equipe' : 'Visualizar como cliente'}
            </button>
          )}
          {isTeam && (
            <button onClick={() => { setViewAsClient(false); router.push('/dashboard') }} style={{ background: 'none', border: `1px solid ${corTextoHeader}40`, borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: corTextoHeader, opacity: 0.8 }}>
              Voltar ao Painel
            </button>
          )}
          <button onClick={() => signOut()} style={{ background: 'none', border: `1.5px solid ${corTextoHeader}`, borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: corTextoHeader }}>Sair</button>
        </div>
      </div>

      {/* Banner do modo "Visualizar como cliente" */}
      {isTeam && viewAs && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '8px 24px', fontSize: 12.5, color: '#92400e', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700 }}>Modo visualização — você está vendo o portal como o cliente vê (somente leitura).</span>
          <button onClick={() => alternarViewAs(false)} style={{ background: '#92400e', color: '#fff', border: 'none', borderRadius: 7, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Sair do modo cliente</button>
        </div>
      )}

      {/* Banner "o que está esperando você" — visível em todo o portal, exceto na própria Aprovações */}
      {pendentesAprov > 0 && subpath !== '/aprovacoes' && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#b91c1c' }}>
            Você tem {pendentesAprov} {pendentesAprov === 1 ? 'item aguardando' : 'itens aguardando'} a sua aprovação.
          </span>
          <button onClick={() => router.push(`${basePath}/aprovacoes`)} style={{ background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Revisar agora</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {/* Sidebar */}
        <aside style={{ width: 220, flexShrink: 0, background: '#fff', borderRight: '1px solid #f0f0f0', minHeight: 'calc(100vh - 56px)', position: 'sticky', top: 56, padding: '20px 14px', boxSizing: 'border-box' }}>
          {/* Cliente info */}
          {cliente && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 16px', borderBottom: '1px solid #f0f0f0', marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: cliente.corPrimaria || '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: cliente.corSecundaria || '#111', flexShrink: 0 }}>
                {cliente.logo ? <img src={cliente.logo} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                {(!cliente.logo) && <span>{cliente.nome?.[0]?.toUpperCase()}</span>}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#111' }}>{cliente.nome}</p>
                {cliente.instagram && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888' }}>@{cliente.instagram.replace(/^@/, '')}</p>}
              </div>
            </div>
          )}

          {/* Nav — agrupada: "O que o cliente vê" (todos) x "Ferramentas da equipe" (equipe).
              O cliente vê apenas o primeiro grupo (sem cabecalhos). A equipe ve os dois separados. */}
          {(() => {
            const renderItem = (item: typeof NAV_ITEMS[number]) => {
              const href = `${basePath}${item.key}`
              const ativo = subpath === item.key || (item.key === '' && subpath === '')
              return (
                <button key={item.key} onClick={() => router.push(href)} style={{
                  padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  fontWeight: ativo ? 700 : 500, color: ativo ? corTextoHeader : '#888',
                  background: ativo ? corPrimaria : 'transparent',
                  fontSize: 14, transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                  <span>{item.label}</span>
                  {item.key === '/aprovacoes' && pendentesAprov > 0 && (
                    <span style={{ background: '#dc2626', color: '#fff', borderRadius: 999, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, padding: '0 5px' }}>{pendentesAprov}</span>
                  )}
                </button>
              )
            }
            const grupoCliente = NAV_ITEMS.filter(i => i.todos && clientePode((i as any).perm))
            const grupoEquipe = NAV_ITEMS.filter(i => i.equipe)
            const rotulo = { display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 6px', padding: '0 4px' }
            return (
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {ehEquipe && <span style={rotulo}>O que o cliente vê</span>}
                {grupoCliente.map(renderItem)}
                {ehEquipe && grupoEquipe.length > 0 && (
                  <>
                    <div style={{ height: 1, background: '#f0f0f0', margin: '12px 0' }} />
                    <span style={rotulo}>Ferramentas da equipe</span>
                    {grupoEquipe.map(renderItem)}
                  </>
                )}
              </nav>
            )
          })()}

          {/* Minha conta */}
          <div style={{ paddingTop: 16, borderTop: '1px solid #f0f0f0', marginTop: 20 }}>
            <button onClick={() => router.push(`${basePath}/conta`)} style={{
              padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              fontWeight: subpath === '/conta' ? 700 : 500, color: subpath === '/conta' ? corTextoHeader : '#888',
              background: subpath === '/conta' ? corPrimaria : 'transparent', fontSize: 13, width: '100%',
            }}>
              Minha conta
            </button>
          </div>
        </aside>

        {/* Conteudo */}
        <main style={{ flex: 1, minWidth: 0, padding: '24px 28px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

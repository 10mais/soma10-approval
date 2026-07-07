'use client'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { isViewAsClient, setViewAsClient } from '@/lib/modoCliente'
import { temModulo } from '@/lib/modulos'
import AvatarCliente from '@/app/components/AvatarCliente'

// `perm` liga o item a uma flag de permissao do cliente (cliente.permissoes).
// Ausente/undefined = liberado. Itens sem `perm` (Início) ficam sempre visíveis.
const NAV_ITEMS = [
  { key: '', label: 'Início', todos: true },
  { key: '/entregas', label: 'Entregas', todos: true, perm: 'entregas' as const },
  { key: '/aprovacoes', label: 'Aprovações', todos: true, perm: 'aprovacoes' as const },
  { key: '/solicitar', label: 'Solicitar conteúdo', todos: true, perm: 'solicitar' as const },
  { key: '/planner', label: 'Planner', equipe: true }, // movido p/ Produção (agência); no portal só a equipe alcança
  // Add-ons do plano modular: equipe sempre vê (ferramenta); cliente vê se contratou.
  { key: '/playbook', label: 'Playbook', equipe: true, modulo: 'playbook' as const },
  { key: '/marca', label: 'Marca', equipe: true }, // 'marca' é billável, mas a visão do cliente ainda não foi construída (é editor da equipe)
  { key: '/listening', label: 'Social Listening', equipe: true, modulo: 'listening' as const },
  { key: '/analytics', label: 'Analytics', equipe: true, modulo: 'analytics' as const },
]

// Icones da barra inferior (mobile / cara de app)
const ICON_PATH: Record<string, string> = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  aprovacoes: 'M20 6 9 17l-5-5',
  entregas: 'M21 8 12 3 3 8l9 5 9-5zM3 8v8l9 5 9-5V8',
  menu: 'M3 6h18M3 12h18M3 18h18',
}

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
  // Guard de acesso direto por URL: cliente só acessa páginas "todos" liberadas.
  // Páginas só-equipe (equipe:true, ex.: Planner/Playbook/Marca) ou sem permissão
  // no Brand Board redirecionam pro Início.
  useEffect(() => {
    if (!cliente || ehEquipe) return
    const item = NAV_ITEMS.find(i => i.key === subpath)
    // Add-on contratado (módulo ativo) libera a página mesmo sendo equipe:true.
    const moduloOk = !!(item && (item as any).modulo && temModulo((cliente as any).modulos, (item as any).modulo))
    const soEquipe = !!(item && (item as any).equipe && !moduloOk)
    const semPerm = !!(item && (item as any).perm && cliente.permissoes?.[(item as any).perm] === false)
    if (soEquipe || semPerm) router.replace(basePath)
  }, [cliente, subpath, ehEquipe])

  // Pendências de aprovação do cliente (banner "o que está esperando você", em todo o portal)
  const [pendentesAprov, setPendentesAprov] = useState(0)
  useEffect(() => {
    fetch(`/api/posts?clienteId=${clienteId}`).then(r => r.json()).then(d => {
      setPendentesAprov(Array.isArray(d) ? d.filter((p: any) => p.etapa === 'aprovacao_copy' || p.etapa === 'aprovacao_criativo').length : 0)
    }).catch(() => {})
  }, [clienteId, subpath])

  // Layout padrao da agencia para TODOS os clientes (sem tematizacao por cliente).
  // Header neutro (branco/escuro) e botoes primarios no amarelo Soma10.
  const MARCA = '#ffc00f'          // amarelo Soma10 (botoes primarios via var(--marca))
  const MARCA_TEXTO = '#111'       // texto sobre o amarelo
  const corTextoHeader = '#111'    // header branco -> texto escuro
  const logoSrc = '/logo.svg'

  // Responsivo: no celular a sidebar vira um drawer (menu hamburguer)
  const [mobile, setMobile] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const apply = () => setMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  // Fecha o drawer ao navegar
  useEffect(() => { setMenuAberto(false) }, [subpath])

  const asideBase: React.CSSProperties = { width: mobile ? 264 : 220, flexShrink: 0, background: '#fff', borderRight: '1px solid #f0f0f0', boxSizing: 'border-box', padding: '20px 14px' }
  const asideStyle: React.CSSProperties = mobile
    ? { ...asideBase, position: 'fixed', top: 'calc(56px + env(safe-area-inset-top))', left: 0, height: 'calc(100vh - 56px - env(safe-area-inset-top))', overflowY: 'auto', zIndex: 200, transform: menuAberto ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s ease', boxShadow: menuAberto ? '2px 0 16px rgba(0,0,0,0.18)' : 'none' }
    : { ...asideBase, minHeight: 'calc(100vh - 56px)', position: 'sticky', top: 56 }
  const irPara = (href: string) => { router.push(href); if (mobile) setMenuAberto(false) }

  return (
    <div style={{ ['--marca' as any]: MARCA, ['--marca-texto' as any]: MARCA_TEXTO }}>
      {/* Header padrao da agencia (neutro) — igual para todos os clientes */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', paddingLeft: mobile ? 14 : 24, paddingRight: mobile ? 14 : 24, paddingTop: mobile ? 'env(safe-area-inset-top)' : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, height: mobile ? undefined : 56, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div onClick={() => router.push(ehEquipe ? '/dashboard' : basePath)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <img src={logoSrc} alt="Soma10" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, color: corTextoHeader, fontSize: 15 }}>{mobile ? 'Soma10' : 'Soma10 Approval'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 8 : 12 }}>
          {!mobile && (
            <button onClick={() => router.push(`${basePath}/conta`)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ fontSize: 13, color: corTextoHeader, opacity: 0.8 }}>{session?.user?.name}</span>
            </button>
          )}
          {isTeam && (
            <button onClick={() => alternarViewAs(!viewAs)} title={viewAs ? 'Voltar a editar como equipe' : 'Ver o portal como o cliente ve (somente leitura)'}
              style={{ background: viewAs ? corTextoHeader : 'none', border: `1px solid ${corTextoHeader}`, borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: viewAs ? MARCA : corTextoHeader }}>
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

      {/* Backdrop do drawer no mobile */}
      {mobile && menuAberto && (
        <div onClick={() => setMenuAberto(false)} style={{ position: 'fixed', inset: 0, top: 'calc(56px + env(safe-area-inset-top))', background: 'rgba(0,0,0,0.35)', zIndex: 150 }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {/* Sidebar (drawer no mobile) */}
        <aside style={asideStyle}>
          {/* Cliente info */}
          {cliente && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 16px', borderBottom: '1px solid #f0f0f0', marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#111', flexShrink: 0 }}>
                <AvatarCliente logo={cliente.logo} nome={cliente.nome} clienteId={clienteId} />
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
                <button key={item.key} onClick={() => irPara(href)} style={{
                  padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  fontWeight: ativo ? 700 : 500, color: ativo ? corTextoHeader : '#888',
                  background: ativo ? MARCA : 'transparent',
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
            // O cliente vê: núcleo (todos + permitido) + add-ons CONTRATADOS (módulo ativo).
            // Para a equipe (ehEquipe), os add-ons aparecem em "Ferramentas da equipe".
            const grupoCliente = NAV_ITEMS.filter(i => (i.todos && clientePode((i as any).perm)) || (!ehEquipe && (i as any).modulo && temModulo((cliente as any)?.modulos, (i as any).modulo)))
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
            <button onClick={() => irPara(`${basePath}/conta`)} style={{
              padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              fontWeight: subpath === '/conta' ? 700 : 500, color: subpath === '/conta' ? corTextoHeader : '#888',
              background: subpath === '/conta' ? MARCA : 'transparent', fontSize: 13, width: '100%',
            }}>
              Minha conta
            </button>
          </div>
        </aside>

        {/* Conteudo */}
        <main style={{ flex: 1, minWidth: 0, padding: mobile ? '16px 14px calc(78px + env(safe-area-inset-bottom))' : '24px 28px', width: mobile ? '100%' : undefined }}>
          {children}
        </main>
      </div>

      {/* Barra de navegacao inferior (mobile / cara de app) */}
      {mobile && (() => {
        const itens = [
          { key: '', label: 'Início', icon: 'inicio' },
          { key: '/aprovacoes', label: 'Aprovar', icon: 'aprovacoes', perm: 'aprovacoes' },
          { key: '/entregas', label: 'Entregas', icon: 'entregas', perm: 'entregas' },
        ].filter(i => clientePode((i as any).perm))
        const btn = (ativo: boolean, icon: string, label: string, onClick: () => void, badge?: number) => (
          <button key={label} onClick={onClick} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '9px 0 5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: ativo ? '#111' : '#9aa0a6', position: 'relative' }}>
            <span style={{ position: 'relative', display: 'flex' }}>
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICON_PATH[icon]} /></svg>
              {!!badge && badge > 0 && (
                <span style={{ position: 'absolute', top: -5, right: -8, background: '#dc2626', color: '#fff', borderRadius: 999, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800, padding: '0 4px' }}>{badge > 9 ? '9+' : badge}</span>
              )}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: ativo ? 700 : 500 }}>{label}</span>
          </button>
        )
        return (
          <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 140, background: '#fff', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-around', alignItems: 'stretch', paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -2px 12px rgba(0,0,0,0.06)' }}>
            {itens.map(i => btn(subpath === i.key && !menuAberto, i.icon, i.label, () => irPara(`${basePath}${i.key}`), i.key === '/aprovacoes' ? pendentesAprov : undefined))}
            {btn(menuAberto, 'menu', 'Menu', () => setMenuAberto(v => !v))}
          </nav>
        )
      })()}
    </div>
  )
}

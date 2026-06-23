'use client'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

const NAV_ITEMS = [
  { key: '', label: 'Inicio' },
  { key: '/aprovacoes', label: 'Aprovacoes' },
  { key: '/esteira', label: 'Esteira' },
  { key: '/planner', label: 'Planner' },
  { key: '/playbook', label: 'Playbook' },
  { key: '/marca', label: 'Marca' },
  { key: '/listening', label: 'Social Listening' },
  { key: '/analytics', label: 'Analytics' },
]

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const clienteId = params.clienteId as string
  const [cliente, setCliente] = useState<any>(null)
  const role = (session?.user as any)?.role
  const ehEquipe = role === 'admin' || role === 'gerente'

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(lista => {
      const c = (Array.isArray(lista) ? lista : []).find((x: any) => x.id === clienteId)
      if (c) setCliente(c)
    }).catch(() => {})
  }, [clienteId])

  const basePath = `/cliente/${clienteId}`
  const subpath = pathname.replace(basePath, '') || ''

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#111', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 100 }}>
        <div onClick={() => router.push(ehEquipe ? '/dashboard' : basePath)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <div style={{ background: '#fff', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="/logo.svg" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
          </div>
          <span style={{ fontWeight: 800, color: '#fff', fontSize: 15 }}>Soma10Approval</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => router.push(`${basePath}/conta`)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <span style={{ fontSize: 13, color: '#ccc' }}>{session?.user?.name}</span>
          </button>
          <span style={{ background: '#ffc00f', color: '#111', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{role}</span>
          {ehEquipe && (
            <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: '1px solid #555', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#ccc' }}>
              Voltar ao Painel
            </button>
          )}
          <button onClick={() => signOut()} style={{ background: 'none', border: '1.5px solid #fff', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff' }}>Sair</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {/* Sidebar */}
        <aside style={{ width: 220, flexShrink: 0, background: '#fff', borderRight: '1px solid #f0f0f0', minHeight: 'calc(100vh - 56px)', position: 'sticky', top: 56, padding: '20px 14px', boxSizing: 'border-box' }}>
          {/* Cliente info */}
          {cliente && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 16px', borderBottom: '1px solid #f0f0f0', marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: cliente.corPrimaria || '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: cliente.corSecundaria || '#111', flexShrink: 0 }}>
                {cliente.logo ? <img src={cliente.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : cliente.nome?.[0]?.toUpperCase()}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#111' }}>{cliente.nome}</p>
                {cliente.instagram && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888' }}>@{cliente.instagram.replace(/^@/, '')}</p>}
              </div>
            </div>
          )}

          {/* Nav */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_ITEMS.map(item => {
              const href = `${basePath}${item.key}`
              const ativo = subpath === item.key || (item.key === '' && subpath === '')
              return (
                <button key={item.key} onClick={() => router.push(href)} style={{
                  padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  fontWeight: ativo ? 700 : 500, color: ativo ? '#111' : '#888',
                  background: ativo ? '#ffc00f' : 'transparent',
                  fontSize: 14, transition: 'all 0.15s',
                }}>
                  {item.label}
                </button>
              )
            })}
          </nav>

          {/* Minha conta */}
          <div style={{ paddingTop: 16, borderTop: '1px solid #f0f0f0', marginTop: 20 }}>
            <button onClick={() => router.push(`${basePath}/conta`)} style={{
              padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              fontWeight: subpath === '/conta' ? 700 : 500, color: subpath === '/conta' ? '#111' : '#888',
              background: subpath === '/conta' ? '#ffc00f' : 'transparent', fontSize: 13, width: '100%',
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

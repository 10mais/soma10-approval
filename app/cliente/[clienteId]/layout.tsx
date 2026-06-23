'use client'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

const NAV_ITEMS = [
  { key: '', label: 'Inicio', todos: true },
  { key: '/aprovacoes', label: 'Aprovacoes', todos: true },
  { key: '/esteira', label: 'Esteira', todos: true },
  { key: '/planner', label: 'Planner', todos: true },
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
  const ehEquipe = role === 'admin' || role === 'gerente'

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(lista => {
      const c = (Array.isArray(lista) ? lista : []).find((x: any) => x.id === clienteId)
      if (c) setCliente(c)
    }).catch(() => {})
  }, [clienteId])

  const basePath = `/cliente/${clienteId}`
  const subpath = pathname.replace(basePath, '') || ''

  // Extrai cor dominante da imagem de perfil
  const [corExtraida, setCorExtraida] = useState<string | null>(null)
  useEffect(() => {
    if (!cliente?.logo) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 50; canvas.height = 50
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, 50, 50)
        const data = ctx.getImageData(0, 0, 50, 50).data
        let r = 0, g = 0, b = 0, count = 0
        for (let i = 0; i < data.length; i += 16) {
          const pr = data[i], pg = data[i+1], pb = data[i+2], pa = data[i+3]
          if (pa < 128) continue
          // Ignora pixels muito claros (brancos/cinza claro) e muito escuros
          if (pr + pg + pb > 680 || pr + pg + pb < 60) continue
          r += pr; g += pg; b += pb; count++
        }
        if (count > 0) {
          r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count)
          setCorExtraida(`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`)
        }
      } catch {}
    }
    img.src = cliente.logo
  }, [cliente?.logo])

  const corPrimaria = corExtraida || cliente?.corPrimaria || '#111'
  const corSecundaria = cliente?.corSecundaria || '#fff'

  return (
    <div>
      {/* Header personalizado com a cor do cliente */}
      <div style={{ background: corPrimaria, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 100 }}>
        <div onClick={() => router.push(ehEquipe ? '/dashboard' : basePath)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <div style={{ background: '#fff', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {cliente?.logo ? <img src={cliente.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src="/logo.svg" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />}
          </div>
          <span style={{ fontWeight: 800, color: corSecundaria, fontSize: 15 }}>{cliente?.nome || 'Soma10Approval'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => router.push(`${basePath}/conta`)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <span style={{ fontSize: 13, color: corSecundaria, opacity: 0.8 }}>{session?.user?.name}</span>
          </button>
          {ehEquipe && (
            <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: `1px solid ${corSecundaria}40`, borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: corSecundaria, opacity: 0.8 }}>
              Voltar ao Painel
            </button>
          )}
          <button onClick={() => signOut()} style={{ background: 'none', border: `1.5px solid ${corSecundaria}`, borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: corSecundaria }}>Sair</button>
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
            {NAV_ITEMS.filter(item => item.todos || (item.equipe && ehEquipe)).map(item => {
              const href = `${basePath}${item.key}`
              const ativo = subpath === item.key || (item.key === '' && subpath === '')
              return (
                <button key={item.key} onClick={() => router.push(href)} style={{
                  padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  fontWeight: ativo ? 700 : 500, color: ativo ? corSecundaria : '#888',
                  background: ativo ? corPrimaria : 'transparent',
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
              fontWeight: subpath === '/conta' ? 700 : 500, color: subpath === '/conta' ? corSecundaria : '#888',
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

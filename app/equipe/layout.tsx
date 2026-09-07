'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import AvatarPessoa from '@/app/components/AvatarPessoa'

// EQUIPE — a casa de cada colaborador (decisão do dono, 07/09/2026): substitui o
// "Meu dia". Cada pessoa tem um card com atribuições, responsabilidades e o que
// está assinalado para ela. A visão de TODOS os cards é só do admin; os demais
// entram direto no próprio card. Mesmo esqueleto do hub do cliente.

type Pessoa = { email: string; nome: string; cargo?: string; foto?: string; role?: string }

const IC = {
  voltar: 'M19 12H5M12 19l-7-7 7-7',
  sol: 'M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  lua: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  menu: 'M3 6h18M3 12h18M3 18h18',
  equipe: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
}
function Ico({ d, size = 15 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
}


export default function EquipeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()
  const role = (session?.user as any)?.role
  const meuEmail = String((session?.user as any)?.email || '').toLowerCase()
  const ehAdmin = role === 'admin'
  const [pessoas, setPessoas] = useState<Pessoa[]>([])

  const [tema, setTema] = useState<'claro' | 'escuro'>('claro')
  useEffect(() => { try { if (localStorage.getItem('soma10-tema') === 'escuro') setTema('escuro') } catch {} }, [])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema === 'escuro' ? 'dark' : 'light')
    document.body.style.background = tema === 'escuro' ? '#0F0E0A' : '#F5F4EF'
  }, [tema])
  function alternarTema() { setTema(t => { const n = t === 'claro' ? 'escuro' : 'claro'; try { localStorage.setItem('soma10-tema', n) } catch {}; return n }) }

  useEffect(() => {
    if (status !== 'authenticated') return
    if (role === 'cliente') { router.replace('/dashboard'); return }
    fetch('/api/equipe').then(r => r.ok ? r.json() : []).then(d => setPessoas(Array.isArray(d) ? d : [])).catch(() => {})
  }, [status, role, router])

  const [mobile, setMobile] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  // Lista de pessoas RECOLHIDA por padrão (dono, 07/09: "pode permanecer, porém recolhido,
  // com a seta para estender"). Só avatares; a seta expande; a escolha fica no navegador.
  const [recolhida, setRecolhida] = useState(true)
  useEffect(() => { try { if (localStorage.getItem('soma10-equipe-recolhida') === '0') setRecolhida(false) } catch {} }, [])
  function alternarRecolhida() { setRecolhida(v => { const n = !v; try { localStorage.setItem('soma10-equipe-recolhida', n ? '1' : '0') } catch {}; return n }) }
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const apply = () => setMobile(mq.matches)
    apply(); mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  useEffect(() => { setMenuAberto(false) }, [pathname])

  const atualEmail = (() => {
    const m = pathname.match(/^\/equipe\/([^/]+)/)
    if (!m) return ''
    const seg = decodeURIComponent(m[1]).toLowerCase()
    return seg === 'me' ? meuEmail : seg
  })()
  const lista = ehAdmin ? pessoas : pessoas.filter(p => p.email.toLowerCase() === meuEmail)
  const primeiroNome = (session?.user?.name || '').split(' ')[0]

  return (
    <div className="soma10-v2 eq-raiz" data-theme={tema === 'escuro' ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--v2-ground)', color: 'var(--v2-ink)', fontFamily: 'var(--v2-font)' }}>
      <style>{`
        .eq-raiz button, .eq-raiz select, .eq-raiz input, .eq-raiz textarea { font-family: inherit; }
        .eq-nav { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: 0; border-radius: 12px; background: transparent; color: var(--v2-ink2); font-size: 13px; text-align: left; cursor: pointer; transition: background 120ms, color 120ms; }
        .eq-nav:hover { background: var(--v2-surface2); color: var(--v2-ink); }
        .eq-nav.on { background: var(--v2-amber-bg); color: var(--v2-ink); }
        .eq-rotulo { display: block; margin: 14px 10px 6px; font-size: 10.5px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: var(--v2-ink3); }
        .eq-topo-btn { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 999px; border: 1px solid var(--v2-rule); background: var(--v2-surface); color: var(--v2-ink2); font-size: 12.5px; cursor: pointer; }
        .eq-topo-btn:hover { color: var(--v2-ink); border-color: var(--v2-rule2); }
        .eq-card:hover { border-color: var(--v2-rule2); transform: translateY(-1px); }
      `}</style>

      <header style={{ position: 'sticky', top: 0, zIndex: 100, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: mobile ? '0 14px' : '0 22px', background: 'var(--v2-surface)', borderBottom: '1px solid var(--v2-rule)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {mobile && <button className="eq-topo-btn" aria-label="Menu" onClick={() => setMenuAberto(v => !v)} style={{ padding: 8 }}><Ico d={IC.menu} /></button>}
          <button className="eq-topo-btn" onClick={() => router.push('/dashboard')}><Ico d={IC.voltar} size={14} />{!mobile && 'Painel'}</button>
          {ehAdmin && <button className="eq-topo-btn" onClick={() => router.push('/equipe')} style={pathname === '/equipe' ? { color: 'var(--v2-ink)', borderColor: 'var(--v2-amber-on)' } : undefined}><Ico d={IC.equipe} size={14} />{!mobile && 'Equipe'}</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="eq-topo-btn" onClick={alternarTema} title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'} style={{ padding: 8 }}><Ico d={tema === 'escuro' ? IC.sol : IC.lua} /></button>
          {!mobile && <span style={{ fontSize: 13, color: 'var(--v2-ink2)' }}>{primeiroNome}</span>}
          <button className="eq-topo-btn" onClick={() => signOut()}>Sair</button>
        </div>
      </header>


      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {mobile && menuAberto && <div onClick={() => setMenuAberto(false)} style={{ position: 'fixed', inset: 0, top: 56, background: 'rgba(0,0,0,0.45)', zIndex: 150 }} />}
        {(() => { const mini = recolhida && !mobile; return (
        <aside aria-label="Pessoas da equipe" style={mobile
          ? { position: 'fixed', top: 56, left: 0, bottom: 0, width: 268, overflowY: 'auto', zIndex: 200, transform: menuAberto ? 'translateX(0)' : 'translateX(-105%)', transition: 'transform 200ms ease', background: 'var(--v2-surface)', borderRight: '1px solid var(--v2-rule)', padding: 12, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }
          : { position: 'sticky', top: 56, width: mini ? 64 : 248, flexShrink: 0, height: 'calc(100vh - 56px)', overflowY: 'auto', overflowX: 'hidden', background: 'var(--v2-surface)', borderRight: '1px solid var(--v2-rule)', padding: mini ? '12px 8px' : 12, boxSizing: 'border-box', transition: 'width 180ms ease', display: 'flex', flexDirection: 'column' }}>
          {!mini && <span className="eq-rotulo">{ehAdmin ? 'Equipe' : 'Meu perfil'}</span>}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, marginTop: mini ? 4 : 0 }}>
            {lista.map(p => (
              <button key={p.email} className={`eq-nav${atualEmail === p.email.toLowerCase() ? ' on' : ''}`} title={mini ? `${p.nome}${p.cargo ? ` · ${p.cargo}` : ''}` : undefined} onClick={() => router.push(`/equipe/${encodeURIComponent(p.email)}`)} style={mini ? { justifyContent: 'center', padding: '7px 0' } : undefined}>
                <AvatarPessoa p={p} tam={30} />
                {!mini && <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}{p.email.toLowerCase() === meuEmail ? ' (você)' : ''}</span>
                  {p.cargo && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--v2-ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.cargo}</span>}
                </span>}
              </button>
            ))}
            {lista.length === 0 && !mini && <p style={{ margin: '6px 10px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>Carregando…</p>}
          </nav>
          {!mobile && (
            <button onClick={alternarRecolhida} title={recolhida ? 'Expandir a lista' : 'Recolher a lista'} aria-label={recolhida ? 'Expandir a lista' : 'Recolher a lista'} className="eq-topo-btn" style={{ alignSelf: mini ? 'center' : 'flex-end', padding: 8, marginTop: 10, flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: recolhida ? 'none' : 'rotate(180deg)', transition: 'transform 160ms' }}><path d="M9 18l6-6-6-6" /></svg>
            </button>
          )}
        </aside>
        ) })()}
        <main style={{ flex: 1, minWidth: 0, padding: mobile ? '16px 14px 40px' : '26px 32px 48px' }}>{children}</main>
      </div>
    </div>
  )
}

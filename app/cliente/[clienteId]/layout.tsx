'use client'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { temModulo } from '@/lib/modulos'
import AvatarCliente from '@/app/components/AvatarCliente'
import { fecharFora } from '@/lib/fecharModal'

// HUB DO CLIENTE (decisão do dono, 06/09/2026): "clico em um cliente, abre um
// menu e mostra tudo o que está atribuído a ele". Esta é a casa do cliente
// DENTRO da operação da equipe — não é mais um portal com login do cliente
// (isso fica para o multi-tenant). O papel `cliente`, se ainda existir, vê só o
// núcleo antigo (Início, Entregas, Aprovações, Solicitar, Documentos).

type Item = { key: string; label: string; icone: string; badge?: 'aprovacoes'; perm?: string; modulo?: string; soEquipe?: boolean }
type Grupo = { titulo: string; itens: Item[] }

const IC: Record<string, string> = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  playbook: 'M4 6h16M4 12h10M4 18h7',
  tarefas: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  planner: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  studio: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  aprovacoes: 'M20 6 9 17l-5-5',
  entregas: 'M21 8 12 3 3 8l9 5 9-5zM3 8v8l9 5 9-5V8',
  solicitar: 'M12 5v14M5 12h14',
  marca: 'M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z',
  documentos: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  listening: 'M3 12h4l3-8 4 16 3-8h4',
  analytics: 'M3 3v18h18M7 14l4-4 4 4 5-6',
  relatorio: 'M4 4h16v16H4zM8 12v5M12 9v8M16 14v3',
  conta: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  voltar: 'M19 12H5M12 19l-7-7 7-7',
  sol: 'M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  lua: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  menu: 'M3 6h18M3 12h18M3 18h18',
  troca: 'M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4',
}

const GRUPOS_EQUIPE: Grupo[] = [
  { titulo: 'Visão', itens: [
    { key: '', label: 'Início', icone: 'inicio' },
    { key: '/relatorio', label: 'Relatório da semana', icone: 'relatorio' },
  ] },
  { titulo: 'Produção', itens: [
    { key: '/playbook', label: 'Playbook', icone: 'playbook' },
    { key: '/tarefas', label: 'Tarefas', icone: 'tarefas' },
    { key: '/studio', label: 'Studio · pautas', icone: 'studio' },
    { key: '/planner', label: 'Planner · conteúdos', icone: 'planner' },
    { key: '/aprovacoes', label: 'Aprovações', icone: 'aprovacoes', badge: 'aprovacoes' },
    { key: '/entregas', label: 'Entregas', icone: 'entregas' },
  ] },
  { titulo: 'Marca e dados', itens: [
    { key: '/marca', label: 'Marca', icone: 'marca' },
    { key: '/documentos', label: 'Documentos', icone: 'documentos' },
    { key: '/listening', label: 'Social Listening', icone: 'listening' },
    { key: '/analytics', label: 'Analytics', icone: 'analytics' },
  ] },
]

// Núcleo que o papel `cliente` ainda alcança (mesmas permissões de antes).
const GRUPOS_CLIENTE: Grupo[] = [
  { titulo: '', itens: [
    { key: '', label: 'Início', icone: 'inicio' },
    { key: '/entregas', label: 'Entregas', icone: 'entregas', perm: 'entregas' },
    { key: '/aprovacoes', label: 'Aprovações', icone: 'aprovacoes', badge: 'aprovacoes', perm: 'aprovacoes' },
    { key: '/solicitar', label: 'Solicitar conteúdo', icone: 'solicitar', perm: 'solicitar' },
    { key: '/documentos', label: 'Documentos', icone: 'documentos', perm: 'documentos' },
    { key: '/playbook', label: 'Playbook', icone: 'playbook', modulo: 'playbook' },
    { key: '/marca', label: 'Marca', icone: 'marca', modulo: 'marca' },
    { key: '/listening', label: 'Social Listening', icone: 'listening', modulo: 'listening' },
    { key: '/analytics', label: 'Analytics', icone: 'analytics', modulo: 'analytics' },
    { key: '/conta', label: 'Minha conta', icone: 'conta' },
  ] },
]

function Ico({ d, size = 16 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
}

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const clienteId = params.clienteId as string
  const role = (session?.user as any)?.role
  const ehEquipe = role === 'admin' || role === 'gerente'
  const [cliente, setCliente] = useState<any>(null)
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([])

  // Tema: o mesmo do painel (localStorage soma10-tema); os tokens vivem em :root[data-theme].
  const [tema, setTema] = useState<'claro' | 'escuro'>('claro')
  useEffect(() => { try { if (localStorage.getItem('soma10-tema') === 'escuro') setTema('escuro') } catch {} }, [])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema === 'escuro' ? 'dark' : 'light')
    document.body.style.background = tema === 'escuro' ? '#0F0E0A' : '#F5F4EF'
  }, [tema])
  function alternarTema() { setTema(t => { const n = t === 'claro' ? 'escuro' : 'claro'; try { localStorage.setItem('soma10-tema', n) } catch {}; return n }) }

  useEffect(() => {
    fetch(`/api/clientes?id=${clienteId}`).then(r => r.json()).then(d => { if (d && !d.error) setCliente(Array.isArray(d) ? d.find((x: any) => x.id === clienteId) : d) }).catch(() => {})
  }, [clienteId])
  useEffect(() => {
    if (!ehEquipe) return
    fetch('/api/clientes').then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d.filter((c: any) => !c.arquivado).map((c: any) => ({ id: c.id, nome: c.nome })) : [])).catch(() => {})
  }, [ehEquipe])

  const basePath = `/cliente/${clienteId}`
  const subpath = pathname.replace(basePath, '') || ''

  const clientePode = (perm?: string) => !perm || ehEquipe || cliente?.permissoes?.[perm] !== false
  const moduloOk = (m?: string) => !m || ehEquipe || temModulo(cliente?.modulos, m as any)

  // Guard para o papel cliente: páginas só-equipe ou sem permissão voltam ao Início.
  useEffect(() => {
    if (!cliente || ehEquipe || !role) return
    const permitido = GRUPOS_CLIENTE[0].itens.some(i => i.key === subpath && clientePode(i.perm) && moduloOk(i.modulo))
    if (subpath && !permitido) router.replace(basePath)
  }, [cliente, subpath, ehEquipe, role]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pendências de aprovação (selo no menu)
  const [pendentes, setPendentes] = useState(0)
  useEffect(() => {
    fetch(`/api/posts?clienteId=${clienteId}`).then(r => r.json()).then(d => {
      setPendentes(Array.isArray(d) ? d.filter((p: any) => p.etapa === 'aprovacao_copy' || p.etapa === 'aprovacao_criativo').length : 0)
    }).catch(() => {})
  }, [clienteId, subpath])

  const [mobile, setMobile] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const apply = () => setMobile(mq.matches)
    apply(); mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  useEffect(() => { setMenuAberto(false) }, [subpath])
  const irPara = (href: string) => { router.push(href); if (mobile) setMenuAberto(false) }

  // Bloqueio do papel cliente (arquivado / inadimplente) — como antes.
  const bloqueio = cliente && !ehEquipe && role === 'cliente' ? (cliente.arquivado ? 'arquivado' : cliente.inadimplente ? 'inadimplente' : null) : null
  if (bloqueio) {
    const arq = bloqueio === 'arquivado'
    return (
      <div className="soma10-v2" data-theme={tema === 'escuro' ? 'dark' : 'light'} style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--v2-ground)', fontFamily: 'var(--v2-font)' }}>
        <div style={{ maxWidth: 440, width: '100%', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 16, padding: '32px 28px', textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 500, color: 'var(--v2-ink)' }}>{arq ? 'Acesso encerrado' : 'Acesso temporariamente suspenso'}</h1>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--v2-ink2)', lineHeight: 1.6 }}>{arq ? 'O acesso a este portal foi encerrado. Se você acredita que isso é um engano, fale com a nossa equipe.' : 'O acesso está suspenso no momento. Fale com a nossa equipe para regularizar.'}</p>
          <button onClick={() => signOut()} style={{ padding: '10px 22px', background: 'var(--v2-ink)', color: 'var(--v2-ground)', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>Sair</button>
        </div>
      </div>
    )
  }

  const grupos = (ehEquipe ? GRUPOS_EQUIPE : GRUPOS_CLIENTE).map(g => ({ ...g, itens: g.itens.filter(i => clientePode(i.perm) && moduloOk(i.modulo)) }))
  const ativo = (key: string) => key === '' ? subpath === '' : subpath === key || subpath.startsWith(key + '/')
  const primeiroNome = (session?.user?.name || '').split(' ')[0]

  return (
    <div className="soma10-v2 hub-raiz" data-theme={tema === 'escuro' ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--v2-ground)', color: 'var(--v2-ink)', fontFamily: 'var(--v2-font)' }}>
      <style>{`
        .hub-raiz button, .hub-raiz select, .hub-raiz input, .hub-raiz textarea { font-family: inherit; }
        .hub-nav { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 12px; border: 0; border-radius: 10px; background: transparent; color: var(--v2-ink2); font-size: 13.5px; font-weight: 400; text-align: left; cursor: pointer; transition: background 120ms, color 120ms; }
        .hub-nav:hover { background: var(--v2-surface2); color: var(--v2-ink); }
        .hub-nav.on { background: var(--v2-amber-bg); color: var(--v2-amber); font-weight: 500; }
        .hub-nav svg { flex-shrink: 0; opacity: .85; }
        .hub-rotulo { display: block; margin: 16px 12px 6px; font-size: 10.5px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: var(--v2-ink3); }
        .hub-topo-btn { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 999px; border: 1px solid var(--v2-rule); background: var(--v2-surface); color: var(--v2-ink2); font-size: 12.5px; cursor: pointer; }
        .hub-topo-btn:hover { color: var(--v2-ink); border-color: var(--v2-rule2); }
        .hub-troca { appearance: none; -webkit-appearance: none; padding: 7px 30px 7px 12px; border-radius: 999px; border: 1px solid var(--v2-rule); background: var(--v2-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8677' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 11px center; color: var(--v2-ink); font-size: 12.5px; font-weight: 500; cursor: pointer; max-width: 220px; }
        .hub-main { flex: 1; min-width: 0; }
        @media print { .hub-topo, .hub-rail, .hub-fundo { display: none !important; } .hub-main { padding: 0 !important; } }
      `}</style>

      {/* Topo: volta ao painel, troca de cliente, tema, quem está logado */}
      <header className="hub-topo" style={{ position: 'sticky', top: 0, zIndex: 100, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: mobile ? '0 14px' : '0 22px', background: 'var(--v2-surface)', borderBottom: '1px solid var(--v2-rule)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {mobile && <button className="hub-topo-btn" aria-label="Menu" onClick={() => setMenuAberto(v => !v)} style={{ padding: 8 }}><Ico d={IC.menu} /></button>}
          {ehEquipe
            ? <button className="hub-topo-btn" onClick={() => router.push('/dashboard')}><Ico d={IC.voltar} size={14} />{!mobile && 'Painel'}</button>
            : <span style={{ fontWeight: 500, fontSize: 14 }}>Soma10</span>}
          {ehEquipe && clientes.length > 1 && (
            <select className="hub-troca" value={clienteId} onChange={e => router.push(`/cliente/${e.target.value}${subpath}`)} title="Trocar de cliente">
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="hub-topo-btn" onClick={alternarTema} title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'} style={{ padding: 8 }}><Ico d={tema === 'escuro' ? IC.sol : IC.lua} size={15} /></button>
          {!mobile && <span style={{ fontSize: 13, color: 'var(--v2-ink2)' }}>{primeiroNome}</span>}
          <button className="hub-topo-btn" onClick={() => signOut()}>Sair</button>
        </div>
      </header>

      {mobile && menuAberto && <div className="hub-fundo" onClick={fecharFora(() => setMenuAberto(false), { perguntar: false })} style={{ position: 'fixed', inset: 0, top: 56, background: 'rgba(0,0,0,0.45)', zIndex: 150 }} />}

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {/* Trilho do cliente */}
        <aside className="hub-rail" style={mobile
          ? { position: 'fixed', top: 56, left: 0, bottom: 0, width: 268, overflowY: 'auto', zIndex: 200, transform: menuAberto ? 'translateX(0)' : 'translateX(-105%)', transition: 'transform 200ms ease', background: 'var(--v2-surface)', borderRight: '1px solid var(--v2-rule)', padding: '16px 12px', boxSizing: 'border-box' }
          : { position: 'sticky', top: 56, width: 240, flexShrink: 0, height: 'calc(100vh - 56px)', overflowY: 'auto', background: 'var(--v2-surface)', borderRight: '1px solid var(--v2-rule)', padding: '18px 12px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 8px 16px', borderBottom: '1px solid var(--v2-rule)', marginBottom: 6 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', background: 'var(--v2-surface2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <AvatarCliente logo={cliente?.logo} nome={cliente?.nome || '?'} clienteId={clienteId} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: 'var(--v2-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cliente?.nome || 'Carregando…'}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cliente?.instagram ? `@${String(cliente.instagram).replace(/^@/, '')}` : cliente?.segmento || ''}</p>
            </div>
          </div>
          <nav>
            {grupos.map((g, gi) => (
              <div key={gi}>
                {g.titulo && <span className="hub-rotulo">{g.titulo}</span>}
                {g.itens.map(i => (
                  <button key={i.key} className={`hub-nav${ativo(i.key) ? ' on' : ''}`} onClick={() => irPara(`${basePath}${i.key}`)}>
                    <Ico d={IC[i.icone]} />
                    <span style={{ flex: 1 }}>{i.label}</span>
                    {i.badge === 'aprovacoes' && pendentes > 0 && <span style={{ background: 'var(--v2-hot)', color: '#fff', borderRadius: 999, minWidth: 18, height: 18, padding: '0 5px', display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 600 }}>{pendentes}</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <main className="hub-main" style={{ padding: mobile ? '16px 14px 40px' : '26px 32px 48px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

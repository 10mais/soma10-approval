'use client'
import { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { confirmar, toast } from '@/lib/toast'

type No = { id: string; texto: string; x: number; y: number; cor?: string }
type Conexao = { id: string; de: string; para: string }
type MapaMeta = { id: string; titulo: string; atualizadoEm: string; nosQtd?: number }

const CORES = ['#7c3aed', '#1d4ed8', '#0891b2', '#16a34a', '#ea580c', '#dc2626', '#111827']
const LARG = 168, ALT = 60 // dimensões aproximadas do nó (p/ centro das linhas)

export default function MapasMentais() {
  const [mapas, setMapas] = useState<MapaMeta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [abertoId, setAbertoId] = useState<string | null>(null)

  function carregar() {
    setCarregando(true)
    fetch('/api/mapas').then(r => r.json()).then(d => setMapas(Array.isArray(d) ? d : [])).finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  async function novo() {
    const r = await fetch('/api/mapas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: '' }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { carregar(); setAbertoId(r.mapa.id) } else toast('Falha ao criar mapa.', 'erro')
  }
  async function excluir(id: string) {
    if (!(await confirmar('Excluir este mapa mental?', { titulo: 'Excluir mapa', okLabel: 'Excluir', perigo: true }))) return
    await fetch(`/api/mapas?id=${id}`, { method: 'DELETE' }).catch(() => {})
    setMapas(ms => ms.filter(m => m.id !== id))
  }

  if (abertoId) return <Editor id={abertoId} onVoltar={() => { setAbertoId(null); carregar() }} />

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Mapas mentais</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Organize ideias em nós e conexões — brainstorm, estratégia, planejamento.</p>
        </div>
        <button onClick={novo} style={{ padding: '10px 18px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Novo mapa</button>
      </div>
      {carregando ? <p style={{ color: '#aaa' }}>Carregando...</p> : mapas.length === 0 ? (
        <div onClick={novo} style={{ background: '#fff', borderRadius: 14, padding: '50px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, color: '#888' }}>Nenhum mapa ainda.</p>
          <p style={{ margin: 0, fontSize: 12.5, color: '#aaa' }}>Clique para criar o primeiro.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {mapas.map(m => (
            <div key={m.id} onClick={() => setAbertoId(m.id)} style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #eee', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><circle cx="6" cy="18" r="3" /><path d="M9 6h6a3 3 0 0 1 3 3v6M6 9v6" /></svg>
                </span>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titulo?.trim() || 'Sem título'}</p>
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: '#aaa' }}>{m.nosQtd || 0} nó(s) · {new Date(m.atualizadoEm).toLocaleDateString('pt-BR')}</p>
              <button onClick={e => { e.stopPropagation(); excluir(m.id) }} style={{ marginTop: 8, background: 'none', border: 'none', color: '#c00', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Excluir</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Editor({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [nos, setNos] = useState<No[]>([])
  const [conexoes, setConexoes] = useState<Conexao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvo, setSalvo] = useState<'idle' | 'salvando' | 'ok'>('idle')
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const [conectarDe, setConectarDe] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montado = useRef(false)

  useEffect(() => {
    fetch(`/api/mapas?id=${id}`).then(r => r.json()).then(m => {
      if (m && !m.error) { setTitulo(m.titulo || ''); setNos(m.nos || []); setConexoes(m.conexoes || []) }
      setCarregando(false); montado.current = true
    }).catch(() => { setCarregando(false); montado.current = true })
  }, [id])

  // Autosave (debounce)
  useEffect(() => {
    if (!montado.current) return
    setSalvo('salvando')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      fetch('/api/mapas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, titulo, nos, conexoes }) })
        .then(() => { setSalvo('ok'); setTimeout(() => setSalvo('idle'), 1200) }).catch(() => setSalvo('idle'))
    }, 700)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [titulo, nos, conexoes])

  function ponto(e: PointerEvent | React.PointerEvent) {
    const el = canvasRef.current!; const r = el.getBoundingClientRect()
    return { x: (e as any).clientX - r.left + el.scrollLeft, y: (e as any).clientY - r.top + el.scrollTop }
  }
  function iniciarDrag(e: React.PointerEvent, no: No) {
    e.stopPropagation()
    const p = ponto(e)
    setDrag({ id: no.id, dx: p.x - no.x, dy: p.y - no.y })
  }
  useEffect(() => {
    if (!drag) return
    const mm = (e: PointerEvent) => { const p = ponto(e); setNos(ns => ns.map(n => n.id === drag.id ? { ...n, x: Math.max(0, p.x - drag.dx), y: Math.max(0, p.y - drag.dy) } : n)) }
    const mu = () => setDrag(null)
    window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu)
    return () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu) }
  }, [drag])

  const setNo = (nid: string, patch: Partial<No>) => setNos(ns => ns.map(n => n.id === nid ? { ...n, ...patch } : n))
  function addNo(base?: No) {
    const nid = uuid()
    const novo: No = base
      ? { id: nid, texto: 'Novo nó', x: base.x + 210, y: base.y + Math.round(Math.random() * 120 - 60), cor: base.cor }
      : { id: nid, texto: 'Novo nó', x: (canvasRef.current?.scrollLeft || 0) + 120, y: (canvasRef.current?.scrollTop || 0) + 120, cor: CORES[0] }
    setNos(ns => [...ns, novo])
    if (base) setConexoes(cs => [...cs, { id: uuid(), de: base.id, para: nid }])
  }
  function excluirNo(nid: string) {
    setNos(ns => ns.filter(n => n.id !== nid))
    setConexoes(cs => cs.filter(c => c.de !== nid && c.para !== nid))
    if (conectarDe === nid) setConectarDe(null)
  }
  function cicloCor(no: No) { const i = CORES.indexOf(no.cor || CORES[0]); setNo(no.id, { cor: CORES[(i + 1) % CORES.length] }) }
  function clicarLink(no: No) {
    if (!conectarDe) { setConectarDe(no.id); return }
    if (conectarDe === no.id) { setConectarDe(null); return }
    setConexoes(cs => cs.some(c => (c.de === conectarDe && c.para === no.id) || (c.de === no.id && c.para === conectarDe)) ? cs : [...cs, { id: uuid(), de: conectarDe!, para: no.id }])
    setConectarDe(null)
  }
  const centro = (n: No) => ({ x: n.x + LARG / 2, y: n.y + ALT / 2 })

  if (carregando) return <p style={{ color: '#aaa' }}>Carregando mapa...</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={onVoltar} title="Voltar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título do mapa" style={{ flex: 1, minWidth: 160, maxWidth: 380, border: 'none', outline: 'none', fontSize: 17, fontWeight: 800, color: '#111', fontFamily: 'inherit', background: 'transparent' }} />
        {salvo === 'salvando' && <span style={{ fontSize: 11.5, color: '#aaa' }}>salvando…</span>}
        {salvo === 'ok' && <span style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600 }}>salvo</span>}
        <button onClick={() => addNo()} style={{ marginLeft: 'auto', padding: '8px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>+ Nó</button>
      </div>
      {conectarDe && <p style={{ margin: '0 0 8px', fontSize: 12.5, color: '#7c3aed', fontWeight: 700 }}>Modo conexão: clique no ícone de link de outro nó para ligar (ou no mesmo para cancelar).</p>}

      <div ref={canvasRef} style={{ position: 'relative', height: 'calc(100vh - 230px)', minHeight: 420, overflow: 'auto', background: '#fafafa', backgroundImage: 'radial-gradient(#e5e5e5 1px, transparent 1px)', backgroundSize: '22px 22px', border: '1px solid #eee', borderRadius: 14 }}>
        <div style={{ position: 'relative', width: 2400, height: 1600 }}>
          {/* Conexões */}
          <svg width={2400} height={1600} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            {conexoes.map(c => {
              const a = nos.find(n => n.id === c.de), b = nos.find(n => n.id === c.para)
              if (!a || !b) return null
              const p1 = centro(a), p2 = centro(b)
              return (
                <g key={c.id} style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => setConexoes(cs => cs.filter(x => x.id !== c.id))}>
                  <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={14} />
                  <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#c4b5fd" strokeWidth={2.5} />
                </g>
              )
            })}
          </svg>
          {/* Nós */}
          {nos.map(no => {
            const alvo = !!conectarDe && conectarDe !== no.id
            return (
              <div key={no.id} style={{ position: 'absolute', left: no.x, top: no.y, width: LARG, background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.12)', border: `2px solid ${alvo ? '#7c3aed' : (conectarDe === no.id ? '#7c3aed' : '#eee')}`, overflow: 'hidden' }}>
                {/* Cabeçalho = alça de arraste */}
                <div onPointerDown={e => iniciarDrag(e, no)} style={{ height: 22, background: no.cor || CORES[0], cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, padding: '0 4px' }}>
                  <button onPointerDown={e => e.stopPropagation()} onClick={() => cicloCor(no)} title="Cor" style={{ width: 15, height: 15, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.7)', background: 'transparent', cursor: 'pointer', padding: 0 }} />
                  <button onPointerDown={e => e.stopPropagation()} onClick={() => clicarLink(no)} title="Conectar a outro nó" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', padding: 2 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>
                  </button>
                  <button onPointerDown={e => e.stopPropagation()} onClick={() => addNo(no)} title="Adicionar nó ligado" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 15, fontWeight: 800, lineHeight: 1, padding: '0 2px' }}>+</button>
                  <button onPointerDown={e => e.stopPropagation()} onClick={() => excluirNo(no.id)} title="Excluir nó" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
                </div>
                <textarea value={no.texto} onChange={e => setNo(no.id, { texto: e.target.value })} onPointerDown={e => e.stopPropagation()} placeholder="Ideia…"
                  style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', padding: '8px 10px', fontSize: 12.5, lineHeight: 1.35, fontFamily: 'inherit', color: '#222', minHeight: 34, boxSizing: 'border-box', background: 'transparent' }} rows={2} />
              </div>
            )
          })}
        </div>
      </div>
      <p style={{ margin: '8px 2px 0', fontSize: 11.5, color: '#bbb' }}>Arraste pela faixa colorida do topo do nó. Use <b>+</b> para criar um nó ligado, o ícone de link para conectar dois nós, e clique numa linha para removê-la.</p>
    </div>
  )
}

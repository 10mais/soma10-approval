'use client'
import { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { confirmar, toast } from '@/lib/toast'

type No = { id: string; texto: string; x: number; y: number; cor?: string }
type Conexao = { id: string; de: string; para: string }
type MapaMeta = { id: string; titulo: string; atualizadoEm: string; nosQtd?: number }

const CORES = ['#7c3aed', '#1d4ed8', '#0891b2', '#16a34a', '#ea580c', '#dc2626', '#111827']
const LARG = 170, ALT = 46 // largura fixa do nó e altura aproximada (p/ centro das conexões)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

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
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selId, setSelId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [conectarDe, setConectarDe] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<null | { tipo: 'no' | 'pan'; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean }>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montado = useRef(false)

  useEffect(() => {
    fetch(`/api/mapas?id=${id}`).then(r => r.json()).then(m => {
      if (m && !m.error) { setTitulo(m.titulo || ''); setNos(m.nos || []); setConexoes(m.conexoes || []) }
      setCarregando(false); montado.current = true
    }).catch(() => { setCarregando(false); montado.current = true })
  }, [id])

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

  const setNo = (nid: string, patch: Partial<No>) => setNos(ns => ns.map(n => n.id === nid ? { ...n, ...patch } : n))
  function criarConexao(de: string, para: string) {
    setConexoes(cs => cs.some(c => (c.de === de && c.para === para) || (c.de === para && c.para === de)) ? cs : [...cs, { id: uuid(), de, para }])
  }

  // Arraste de nó / pan do fundo (via window para não perder o ponteiro)
  useEffect(() => {
    const mm = (e: PointerEvent) => {
      const d = dragRef.current; if (!d) return
      const ddx = e.clientX - d.sx, ddy = e.clientY - d.sy
      if (Math.abs(ddx) + Math.abs(ddy) > 4) d.moved = true
      if (d.tipo === 'pan') setPan({ x: d.ox + ddx, y: d.oy + ddy })
      else setNos(ns => ns.map(n => n.id === d.id ? { ...n, x: d.ox + ddx / zoom, y: d.oy + ddy / zoom } : n))
    }
    const mu = () => {
      const d = dragRef.current
      if (d && !d.moved) {
        if (d.tipo === 'no') {
          if (conectarDe && conectarDe !== d.id) { criarConexao(conectarDe, d.id!); setConectarDe(null) }
          else { setSelId(d.id!); setEditId(null) }
        } else { setSelId(null); setEditId(null); setConectarDe(null) }
      }
      dragRef.current = null
    }
    window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu)
    return () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu) }
  }, [zoom, conectarDe])

  // Zoom por scroll (listener nativo não-passivo, centrado no cursor)
  useEffect(() => {
    const el = canvasRef.current; if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const cx = e.clientX - r.left, cy = e.clientY - r.top
      const novo = clamp(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.35, 2)
      const px = (cx - pan.x) / zoom, py = (cy - pan.y) / zoom
      setPan({ x: cx - px * novo, y: cy - py * novo }); setZoom(novo)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, pan])
  function zoomBotao(fator: number) {
    const r = canvasRef.current!.getBoundingClientRect()
    const cx = r.width / 2, cy = r.height / 2
    const novo = clamp(zoom * fator, 0.35, 2)
    const px = (cx - pan.x) / zoom, py = (cy - pan.y) / zoom
    setPan({ x: cx - px * novo, y: cy - py * novo }); setZoom(novo)
  }

  function addNo(base?: No) {
    const nid = uuid()
    const novo: No = base
      ? { id: nid, texto: '', x: base.x + 210, y: base.y + Math.round(Math.random() * 100 - 50), cor: base.cor }
      : { id: nid, texto: '', x: (-pan.x + 150) / zoom, y: (-pan.y + 150) / zoom, cor: CORES[0] }
    setNos(ns => [...ns, novo]); if (base) criarConexao(base.id, nid)
    setSelId(nid); setEditId(nid)
  }
  function excluirNo(nid: string) {
    setNos(ns => ns.filter(n => n.id !== nid))
    setConexoes(cs => cs.filter(c => c.de !== nid && c.para !== nid))
    if (selId === nid) setSelId(null); if (editId === nid) setEditId(null); if (conectarDe === nid) setConectarDe(null)
  }
  function cicloCor(no: No) { const i = CORES.indexOf(no.cor || CORES[0]); setNo(no.id, { cor: CORES[(i + 1) % CORES.length] }) }
  const centro = (n: No) => ({ x: n.x + LARG / 2, y: n.y + ALT / 2 })

  if (carregando) return <p style={{ color: '#aaa' }}>Carregando mapa...</p>

  const sel = nos.find(n => n.id === selId)
  const TBtn = ({ title, onClick, children, cor }: any) => (
    <button onPointerDown={e => e.stopPropagation()} onClick={onClick} title={title} style={{ width: 30, height: 30, border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer', color: cor || '#444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</button>
  )

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

      <div ref={canvasRef}
        onPointerDown={e => { dragRef.current = { tipo: 'pan', sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y, moved: false } }}
        style={{ position: 'relative', height: 'calc(100vh - 220px)', minHeight: 440, overflow: 'hidden', background: '#fbfbfc', backgroundImage: 'radial-gradient(#e7e7ea 1px, transparent 1px)', backgroundSize: `${22 * zoom}px ${22 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px`, border: '1px solid #eee', borderRadius: 14, cursor: dragRef.current?.tipo === 'pan' ? 'grabbing' : 'default', touchAction: 'none' }}>

        <div style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {/* Conexões (curvas) */}
          <svg width={4000} height={3000} style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
            {conexoes.map(c => {
              const a = nos.find(n => n.id === c.de), b = nos.find(n => n.id === c.para)
              if (!a || !b) return null
              const p1 = centro(a), p2 = centro(b), dx = Math.abs(p2.x - p1.x) / 2 + 20
              const path = `M ${p1.x} ${p1.y} C ${p1.x + (p2.x > p1.x ? dx : -dx)} ${p1.y}, ${p2.x + (p2.x > p1.x ? -dx : dx)} ${p2.y}, ${p2.x} ${p2.y}`
              return (
                <g key={c.id} style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={() => setConexoes(cs => cs.filter(x => x.id !== c.id))}>
                  <path d={path} stroke="transparent" strokeWidth={14} fill="none" />
                  <path d={path} stroke={a.cor || '#c4b5fd'} strokeWidth={2.5} fill="none" opacity={0.8} />
                </g>
              )
            })}
          </svg>
          {/* Nós (pill minimalista) */}
          {nos.map(no => {
            const selecionado = selId === no.id
            const alvo = !!conectarDe && conectarDe !== no.id
            const editando = editId === no.id
            return (
              <div key={no.id} onPointerDown={e => { e.stopPropagation(); if (!editando) dragRef.current = { tipo: 'no', id: no.id, sx: e.clientX, sy: e.clientY, ox: no.x, oy: no.y, moved: false } }}
                onDoubleClick={() => { setSelId(no.id); setEditId(no.id) }}
                style={{ position: 'absolute', left: no.x, top: no.y, width: LARG, minHeight: ALT, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 22, padding: '8px 14px', boxShadow: selecionado ? '0 0 0 2px #3b82f6, 0 4px 14px rgba(0,0,0,0.10)' : '0 2px 8px rgba(0,0,0,0.08)', border: alvo ? '2px dashed #7c3aed' : '1px solid #ececf0', cursor: editando ? 'text' : 'grab' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: no.cor || CORES[0], flexShrink: 0 }} />
                {editando
                  ? <textarea value={no.texto} autoFocus onChange={e => setNo(no.id, { texto: e.target.value })} onPointerDown={e => e.stopPropagation()} onBlur={() => setEditId(null)} placeholder="Ideia…"
                      style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: 12.5, lineHeight: 1.35, fontFamily: 'inherit', color: '#222', background: 'transparent', minHeight: 30 }} rows={2} />
                  : <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.35, color: no.texto ? '#222' : '#bbb', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{no.texto || 'Ideia…'}</span>}
              </div>
            )
          })}
        </div>

        {/* Barra flutuante do nó selecionado (coordenadas de tela) */}
        {sel && !editId && (
          <div style={{ position: 'absolute', left: clamp(pan.x + sel.x * zoom, 6, (canvasRef.current?.clientWidth || 600) - 210), top: Math.max(6, pan.y + sel.y * zoom - 46), zIndex: 5, display: 'flex', alignItems: 'center', gap: 2, background: '#fff', borderRadius: 12, boxShadow: '0 6px 22px rgba(0,0,0,0.16)', border: '1px solid #eee', padding: 4 }}>
            <TBtn title="Editar texto" onClick={() => setEditId(sel.id)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
            </TBtn>
            <TBtn title="Cor" onClick={() => cicloCor(sel)}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: sel.cor || CORES[0], border: '2px solid #fff', boxShadow: '0 0 0 1px #ddd' }} />
            </TBtn>
            <TBtn title="Adicionar nó ligado" onClick={() => addNo(sel)}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </TBtn>
            <TBtn title={conectarDe === sel.id ? 'Clique em outro nó (ou aqui p/ cancelar)' : 'Conectar a outro nó'} cor={conectarDe === sel.id ? '#7c3aed' : '#444'} onClick={() => setConectarDe(conectarDe === sel.id ? null : sel.id)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>
            </TBtn>
            <div style={{ width: 1, height: 18, background: '#eee', margin: '0 2px' }} />
            <TBtn title="Excluir nó" cor="#dc2626" onClick={() => excluirNo(sel.id)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /></svg>
            </TBtn>
          </div>
        )}

        {/* Controles de zoom */}
        <div style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 5, display: 'flex', flexDirection: 'column', gap: 4, background: '#fff', borderRadius: 10, boxShadow: '0 4px 14px rgba(0,0,0,0.12)', border: '1px solid #eee', padding: 4 }}>
          <button onClick={() => zoomBotao(1.2)} title="Aproximar" style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: '#444', borderRadius: 7 }}>+</button>
          <span style={{ textAlign: 'center', fontSize: 10.5, color: '#999', fontWeight: 700 }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => zoomBotao(1 / 1.2)} title="Afastar" style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, color: '#444', borderRadius: 7 }}>−</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} title="Redefinir zoom" style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', color: '#888', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
          </button>
        </div>
      </div>
      <p style={{ margin: '8px 2px 0', fontSize: 11.5, color: '#bbb' }}>Arraste os nós livremente · role para zoom · arraste o fundo para mover · duplo-clique edita o texto · clique num nó para a barra de ações.</p>
    </div>
  )
}

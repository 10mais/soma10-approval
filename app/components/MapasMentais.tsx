'use client'
import { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { confirmar, toast } from '@/lib/toast'

type No = { id: string; texto: string; x: number; y: number; cor?: string }
type Conexao = { id: string; de: string; para: string }
type MapaMeta = { id: string; titulo: string; atualizadoEm: string; nosQtd?: number }

const CORES = ['#ffc00f', '#7c3aed', '#1d4ed8', '#0891b2', '#16a34a', '#ea580c', '#dc2626']
const LARG = 170, ALT = 46 // largura fixa do nó e altura aproximada (p/ centro das conexões)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export default function MapasMentais() {
  const [mapas, setMapas] = useState<MapaMeta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [novoModal, setNovoModal] = useState(false)
  const [modoIA, setModoIA] = useState(false)
  const [tema, setTema] = useState('')
  const [gerando, setGerando] = useState(false)

  function carregar() {
    setCarregando(true)
    fetch('/api/mapas').then(r => r.json()).then(d => setMapas(Array.isArray(d) ? d : [])).finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  async function criarDoZero() {
    const r = await fetch('/api/mapas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: '' }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { setNovoModal(false); carregar(); setAbertoId(r.mapa.id) } else toast('Falha ao criar mapa.', 'erro')
  }
  async function gerarIA() {
    if (!tema.trim() || gerando) return
    setGerando(true)
    const r = await fetch('/api/mapas/gerar-ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tema: tema.trim() }) }).then(x => x.json()).catch(() => null)
    setGerando(false)
    if (r?.ok) { setNovoModal(false); setModoIA(false); setTema(''); carregar(); setAbertoId(r.id) } else toast(r?.error || 'Falha ao gerar com IA.', 'erro')
  }
  function abrirNovo() { setModoIA(false); setTema(''); setNovoModal(true) }
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
        <button onClick={abrirNovo} style={{ padding: '10px 18px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Novo mapa</button>
      </div>
      {carregando ? <p style={{ color: '#aaa' }}>Carregando...</p> : mapas.length === 0 ? (
        <div onClick={abrirNovo} style={{ background: '#fff', borderRadius: 14, padding: '50px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
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

      {novoModal && (
        <div onClick={() => !gerando && setNovoModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', padding: 22 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>Novo mapa mental</h3>
            {!modoIA ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={criarDoZero} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '14px 16px', background: '#fafafa', border: '1.5px solid #eee', borderRadius: 12, cursor: 'pointer' }}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: '#f0f0f0', color: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span>
                  <span><span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#111' }}>Começar do zero</span><span style={{ display: 'block', fontSize: 12, color: '#999' }}>Um mapa em branco com o nó central</span></span>
                </button>
                <button onClick={() => setModoIA(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '14px 16px', background: '#faf5ff', border: '1.5px solid #e9d5ff', borderRadius: 12, cursor: 'pointer' }}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" /></svg></span>
                  <span><span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#111' }}>Gerar com IA</span><span style={{ display: 'block', fontSize: 12, color: '#999' }}>Descreva um tema e a IA monta o mapa</span></span>
                </button>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>Sobre o que é o mapa?</label>
                <textarea value={tema} onChange={e => setTema(e.target.value)} autoFocus placeholder="Ex.: Estrutura organizacional da Clínica Norah · Plano de marketing 2026 · Onboarding de novo cliente…"
                  style={{ width: '100%', minHeight: 90, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#bbb' }}>A IA cria os ramos e subtópicos. Você ajusta tudo depois.</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={gerarIA} disabled={!tema.trim() || gerando} style={{ flex: 1, padding: '11px 0', background: tema.trim() ? 'var(--marca, #ffc00f)' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: tema.trim() && !gerando ? 'pointer' : 'not-allowed' }}>{gerando ? 'Gerando…' : 'Gerar mapa'}</button>
                  <button onClick={() => setModoIA(false)} disabled={gerando} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Voltar</button>
                </div>
              </div>
            )}
          </div>
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
  const [layout, setLayout] = useState<'mapa' | 'organograma' | 'lista'>('mapa')
  const [selId, setSelId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [conectarDe, setConectarDe] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<null | { tipo: 'no' | 'pan'; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean; orig?: Record<string, { x: number; y: number }> }>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montado = useRef(false)

  useEffect(() => {
    fetch(`/api/mapas?id=${id}`).then(r => r.json()).then(m => {
      if (m && !m.error) { setTitulo(m.titulo || ''); setNos(m.nos || []); setConexoes(m.conexoes || []); setLayout(m.layout || 'mapa') }
      setCarregando(false); montado.current = true
    }).catch(() => { setCarregando(false); montado.current = true })
  }, [id])

  useEffect(() => {
    if (!montado.current) return
    setSalvo('salvando')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      fetch('/api/mapas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, titulo, nos, conexoes, layout }) })
        .then(() => { setSalvo('ok'); setTimeout(() => setSalvo('idle'), 1200) }).catch(() => setSalvo('idle'))
    }, 700)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [titulo, nos, conexoes, layout])

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
      else setNos(ns => ns.map(n => d.orig && d.orig[n.id] ? { ...n, x: d.orig[n.id].x + ddx / zoom, y: d.orig[n.id].y + ddy / zoom } : n))
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

  // Atalhos: ENTER = irmão · TAB = filho (nó selecionado, fora de campos de texto)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selId || editId) return
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      const no = nos.find(n => n.id === selId); if (!no) return
      if (e.key === 'Enter') { e.preventDefault(); criarIrmao(no) }
      else if (e.key === 'Tab') { e.preventDefault(); criarFilho(no) }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); excluirNo(no.id) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selId, editId, nos, conexoes])
  function zoomBotao(fator: number) {
    const r = canvasRef.current!.getBoundingClientRect()
    const cx = r.width / 2, cy = r.height / 2
    const novo = clamp(zoom * fator, 0.35, 2)
    const px = (cx - pan.x) / zoom, py = (cy - pan.y) / zoom
    setPan({ x: cx - px * novo, y: cy - py * novo }); setZoom(novo)
  }

  function addNo(base?: No) {
    // Sem base: liga na RAIZ (mantém uma única ideia central — nunca cria nó solto)
    const pai = base || nos.find(n => !conexoes.some(c => c.para === n.id))
    const nid = uuid()
    const novo: No = pai
      ? { id: nid, texto: '', x: pai.x + 210, y: pai.y + Math.round(Math.random() * 100 - 50), cor: pai.cor || CORES[0] }
      : { id: nid, texto: '', x: (-pan.x + 150) / zoom, y: (-pan.y + 150) / zoom, cor: undefined }
    setNos(ns => [...ns, novo]); if (pai) criarConexao(pai.id, nid)
    setSelId(nid); setEditId(nid)
  }
  // TAB = filho (nó ligado a partir do selecionado)
  const criarFilho = (no: No) => addNo(no)
  // ENTER = irmão (nó ligado ao MESMO pai do selecionado)
  function criarIrmao(no: No) {
    const conPai = conexoes.find(c => c.para === no.id)
    if (!conPai) { toast('O nó raiz é o ponto de partida — use Tab para criar ramos.', 'info'); return }
    const nid = uuid()
    setNos(ns => [...ns, { id: nid, texto: '', x: no.x, y: no.y + ALT + 24, cor: no.cor }])
    criarConexao(conPai.de, nid)
    setSelId(nid); setEditId(nid)
  }
  async function excluirNo(nid: string) {
    // Raiz é o ponto de partida — não pode ser excluída (evita ficar sem/2 centros)
    if (!conexoes.some(c => c.para === nid)) { toast('O nó raiz não pode ser excluído — é o ponto de partida do mapa.', 'info'); return }
    // Coleta a sub-árvore (o nó + todos os descendentes) — apagar não deixa órfãos
    const remover = new Set<string>([nid]); const fila = [nid]
    while (fila.length) { const cur = fila.shift()!; for (const c of conexoes) if (c.de === cur && !remover.has(c.para)) { remover.add(c.para); fila.push(c.para) } }
    if (remover.size > 1 && !(await confirmar(`Excluir este nó e seus ${remover.size - 1} sub-nó(s)? Toda a ramificação será removida.`, { titulo: 'Excluir nó', okLabel: 'Excluir', perigo: true }))) return
    setNos(ns => ns.filter(n => !remover.has(n.id)))
    setConexoes(cs => cs.filter(c => !remover.has(c.de) && !remover.has(c.para)))
    if (selId && remover.has(selId)) setSelId(null)
    if (editId && remover.has(editId)) setEditId(null)
    if (conectarDe && remover.has(conectarDe)) setConectarDe(null)
  }
  function cicloCor(no: No) { const i = CORES.indexOf(no.cor || CORES[0]); setNo(no.id, { cor: CORES[(i + 1) % CORES.length] }) }
  const centro = (n: No) => ({ x: n.x + LARG / 2, y: n.y + ALT / 2 })
  const temPai = (nid: string) => conexoes.some(c => c.para === nid)

  // Reposiciona os nós conforme o layout escolhido (Mapa mental mantém as posições livres)
  function aplicarLayout(tipo: 'mapa' | 'organograma' | 'lista') {
    setLayout(tipo)
    if (tipo === 'mapa') return
    const filhos: Record<string, string[]> = {}
    for (const c of conexoes) (filhos[c.de] ||= []).push(c.para)
    const raizes = nos.filter(n => !temPai(n.id)).map(n => n.id)
    const pos: Record<string, { x: number; y: number }> = {}
    const visto = new Set<string>()
    if (tipo === 'organograma') {
      const NW = 190, NH = 110; let cursor = 0
      const tree = (idn: string, depth: number): number => {
        if (visto.has(idn)) return cursor; visto.add(idn)
        const ch = (filhos[idn] || []).filter(c => !visto.has(c))
        if (!ch.length) { const x = cursor; cursor += NW; pos[idn] = { x, y: depth * NH }; return x }
        const xs = ch.map(c => tree(c, depth + 1))
        const x = (xs[0] + xs[xs.length - 1]) / 2; pos[idn] = { x, y: depth * NH }; return x
      }
      raizes.forEach((r, i) => { if (i) cursor += NW; tree(r, 0) })
    } else {
      const INDENT = 46, ROW = 54; let row = 0
      const walk = (idn: string, depth: number) => {
        if (visto.has(idn)) return; visto.add(idn)
        pos[idn] = { x: depth * INDENT, y: row * ROW }; row++
        for (const c of (filhos[idn] || [])) walk(c, depth + 1)
      }
      raizes.forEach(r => walk(r, 0))
    }
    setNos(ns => ns.map(n => pos[n.id] ? { ...n, x: pos[n.id].x + 90, y: pos[n.id].y + 70 } : n))
    setPan({ x: 0, y: 0 }); setZoom(1); setSelId(null); setEditId(null)
  }

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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 3, background: '#f0f0f0', borderRadius: 9, padding: 3 }}>
          {([['mapa', 'Mapa mental'], ['organograma', 'Organograma'], ['lista', 'Lista']] as const).map(([k, l]) => (
            <button key={k} onClick={() => aplicarLayout(k)} title={k === 'mapa' ? 'Posições livres' : 'Reorganiza automaticamente'} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: layout === k ? '#fff' : 'transparent', color: layout === k ? '#111' : '#888', boxShadow: layout === k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{l}</button>
          ))}
        </div>
        <button onClick={() => addNo()} style={{ padding: '8px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>+ Nó</button>
      </div>

      <div ref={canvasRef}
        onPointerDown={e => { dragRef.current = { tipo: 'pan', sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y, moved: false } }}
        style={{ position: 'relative', height: 'calc(100vh - 220px)', minHeight: 440, overflow: 'hidden', background: '#fbfbfc', backgroundImage: 'radial-gradient(#e7e7ea 1px, transparent 1px)', backgroundSize: `${22 * zoom}px ${22 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px`, border: '1px solid #eee', borderRadius: 14, cursor: dragRef.current?.tipo === 'pan' ? 'grabbing' : 'default', touchAction: 'none' }}>

        <div style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {/* Conexões (curvas) */}
          <svg width={4000} height={3000} style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
            {layout !== 'lista' && conexoes.map(c => {
              const a = nos.find(n => n.id === c.de), b = nos.find(n => n.id === c.para)
              if (!a || !b) return null
              let path: string
              if (layout === 'organograma') {
                const p1 = { x: a.x + LARG / 2, y: a.y + ALT }, p2 = { x: b.x + LARG / 2, y: b.y }
                const midY = (p1.y + p2.y) / 2
                path = `M ${p1.x} ${p1.y} L ${p1.x} ${midY} L ${p2.x} ${midY} L ${p2.x} ${p2.y}`
              } else {
                const p1 = centro(a), p2 = centro(b), dx = Math.abs(p2.x - p1.x) / 2 + 20
                path = `M ${p1.x} ${p1.y} C ${p1.x + (p2.x > p1.x ? dx : -dx)} ${p1.y}, ${p2.x + (p2.x > p1.x ? -dx : dx)} ${p2.y}, ${p2.x} ${p2.y}`
              }
              return (
                <g key={c.id} style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={() => setConexoes(cs => cs.filter(x => x.id !== c.id))}>
                  <path d={path} stroke="transparent" strokeWidth={14} fill="none" />
                  <path d={path} stroke="#ffc00f" strokeWidth={2.75} fill="none" strokeLinecap="round" />
                </g>
              )
            })}
          </svg>
          {/* Nós (pill minimalista) */}
          {nos.map(no => {
            const selecionado = selId === no.id
            const alvo = !!conectarDe && conectarDe !== no.id
            const editando = editId === no.id
            const raiz = !temPai(no.id)
            return (
              <div key={no.id} onPointerDown={e => {
                  e.stopPropagation()
                  if (editando) return
                  // Move o nó + toda a sua sub-árvore (nós subsequentes) juntos
                  const sub = new Set<string>([no.id]); const fila = [no.id]
                  while (fila.length) { const cur = fila.shift()!; for (const c of conexoes) if (c.de === cur && !sub.has(c.para)) { sub.add(c.para); fila.push(c.para) } }
                  const orig: Record<string, { x: number; y: number }> = {}
                  nos.forEach(n => { if (sub.has(n.id)) orig[n.id] = { x: n.x, y: n.y } })
                  dragRef.current = { tipo: 'no', id: no.id, sx: e.clientX, sy: e.clientY, ox: no.x, oy: no.y, moved: false, orig }
                }}
                onDoubleClick={() => { setSelId(no.id); setEditId(no.id) }}
                style={{ position: 'absolute', left: no.x, top: no.y, width: raiz ? LARG + 22 : LARG, minHeight: ALT, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8, background: raiz ? '#1f2937' : '#fff', borderRadius: 22, padding: raiz ? '11px 18px' : '8px 14px', boxShadow: selecionado ? '0 0 0 2px #3b82f6, 0 6px 16px rgba(0,0,0,0.14)' : (raiz ? '0 5px 18px rgba(0,0,0,0.20)' : '0 2px 8px rgba(0,0,0,0.08)'), border: alvo ? '2px dashed #7c3aed' : (raiz ? 'none' : '1px solid #ececf0'), cursor: editando ? 'text' : 'grab' }}>
                {!raiz && <span style={{ width: 10, height: 10, borderRadius: '50%', background: no.cor || CORES[0], flexShrink: 0 }} />}
                {editando
                  ? <textarea value={no.texto} autoFocus onChange={e => setNo(no.id, { texto: e.target.value })} onPointerDown={e => e.stopPropagation()} onBlur={() => setEditId(null)} placeholder="Ideia…"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setEditId(null); criarIrmao(no) }
                        else if (e.key === 'Tab') { e.preventDefault(); setEditId(null); criarFilho(no) }
                      }}
                      style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: raiz ? 13.5 : 12.5, fontWeight: raiz ? 800 : 400, lineHeight: 1.35, fontFamily: 'inherit', color: raiz ? '#fff' : '#222', background: 'transparent', minHeight: 30 }} rows={2} />
                  : <span style={{ flex: 1, fontSize: raiz ? 13.5 : 12.5, fontWeight: raiz ? 800 : 400, lineHeight: 1.35, color: raiz ? '#fff' : (no.texto ? '#222' : '#bbb'), wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{no.texto || (raiz ? 'Ideia central' : 'Ideia…')}</span>}
                {selecionado && !editando && (
                  <button onPointerDown={e => e.stopPropagation()} onClick={() => addNo(no)} title="Adicionar nó filho"
                    style={{ position: 'absolute', right: -13, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: '50%', background: '#fff', border: '1.5px solid #d0d0d5', color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 5px rgba(0,0,0,0.14)', padding: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                )}
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
            {temPai(sel.id) && <>
              <div style={{ width: 1, height: 18, background: '#eee', margin: '0 2px' }} />
              <TBtn title="Excluir nó" cor="#dc2626" onClick={() => excluirNo(sel.id)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /></svg>
              </TBtn>
            </>}
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
      <p style={{ margin: '8px 2px 0', fontSize: 11.5, color: '#bbb' }}>Arraste os nós · role para zoom · arraste o fundo para mover · duplo-clique edita · <b style={{ color: '#999' }}>Enter</b> cria um irmão, <b style={{ color: '#999' }}>Tab</b> cria um filho, <b style={{ color: '#999' }}>Delete</b> apaga o nó e sua ramificação.</p>
    </div>
  )
}

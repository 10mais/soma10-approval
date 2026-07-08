'use client'
import { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { confirmar, toast } from '@/lib/toast'
import AvatarCliente from './AvatarCliente'

type No = { id: string; texto: string; x: number; y: number; cor?: string; colapsado?: boolean }
type Conexao = { id: string; de: string; para: string }
type ClienteLite = { id: string; nome: string; logo?: string }
type MapaMeta = { id: string; titulo: string; atualizadoEm: string; nosQtd?: number; clienteId?: string; clienteNome?: string }

const CORES = ['#ffc00f', '#7c3aed', '#1d4ed8', '#0891b2', '#16a34a', '#ea580c', '#dc2626']
const COR_LIGACAO = '#ffc00f' // cor padrão das ligações (amarelo da marca)
const LARG = 170, ALT = 46 // largura fixa do nó e altura aproximada (p/ centro das conexões)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export default function MapasMentais({ clientes = [] }: { clientes?: ClienteLite[] }) {
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

  if (abertoId) return <Editor id={abertoId} clientes={clientes} onVoltar={() => { setAbertoId(null); carregar() }} />

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
          {mapas.map(m => {
            const cli = m.clienteId ? clientes.find(c => c.id === m.clienteId) : null
            return (
            <div key={m.id} onClick={() => setAbertoId(m.id)} style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #eee', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><circle cx="6" cy="18" r="3" /><path d="M9 6h6a3 3 0 0 1 3 3v6M6 9v6" /></svg>
                </span>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titulo?.trim() || 'Sem título'}</p>
              </div>
              {(cli || m.clienteNome) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#888' }}>
                    <AvatarCliente logo={cli?.logo} nome={cli?.nome || m.clienteNome} clienteId={m.clienteId} />
                  </span>
                  <span style={{ fontSize: 11.5, color: '#7c3aed', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cli?.nome || m.clienteNome}</span>
                </div>
              )}
              <p style={{ margin: 0, fontSize: 11.5, color: '#aaa' }}>{m.nosQtd || 0} nó(s) · {new Date(m.atualizadoEm).toLocaleDateString('pt-BR')}</p>
              <button onClick={e => { e.stopPropagation(); excluir(m.id) }} style={{ marginTop: 8, background: 'none', border: 'none', color: '#c00', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Excluir</button>
            </div>
          )})}
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

function Editor({ id, clientes = [], onVoltar }: { id: string; clientes?: ClienteLite[]; onVoltar: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [nos, setNos] = useState<No[]>([])
  const [conexoes, setConexoes] = useState<Conexao[]>([])
  const [clienteId, setClienteId] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvo, setSalvo] = useState<'idle' | 'salvando' | 'ok'>('idle')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [layout, setLayout] = useState<'mapa' | 'organograma' | 'lista'>('mapa')
  const [autoArrumar, setAutoArrumar] = useState(true) // LIGADO por padrão: o mapa se arruma sozinho e nunca sobrepõe nós
  const [reflowTick, setReflowTick] = useState(0)
  const [selId, setSelId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [conectarDe, setConectarDe] = useState<string | null>(null)
  const alturas = useRef<Record<string, number>>({}) // altura REAL (medida) de cada nó — layout sem sobreposição
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<null | { tipo: 'no' | 'pan'; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean; orig?: Record<string, { x: number; y: number }> }>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montado = useRef(false)

  useEffect(() => {
    fetch(`/api/mapas?id=${id}`).then(r => r.json()).then(m => {
      if (m && !m.error) { setTitulo(m.titulo || ''); setNos(m.nos || []); setConexoes(m.conexoes || []); setLayout(m.layout || 'mapa'); setClienteId(m.clienteId || '') }
      setCarregando(false); montado.current = true
    }).catch(() => { setCarregando(false); montado.current = true })
  }, [id])

  useEffect(() => {
    if (!montado.current) return
    setSalvo('salvando')
    if (timer.current) clearTimeout(timer.current)
    const nome = clienteId ? (clientes.find(c => c.id === clienteId)?.nome || '') : ''
    timer.current = setTimeout(() => {
      fetch('/api/mapas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, titulo, nos, conexoes, layout, clienteId: clienteId || '', clienteNome: nome }) })
        .then(() => { setSalvo('ok'); setTimeout(() => setSalvo('idle'), 1200) }).catch(() => setSalvo('idle'))
    }, 700)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [titulo, nos, conexoes, layout, clienteId])

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

  // Auto-organizar: reflui as posições quando muda a estrutura (adiciona/remove nó
  // ou ramifica) ou quando o usuário liga o modo. Não dispara ao arrastar (o
  // comprimento não muda) nem ao editar texto — só na estrutura.
  useEffect(() => {
    if (!autoArrumar || !montado.current) return
    const pos = computarPosicoes(layout, nos, conexoes)
    ancorarNaRaiz(pos) // enquadramento fixo no nó principal
    setNos(ns => {
      let mudou = false
      const novo = ns.map(n => { const p = pos[n.id]; if (p && (Math.abs(p.x - n.x) > 0.5 || Math.abs(p.y - n.y) > 0.5)) { mudou = true; return { ...n, x: p.x, y: p.y } } return n })
      return mudou ? novo : ns
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nos.length, conexoes.length, autoArrumar, layout, reflowTick])

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
  function alternarColapso(no: No) { setNo(no.id, { colapsado: !no.colapsado }); setReflowTick(t => t + 1) }
  const centro = (n: No) => ({ x: n.x + LARG / 2, y: n.y + ALT / 2 })
  const temPai = (nid: string) => conexoes.some(c => c.para === nid)
  // Não deixa nó VAZIO: ao terminar a edição (Enter/blur) sem texto, remove o nó
  // (se for recém-criado — sem filhos e não-raiz). Depois reajusta o mapa.
  function finalizarNo(no: No) {
    setEditId(null)
    const vazio = !(no.texto || '').trim()
    const temFilhoNo = conexoes.some(c => c.de === no.id)
    if (vazio && !temFilhoNo && temPai(no.id)) {
      setNos(ns => ns.filter(n => n.id !== no.id))
      setConexoes(cs => cs.filter(c => c.de !== no.id && c.para !== no.id))
      if (selId === no.id) setSelId(null)
      delete alturas.current[no.id]
    }
    setReflowTick(t => t + 1)
  }

  // Reposiciona os nós em árvore conforme o layout: organograma = vertical (pai em
  // cima, filhos abaixo); mapa mental = horizontal (pai à esquerda, filhos à direita);
  // lista = indentado. Ramos colapsados contam como folha (não ocupam espaço).
  // Layout em árvore que MEDE a altura real de cada nó (alturas.current) para que
  // as folhas nunca se sobreponham, mesmo com textos de várias linhas. Cada folha
  // ocupa uma faixa = altura do nó + gap; o pai é centralizado no meio dos filhos.
  function computarPosicoes(tipo: 'mapa' | 'organograma' | 'lista', nsArg: No[], csArg: Conexao[]): Record<string, { x: number; y: number }> {
    const filhos: Record<string, string[]> = {}
    for (const c of csArg) (filhos[c.de] ||= []).push(c.para)
    const temPaiL = (nid: string) => csArg.some(c => c.para === nid)
    const raizes = nsArg.filter(n => !temPaiL(n.id)).map(n => n.id)
    const colaps = new Set(nsArg.filter(n => n.colapsado).map(n => n.id))
    const H = (id: string) => Math.max(alturas.current[id] || ALT, ALT) // altura real medida
    const pos: Record<string, { x: number; y: number }> = {}
    const visto = new Set<string>()
    const M = 100 // margem inicial

    if (tipo === 'lista') {
      let y = 0
      const walk = (idn: string, depth: number) => {
        if (visto.has(idn)) return; visto.add(idn)
        pos[idn] = { x: depth * 46 + M, y: y + M }; y += H(idn) + 14
        if (!colaps.has(idn)) for (const c of (filhos[idn] || [])) walk(c, depth + 1)
      }
      raizes.forEach(r => walk(r, 0))
      return pos
    }

    const horizontal = tipo === 'mapa'
    const NIVEL = horizontal ? 250 : 160 // distância entre níveis
    const GAPV = 22 // respiro vertical entre irmãos (mapa)
    const GAPH = 40 // respiro horizontal entre irmãos (organograma)
    let cursor = 0
    const walk = (idn: string, depth: number): number => {
      if (visto.has(idn)) return cursor; visto.add(idn)
      const ch = colaps.has(idn) ? [] : (filhos[idn] || []).filter(c => !visto.has(c))
      let centro: number
      if (!ch.length) {
        const tam = horizontal ? H(idn) : LARG
        centro = cursor + tam / 2
        cursor += tam + (horizontal ? GAPV : GAPH)
      } else {
        const cs = ch.map(c => walk(c, depth + 1))
        centro = (cs[0] + cs[cs.length - 1]) / 2
      }
      // 'centro' é o centro no eixo de espalhamento; converte para canto sup-esq.
      pos[idn] = horizontal
        ? { x: depth * NIVEL + M, y: centro - H(idn) / 2 + M }
        : { x: centro - LARG / 2 + M, y: depth * NIVEL + M }
      return centro
    }
    raizes.forEach((r, i) => { if (i) cursor += horizontal ? 46 : 60; walk(r, 0) })
    return pos
  }

  // Mantém o NÓ PRINCIPAL (1ª raiz) parado e ajusta o resto ao redor dele —
  // assim o enquadramento não "pula" quando o mapa se reorganiza.
  function ancorarNaRaiz(pos: Record<string, { x: number; y: number }>) {
    const raizId = nos.find(n => !conexoes.some(c => c.para === n.id))?.id
    if (!raizId || !pos[raizId]) return
    const atual = nos.find(n => n.id === raizId)
    if (!atual) return
    const dx = atual.x - pos[raizId].x, dy = atual.y - pos[raizId].y
    if (!dx && !dy) return
    for (const k in pos) { pos[k].x += dx; pos[k].y += dy }
  }

  function aplicarLayout(tipo: 'mapa' | 'organograma' | 'lista') {
    setLayout(tipo)
    const pos = computarPosicoes(tipo, nos, conexoes)
    ancorarNaRaiz(pos) // enquadramento fixo no nó principal
    setNos(ns => ns.map(n => pos[n.id] ? { ...n, x: pos[n.id].x, y: pos[n.id].y } : n))
    setSelId(null); setEditId(null); setConectarDe(null)
  }

  if (carregando) return <p style={{ color: '#aaa' }}>Carregando mapa...</p>

  // Colapso: esconde os descendentes de qualquer nó colapsado.
  const filhosMap: Record<string, string[]> = {}
  for (const c of conexoes) (filhosMap[c.de] ||= []).push(c.para)
  const oculto = new Set<string>()
  const esconder = (idn: string) => { for (const ch of (filhosMap[idn] || [])) if (!oculto.has(ch)) { oculto.add(ch); esconder(ch) } }
  for (const n of nos) if (n.colapsado) esconder(n.id)
  const nosVis = nos.filter(n => !oculto.has(n.id))
  const conVis = conexoes.filter(c => !oculto.has(c.de) && !oculto.has(c.para))
  const temFilho = (nid: string) => (filhosMap[nid] || []).length > 0

  const sel = nos.find(n => n.id === selId && !oculto.has(n.id))
  const cliente = clienteId ? clientes.find(c => c.id === clienteId) : null
  const TBtn = ({ title, onClick, children, cor }: any) => (
    <button onPointerDown={e => e.stopPropagation()} onClick={onClick} title={title} style={{ width: 30, height: 30, border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer', color: cor || '#444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</button>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={onVoltar} title="Voltar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título do mapa" style={{ flex: 1, minWidth: 140, maxWidth: 320, border: 'none', outline: 'none', fontSize: 17, fontWeight: 800, color: '#111', fontFamily: 'inherit', background: 'transparent' }} />

        {/* Atribuir a um cliente (fixa a logomarca) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {cliente && (
            <span title={cliente.nome} style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#888', border: '2px solid var(--marca, #ffc00f)' }}>
              <AvatarCliente logo={cliente.logo} nome={cliente.nome} clienteId={cliente.id} />
            </span>
          )}
          <select value={clienteId} onChange={e => setClienteId(e.target.value)} title="Atribuir a um cliente" style={{ padding: '7px 10px', borderRadius: 9, border: '1.5px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit', background: '#fff', color: clienteId ? '#111' : '#888', maxWidth: 160 }}>
            <option value="">Sem cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        {salvo === 'salvando' && <span style={{ fontSize: 11.5, color: '#aaa' }}>salvando…</span>}
        {salvo === 'ok' && <span style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600 }}>salvo</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 3, background: '#f0f0f0', borderRadius: 9, padding: 3 }}>
          {([['mapa', 'Mapa mental'], ['organograma', 'Organograma'], ['lista', 'Lista']] as const).map(([k, l]) => (
            <button key={k} onClick={() => aplicarLayout(k)} title={k === 'mapa' ? 'Ligações curvas, fluxo horizontal' : k === 'organograma' ? 'Ligações retas, ramificação vertical' : 'Lista indentada'} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: layout === k ? '#fff' : 'transparent', color: layout === k ? '#111' : '#888', boxShadow: layout === k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{l}</button>
          ))}
        </div>
        {/* Auto-organizar: reflui os espaços conforme os ramos são criados */}
        <button onClick={() => setAutoArrumar(v => !v)} title={autoArrumar ? 'Auto-organizar ligado — desligar' : 'Auto-organizar os espaços conforme cria ramos'} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 9, border: autoArrumar ? '1.5px solid var(--marca, #ffc00f)' : '1.5px solid #e6e6e6', background: autoArrumar ? '#fffbeb' : '#fff', color: autoArrumar ? '#a16207' : '#666', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
          Auto
        </button>
        <button onClick={() => aplicarLayout(layout)} title="Organizar agora" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 9, border: '1.5px solid #e6e6e6', background: '#fff', color: '#666', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Organizar</button>
        <button onClick={() => addNo()} style={{ padding: '8px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>+ Nó</button>
      </div>

      <div ref={canvasRef}
        onPointerDown={e => { dragRef.current = { tipo: 'pan', sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y, moved: false } }}
        style={{ position: 'relative', height: 'calc(100vh - 220px)', minHeight: 440, overflow: 'hidden', background: '#fbfbfc', backgroundImage: 'radial-gradient(#e7e7ea 1px, transparent 1px)', backgroundSize: `${22 * zoom}px ${22 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px`, border: '1px solid #eee', borderRadius: 14, cursor: dragRef.current?.tipo === 'pan' ? 'grabbing' : 'default', touchAction: 'none' }}>

        <div style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {/* Conexões — NÃO deletáveis por clique (a estrutura vem dos nós). Cor: amarelo da marca. */}
          <svg width={4000} height={3000} style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
            {layout !== 'lista' && conVis.map(c => {
              const a = nos.find(n => n.id === c.de), b = nos.find(n => n.id === c.para)
              if (!a || !b) return null
              let path: string
              if (layout === 'organograma') {
                // Ligações retas/quadradas (cotovelo), ramificação vertical
                const p1 = { x: a.x + LARG / 2, y: a.y + ALT }, p2 = { x: b.x + LARG / 2, y: b.y }
                const midY = (p1.y + p2.y) / 2
                path = `M ${p1.x} ${p1.y} L ${p1.x} ${midY} L ${p2.x} ${midY} L ${p2.x} ${p2.y}`
              } else {
                // Ligações curvas, fluxo horizontal
                const p1 = centro(a), p2 = centro(b), dx = Math.abs(p2.x - p1.x) / 2 + 20
                path = `M ${p1.x} ${p1.y} C ${p1.x + (p2.x > p1.x ? dx : -dx)} ${p1.y}, ${p2.x + (p2.x > p1.x ? -dx : dx)} ${p2.y}, ${p2.x} ${p2.y}`
              }
              return <path key={c.id} d={path} stroke={COR_LIGACAO} strokeWidth={2.75} fill="none" strokeLinecap="round" />
            })}
          </svg>
          {/* Nós (pill minimalista) */}
          {nosVis.map(no => {
            const selecionado = selId === no.id
            const alvo = !!conectarDe && conectarDe !== no.id
            const editando = editId === no.id
            const raiz = !temPai(no.id)
            const pai = temFilho(no.id)
            const colapBottom = layout === 'organograma'
            return (
              <div key={no.id} ref={el => { if (el) alturas.current[no.id] = el.offsetHeight }} onPointerDown={e => {
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
                  ? <textarea value={no.texto} autoFocus onChange={e => setNo(no.id, { texto: e.target.value })} onPointerDown={e => e.stopPropagation()} onBlur={() => finalizarNo(no)} placeholder="Ideia…"
                      onKeyDown={e => {
                        // 1º Enter só CONFIRMA o texto; o 2º Enter (nó já selecionado) cria o irmão via atalho global.
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finalizarNo(no) }
                        else if (e.key === 'Tab') { e.preventDefault(); criarFilho(no) } // Tab = novo filho (regra inalterada)
                      }}
                      style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: raiz ? 13.5 : 12.5, fontWeight: raiz ? 800 : 400, lineHeight: 1.35, fontFamily: 'inherit', color: raiz ? '#fff' : '#222', background: 'transparent', minHeight: 30 }} rows={2} />
                  : <span style={{ flex: 1, fontSize: raiz ? 13.5 : 12.5, fontWeight: raiz ? 800 : 400, lineHeight: 1.35, color: raiz ? '#fff' : (no.texto ? '#222' : '#bbb'), wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{no.texto || (raiz ? 'Ideia central' : 'Ideia…')}</span>}
                {/* Botão de ocultar/mostrar ramificação (só em nós com filhos) */}
                {pai && !editando && (
                  <button onPointerDown={e => e.stopPropagation()} onClick={() => alternarColapso(no)} title={no.colapsado ? 'Mostrar ramificação' : 'Ocultar ramificação'}
                    style={{ position: 'absolute', ...(colapBottom ? { bottom: -12, left: '50%', transform: 'translateX(-50%)' } : { right: -12, top: '50%', transform: 'translateY(-50%)' }), width: 22, height: 22, borderRadius: '50%', background: no.colapsado ? 'var(--marca, #ffc00f)' : '#fff', border: '1.5px solid ' + (no.colapsado ? 'var(--marca, #ffc00f)' : '#d0d0d5'), color: no.colapsado ? '#111' : '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 5px rgba(0,0,0,0.14)', padding: 0, fontSize: 13, fontWeight: 900, lineHeight: 1, zIndex: 2 }}>
                    {no.colapsado ? '+' : '−'}
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
            {temFilho(sel.id) && <>
              <div style={{ width: 1, height: 18, background: '#eee', margin: '0 2px' }} />
              <TBtn title={sel.colapsado ? 'Mostrar ramificação' : 'Ocultar ramificação'} onClick={() => alternarColapso(sel)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d={sel.colapsado ? 'M12 5v14M5 12h14' : 'M5 12h14'} /></svg>
              </TBtn>
            </>}
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
      <p style={{ margin: '8px 2px 0', fontSize: 11.5, color: '#bbb' }}>Arraste os nós · role para zoom · duplo-clique edita · <b style={{ color: '#999' }}>Enter</b> confirma o texto (Enter de novo cria um irmão), <b style={{ color: '#999' }}>Tab</b> cria filho, <b style={{ color: '#999' }}>Delete</b> apaga o nó · o botão <b style={{ color: '#999' }}>−</b> oculta a ramificação · <b style={{ color: '#999' }}>Auto</b> mantém tudo organizado (nunca sobrepõe).</p>
    </div>
  )
}

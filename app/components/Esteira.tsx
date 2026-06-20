'use client'
import { useEffect, useState } from 'react'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string; corSecundaria?: string }
type Plano = { id: string; clienteId: string; clienteNome: string; mes: number; ano: number; titulo?: string }
type Pauta = {
  id: string; clienteId: string; clienteNome: string; imagens: string[]; legenda: string
  status: string; formato?: string; etapa?: string; briefing?: string; planoId?: string
  capasVideo?: Record<string, string>; thumbnail?: string; dataAgendada?: string
  ajusteCopy?: string; ajusteCriativo?: string
}

const ETAPAS: { key: string; label: string; cliente?: boolean }[] = [
  { key: 'briefing', label: 'Briefing' },
  { key: 'copy', label: 'Copy' },
  { key: 'aprovacao_copy', label: 'Aprovação de copy', cliente: true },
  { key: 'criativo', label: 'Criativo' },
  { key: 'aprovacao_criativo', label: 'Aprovação de criativo', cliente: true },
  { key: 'pronto', label: 'Pronto / Agendado' },
]
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const ehVideo = (u: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(u || '')

function capaDaPauta(p: Pauta): string {
  if (p.thumbnail) return p.thumbnail
  const caps = p.capasVideo || {}
  for (const url of (p.imagens || [])) { if (caps[url]) return caps[url] }
  const img = (p.imagens || []).find(u => !ehVideo(u))
  if (img) return img
  return Object.values(caps)[0] || (p.imagens || [])[0] || ''
}

export default function Esteira({ clientes, onAbrirComposer }: {
  clientes: Cliente[]
  onAbrirComposer?: (pauta: Pauta) => void
}) {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [planoSel, setPlanoSel] = useState<string>('')
  const [pautas, setPautas] = useState<Pauta[]>([])
  const [carregando, setCarregando] = useState(false)
  const [novoPlano, setNovoPlano] = useState(false)
  const [formPlano, setFormPlano] = useState({ clienteId: '', mes: new Date().getMonth() + 1, ano: new Date().getFullYear() })
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [pautaModal, setPautaModal] = useState<Pauta | null>(null)

  function carregarPlanos() {
    fetch('/api/planos').then(r => r.json()).then(d => setPlanos(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => { carregarPlanos() }, [])

  function carregarPautas(planoId: string) {
    if (!planoId) { setPautas([]); return }
    setCarregando(true)
    fetch(`/api/planos?id=${planoId}`).then(r => r.json()).then(d => setPautas(d?.pautas || [])).finally(() => setCarregando(false))
  }
  useEffect(() => { carregarPautas(planoSel) }, [planoSel])

  async function criarPlano() {
    if (!formPlano.clienteId) return
    const cli = clientes.find(c => c.id === formPlano.clienteId)
    const r = await fetch('/api/planos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formPlano, clienteNome: cli?.nome }),
    }).then(x => x.json())
    if (r?.plano) { setNovoPlano(false); carregarPlanos(); setPlanoSel(r.plano.id) }
  }

  async function novaPauta() {
    const plano = planos.find(p => p.id === planoSel)
    if (!plano) return
    const briefing = prompt('Tema/ideia da pauta (briefing):')
    if (briefing === null) return
    const r = await fetch('/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: plano.clienteId, clienteNome: plano.clienteNome, imagens: [], legenda: '', formato: 'feed', rascunhoInterno: true, planoId: plano.id, etapa: 'briefing', briefing }),
    }).then(x => x.json())
    if (r?.post) carregarPautas(planoSel)
  }

  async function moverEtapa(pauta: Pauta, etapa: string) {
    if (pauta.etapa === etapa) return
    setPautas(ps => ps.map(p => p.id === pauta.id ? { ...p, etapa } : p))
    await fetch('/api/posts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pauta.id, etapa }),
    }).catch(() => {})
    carregarPautas(planoSel)
  }

  const planoAtual = planos.find(p => p.id === planoSel)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Esteira de Criativos</h2>
        <select value={planoSel} onChange={e => setPlanoSel(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', minWidth: 240 }}>
          <option value="">Selecione um plano...</option>
          {planos.map(p => <option key={p.id} value={p.id}>{p.clienteNome} — {MESES[p.mes - 1]}/{p.ano}{p.titulo ? ` · ${p.titulo}` : ''}</option>)}
        </select>
        <button onClick={() => setNovoPlano(true)} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Novo plano</button>
        {planoSel && <button onClick={novaPauta} style={{ padding: '9px 16px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Nova pauta</button>}
      </div>

      {novoPlano && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Cliente</label>
            <select value={formPlano.clienteId} onChange={e => setFormPlano(f => ({ ...f, clienteId: e.target.value }))} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minWidth: 200 }}>
              <option value="">Selecione...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Mês</label>
            <select value={formPlano.mes} onChange={e => setFormPlano(f => ({ ...f, mes: Number(e.target.value) }))} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13 }}>
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Ano</label>
            <input type="number" value={formPlano.ano} onChange={e => setFormPlano(f => ({ ...f, ano: Number(e.target.value) }))} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, width: 90 }} />
          </div>
          <button onClick={criarPlano} disabled={!formPlano.clienteId} style={{ padding: '10px 20px', background: formPlano.clienteId ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: formPlano.clienteId ? 'pointer' : 'not-allowed' }}>Criar plano</button>
          <button onClick={() => setNovoPlano(false)} style={{ padding: '10px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      )}

      {!planoSel ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa', background: '#fff', borderRadius: 14, border: '1px solid #eee' }}>
          <p>Selecione ou crie um plano para abrir a esteira.</p>
        </div>
      ) : carregando ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>Carregando pautas...</div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {ETAPAS.map(col => {
            const cards = pautas.filter(p => (p.etapa || 'briefing') === col.key)
            return (
              <div key={col.key}
                onDragOver={e => { if (dragId) { e.preventDefault(); setOverCol(col.key) } }}
                onDragLeave={() => setOverCol(o => (o === col.key ? null : o))}
                onDrop={() => { const p = pautas.find(x => x.id === dragId); if (p) moverEtapa(p, col.key); setDragId(null); setOverCol(null) }}
                style={{
                  flex: '0 0 230px', width: 230, background: overCol === col.key ? '#fffbeb' : '#f6f6f7', borderRadius: 12, padding: 10,
                  outline: overCol === col.key ? '2px dashed #ffc00f' : 'none', outlineOffset: -2, alignSelf: 'flex-start',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#444' }}>{col.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', background: '#fff', borderRadius: 999, padding: '1px 8px' }}>{cards.length}</span>
                </div>
                {col.cliente && <p style={{ margin: '0 4px 8px', fontSize: 10, color: '#b45309' }}>Aguarda o cliente</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cards.map(p => {
                    const capa = capaDaPauta(p)
                    const mostrarImg = capa && !ehVideo(capa)
                    return (
                      <div key={p.id} draggable onDragStart={() => setDragId(p.id)} onDragEnd={() => { setDragId(null); setOverCol(null) }}
                        onClick={() => setPautaModal(p)}
                        style={{ background: '#fff', borderRadius: 10, padding: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', cursor: 'grab' }}>
                        {(p.imagens || []).length > 0 && (
                          <div style={{ width: '100%', aspectRatio: '1.6', borderRadius: 8, overflow: 'hidden', background: '#eee', marginBottom: 8 }}>
                            {mostrarImg ? <img src={capa} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : capa ? <video src={capa} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                          </div>
                        )}
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#111', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {p.briefing || p.legenda || 'Sem título'}
                        </p>
                        {(p.ajusteCopy || p.ajusteCriativo) && (
                          <p style={{ margin: '6px 0 0', fontSize: 10.5, color: '#b91c1c', background: '#fef2f2', borderRadius: 6, padding: '4px 6px' }}>Ajuste pedido pelo cliente</p>
                        )}
                      </div>
                    )
                  })}
                  {cards.length === 0 && <p style={{ margin: 0, fontSize: 11, color: '#bbb', textAlign: 'center', padding: '14px 0' }}>—</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal da pauta */}
      {pautaModal && (
        <PautaModal pauta={pautaModal} onClose={() => setPautaModal(null)}
          onAbrirComposer={onAbrirComposer}
          onSalvo={() => { setPautaModal(null); carregarPautas(planoSel) }} />
      )}
    </div>
  )
}

function PautaModal({ pauta, onClose, onSalvo, onAbrirComposer }: {
  pauta: Pauta; onClose: () => void; onSalvo: () => void; onAbrirComposer?: (p: Pauta) => void
}) {
  const [briefing, setBriefing] = useState(pauta.briefing || '')
  const [legenda, setLegenda] = useState(pauta.legenda || '')
  const [salvando, setSalvando] = useState(false)

  async function salvar(extra?: any) {
    setSalvando(true)
    await fetch('/api/posts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pauta.id, briefing, legenda, ...extra }),
    }).catch(() => {})
    setSalvando(false)
    onSalvo()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#111' }}>Pauta — {pauta.clienteNome}</h3>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Briefing / ideia</label>
        <textarea value={briefing} onChange={e => setBriefing(e.target.value)} placeholder="Tema, ângulo, objetivo..."
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14 }} />
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Copy (legenda)</label>
        <textarea value={legenda} onChange={e => setLegenda(e.target.value)} placeholder="Texto da publicação..."
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minHeight: 100, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => salvar()} disabled={salvando} style={{ flex: 1, padding: '11px 0', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', minWidth: 120 }}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          {onAbrirComposer && (
            <button onClick={() => onAbrirComposer(pauta)} style={{ padding: '11px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Abrir criativo
            </button>
          )}
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

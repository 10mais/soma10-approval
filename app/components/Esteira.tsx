'use client'
import { useEffect, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'
import UploadProgress from './UploadProgress'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string; corSecundaria?: string }
type Plano = { id: string; clienteId: string; clienteNome: string; mes: number; ano: number; titulo?: string }
type Pauta = {
  id: string; clienteId: string; clienteNome: string; imagens: string[]; legenda: string
  status: string; formato?: string; etapa?: string; briefing?: string; planoId?: string
  capasVideo?: Record<string, string>; thumbnail?: string; dataAgendada?: string
  ajusteCopy?: string; ajusteCriativo?: string
  sugestaoImagem?: string; textoImagem?: string; sugestaoLegenda?: string
  criadoEm?: string; atualizadoEm?: string; aguardandoDesde?: string
}

// Espera em aprovacao (SLA 24h)
function tempoEspera(aguardandoDesde?: string): { texto: string; atrasado: boolean } | null {
  if (!aguardandoDesde) return null
  const ms = Date.now() - new Date(aguardandoDesde).getTime()
  if (ms < 0) return null
  const horas = Math.floor(ms / (60 * 60 * 1000))
  const atrasado = horas >= 24
  const texto = horas < 1 ? 'há poucos minutos' : horas < 24 ? `há ${horas}h` : `há ${Math.floor(horas / 24)} dia(s)`
  return { texto, atrasado }
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

const FORMATO_INFO: Record<string, { label: string; cor: string; icon: string }> = {
  feed: { label: 'Feed', cor: '#1d4ed8', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  reel: { label: 'Reel', cor: '#dc2626', icon: 'M5.76 2h12.48L22 6v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6l3.76-4zM10 12l5 3-5 3v-6z' },
  story: { label: 'Story', cor: '#7c3aed', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12z' },
  carrossel: { label: 'Carrossel', cor: '#0891b2', icon: 'M4 4h12v12H4zM8 8h12v12H8z' },
}
function formatoBadge(formato?: string, qtdImagens?: number) {
  const fmt = (qtdImagens && qtdImagens > 1) ? 'carrossel' : (formato || 'feed')
  const info = FORMATO_INFO[fmt] || FORMATO_INFO.feed
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: info.cor, background: `${info.cor}12`, border: `1px solid ${info.cor}30`, borderRadius: 999, padding: '1px 6px' }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill={info.cor} style={{ flexShrink: 0 }}><path d={info.icon} /></svg>
      {info.label}
    </span>
  )
}

function capaDaPauta(p: Pauta): string {
  if (p.thumbnail) return p.thumbnail
  const caps = p.capasVideo || {}
  for (const url of (p.imagens || [])) { if (caps[url]) return caps[url] }
  const img = (p.imagens || []).find(u => !ehVideo(u))
  if (img) return img
  return Object.values(caps)[0] || (p.imagens || [])[0] || ''
}

export default function Esteira({ clientes, clienteFixo, onAbrirComposer }: {
  clientes: Cliente[]
  clienteFixo?: string
  onAbrirComposer?: (pauta: Pauta) => void
}) {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [planoSel, setPlanoSel] = useState('')
  const [pautas, setPautas] = useState<Pauta[]>([])
  const [carregando, setCarregando] = useState(false)
  const [novoPlano, setNovoPlano] = useState(false)
  const [formPlano, setFormPlano] = useState({ clienteId: clienteFixo || '', mes: new Date().getMonth() + 1, ano: new Date().getFullYear() })
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [pautaModal, setPautaModal] = useState<Pauta | null>(null)
  const [novaPautaModal, setNovaPautaModal] = useState(false)
  const [formPauta, setFormPauta] = useState({ briefing: '', sugestaoImagem: '', textoImagem: '', sugestaoLegenda: '', formato: 'feed', refImagemUrl: '' })
  const [enviandoRefImagem, setEnviandoRefImagem] = useState(false)
  const [progRefImagem, setProgRefImagem] = useState<number | null>(null)
  const [gerandoIA, setGerandoIA] = useState(false)
  const [iaMsg, setIaMsg] = useState('')
  const [gerandoLegendaNova, setGerandoLegendaNova] = useState(false)
  const [legendaNovaMsg, setLegendaNovaMsg] = useState('')

  async function gerarLegendaNovaPauta() {
    const plano = planos.find(p => p.id === planoSel)
    if (!plano || !formPauta.briefing.trim()) return
    setGerandoLegendaNova(true); setLegendaNovaMsg('Gerando legenda...')
    try {
      const r = await fetch('/api/esteira/gerar-legenda', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: plano.clienteId, briefing: formPauta.briefing, sugestaoImagem: formPauta.sugestaoImagem, textoImagem: formPauta.textoImagem, formato: formPauta.formato }),
      })
      const d = await r.json()
      if (!r.ok) { setLegendaNovaMsg(d?.error || 'Falha ao gerar.'); return }
      setFormPauta(f => ({ ...f, sugestaoLegenda: d.legenda }))
      setLegendaNovaMsg('Legenda gerada!')
      setTimeout(() => setLegendaNovaMsg(''), 4000)
    } catch { setLegendaNovaMsg('Erro de conexao.') }
    finally { setGerandoLegendaNova(false) }
  }

  function carregarPlanos() {
    const url = clienteFixo ? `/api/planos?clienteId=${clienteFixo}` : '/api/planos'
    fetch(url).then(r => r.json()).then(d => {
      const lista = Array.isArray(d) ? d : []
      setPlanos(lista)
      if (!planoSel && lista.length > 0) setPlanoSel(lista[0].id)
    }).catch(() => {})
  }
  useEffect(() => { carregarPlanos() }, [clienteFixo])

  function carregarPautas(planoId: string) {
    if (!planoId) { setPautas([]); return }
    setCarregando(true)
    fetch(`/api/planos?id=${planoId}&pautas=1`).then(r => r.json()).then(d => setPautas(d?.pautas || [])).finally(() => setCarregando(false))
  }
  useEffect(() => { carregarPautas(planoSel) }, [planoSel])

  async function criarPlano() {
    const cid = clienteFixo || formPlano.clienteId
    if (!cid) return
    const cli = clientes.find(c => c.id === cid)
    const r = await fetch('/api/planos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: cid, clienteNome: cli?.nome, mes: formPlano.mes, ano: formPlano.ano }),
    }).then(x => x.json())
    if (r?.plano) { setNovoPlano(false); carregarPlanos(); setPlanoSel(r.plano.id) }
  }

  async function criarPauta() {
    const plano = planos.find(p => p.id === planoSel)
    if (!plano || !formPauta.briefing.trim()) return
    await fetch('/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId: plano.clienteId, clienteNome: plano.clienteNome, imagens: [], legenda: formPauta.sugestaoLegenda || '',
        formato: formPauta.formato || 'feed', rascunhoInterno: true, planoId: plano.id, etapa: 'briefing',
        briefing: formPauta.briefing, sugestaoImagem: [formPauta.sugestaoImagem, formPauta.refImagemUrl].filter(Boolean).join('\n'), textoImagem: formPauta.textoImagem, sugestaoLegenda: formPauta.sugestaoLegenda,
      }),
    })
    setNovaPautaModal(false)
    setFormPauta({ briefing: '', sugestaoImagem: '', textoImagem: '', sugestaoLegenda: '', formato: 'feed', refImagemUrl: '' })
    carregarPautas(planoSel)
  }

  async function gerarPlanoIA() {
    if (!planoSel) return
    if (!confirm('A IA vai gerar pautas para o mes inteiro com base no Brand Board. Isso consome creditos da IA. Continuar?')) return
    setGerandoIA(true); setIaMsg('Gerando pautas com IA... (pode levar ate 1 minuto)')
    try {
      const r = await fetch('/api/esteira/gerar-plano', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planoId: planoSel, quantidade: 12 }),
      })
      const d = await r.json()
      if (!r.ok) { setIaMsg(d?.error || 'Falha ao gerar o plano.'); return }
      setIaMsg(`${d.quantidade} pautas criadas com sucesso!`)
      carregarPautas(planoSel)
      setTimeout(() => setIaMsg(''), 6000)
    } catch { setIaMsg('Erro de conexao ao gerar o plano.') }
    finally { setGerandoIA(false) }
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Esteira de Criativos</h2>
        <select value={planoSel} onChange={e => setPlanoSel(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', minWidth: 240 }}>
          <option value="">Selecione um plano...</option>
          {planos.map(p => <option key={p.id} value={p.id}>{clienteFixo ? '' : `${p.clienteNome} — `}{MESES[p.mes - 1]}/{p.ano}{p.titulo ? ` · ${p.titulo}` : ''}</option>)}
        </select>
        <button onClick={() => setNovoPlano(true)} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Novo plano</button>
        {planoSel && <>
          <button onClick={() => { setFormPauta({ briefing: '', sugestaoImagem: '', textoImagem: '', sugestaoLegenda: '', formato: 'feed', refImagemUrl: '' }); setNovaPautaModal(true) }} style={{ padding: '9px 16px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Nova pauta</button>
          <button onClick={gerarPlanoIA} disabled={gerandoIA} style={{ padding: '9px 16px', background: '#111', color: '#ffc00f', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: gerandoIA ? 'not-allowed' : 'pointer', opacity: gerandoIA ? 0.6 : 1 }}>
            {gerandoIA ? 'Gerando...' : 'Gerar plano com IA'}
          </button>
        </>}
      </div>

      {/* Form de novo plano */}
      {novoPlano && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {!clienteFixo && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Cliente</label>
              <select value={formPlano.clienteId} onChange={e => setFormPlano(f => ({ ...f, clienteId: e.target.value }))} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minWidth: 200 }}>
                <option value="">Selecione...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Mes</label>
            <select value={formPlano.mes} onChange={e => setFormPlano(f => ({ ...f, mes: Number(e.target.value) }))} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13 }}>
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Ano</label>
            <input type="number" value={formPlano.ano} onChange={e => setFormPlano(f => ({ ...f, ano: Number(e.target.value) }))} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, width: 90 }} />
          </div>
          <button onClick={criarPlano} disabled={!clienteFixo && !formPlano.clienteId} style={{ padding: '10px 20px', background: (clienteFixo || formPlano.clienteId) ? 'var(--marca, #ffc00f)' : '#f0f0f0', color: (clienteFixo || formPlano.clienteId) ? 'var(--marca-texto, #111)' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: (clienteFixo || formPlano.clienteId) ? 'pointer' : 'not-allowed' }}>Criar plano</button>
          <button onClick={() => setNovoPlano(false)} style={{ padding: '10px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      )}

      {iaMsg && (
        <div style={{ background: iaMsg.includes('sucesso') ? '#dcfce7' : iaMsg.includes('Gerando') ? '#eff6ff' : '#fef2f2',
          border: `1px solid ${iaMsg.includes('sucesso') ? '#86efac' : iaMsg.includes('Gerando') ? '#bfdbfe' : '#fecaca'}`,
          borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13,
          color: iaMsg.includes('sucesso') ? '#166534' : iaMsg.includes('Gerando') ? '#1d4ed8' : '#b91c1c',
          display: 'flex', alignItems: 'center', gap: 10 }}>
          {gerandoIA && <span style={{ width: 14, height: 14, border: '2px solid #bfdbfe', borderTopColor: '#1d4ed8', borderRadius: '50%', display: 'inline-block', animation: 'girar 0.8s linear infinite', flexShrink: 0 }} />}
          {iaMsg}
          {gerandoIA && <style>{`@keyframes girar{to{transform:rotate(360deg)}}`}</style>}
        </div>
      )}

      {/* Kanban */}
      {!planoSel ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa', background: '#fff', borderRadius: 14, border: '1px solid #eee' }}>
          <p>Selecione ou crie um plano para abrir a esteira.</p>
        </div>
      ) : carregando ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>Carregando pautas...</div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, height: 'calc(100vh - 200px)', alignItems: 'stretch' }}>
          {ETAPAS.map(col => {
            const cards = pautas.filter(p => (p.etapa || 'briefing') === col.key).sort((a, b) => new Date(b.atualizadoEm || b.criadoEm || '').getTime() - new Date(a.atualizadoEm || a.criadoEm || '').getTime())
            return (
              <div key={col.key}
                onDragOver={e => { if (dragId) { e.preventDefault(); setOverCol(col.key) } }}
                onDragLeave={() => setOverCol(o => (o === col.key ? null : o))}
                onDrop={() => { const p = pautas.find(x => x.id === dragId); if (p) moverEtapa(p, col.key); setDragId(null); setOverCol(null) }}
                style={{
                  flex: '0 0 230px', width: 230, background: overCol === col.key ? '#fffbeb' : '#f6f6f7', borderRadius: 12, padding: 10,
                  outline: overCol === col.key ? '2px dashed #ffc00f' : 'none', outlineOffset: -2,
                  display: 'flex', flexDirection: 'column', minHeight: 0,
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#444' }}>{col.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', background: '#fff', borderRadius: 999, padding: '1px 8px' }}>{cards.length}</span>
                </div>
                {col.cliente && <p style={{ margin: '0 4px 8px', fontSize: 10, color: '#b45309' }}>Aguarda o cliente</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto', minHeight: 60 }}>
                  {cards.map(p => {
                    const capa = capaDaPauta(p)
                    const mostrarImg = capa && !ehVideo(capa)
                    return (
                      <div key={p.id} draggable onDragStart={() => setDragId(p.id)} onDragEnd={() => { setDragId(null); setOverCol(null) }}
                        onClick={() => setPautaModal(p)}
                        style={{ background: '#fff', borderRadius: 10, padding: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', cursor: 'grab', opacity: dragId === p.id ? 0.4 : 1 }}>
                        {(p.imagens || []).length > 0 && (
                          <div style={{ width: '100%', aspectRatio: '1.6', borderRadius: 8, overflow: 'hidden', background: '#eee', marginBottom: 8 }}>
                            {mostrarImg ? <img src={capa} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : capa ? <video src={capa} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          {formatoBadge(p.formato, (p.imagens || []).length)}
                          {p.dataAgendada && <span style={{ fontSize: 10, color: '#666' }}>{new Date(p.dataAgendada).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {new Date(p.dataAgendada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#111', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {p.briefing || p.legenda || 'Sem titulo'}
                        </p>
                        {p.sugestaoImagem && <p style={{ margin: '3px 0 0', fontSize: 10, color: '#888' }}>Imagem: {p.sugestaoImagem.slice(0, 40)}...</p>}
                        {(p.ajusteCopy || p.ajusteCriativo) && (
                          <p style={{ margin: '5px 0 0', fontSize: 10.5, color: '#b91c1c', background: '#fef2f2', borderRadius: 6, padding: '4px 6px' }}>Ajuste pedido pelo cliente</p>
                        )}
                        {col.cliente && (() => { const e = tempoEspera(p.aguardandoDesde); return e ? (
                          <p style={{ margin: '5px 0 0', fontSize: 10.5, fontWeight: 700, color: e.atrasado ? '#b91c1c' : '#888', background: e.atrasado ? '#fef2f2' : '#f5f5f5', borderRadius: 6, padding: '4px 6px' }}>Aguardando {e.texto}</p>
                        ) : null })()}
                        {col.key === 'criativo' && (p.imagens || []).length > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); moverEtapa(p, 'aprovacao_criativo') }}
                            style={{ marginTop: 6, width: '100%', padding: '6px 0', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                            Enviar para aprovacao
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {cards.length === 0 && <p style={{ margin: 0, fontSize: 11, color: '#bbb', textAlign: 'center', padding: '14px 0' }}>--</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de nova pauta */}
      {novaPautaModal && (
        <div onClick={() => setNovaPautaModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>Nova pauta</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Tema / ideia da pauta *</label>
                <textarea value={formPauta.briefing} onChange={e => setFormPauta(f => ({ ...f, briefing: e.target.value }))} placeholder="Ex.: Post sobre cuidados com joias no inverno..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minHeight: 60, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Referencia de imagem (opcional)</label>
                <textarea value={formPauta.sugestaoImagem} onChange={e => setFormPauta(f => ({ ...f, sugestaoImagem: e.target.value }))} placeholder="Descreva a ideia visual: foto de produto, lifestyle, bastidores..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minHeight: 50, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', background: '#f5f5f5', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#444' }}>
                    {enviandoRefImagem ? 'Enviando...' : '+ Anexar imagem'}
                    <input type="file" accept="image/*,video/*" style={{ display: 'none' }} disabled={enviandoRefImagem} onChange={async e => {
                      if (!e.target.files?.[0]) return
                      setEnviandoRefImagem(true); setProgRefImagem(0)
                      try {
                        const f = e.target.files[0]; const ext = f.name.split('.').pop() || 'jpg'
                        const blob = await upload(`refs/${uuid()}.${ext}`, f, { access: 'public', handleUploadUrl: '/api/upload', contentType: f.type, clientPayload: f.type, onUploadProgress: ({ percentage }) => setProgRefImagem(percentage) })
                        setFormPauta(p => ({ ...p, refImagemUrl: blob.url }))
                      } catch {} finally { setEnviandoRefImagem(false); setProgRefImagem(null) }
                      e.target.value = ''
                    }} />
                  </label>
                  <div style={{ width: '100%' }}><UploadProgress valor={progRefImagem} /></div>
                  <span style={{ fontSize: 11, color: '#aaa' }}>ou</span>
                  <input value={formPauta.refImagemUrl} onChange={e => setFormPauta(f => ({ ...f, refImagemUrl: e.target.value }))} placeholder="Link do Drive ou URL da referencia"
                    style={{ flex: 1, minWidth: 180, padding: '6px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 11, fontFamily: 'inherit' }} />
                </div>
                {formPauta.refImagemUrl && /\.(jpg|jpeg|png|gif|webp)/i.test(formPauta.refImagemUrl) && (
                  <img src={formPauta.refImagemUrl} alt="" style={{ marginTop: 8, maxWidth: 120, maxHeight: 80, borderRadius: 8, objectFit: 'cover' }} />
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Texto na imagem (opcional)</label>
                <input value={formPauta.textoImagem} onChange={e => setFormPauta(f => ({ ...f, textoImagem: e.target.value }))} placeholder="Texto que deve aparecer na arte/criativo"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>Legenda (opcional)</label>
                  <button onClick={gerarLegendaNovaPauta} disabled={gerandoLegendaNova || !formPauta.briefing.trim()} type="button"
                    style={{ padding: '4px 12px', background: 'transparent', color: (gerandoLegendaNova || !formPauta.briefing.trim()) ? '#ccc' : '#7c3aed', border: `1px solid ${(gerandoLegendaNova || !formPauta.briefing.trim()) ? '#e0e0e0' : '#7c3aed30'}`, borderRadius: 8, fontWeight: 600, fontSize: 11, cursor: (gerandoLegendaNova || !formPauta.briefing.trim()) ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z"/></svg>
                    {gerandoLegendaNova ? 'Gerando...' : 'Criar com IA'}
                  </button>
                </div>
                {legendaNovaMsg && <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: legendaNovaMsg.includes('Erro') || legendaNovaMsg.includes('Falha') ? '#dc2626' : '#16a34a' }}>{legendaNovaMsg}</p>}
                <textarea value={formPauta.sugestaoLegenda} onChange={e => setFormPauta(f => ({ ...f, sugestaoLegenda: e.target.value }))} placeholder="Rascunho da legenda/copy para o post..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minHeight: 60, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Formato</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'feed', label: 'Feed', cor: '#1d4ed8' },
                  { key: 'reel', label: 'Reel', cor: '#dc2626' },
                  { key: 'carrossel', label: 'Carrossel', cor: '#0891b2' },
                  { key: 'story', label: 'Story', cor: '#7c3aed' },
                ].map(f => (
                  <button key={f.key} type="button" onClick={() => setFormPauta(p => ({ ...p, formato: f.key }))}
                    style={{ padding: '6px 14px', borderRadius: 8, border: formPauta.formato === f.key ? `2px solid ${f.cor}` : '1px solid #e0e0e0', background: formPauta.formato === f.key ? `${f.cor}10` : '#fff', fontSize: 12, fontWeight: formPauta.formato === f.key ? 700 : 500, color: formPauta.formato === f.key ? f.cor : '#666', cursor: 'pointer' }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={criarPauta} disabled={!formPauta.briefing.trim()} style={{ flex: 1, padding: '12px 0', background: formPauta.briefing.trim() ? 'var(--marca, #ffc00f)' : '#f0f0f0', color: formPauta.briefing.trim() ? 'var(--marca-texto, #111)' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: formPauta.briefing.trim() ? 'pointer' : 'not-allowed' }}>Criar pauta</button>
              <button onClick={() => setNovaPautaModal(false)} style={{ padding: '12px 20px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalhes da pauta */}
      {pautaModal && (
        <PautaModal pauta={pautaModal} onClose={() => setPautaModal(null)}
          onAbrirComposer={onAbrirComposer}
          onSalvo={() => { setPautaModal(null); carregarPautas(planoSel) }}
          onDescartar={async () => {
            if (!confirm('Descartar esta pauta? Ela será removida permanentemente.')) return
            await fetch(`/api/posts?id=${pautaModal.id}`, { method: 'DELETE' }).catch(() => {})
            setPautaModal(null); carregarPautas(planoSel)
          }} />
      )}
    </div>
  )
}

function PautaModal({ pauta, onClose, onSalvo, onAbrirComposer, onDescartar }: {
  pauta: Pauta; onClose: () => void; onSalvo: () => void; onAbrirComposer?: (p: Pauta) => void; onDescartar?: () => void
}) {
  const [briefing, setBriefing] = useState(pauta.briefing || '')
  const [sugestaoImagem, setSugestaoImagem] = useState(pauta.sugestaoImagem || '')
  const [textoImagem, setTextoImagem] = useState(pauta.textoImagem || '')
  const [legenda, setLegenda] = useState(pauta.legenda || '')
  const [formato, setFormato] = useState(pauta.formato || 'feed')
  const [salvando, setSalvando] = useState(false)
  const [gerandoLegenda, setGerandoLegenda] = useState(false)
  const [legendaMsg, setLegendaMsg] = useState('')

  async function gerarLegendaIA() {
    setGerandoLegenda(true); setLegendaMsg('Gerando legenda...')
    try {
      const r = await fetch('/api/esteira/gerar-legenda', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: pauta.clienteId, briefing, sugestaoImagem, textoImagem, formato }),
      })
      const d = await r.json()
      if (!r.ok) { setLegendaMsg(d?.error || 'Falha ao gerar.'); return }
      setLegenda(d.legenda)
      setLegendaMsg('Legenda gerada!')
      setTimeout(() => setLegendaMsg(''), 4000)
    } catch { setLegendaMsg('Erro de conexao.') }
    finally { setGerandoLegenda(false) }
  }

  const [refImgUrl, setRefImgUrl] = useState('')
  const [enviandoRef, setEnviandoRef] = useState(false)
  const [progRef, setProgRef] = useState<number | null>(null)

  async function salvar(extra?: any) {
    setSalvando(true)
    await fetch('/api/posts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pauta.id, briefing, sugestaoImagem, textoImagem, legenda, formato, ...extra }),
    }).catch(() => {})
    setSalvando(false)
    onSalvo()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#111' }}>Pauta — {pauta.clienteNome}</h3>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Briefing / ideia</label>
        <textarea value={briefing} onChange={e => setBriefing(e.target.value)} placeholder="Tema, ângulo, objetivo..."
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minHeight: 60, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }} />

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Referencia de imagem</label>
        <textarea value={sugestaoImagem} onChange={e => setSugestaoImagem(e.target.value)} placeholder="Descreva a ideia visual..."
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minHeight: 50, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', background: '#f5f5f5', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#444' }}>
            {enviandoRef ? 'Enviando...' : '+ Anexar imagem'}
            <input type="file" accept="image/*,video/*" style={{ display: 'none' }} disabled={enviandoRef} onChange={async e => {
              if (!e.target.files?.[0]) return
              setEnviandoRef(true); setProgRef(0)
              try {
                const f = e.target.files[0]; const ext = f.name.split('.').pop() || 'jpg'
                const blob = await upload(`refs/${uuid()}.${ext}`, f, { access: 'public', handleUploadUrl: '/api/upload', contentType: f.type, clientPayload: f.type, onUploadProgress: ({ percentage }) => setProgRef(percentage) })
                setRefImgUrl(blob.url)
                setSugestaoImagem(prev => [prev, blob.url].filter(Boolean).join('\n'))
              } catch {} finally { setEnviandoRef(false); setProgRef(null) }
              e.target.value = ''
            }} />
          </label>
          <div style={{ width: '100%' }}><UploadProgress valor={progRef} /></div>
          <span style={{ fontSize: 11, color: '#aaa' }}>ou</span>
          <input value={refImgUrl} onChange={e => setRefImgUrl(e.target.value)} placeholder="Link do Drive ou URL da referencia"
            style={{ flex: 1, minWidth: 180, padding: '6px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 11, fontFamily: 'inherit' }} />
        </div>
        {(() => {
          const urls = ((sugestaoImagem || '') + '\n' + (refImgUrl || '')).match(/https?:\/\/\S+/g) || []
          const imgs = Array.from(new Set(urls)).filter(u => /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u))
          return imgs.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {imgs.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noreferrer" title="Abrir imagem">
                  <img src={u} alt="" style={{ width: 90, height: 90, borderRadius: 8, objectFit: 'cover', border: '1px solid #eee' }} />
                </a>
              ))}
            </div>
          ) : null
        })()}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Texto na imagem</label>
        <input value={textoImagem} onChange={e => setTextoImagem(e.target.value)} placeholder="Texto que aparece na arte"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>Copy (legenda)</label>
          <button onClick={gerarLegendaIA} disabled={gerandoLegenda || !briefing.trim()} type="button"
            style={{ padding: '4px 12px', background: 'transparent', color: (gerandoLegenda || !briefing.trim()) ? '#ccc' : '#7c3aed', border: `1px solid ${(gerandoLegenda || !briefing.trim()) ? '#e0e0e0' : '#7c3aed30'}`, borderRadius: 8, fontWeight: 600, fontSize: 11, cursor: (gerandoLegenda || !briefing.trim()) ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z"/></svg>
            {gerandoLegenda ? 'Gerando...' : 'Criar com IA'}
          </button>
        </div>
        {legendaMsg && <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: legendaMsg.includes('Erro') || legendaMsg.includes('Falha') ? '#dc2626' : '#16a34a' }}>{legendaMsg}</p>}
        <textarea value={legenda} onChange={e => setLegenda(e.target.value)} placeholder="Texto da publicacao..."
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minHeight: 100, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }} />

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Formato</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'feed', label: 'Feed', cor: '#1d4ed8' },
              { key: 'reel', label: 'Reel', cor: '#dc2626' },
              { key: 'carrossel', label: 'Carrossel', cor: '#0891b2' },
              { key: 'story', label: 'Story', cor: '#7c3aed' },
            ].map(f => (
              <button key={f.key} type="button" onClick={() => setFormato(f.key)}
                style={{ padding: '6px 14px', borderRadius: 8, border: formato === f.key ? `2px solid ${f.cor}` : '1px solid #e0e0e0', background: formato === f.key ? `${f.cor}10` : '#fff', fontSize: 12, fontWeight: formato === f.key ? 700 : 500, color: formato === f.key ? f.cor : '#666', cursor: 'pointer' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {(pauta.ajusteCopy || pauta.ajusteCriativo) && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 12.5, color: '#b91c1c' }}>
            <strong>Ajuste solicitado pelo cliente:</strong> {pauta.ajusteCopy || pauta.ajusteCriativo}
          </div>
        )}

        {/* Botao copiar instrucoes para producao */}
        <button onClick={() => {
          const txt = [
            `CLIENTE: ${pauta.clienteNome}`,
            `BRIEFING: ${briefing}`,
            sugestaoImagem ? `SUGESTAO DE IMAGEM: ${sugestaoImagem}` : '',
            textoImagem ? `TEXTO NA IMAGEM: ${textoImagem}` : '',
            legenda ? `LEGENDA:\n${legenda}` : '',
            pauta.formato ? `FORMATO: ${pauta.formato}` : '',
            pauta.dataAgendada ? `DATA: ${new Date(pauta.dataAgendada).toLocaleString('pt-BR')}` : '',
          ].filter(Boolean).join('\n\n')
          navigator.clipboard.writeText(txt).then(() => alert('Instrucoes copiadas para a area de transferencia!')).catch(() => alert(txt))
        }} style={{ width: '100%', padding: '10px 0', background: '#f5f5f5', color: '#555', border: '1px solid #e0e0e0', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer', marginBottom: 10 }}>
          Copiar instrucoes para producao
        </button>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => salvar()} disabled={salvando} style={{ flex: 1, padding: '11px 0', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', minWidth: 120 }}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          {onAbrirComposer && pauta.etapa === 'criativo' && (
            <button onClick={() => onAbrirComposer(pauta)} style={{ padding: '11px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Adicionar criativo
            </button>
          )}
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
          {onDescartar && (
            <button onClick={onDescartar} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Descartar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

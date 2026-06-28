'use client'
import { useEffect, useState, useCallback } from 'react'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'
import OptImg from './OptImg'
import UploadProgress from './UploadProgress'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string }
type Usuario = { id: string; nome: string; email: string; role: string; foto?: string }
type Anotacao = { id: string; x: number; y: number; texto: string; autor: string; autorNome: string; criadoEm: string }
type Anexo = { nome: string; url: string; tipo: string; anotacoes?: Anotacao[] }
type Tarefa = {
  id: string; titulo: string; descricao?: string; tipo?: string; status: string; prioridade: string
  responsavelEmail?: string; responsavelNome?: string; clienteId?: string; clienteNome?: string
  prazo?: string; anexos?: Anexo[]
  atividades?: any[]; comentarios?: any[]
  criadoPor: string; criadoEm: string; atualizadoEm: string; concluidoEm?: string
  excluidoEm?: string; excluidoPor?: string
}

const TIPOS: { key: string; label: string; cor: string; icone: string }[] = [
  { key: 'carrossel', label: 'Carrossel', cor: '#7c3aed', icone: 'M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5z' },
  { key: 'criativo', label: 'Criativo', cor: '#ea580c', icone: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { key: 'ecommerce', label: 'E-commerce', cor: '#0891b2', icone: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0' },
  { key: 'estrategia', label: 'Estrategia', cor: '#0d9488', icone: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' },
  { key: 'landing_page', label: 'Landing Page', cor: '#2563eb', icone: 'M3 3h18v18H3zM3 9h18M9 21V9' },
  { key: 'planejamento', label: 'Planejamento', cor: '#4f46e5', icone: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  { key: 'post', label: 'Post', cor: '#059669', icone: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { key: 'reel', label: 'Reel', cor: '#dc2626', icone: 'M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z' },
  { key: 'story', label: 'Story', cor: '#c026d3', icone: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12z' },
  { key: 'tarefa', label: 'Tarefa', cor: '#6b7280', icone: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  { key: 'video', label: 'Video', cor: '#b91c1c', icone: 'M5 3l14 9-14 9V3z' },
]

// Tipos personalizados criados pela equipe (persistidos no servidor). Mantidos em
// modulo para que os badges dos cards (que usam tipoInfo) resolvam tipos custom.
let TIPOS_CUSTOM: { key: string; label: string; cor: string; icone: string }[] = []
function todosTipos() { return [...TIPOS, ...TIPOS_CUSTOM] }
function tipoInfo(key?: string) { return todosTipos().find(t => t.key === key) || TIPOS.find(t => t.key === 'tarefa')! }

function forcarDownload(url: string, nome: string) {
  fetch(url).then(r => r.blob()).then(blob => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = nome
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 100)
  }).catch(() => { window.open(url, '_blank') })
}

function TextoComMencoes({ texto }: { texto: string }) {
  const partes = texto.split(/(@[a-zA-ZÀ-ÿ\s]+?)(?=\s@|\s*$|[.,!?;:\])])/g)
  return <>{partes.map((p, i) => p.startsWith('@') ? <span key={i} style={{ color: '#2563eb', fontWeight: 600 }}>{p}</span> : <span key={i}>{p}</span>)}</>
}

function ConfirmPopup({ mensagem, onConfirm, onCancel }: { mensagem: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', maxWidth: 400, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111', lineHeight: 1.4 }}>{mensagem}</p>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: '#888' }}>A tarefa sera movida para a lixeira e podera ser restaurada em ate 30 dias.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '9px 20px', background: '#f5f5f5', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#555', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onConfirm} style={{ padding: '9px 20px', background: '#b91c1c', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>Excluir</button>
        </div>
      </div>
    </div>
  )
}

function AnexoViewer({ anexo, anexoIndex, onClose, onAddAnotacao, onRemoveAnotacao }: {
  anexo: Anexo; anexoIndex: number
  onClose: () => void
  onAddAnotacao: (idx: number, anotacao: Anotacao) => void
  onRemoveAnotacao: (idx: number, anotacaoId: string) => void
}) {
  const [pendente, setPendente] = useState<{ x: number; y: number } | null>(null)
  const [textoAnotacao, setTextoAnotacao] = useState('')
  const [anotacaoHover, setAnotacaoHover] = useState<string | null>(null)
  const ehImagem = anexo.tipo.startsWith('image')
  const ehVideo = anexo.tipo.startsWith('video')
  const anotacoes = anexo.anotacoes || []

  function handleClickImagem(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPendente({ x, y })
    setTextoAnotacao('')
  }

  function confirmarAnotacao() {
    if (!pendente || !textoAnotacao.trim()) return
    onAddAnotacao(anexoIndex, {
      id: uuid(), x: pendente.x, y: pendente.y, texto: textoAnotacao.trim(),
      autor: '', autorNome: '', criadoEm: new Date().toISOString(),
    })
    setPendente(null)
    setTextoAnotacao('')
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 0, maxWidth: 1200, width: '100%', maxHeight: '92vh', background: '#1a1a1a', borderRadius: 16, overflow: 'hidden' }}>
        {/* Lado esquerdo — midia */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', minWidth: 0, background: '#111' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          <button onClick={() => forcarDownload(anexo.url, anexo.nome)} style={{ position: 'absolute', top: 12, right: 52, width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
            title="Baixar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          {ehImagem && (
            <div onClick={handleClickImagem} style={{ position: 'relative', cursor: 'crosshair', maxWidth: '100%', maxHeight: '92vh' }}>
              <img src={anexo.url} alt={anexo.nome} style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', display: 'block' }} />
              {anotacoes.map((an, idx) => (
                <div key={an.id}
                  onMouseEnter={() => setAnotacaoHover(an.id)}
                  onMouseLeave={() => setAnotacaoHover(null)}
                  style={{ position: 'absolute', left: `${an.x}%`, top: `${an.y}%`, transform: 'translate(-50%, -50%)', zIndex: 5 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#b91c1c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', cursor: 'pointer' }}>
                    {idx + 1}
                  </div>
                  {anotacaoHover === an.id && (
                    <div style={{ position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)', background: '#fff', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', minWidth: 160, maxWidth: 260, zIndex: 10 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: '#111' }}>{an.texto}</p>
                      <p style={{ margin: 0, fontSize: 10, color: '#aaa' }}>{an.autorNome} · {new Date(an.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      <button onClick={e => { e.stopPropagation(); onRemoveAnotacao(anexoIndex, an.id) }}
                        style={{ marginTop: 6, padding: '3px 8px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 4, fontSize: 10, color: '#b91c1c', cursor: 'pointer', fontWeight: 600 }}>Remover</button>
                    </div>
                  )}
                </div>
              ))}
              {pendente && (
                <div style={{ position: 'absolute', left: `${pendente.x}%`, top: `${pendente.y}%`, transform: 'translate(-50%, -50%)', zIndex: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ffc00f', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', animation: 'pulse 1s infinite' }}>?</div>
                  <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)', background: '#fff', borderRadius: 10, padding: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', minWidth: 220, zIndex: 10 }}>
                    <textarea value={textoAnotacao} onChange={e => setTextoAnotacao(e.target.value)} placeholder="Descreva a correcao..."
                      autoFocus style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 12, minHeight: 50, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmarAnotacao() } }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setPendente(null)} style={{ flex: 1, padding: '6px 0', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#666', cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={confirmarAnotacao} disabled={!textoAnotacao.trim()} style={{ flex: 1, padding: '6px 0', background: textoAnotacao.trim() ? '#b91c1c' : '#f0f0f0', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, color: textoAnotacao.trim() ? '#fff' : '#aaa', cursor: textoAnotacao.trim() ? 'pointer' : 'not-allowed' }}>Marcar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {ehVideo && <video src={anexo.url} controls style={{ maxWidth: '100%', maxHeight: '85vh' }} />}
          {!ehImagem && !ehVideo && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              <p style={{ margin: 0, fontSize: 14, color: '#ccc', fontWeight: 600 }}>{anexo.nome}</p>
              <a href={anexo.url} target="_blank" rel="noreferrer" style={{ padding: '8px 20px', background: '#ffc00f', color: '#111', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Abrir arquivo</a>
            </div>
          )}
          {ehImagem && <p style={{ margin: '8px 0 0', fontSize: 11, color: '#888', textAlign: 'center' }}>Clique na imagem para marcar uma correcao</p>}
        </div>

        {/* Lado direito — lista de anotacoes */}
        {ehImagem && (
          <div style={{ width: 280, background: '#1e1e1e', borderLeft: '1px solid #333', padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 800, color: '#fff' }}>Correcoes ({anotacoes.length})</h4>
            {anotacoes.length === 0 && <p style={{ margin: 0, fontSize: 12, color: '#666' }}>Nenhuma correcao marcada. Clique na imagem para adicionar.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {anotacoes.map((an, idx) => (
                <div key={an.id}
                  onMouseEnter={() => setAnotacaoHover(an.id)}
                  onMouseLeave={() => setAnotacaoHover(null)}
                  style={{ display: 'flex', gap: 10, padding: '10px 12px', background: anotacaoHover === an.id ? '#2a2a2a' : '#252525', borderRadius: 8, border: anotacaoHover === an.id ? '1px solid #555' : '1px solid #333', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#b91c1c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{idx + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 12, color: '#eee', lineHeight: 1.4 }}>{an.texto}</p>
                    <p style={{ margin: 0, fontSize: 10, color: '#777' }}>{an.autorNome || 'Voce'} · {new Date(an.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); onRemoveAnotacao(anexoIndex, an.id) }} title="Remover"
                    style={{ width: 20, height: 20, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const COLUNAS: { key: string; label: string }[] = [
  { key: 'a_fazer', label: 'A fazer' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'em_revisao', label: 'Em revisao' },
  { key: 'concluido', label: 'Concluido' },
]

const PRIORIDADES: { key: string; label: string; cor: string }[] = [
  { key: 'urgente', label: 'Urgente', cor: '#b91c1c' },
  { key: 'alta', label: 'Alta', cor: '#ea580c' },
  { key: 'media', label: 'Media', cor: '#ca8a04' },
  { key: 'baixa', label: 'Baixa', cor: '#6b7280' },
]

function corPrioridade(p: string) { return PRIORIDADES.find(x => x.key === p)?.cor || '#888' }

function prazoFormatado(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function ehAtrasado(prazo?: string, status?: string) {
  if (!prazo || status === 'concluido') return false
  return new Date(prazo).getTime() < Date.now()
}

export default function GestaoTarefas({ clientes, usuarios, abrirTarefaId, onAbriuTarefa }: { clientes: Cliente[]; usuarios: Usuario[]; abrirTarefaId?: string | null; onAbriuTarefa?: () => void }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [excluidas, setExcluidas] = useState<Tarefa[]>([])
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [mostrarLixeira, setMostrarLixeira] = useState(false)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [novaModal, setNovaModal] = useState(false)
  const [editModal, setEditModal] = useState<Tarefa | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [tarefaViewMode, setTarefaViewMode] = useState<'modal' | 'fullscreen' | 'sidebar'>('modal')
  const [confirmPopup, setConfirmPopup] = useState<{ mensagem: string; onConfirm: () => void } | null>(null)
  // Tipos de tarefa personalizados (criados pela equipe, aplicam-se a tudo)
  const [tiposCustom, setTiposCustom] = useState<{ key: string; label: string; cor: string; icone: string }[]>(TIPOS_CUSTOM)
  function aplicarTiposCustom(lista: { key: string; label: string; cor: string; icone: string }[]) {
    TIPOS_CUSTOM = Array.isArray(lista) ? lista : []
    setTiposCustom(TIPOS_CUSTOM)
  }
  useEffect(() => { fetch('/api/tipos-tarefa').then(r => r.json()).then(d => { if (Array.isArray(d)) aplicarTiposCustom(d) }).catch(() => {}) }, [])
  // Abrir uma tarefa especifica (ex.: vindo de "Meu dia")
  useEffect(() => {
    if (!abrirTarefaId) return
    const t = tarefas.find(x => x.id === abrirTarefaId)
    if (t) { setEditModal(t); setTarefaViewMode('modal'); onAbriuTarefa?.() }
  }, [abrirTarefaId, tarefas])

  function carregar() {
    fetch('/api/tarefas').then(r => r.json()).then(d => setTarefas(Array.isArray(d) ? d : [])).catch(() => {})
  }
  function carregarLixeira() {
    fetch('/api/tarefas?lixeira=true').then(r => r.json()).then(d => setExcluidas(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => { carregar() }, [])
  useEffect(() => { if (mostrarLixeira) carregarLixeira() }, [mostrarLixeira])

  async function moverStatus(id: string, status: string) {
    setTarefas(ts => ts.map(t => t.id === id ? { ...t, status } : t))
    await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) }).catch(() => {})
    carregar()
  }

  async function restaurarTarefa(id: string) {
    await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restaurar: true }) })
    carregarLixeira()
    carregar()
  }

  async function excluirPermanente(id: string) {
    await fetch(`/api/tarefas?id=${id}&permanente=true`, { method: 'DELETE' })
    carregarLixeira()
  }

  const filtradas = tarefas.filter(t => {
    if (filtroCliente && t.clienteId !== filtroCliente) return false
    if (filtroResponsavel && t.responsavelEmail !== filtroResponsavel) return false
    return true
  })

  const [selecionadas, setSelecionadas] = useState<string[]>([])
  function alternarSelecao(id: string) { setSelecionadas(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]) }
  function excluirSelecionadas() {
    setConfirmPopup({
      mensagem: `Excluir ${selecionadas.length} tarefa(s)?`,
      onConfirm: async () => {
        await Promise.all(selecionadas.map(id => fetch(`/api/tarefas?id=${id}`, { method: 'DELETE' })))
        setSelecionadas([])
        carregar()
        setConfirmPopup(null)
      }
    })
  }

  function diasRestantes(excluidoEm?: string) {
    if (!excluidoEm) return 30
    const diff = 30 - Math.floor((Date.now() - new Date(excluidoEm).getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  }

  return (
    <div>
      {confirmPopup && <ConfirmPopup mensagem={confirmPopup.mensagem} onConfirm={confirmPopup.onConfirm} onCancel={() => setConfirmPopup(null)} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Tarefas</h2>
        {!mostrarLixeira && (
          <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 10, padding: 3 }}>
            {(['kanban', 'lista'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '7px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: view === v ? '#fff' : 'transparent', color: view === v ? '#111' : '#888',
                boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}>{v === 'kanban' ? 'Kanban' : 'Lista'}</button>
            ))}
          </div>
        )}
        {!mostrarLixeira && (
          <>
            <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }}>
              <option value="">Todos os clientes</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }}>
              <option value="">Todos os responsaveis</option>
              {(usuarios || []).filter(u => u.role !== 'cliente').map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
            </select>
            {(filtroCliente || filtroResponsavel) && (
              <button onClick={() => { setFiltroCliente(''); setFiltroResponsavel('') }} style={{ padding: '8px 14px', background: '#f0f0f0', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#666', cursor: 'pointer' }}>Limpar filtros</button>
            )}
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setMostrarLixeira(!mostrarLixeira)} style={{
            padding: '9px 14px', background: mostrarLixeira ? '#fef2f2' : '#f5f5f5', border: mostrarLixeira ? '1px solid #fca5a5' : '1px solid #e0e0e0',
            borderRadius: 10, fontSize: 12, fontWeight: 600, color: mostrarLixeira ? '#b91c1c' : '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            {mostrarLixeira ? 'Voltar' : 'Lixeira'}
            {!mostrarLixeira && excluidas.length > 0 && <span style={{ background: '#b91c1c', color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>{excluidas.length}</span>}
          </button>
          {!mostrarLixeira && (
            <button onClick={() => setNovaModal(true)} className="soma10-no-invert" style={{ padding: '9px 16px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Nova tarefa</button>
          )}
        </div>
      </div>

      {selecionadas.length > 0 && !mostrarLixeira && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 16px', background: '#fff', border: '1px solid #eee', borderRadius: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{selecionadas.length} selecionada(s)</span>
          <button onClick={() => setSelecionadas([])} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#666', cursor: 'pointer' }}>Limpar</button>
          <button onClick={excluirSelecionadas} style={{ marginLeft: 'auto', background: '#991b1b', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Excluir selecionadas</button>
        </div>
      )}

      {/* KANBAN */}
      {view === 'kanban' && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, height: 'calc(100vh - 200px)', alignItems: 'stretch' }}>
          {COLUNAS.map(col => {
            const cards = filtradas.filter(t => t.status === col.key)
            return (
              <div key={col.key}
                onDragOver={e => { if (dragId) { e.preventDefault(); setOverCol(col.key) } }}
                onDragLeave={() => setOverCol(o => o === col.key ? null : o)}
                onDrop={() => { if (dragId) moverStatus(dragId, col.key); setDragId(null); setOverCol(null) }}
                style={{
                  flex: '0 0 240px', width: 240, background: overCol === col.key ? '#fffbeb' : '#f6f6f7', borderRadius: 12, padding: 10,
                  outline: overCol === col.key ? '2px dashed #ffc00f' : 'none', outlineOffset: -2,
                  display: 'flex', flexDirection: 'column', minHeight: 0,
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#444' }}>{col.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', background: '#fff', borderRadius: 999, padding: '1px 8px' }}>{cards.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto', minHeight: 60 }}>
                  {cards.map(t => (
                    <div key={t.id} draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOverCol(null) }}
                      onClick={() => setEditModal(t)}
                      style={{ background: '#fff', borderRadius: 10, padding: '26px 10px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', cursor: 'grab', opacity: dragId === t.id ? 0.4 : 1, borderLeft: `3px solid ${corPrioridade(t.prioridade)}`, position: 'relative' }}>
                      {(() => { const tp = tipoInfo(t.tipo); return (
                        <span style={{ position: 'absolute', top: 6, left: 8, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: tp.cor, background: `${tp.cor}15`, borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={tp.cor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={tp.icone} /></svg>
                          {tp.label}
                        </span>
                      )})()}
                      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#111', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.titulo}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {t.responsavelNome && (() => { const u = (usuarios || []).find(x => x.email === t.responsavelEmail); return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#555', background: '#f0f0f0', borderRadius: 999, padding: '1px 6px' }}>
                            {u?.foto ? <OptImg src={u.foto} size={14} /> : null}
                            {t.responsavelNome}
                          </span>
                        )})()}
                        {t.clienteNome && (() => { const c = (clientes || []).find(x => x.id === t.clienteId); return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#888' }}>
                            {c?.logo ? <OptImg src={c.logo} size={14} /> : null}
                            {t.clienteNome}
                          </span>
                        )})()}
                        {t.prazo && <span style={{ fontSize: 10, color: ehAtrasado(t.prazo, t.status) ? '#b91c1c' : '#888', fontWeight: ehAtrasado(t.prazo, t.status) ? 700 : 500 }}>{prazoFormatado(t.prazo)}{ehAtrasado(t.prazo, t.status) ? ' (atrasado)' : ''}</span>}
                        {(t.anexos || []).length > 0 && <span style={{ fontSize: 10, color: '#1d4ed8', background: '#dbeafe', borderRadius: 999, padding: '1px 6px' }}>{t.anexos!.length} anexo(s)</span>}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <span onClick={e => { e.stopPropagation(); alternarSelecao(t.id) }}
                          style={{ width: 16, height: 16, borderRadius: 4, border: selecionadas.includes(t.id) ? '1.5px solid #1877f2' : '1px solid #ccc',
                            background: selecionadas.includes(t.id) ? '#1877f2' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {selecionadas.includes(t.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                        </span>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && <p style={{ margin: 0, fontSize: 11, color: '#bbb', textAlign: 'center', padding: '14px 0' }}>--</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* LISTA */}
      {view === 'lista' && (
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px 120px 100px 90px 90px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #f0f0f0', fontSize: 11, fontWeight: 700, color: '#888' }}>
            <span>Tipo</span><span>Tarefa</span><span>Responsavel</span><span>Cliente</span><span>Prazo</span><span>Prioridade</span><span>Status</span>
          </div>
          {filtradas.length === 0 && <p style={{ margin: 0, padding: 30, textAlign: 'center', color: '#bbb', fontSize: 13 }}>Nenhuma tarefa encontrada.</p>}
          {filtradas.map(t => {
            const tp = tipoInfo(t.tipo)
            return (
            <div key={t.id} onClick={() => setEditModal(t)} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px 120px 100px 90px 90px', gap: 8, padding: '10px 16px', borderBottom: '1px solid #f8f8f8', cursor: 'pointer', alignItems: 'center', fontSize: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: tp.cor, fontWeight: 600 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={tp.cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={tp.icone} /></svg>
                {tp.label}
              </span>
              <span style={{ fontWeight: 600, color: '#111' }}>{t.titulo}</span>
              <span style={{ color: '#555' }}>{t.responsavelNome || '--'}</span>
              <span style={{ color: '#888' }}>{t.clienteNome || '--'}</span>
              <span style={{ color: ehAtrasado(t.prazo, t.status) ? '#b91c1c' : '#888', fontWeight: ehAtrasado(t.prazo, t.status) ? 700 : 500 }}>{prazoFormatado(t.prazo) || '--'}{ehAtrasado(t.prazo, t.status) ? ' (atrasado)' : ''}</span>
              <span style={{ color: corPrioridade(t.prioridade), fontWeight: 700 }}>{PRIORIDADES.find(p => p.key === t.prioridade)?.label || t.prioridade}</span>
              <span style={{ fontSize: 11 }}>{COLUNAS.find(c => c.key === t.status)?.label || t.status}</span>
            </div>
          )})}
        </div>
      )}

      {/* LIXEIRA */}
      {mostrarLixeira && (
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Tarefas excluidas</span>
            <span style={{ fontSize: 11, color: '#888' }}>Removidas automaticamente apos 30 dias</span>
          </div>
          {excluidas.length === 0 && <p style={{ margin: 0, padding: 40, textAlign: 'center', color: '#bbb', fontSize: 13 }}>Nenhuma tarefa na lixeira.</p>}
          {excluidas.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #f8f8f8' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#555', textDecoration: 'line-through' }}>{t.titulo}</p>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#aaa' }}>
                  {t.clienteNome && <span>{t.clienteNome}</span>}
                  {t.excluidoPor && <span>Excluida por {t.excluidoPor}</span>}
                  <span>{diasRestantes(t.excluidoEm)} dia(s) restante(s)</span>
                </div>
              </div>
              <button onClick={() => restaurarTarefa(t.id)} style={{ padding: '6px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#166534', cursor: 'pointer' }}>Restaurar</button>
              <button onClick={() => setConfirmPopup({ mensagem: `Excluir "${t.titulo}" permanentemente? Esta acao nao pode ser desfeita.`, onConfirm: () => { excluirPermanente(t.id); setConfirmPopup(null) } })}
                style={{ padding: '6px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#b91c1c', cursor: 'pointer' }}>Excluir</button>
            </div>
          ))}
        </div>
      )}

      {/* Modal nova/editar tarefa */}
      {(novaModal || editModal) && (
        <TarefaModal tarefa={editModal} clientes={clientes} usuarios={usuarios}
          tiposCustom={tiposCustom} onTiposCustom={aplicarTiposCustom}
          viewMode={editModal ? tarefaViewMode : 'modal'}
          onChangeViewMode={setTarefaViewMode}
          onClose={() => { setNovaModal(false); setEditModal(null) }}
          onSalvo={() => { if (tarefaViewMode !== 'sidebar') { setNovaModal(false); setEditModal(null) }; carregar() }}
          onRecarregar={(t) => { setEditModal(t); carregar() }}
          onExcluir={editModal ? () => {
            const id = editModal.id
            setConfirmPopup({
              mensagem: `Excluir a tarefa "${editModal.titulo}"?`,
              onConfirm: async () => { await fetch(`/api/tarefas?id=${id}`, { method: 'DELETE' }); setEditModal(null); setConfirmPopup(null); carregar() }
            })
          } : undefined}
        />
      )}
    </div>
  )
}

function TarefaModal({ tarefa, clientes, usuarios, tiposCustom = [], onTiposCustom, onClose, onSalvo, onExcluir, onRecarregar, viewMode = 'modal', onChangeViewMode }: {
  tarefa: Tarefa | null; clientes: Cliente[]; usuarios: Usuario[]
  tiposCustom?: { key: string; label: string; cor: string; icone: string }[]
  onTiposCustom?: (lista: { key: string; label: string; cor: string; icone: string }[]) => void
  onClose: () => void; onSalvo: () => void; onExcluir?: () => void; onRecarregar?: (tarefaAtualizada: Tarefa) => void
  viewMode?: 'modal' | 'fullscreen' | 'sidebar'; onChangeViewMode?: (m: 'modal' | 'fullscreen' | 'sidebar') => void
}) {
  const [form, setForm] = useState({
    titulo: tarefa?.titulo || '', descricao: tarefa?.descricao || '',
    tipo: tarefa?.tipo || 'tarefa',
    status: tarefa?.status || 'a_fazer', prioridade: tarefa?.prioridade || 'media',
    responsavelEmail: tarefa?.responsavelEmail || '', clienteId: tarefa?.clienteId || '',
    marcoId: (tarefa as any)?.marcoId || '',
    prazo: tarefa?.prazo ? tarefa.prazo.split('T')[0] : '',
  })
  const [marcos, setMarcos] = useState<{ id: string; titulo: string }[]>([])
  // Criar novo tipo de tarefa (padrao) direto daqui — fica fixo no dropdown e vale para tudo
  const [criandoTipo, setCriandoTipo] = useState(false)
  const [novoTipoLabel, setNovoTipoLabel] = useState('')
  const [novoTipoCor, setNovoTipoCor] = useState('#6b7280')
  const [salvandoTipo, setSalvandoTipo] = useState(false)
  async function criarTipo() {
    const label = novoTipoLabel.trim()
    if (!label || salvandoTipo) return
    setSalvandoTipo(true)
    try {
      const r = await fetch('/api/tipos-tarefa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, cor: novoTipoCor }) })
      const d = await r.json()
      if (r.ok && d?.tipo?.key) {
        onTiposCustom?.(d.tipos)
        setForm(f => ({ ...f, tipo: d.tipo.key }))
        setNovoTipoLabel(''); setNovoTipoCor('#6b7280'); setCriandoTipo(false)
      } else {
        alert('Nao foi possivel criar o tipo: ' + (d?.error || 'erro desconhecido'))
      }
    } catch { alert('Nao foi possivel criar o tipo.') } finally { setSalvandoTipo(false) }
  }
  useEffect(() => {
    if (!form.clienteId) { setMarcos([]); return }
    fetch(`/api/playbook?clienteId=${form.clienteId}`).then(r => r.json()).then(d => setMarcos(Array.isArray(d) ? d : [])).catch(() => {})
  }, [form.clienteId])
  // Criar etapa do Playbook direto daqui (quando o cliente nao tem a fase desejada)
  const [criandoEtapa, setCriandoEtapa] = useState(false)
  const [novaEtapaTitulo, setNovaEtapaTitulo] = useState('')
  const [salvandoEtapa, setSalvandoEtapa] = useState(false)
  async function criarEtapaRapida() {
    const titulo = novaEtapaTitulo.trim()
    if (!titulo || !form.clienteId || salvandoEtapa) return
    setSalvandoEtapa(true)
    try {
      const cli = (clientes || []).find(c => c.id === form.clienteId)
      const r = await fetch('/api/playbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId: form.clienteId, clienteNome: cli?.nome || '', titulo }) })
      const d = await r.json()
      if (r.ok && d?.marco?.id) {
        setMarcos(m => [...m, { id: d.marco.id, titulo: d.marco.titulo }])
        setForm(f => ({ ...f, marcoId: d.marco.id }))
        setNovaEtapaTitulo(''); setCriandoEtapa(false)
      } else {
        alert('Nao foi possivel criar a etapa: ' + (d?.error || 'erro desconhecido'))
      }
    } catch { alert('Nao foi possivel criar a etapa.') } finally { setSalvandoEtapa(false) }
  }
  const [anexos, setAnexos] = useState<Anexo[]>(tarefa?.anexos || [])
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  const [progAnexo, setProgAnexo] = useState<number | null>(null)
  // Apontamento de horas
  const [apontamentos, setApontamentos] = useState<any[]>((tarefa as any)?.apontamentos || [])
  const [apontH, setApontH] = useState('')
  const [apontM, setApontM] = useState('')
  const [apontDesc, setApontDesc] = useState('')
  const [salvandoApont, setSalvandoApont] = useState(false)
  const [timerInicio, setTimerInicio] = useState<number | null>(null)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!tarefa?.id) return
    const s = localStorage.getItem(`apont:${tarefa.id}`)
    if (s) setTimerInicio(Number(s) || null)
  }, [tarefa?.id])
  useEffect(() => {
    if (timerInicio === null) return
    const t = setInterval(() => setTick(x => x + 1), 1000)
    return () => clearInterval(t)
  }, [timerInicio])
  const totalMin = apontamentos.reduce((s, a) => s + (Number(a.minutos) || 0), 0)
  function fmtMin(min: number) { return `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}` }
  async function registrarApont(minutos: number, descricao: string) {
    if (!tarefa?.id || minutos <= 0) return
    setSalvandoApont(true)
    const r = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, apontarHoras: { minutos, descricao, data: new Date().toISOString() } }) }).then(x => x.json()).catch(() => null)
    setSalvandoApont(false)
    if (r?.tarefa) { setApontamentos(r.tarefa.apontamentos || []); setApontH(''); setApontM(''); setApontDesc(''); onRecarregar?.(r.tarefa) }
  }
  function iniciarTimer() { const t = Date.now(); setTimerInicio(t); if (tarefa?.id) localStorage.setItem(`apont:${tarefa.id}`, String(t)) }
  async function pararTimer() {
    if (timerInicio === null) return
    const min = Math.max(1, Math.round((Date.now() - timerInicio) / 60000))
    if (tarefa?.id) localStorage.removeItem(`apont:${tarefa.id}`)
    setTimerInicio(null)
    await registrarApont(min, 'Timer')
  }
  async function removerApont(apId: string) {
    if (!tarefa?.id) return
    const r = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, removerApontamento: apId }) }).then(x => x.json()).catch(() => null)
    if (r?.tarefa) { setApontamentos(r.tarefa.apontamentos || []); onRecarregar?.(r.tarefa) }
  }
  const [salvando, setSalvando] = useState(false)
  const [abaInterna, setAbaInterna] = useState<'detalhes' | 'activity'>('detalhes')
  const [novoComentario, setNovoComentario] = useState('')
  const [enviandoComentario, setEnviandoComentario] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [mencaoQuery, setMencaoQuery] = useState('')
  const [mencaoAberta, setMencaoAberta] = useState(false)
  const [mencaoPos, setMencaoPos] = useState(0)
  const [editandoComentarioId, setEditandoComentarioId] = useState<string | null>(null)
  const [editandoComentarioTexto, setEditandoComentarioTexto] = useState('')

  function addAnotacao(idx: number, anotacao: Anotacao) {
    setAnexos(arr => arr.map((a, i) => i === idx ? { ...a, anotacoes: [...(a.anotacoes || []), anotacao] } : a))
  }
  function removeAnotacao(idx: number, anotacaoId: string) {
    setAnexos(arr => arr.map((a, i) => i === idx ? { ...a, anotacoes: (a.anotacoes || []).filter(an => an.id !== anotacaoId) } : a))
  }

  async function enviarAnexo(arquivo: File) {
    setEnviandoAnexo(true)
    setProgAnexo(0)
    try {
      const ext = arquivo.name.split('.').pop() || 'bin'
      const blob = await upload(`tarefas/${uuid()}.${ext}`, arquivo, {
        access: 'public', handleUploadUrl: '/api/upload', contentType: arquivo.type, clientPayload: arquivo.type,
        onUploadProgress: ({ percentage }) => setProgAnexo(percentage),
      })
      setAnexos(a => [...a, { nome: arquivo.name, url: blob.url, tipo: arquivo.type }])
    } catch { /* erro silencioso */ }
    setEnviandoAnexo(false)
    setProgAnexo(null)
  }

  async function enviarComentario() {
    if (!tarefa || !novoComentario.trim()) return
    setEnviandoComentario(true)
    const res = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, novoComentario: novoComentario.trim() }) }).catch(() => null)
    setNovoComentario('')
    setEnviandoComentario(false)
    if (res) {
      const data = await res.json().catch(() => null)
      if (data?.tarefa && onRecarregar) onRecarregar(data.tarefa)
    }
  }

  async function editarComentario(comentarioId: string, novoTexto: string) {
    if (!tarefa) return
    const res = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, editarComentario: { id: comentarioId, texto: novoTexto } }) }).catch(() => null)
    if (res) {
      const data = await res.json().catch(() => null)
      if (data?.tarefa && onRecarregar) onRecarregar(data.tarefa)
    }
  }

  async function excluirComentario(comentarioId: string) {
    if (!tarefa) return
    const res = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, excluirComentario: comentarioId }) }).catch(() => null)
    if (res) {
      const data = await res.json().catch(() => null)
      if (data?.tarefa && onRecarregar) onRecarregar(data.tarefa)
    }
  }

  async function salvar() {
    // Vinculo obrigatorio: tarefa de um cliente precisa de uma etapa do Playbook
    if (form.clienteId && !form.marcoId) { alert('Vincule a tarefa a uma etapa do Playbook do cliente (campo "Etapa do Playbook").'); return }
    setSalvando(true)
    const resp = (usuarios || []).find(u => u.email === form.responsavelEmail)
    const cli = (clientes || []).find(c => c.id === form.clienteId)
    const body = { ...form, anexos, responsavelNome: resp?.nome || '', clienteNome: cli?.nome || '', prazo: form.prazo ? new Date(form.prazo + 'T23:59:59').toISOString() : '' }
    if (tarefa) {
      await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, ...body }) })
    } else {
      await fetch('/api/tarefas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSalvando(false)
    onSalvo()
  }

  const showActivitySide = tarefa && viewMode !== 'sidebar'

  const wrapperStyle: Record<string, any> = {
    modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
    fullscreen: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
    sidebar: { position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 1000, overflow: 'auto' },
  }
  const outerPanelStyle: Record<string, any> = {
    modal: { background: '#fff', borderRadius: 16, maxWidth: showActivitySide ? 960 : 640, width: '100%', maxHeight: '90vh', display: 'flex', overflow: 'hidden' },
    fullscreen: { background: '#fff', borderRadius: 16, maxWidth: 1100, width: '100%', maxHeight: '94vh', display: 'flex', overflow: 'hidden' },
    sidebar: { display: 'flex', flexDirection: 'column' as const },
  }

  const anexosComAnotacoes = anexos.filter(a => (a.anotacoes || []).length > 0)

  const activityPanel = tarefa && (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: '#111' }}>Activity</h4>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 14 }}>
        {/* Anexos com miniatura clicavel */}
        {anexos.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Anexos</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {anexos.map((a, i) => (
                <div key={i} onClick={() => setViewerIndex(i)} style={{ position: 'relative', width: 56, height: 56, borderRadius: 6, overflow: 'hidden', border: '1px solid #e0e0e0', cursor: 'pointer' }}>
                  {a.tipo.startsWith('image') ? (
                    <img src={a.url} alt={a.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : a.tipo.startsWith('video') ? (
                    <video src={a.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted preload="metadata" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/></svg>
                    </div>
                  )}
                  {(a.anotacoes || []).length > 0 && (
                    <span style={{ position: 'absolute', top: 1, left: 1, background: '#b91c1c', color: '#fff', borderRadius: 999, minWidth: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, padding: '0 3px' }}>{a.anotacoes!.length}</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Correcoes marcadas */}
        {anexosComAnotacoes.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Correcoes marcadas</div>
            {anexosComAnotacoes.map((a, ai) => {
              const realIdx = anexos.indexOf(a)
              return (
              <div key={ai} style={{ marginBottom: 12 }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#555' }}>{a.nome}</p>
                {(a.anotacoes || []).map((an, idx) => (
                  <div key={an.id} onClick={() => setViewerIndex(realIdx)} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#b91c1c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{idx + 1}</div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: '#555', lineHeight: 1.3 }}>{an.texto}</p>
                      <p style={{ margin: '1px 0 0', fontSize: 9, color: '#bbb' }}>{an.autorNome || 'Voce'} · {new Date(an.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )})}
          </>
        )}

        {/* Historico */}
        {(tarefa.atividades || []).length > 0 && (
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', margin: '4px 0 8px', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Historico</div>
        )}
        {(tarefa.atividades || []).map((a: any) => (
          <div key={a.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.tipo === 'comentario' ? '#1d4ed8' : a.tipo === 'status' ? '#ffc00f' : '#ccc', marginTop: 5, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 12, color: '#555' }}>{a.descricao}</p>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: '#aaa' }}>{a.autor} · {new Date(a.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
        {anexos.length === 0 && (tarefa.comentarios || []).length === 0 && (tarefa.atividades || []).length === 0 && <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>Nenhuma atividade ainda.</p>}

        {(tarefa.comentarios || []).length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', margin: '14px 0 8px', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Comentarios</div>
            {(tarefa.comentarios || []).map((c: any) => (
              <div key={c.id} style={{ background: '#fafafa', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: '#111' }}>{c.autorNome}</span>
                  <span style={{ fontSize: 10, color: '#aaa' }}>{new Date(c.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <button onClick={() => { setEditandoComentarioId(c.id); setEditandoComentarioTexto(c.texto) }} title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => excluirComentario(c.id)} title="Excluir" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
                {editandoComentarioId === c.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <textarea value={editandoComentarioTexto} onChange={e => setEditandoComentarioTexto(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 12, minHeight: 40, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} autoFocus />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditandoComentarioId(null)} style={{ padding: '4px 10px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#666', cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={() => { editarComentario(c.id, editandoComentarioTexto); setEditandoComentarioId(null) }} disabled={!editandoComentarioTexto.trim()}
                        style={{ padding: '4px 10px', background: '#111', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>Salvar</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: '#333', whiteSpace: 'pre-wrap' }}><TextoComMencoes texto={c.texto} /></p>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, position: 'relative' }}>
        {mencaoAberta && (() => {
          const filtrados = (usuarios || []).filter(u => u.role !== 'cliente' && u.nome.toLowerCase().includes(mencaoQuery.toLowerCase()))
          return filtrados.length > 0 ? (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 160, overflowY: 'auto', zIndex: 10, marginBottom: 4 }}>
              {filtrados.map(u => (
                <button key={u.email} onClick={() => {
                  const antes = novoComentario.slice(0, mencaoPos)
                  const depois = novoComentario.slice(mencaoPos + mencaoQuery.length + 1)
                  setNovoComentario(antes + '@' + u.nome + ' ' + depois)
                  setMencaoAberta(false)
                }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12 }}>
                  {u.foto ? <img src={u.foto} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#f0f0f0' }} />}
                  <span style={{ fontWeight: 600, color: '#111' }}>{u.nome}</span>
                  <span style={{ color: '#aaa', fontSize: 10 }}>{u.role}</span>
                </button>
              ))}
            </div>
          ) : null
        })()}
        <textarea value={novoComentario} onChange={e => {
          const v = e.target.value
          setNovoComentario(v)
          const pos = e.target.selectionStart || 0
          const textoBefore = v.slice(0, pos)
          const arroba = textoBefore.lastIndexOf('@')
          if (arroba >= 0 && (arroba === 0 || v[arroba - 1] === ' ' || v[arroba - 1] === '\n')) {
            const query = textoBefore.slice(arroba + 1)
            if (!query.includes(' ') || query.length < 30) { setMencaoAberta(true); setMencaoQuery(query); setMencaoPos(arroba) }
            else setMencaoAberta(false)
          } else setMencaoAberta(false)
        }} placeholder="Escreva um comentario... Use @ para mencionar"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, minHeight: 50, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !mencaoAberta) { e.preventDefault(); enviarComentario() } }} />
        <button onClick={enviarComentario} disabled={enviandoComentario || !novoComentario.trim()}
          style={{ width: '100%', padding: '8px 0', background: novoComentario.trim() ? '#111' : '#f0f0f0', color: novoComentario.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: novoComentario.trim() ? 'pointer' : 'not-allowed' }}>
          Enviar
        </button>
      </div>
    </div>
  )

  return (
    <div onClick={viewMode !== 'sidebar' ? onClose : undefined} style={wrapperStyle[viewMode]}>
      <div onClick={e => e.stopPropagation()} style={outerPanelStyle[viewMode]}>
        {/* Lado esquerdo — Detalhes */}
        <div style={{ flex: 1, overflowY: 'auto', padding: viewMode === 'sidebar' ? 22 : 24, display: 'flex', flexDirection: 'column' }}>
          {/* Cabecalho com titulo + botoes de modo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
              {tarefa ? (<>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tipoInfo(form.tipo).cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={tipoInfo(form.tipo).icone} /></svg>
                Editar {tipoInfo(form.tipo).label.toLowerCase()}
              </>) : 'Nova tarefa'}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {tarefa && onChangeViewMode && (['modal', 'fullscreen', 'sidebar'] as const).map(m => (
                <button key={m} onClick={() => onChangeViewMode(m)} title={m === 'modal' ? 'Modal' : m === 'fullscreen' ? 'Tela cheia' : 'Sidebar'}
                  style={{ width: 28, height: 28, borderRadius: 6, border: viewMode === m ? '1.5px solid #ffc00f' : '1px solid #e0e0e0', background: viewMode === m ? '#fffbeb' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {m === 'modal' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={viewMode === m ? '#111' : '#aaa'} strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /></svg>}
                  {m === 'fullscreen' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={viewMode === m ? '#111' : '#aaa'} strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2" /></svg>}
                  {m === 'sidebar' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={viewMode === m ? '#111' : '#aaa'} strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2" /><path d="M14 2v20" /></svg>}
                </button>
              ))}
              <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>x</button>
            </div>
          </div>

          {/* Abas internas — so no sidebar (sem espaco lateral pra activity) */}
          {tarefa && viewMode === 'sidebar' && (
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
              {(['detalhes', 'activity'] as const).map(a => (
                <button key={a} onClick={() => setAbaInterna(a)} style={{
                  padding: '8px 18px', border: 'none', borderBottom: abaInterna === a ? '2px solid #ffc00f' : '2px solid transparent',
                  background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: abaInterna === a ? 700 : 500, color: abaInterna === a ? '#111' : '#888',
                }}>{a === 'detalhes' ? 'Detalhes' : 'Activity'}</button>
              ))}
            </div>
          )}

          {/* DETALHES */}
          {(!tarefa || viewMode !== 'sidebar' || abaInterna === 'detalhes') && (<>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Titulo *</label>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="O que precisa ser feito?"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div style={{ width: 160 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Tipo</label>
                <div style={{ position: 'relative' }}>
                  <select value={form.tipo} onChange={e => { if (e.target.value === '__novo__') { setCriandoTipo(true) } else { setForm(f => ({ ...f, tipo: e.target.value })) } }}
                    style={{ width: '100%', padding: '10px 12px 10px 32px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff', appearance: 'none', boxSizing: 'border-box' }}>
                    {[...TIPOS, ...tiposCustom].map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    <option value="__novo__">+ Criar novo tipo...</option>
                  </select>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tipoInfo(form.tipo).cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <path d={tipoInfo(form.tipo).icone} />
                  </svg>
                  {criandoTipo && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30, width: 250, background: '#fff', border: '1.5px solid #e0e0e0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#111', marginBottom: 8 }}>Novo tipo de tarefa</div>
                      <input autoFocus value={novoTipoLabel} onChange={e => setNovoTipoLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); criarTipo() } }} placeholder="Ex: Newsletter, Podcast..."
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>Cor</span>
                        <input type="color" value={novoTipoCor} onChange={e => setNovoTipoCor(e.target.value)}
                          style={{ width: 34, height: 28, border: '1px solid #e0e0e0', borderRadius: 6, padding: 0, cursor: 'pointer', background: '#fff' }} />
                        <span style={{ fontSize: 11, color: '#aaa' }}>{novoTipoCor}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={criarTipo} disabled={!novoTipoLabel.trim() || salvandoTipo}
                          style={{ flex: 1, padding: '8px 0', background: novoTipoLabel.trim() ? '#111' : '#f0f0f0', color: novoTipoLabel.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: novoTipoLabel.trim() && !salvandoTipo ? 'pointer' : 'not-allowed' }}>{salvandoTipo ? 'Criando...' : 'Criar tipo'}</button>
                        <button type="button" onClick={() => { setCriandoTipo(false); setNovoTipoLabel('') }}
                          style={{ padding: '8px 12px', background: '#fff', color: '#666', border: '1.5px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: 10.5, color: '#aaa', lineHeight: 1.4 }}>Fica fixo no dropdown e disponivel em todas as tarefas.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Responsavel</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(() => { const u = (usuarios || []).find(x => x.email === form.responsavelEmail); return u?.foto ? <OptImg src={u.foto} size={28} style={{ flexShrink: 0 }} /> : null })()}
                  <select value={form.responsavelEmail} onChange={e => setForm(f => ({ ...f, responsavelEmail: e.target.value }))}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                    <option value="">Sem responsavel</option>
                    {(usuarios || []).filter(u => u.role !== 'cliente').map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Cliente vinculado</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(() => { const c = (clientes || []).find(x => x.id === form.clienteId); return c?.logo ? <OptImg src={c.logo} size={28} style={{ flexShrink: 0 }} /> : null })()}
                  <select value={form.clienteId} onChange={e => setForm(f => ({ ...f, clienteId: e.target.value, marcoId: '' }))}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                    <option value="">Nenhum</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>Etapa do Playbook *</label>
                  {form.clienteId && !criandoEtapa && <button type="button" onClick={() => setCriandoEtapa(true)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>+ Criar etapa</button>}
                </div>
                {!form.clienteId && (
                  <select disabled value="" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#f7f7f7', color: '#aaa' }}>
                    <option value="">Selecione um &quot;Cliente vinculado&quot; primeiro...</option>
                  </select>
                )}
                {form.clienteId && !criandoEtapa && (<>
                  <select value={form.marcoId} onChange={e => { if (e.target.value === '__nova__') { setCriandoEtapa(true) } else { setForm(f => ({ ...f, marcoId: e.target.value })) } }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                    <option value="">{marcos.length === 0 ? 'Nenhuma etapa — crie uma abaixo' : 'Selecione a etapa...'}</option>
                    {marcos.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
                    <option value="__nova__">+ Criar nova etapa...</option>
                  </select>
                  {marcos.length === 0 && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#ea580c' }}>Este cliente não tem etapas no Playbook. Clique em "+ Criar etapa".</p>}
                </>)}
                {form.clienteId && criandoEtapa && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input autoFocus value={novaEtapaTitulo} onChange={e => setNovaEtapaTitulo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); criarEtapaRapida() } }} placeholder="Nome da etapa (ex: Conteudos Julho)"
                      style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    <button type="button" onClick={criarEtapaRapida} disabled={!novaEtapaTitulo.trim() || salvandoEtapa}
                      style={{ padding: '10px 14px', background: novaEtapaTitulo.trim() ? '#111' : '#f0f0f0', color: novaEtapaTitulo.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: novaEtapaTitulo.trim() && !salvandoEtapa ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>{salvandoEtapa ? '...' : 'Criar'}</button>
                    <button type="button" onClick={() => { setCriandoEtapa(false); setNovaEtapaTitulo('') }}
                      style={{ padding: '10px 12px', background: '#fff', color: '#666', border: '1.5px solid #e0e0e0', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Prazo</label>
                <input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Prioridade</label>
                <select value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                  {PRIORIDADES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                  {COLUNAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Descricao</label>
              <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes, contexto, links..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          </div>
          {/* Anexos */}
          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Anexos</label>
            {anexos.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {anexos.map((a, i) => (
                  <div key={i} onClick={() => setViewerIndex(i)} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #e0e0e0', cursor: 'pointer' }}>
                    {a.tipo.startsWith('video') ? (
                      <video src={a.url} style={{ width: 80, height: 80, objectFit: 'cover' }} muted preload="metadata" />
                    ) : a.tipo.startsWith('image') ? (
                      <img src={a.url} alt={a.nome} style={{ width: 80, height: 80, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, background: '#f5f5f5', fontSize: 10, color: '#666', padding: 4, textAlign: 'center', wordBreak: 'break-all' }}>{a.nome}</div>
                    )}
                    {(a.anotacoes || []).length > 0 && (
                      <span style={{ position: 'absolute', top: 2, left: 2, background: '#b91c1c', color: '#fff', borderRadius: 999, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, padding: '0 4px' }}>{a.anotacoes!.length}</span>
                    )}
                    <button onClick={e => { e.stopPropagation(); setAnexos(arr => arr.filter((_, j) => j !== i)) }} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                    <button onClick={e => { e.stopPropagation(); forcarDownload(a.url, a.nome) }}
                      style={{ position: 'absolute', bottom: 2, right: 2, width: 20, height: 20, borderRadius: 4, background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      title={`Baixar ${a.nome}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: '#f5f5f5', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#444' }}>
              {enviandoAnexo ? 'Enviando...' : '+ Adicionar anexo'}
              <input type="file" accept="image/*,video/*,.pdf,.doc,.docx" style={{ display: 'none' }} disabled={enviandoAnexo}
                onChange={e => { if (e.target.files?.[0]) enviarAnexo(e.target.files[0]); e.target.value = '' }} />
            </label>
            <UploadProgress valor={progAnexo} rotulo="Enviando anexo..." />
          </div>

          {/* Apontamento de horas (só em tarefa já criada) */}
          {tarefa?.id && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>Tempo trabalhado</label>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{fmtMin(totalMin)}</span>
              </div>
              {/* Timer + lançamento manual */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                {timerInicio === null ? (
                  <button type="button" onClick={iniciarTimer} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> Iniciar timer
                  </button>
                ) : (
                  <button type="button" onClick={pararTimer} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> Parar ({fmtMin(Math.max(0, (Date.now() - timerInicio) / 60000))})
                  </button>
                )}
                <span style={{ fontSize: 11, color: '#bbb' }}>ou lançar manual:</span>
                <input type="number" min="0" value={apontH} onChange={e => setApontH(e.target.value)} placeholder="h" style={{ width: 48, padding: '7px 8px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
                <input type="number" min="0" max="59" value={apontM} onChange={e => setApontM(e.target.value)} placeholder="min" style={{ width: 54, padding: '7px 8px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
                <input value={apontDesc} onChange={e => setApontDesc(e.target.value)} placeholder="o que foi feito (opcional)" style={{ flex: 1, minWidth: 120, padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
                <button type="button" disabled={salvandoApont || (Number(apontH) || 0) * 60 + (Number(apontM) || 0) <= 0} onClick={() => registrarApont((Number(apontH) || 0) * 60 + (Number(apontM) || 0), apontDesc)}
                  style={{ padding: '8px 14px', background: ((Number(apontH) || 0) * 60 + (Number(apontM) || 0) > 0) ? '#16a34a' : '#f0f0f0', color: ((Number(apontH) || 0) * 60 + (Number(apontM) || 0) > 0) ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Registrar</button>
              </div>
              {apontamentos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[...apontamentos].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).map((a: any) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#666', padding: '4px 0', borderBottom: '1px solid #f5f5f5' }}>
                      <span style={{ fontWeight: 700, color: '#111', width: 52 }}>{fmtMin(a.minutos)}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.usuarioNome}{a.descricao ? ` · ${a.descricao}` : ''}</span>
                      <span style={{ color: '#aaa' }}>{new Date(a.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                      <button onClick={() => removerApont(a.id)} title="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <button onClick={salvar} disabled={salvando || !form.titulo.trim()} className="soma10-no-invert" style={{ flex: 1, padding: '11px 0', background: form.titulo.trim() ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: form.titulo.trim() ? 'pointer' : 'not-allowed' }}>
              {salvando ? 'Salvando...' : (tarefa ? 'Salvar' : 'Criar tarefa')}
            </button>
            {onExcluir && (
              <button onClick={onExcluir} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>
            )}
          </div>
          </>)}

          {/* Activity em aba — so no sidebar */}
          {tarefa && viewMode === 'sidebar' && abaInterna === 'activity' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{activityPanel}</div>
          )}
        </div>

        {/* Lado direito — Activity (modal e fullscreen) */}
        {showActivitySide && (
          <div style={{ width: 320, borderLeft: '1px solid #f0f0f0', background: '#fafafa', padding: 20, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {activityPanel}
          </div>
        )}
      </div>

      {/* Viewer de anexo */}
      {viewerIndex !== null && anexos[viewerIndex] && (
        <AnexoViewer anexo={anexos[viewerIndex]} anexoIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onAddAnotacao={addAnotacao}
          onRemoveAnotacao={removeAnotacao}
        />
      )}
    </div>
  )
}

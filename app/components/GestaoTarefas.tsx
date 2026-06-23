'use client'
import { useEffect, useState, useCallback } from 'react'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string }
type Usuario = { id: string; nome: string; email: string; role: string; foto?: string }
type Tarefa = {
  id: string; titulo: string; descricao?: string; status: string; prioridade: string
  responsavelEmail?: string; responsavelNome?: string; clienteId?: string; clienteNome?: string
  prazo?: string; anexos?: { nome: string; url: string; tipo: string }[]
  atividades?: any[]; comentarios?: any[]
  criadoPor: string; criadoEm: string; atualizadoEm: string; concluidoEm?: string
  excluidoEm?: string; excluidoPor?: string
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

export default function GestaoTarefas({ clientes, usuarios }: { clientes: Cliente[]; usuarios: Usuario[] }) {
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
                      style={{ background: '#fff', borderRadius: 10, padding: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', cursor: 'grab', opacity: dragId === t.id ? 0.4 : 1, borderLeft: `3px solid ${corPrioridade(t.prioridade)}` }}>
                      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#111', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.titulo}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {t.responsavelNome && (() => { const u = (usuarios || []).find(x => x.email === t.responsavelEmail); return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#555', background: '#f0f0f0', borderRadius: 999, padding: '1px 6px' }}>
                            {u?.foto ? <img src={u.foto} alt="" style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} /> : null}
                            {t.responsavelNome}
                          </span>
                        )})()}
                        {t.clienteNome && (() => { const c = (clientes || []).find(x => x.id === t.clienteId); return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#888' }}>
                            {c?.logo ? <img src={c.logo} alt="" style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} /> : null}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 100px 90px 90px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #f0f0f0', fontSize: 11, fontWeight: 700, color: '#888' }}>
            <span>Tarefa</span><span>Responsavel</span><span>Cliente</span><span>Prazo</span><span>Prioridade</span><span>Status</span>
          </div>
          {filtradas.length === 0 && <p style={{ margin: 0, padding: 30, textAlign: 'center', color: '#bbb', fontSize: 13 }}>Nenhuma tarefa encontrada.</p>}
          {filtradas.map(t => (
            <div key={t.id} onClick={() => setEditModal(t)} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 100px 90px 90px', gap: 8, padding: '10px 16px', borderBottom: '1px solid #f8f8f8', cursor: 'pointer', alignItems: 'center', fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: '#111' }}>{t.titulo}</span>
              <span style={{ color: '#555' }}>{t.responsavelNome || '--'}</span>
              <span style={{ color: '#888' }}>{t.clienteNome || '--'}</span>
              <span style={{ color: ehAtrasado(t.prazo, t.status) ? '#b91c1c' : '#888', fontWeight: ehAtrasado(t.prazo, t.status) ? 700 : 500 }}>{prazoFormatado(t.prazo) || '--'}{ehAtrasado(t.prazo, t.status) ? ' (atrasado)' : ''}</span>
              <span style={{ color: corPrioridade(t.prioridade), fontWeight: 700 }}>{PRIORIDADES.find(p => p.key === t.prioridade)?.label || t.prioridade}</span>
              <span style={{ fontSize: 11 }}>{COLUNAS.find(c => c.key === t.status)?.label || t.status}</span>
            </div>
          ))}
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
          viewMode={editModal ? tarefaViewMode : 'modal'}
          onChangeViewMode={setTarefaViewMode}
          onClose={() => { setNovaModal(false); setEditModal(null) }}
          onSalvo={() => { if (tarefaViewMode !== 'sidebar') { setNovaModal(false); setEditModal(null) }; carregar() }}
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

function TarefaModal({ tarefa, clientes, usuarios, onClose, onSalvo, onExcluir, viewMode = 'modal', onChangeViewMode }: {
  tarefa: Tarefa | null; clientes: Cliente[]; usuarios: Usuario[]
  onClose: () => void; onSalvo: () => void; onExcluir?: () => void
  viewMode?: 'modal' | 'fullscreen' | 'sidebar'; onChangeViewMode?: (m: 'modal' | 'fullscreen' | 'sidebar') => void
}) {
  const [form, setForm] = useState({
    titulo: tarefa?.titulo || '', descricao: tarefa?.descricao || '',
    status: tarefa?.status || 'a_fazer', prioridade: tarefa?.prioridade || 'media',
    responsavelEmail: tarefa?.responsavelEmail || '', clienteId: tarefa?.clienteId || '',
    prazo: tarefa?.prazo ? tarefa.prazo.split('T')[0] : '',
  })
  const [anexos, setAnexos] = useState<{ nome: string; url: string; tipo: string }[]>(tarefa?.anexos || [])
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [abaInterna, setAbaInterna] = useState<'detalhes' | 'activity'>('detalhes')
  const [novoComentario, setNovoComentario] = useState('')
  const [enviandoComentario, setEnviandoComentario] = useState(false)

  async function enviarAnexo(arquivo: File) {
    setEnviandoAnexo(true)
    try {
      const ext = arquivo.name.split('.').pop() || 'bin'
      const blob = await upload(`tarefas/${uuid()}.${ext}`, arquivo, {
        access: 'public', handleUploadUrl: '/api/upload', contentType: arquivo.type, clientPayload: arquivo.type,
      })
      setAnexos(a => [...a, { nome: arquivo.name, url: blob.url, tipo: arquivo.type }])
    } catch { /* erro silencioso */ }
    setEnviandoAnexo(false)
  }

  async function enviarComentario() {
    if (!tarefa || !novoComentario.trim()) return
    setEnviandoComentario(true)
    await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, novoComentario: novoComentario.trim() }) }).catch(() => {})
    setNovoComentario('')
    setEnviandoComentario(false)
    onSalvo()
  }

  async function salvar() {
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

  const activityPanel = tarefa && (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: '#111' }}>Activity</h4>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 14 }}>
        {[...(tarefa.atividades || [])].reverse().map((a: any) => (
          <div key={a.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.tipo === 'comentario' ? '#1d4ed8' : a.tipo === 'status' ? '#ffc00f' : '#ccc', marginTop: 5, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 12, color: '#555' }}>{a.descricao}</p>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: '#aaa' }}>{a.autor} · {new Date(a.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
        {(tarefa.comentarios || []).length === 0 && (tarefa.atividades || []).length === 0 && <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>Nenhuma atividade ainda.</p>}

        {(tarefa.comentarios || []).length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', margin: '14px 0 8px', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Comentarios</div>
            {(tarefa.comentarios || []).map((c: any) => (
              <div key={c.id} style={{ background: '#fafafa', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: '#111' }}>{c.autorNome}</span>
                  <span style={{ fontSize: 10, color: '#aaa' }}>{new Date(c.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#333', whiteSpace: 'pre-wrap' }}>{c.texto}</p>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
        <textarea value={novoComentario} onChange={e => setNovoComentario(e.target.value)} placeholder="Escreva um comentario..."
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, minHeight: 50, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarComentario() } }} />
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
            <h3 style={{ margin: 0, fontSize: 16, color: '#111' }}>{tarefa ? 'Editar tarefa' : 'Nova tarefa'}</h3>
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
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Titulo *</label>
              <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="O que precisa ser feito?"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Responsavel</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(() => { const u = (usuarios || []).find(x => x.email === form.responsavelEmail); return u?.foto ? <img src={u.foto} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : null })()}
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
                  {(() => { const c = (clientes || []).find(x => x.id === form.clienteId); return c?.logo ? <img src={c.logo} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : null })()}
                  <select value={form.clienteId} onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                    <option value="">Nenhum</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
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
                  <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #e0e0e0' }}>
                    {a.tipo.startsWith('video') ? (
                      <video src={a.url} style={{ width: 80, height: 80, objectFit: 'cover' }} muted preload="metadata" />
                    ) : a.tipo.startsWith('image') ? (
                      <img src={a.url} alt={a.nome} style={{ width: 80, height: 80, objectFit: 'cover' }} />
                    ) : (
                      <a href={a.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, background: '#f5f5f5', fontSize: 10, color: '#666', textDecoration: 'none', padding: 4, textAlign: 'center', wordBreak: 'break-all' }}>{a.nome}</a>
                    )}
                    <button onClick={() => setAnexos(arr => arr.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                    <a href={a.url} download={a.nome} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                      style={{ position: 'absolute', bottom: 2, right: 2, width: 20, height: 20, borderRadius: 4, background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                      title={`Baixar ${a.nome}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </a>
                  </div>
                ))}
              </div>
            )}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: '#f5f5f5', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#444' }}>
              {enviandoAnexo ? 'Enviando...' : '+ Adicionar anexo'}
              <input type="file" accept="image/*,video/*,.pdf,.doc,.docx" style={{ display: 'none' }} disabled={enviandoAnexo}
                onChange={e => { if (e.target.files?.[0]) enviarAnexo(e.target.files[0]); e.target.value = '' }} />
            </label>
          </div>

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
    </div>
  )
}

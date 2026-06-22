'use client'
import { useEffect, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string }
type Usuario = { id: string; nome: string; email: string; role: string; foto?: string }
type Tarefa = {
  id: string; titulo: string; descricao?: string; status: string; prioridade: string
  responsavelEmail?: string; responsavelNome?: string; clienteId?: string; clienteNome?: string
  prazo?: string; anexos?: { nome: string; url: string; tipo: string }[]
  criadoPor: string; criadoEm: string; atualizadoEm: string; concluidoEm?: string
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
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [novaModal, setNovaModal] = useState(false)
  const [editModal, setEditModal] = useState<Tarefa | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)

  function carregar() {
    fetch('/api/tarefas').then(r => r.json()).then(d => setTarefas(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => { carregar() }, [])

  async function moverStatus(id: string, status: string) {
    setTarefas(ts => ts.map(t => t.id === id ? { ...t, status } : t))
    await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) }).catch(() => {})
    carregar()
  }

  const filtradas = tarefas.filter(t => {
    if (filtroCliente && t.clienteId !== filtroCliente) return false
    if (filtroResponsavel && t.responsavelEmail !== filtroResponsavel) return false
    return true
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Tarefas</h2>
        <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 10, padding: 3 }}>
          {(['kanban', 'lista'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '7px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: view === v ? '#fff' : 'transparent', color: view === v ? '#111' : '#888',
              boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}>{v === 'kanban' ? 'Kanban' : 'Lista'}</button>
          ))}
        </div>
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
        <button onClick={() => setNovaModal(true)} style={{ marginLeft: 'auto', padding: '9px 16px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Nova tarefa</button>
      </div>

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

      {/* Modal nova/editar tarefa */}
      {(novaModal || editModal) && (
        <TarefaModal tarefa={editModal} clientes={clientes} usuarios={usuarios}
          onClose={() => { setNovaModal(false); setEditModal(null) }}
          onSalvo={() => { setNovaModal(false); setEditModal(null); carregar() }}
          onExcluir={editModal ? async () => { await fetch(`/api/tarefas?id=${editModal.id}`, { method: 'DELETE' }); setEditModal(null); carregar() } : undefined}
        />
      )}
    </div>
  )
}

function TarefaModal({ tarefa, clientes, usuarios, onClose, onSalvo, onExcluir }: {
  tarefa: Tarefa | null; clientes: Cliente[]; usuarios: Usuario[]
  onClose: () => void; onSalvo: () => void; onExcluir?: () => void
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

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>{tarefa ? 'Editar tarefa' : 'Nova tarefa'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Titulo *</label>
            <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="O que precisa ser feito?"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Descricao</label>
            <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes, contexto, links..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Responsavel</label>
              <select value={form.responsavelEmail} onChange={e => setForm(f => ({ ...f, responsavelEmail: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                <option value="">Sem responsavel</option>
                {(usuarios || []).filter(u => u.role !== 'cliente').map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Cliente vinculado</label>
              <select value={form.clienteId} onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                <option value="">Nenhum</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
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
          <button onClick={salvar} disabled={salvando || !form.titulo.trim()} style={{ flex: 1, padding: '11px 0', background: form.titulo.trim() ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: form.titulo.trim() ? 'pointer' : 'not-allowed' }}>
            {salvando ? 'Salvando...' : (tarefa ? 'Salvar' : 'Criar tarefa')}
          </button>
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
          {onExcluir && (
            <button onClick={() => { if (confirm('Excluir esta tarefa?')) onExcluir() }} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>
          )}
        </div>
      </div>
    </div>
  )
}

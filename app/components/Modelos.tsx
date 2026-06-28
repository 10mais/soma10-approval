'use client'
import { useEffect, useState } from 'react'

type Cliente = { id: string; nome: string; tipo?: string }
type TMarco = { titulo: string; categoria: string; descricao?: string; diasDuracao?: number }
type TTarefa = { titulo: string; tipo?: string; prioridade?: string; marcoIndice?: number }
type Template = { id: string; nome: string; descricao?: string; marcos: TMarco[]; tarefas: TTarefa[] }

const CATEGORIAS = [
  { key: 'social_media', label: 'Social Media' }, { key: 'trafego', label: 'Tráfego pago' }, { key: 'branding', label: 'Branding' },
  { key: 'landing_page', label: 'Landing Page' }, { key: 'estrategia', label: 'Estratégia' }, { key: 'reuniao', label: 'Reunião' },
  { key: 'entrega', label: 'Entrega' }, { key: 'outro', label: 'Outro' },
]
const TIPOS = ['tarefa', 'carrossel', 'criativo', 'video', 'reel', 'story', 'post', 'estrategia', 'planejamento']
const PRIORIDADES = ['baixa', 'media', 'alta', 'urgente']
const vazio: Template = { id: '', nome: '', descricao: '', marcos: [], tarefas: [] }

export default function Modelos({ clientes }: { clientes: Cliente[] }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [editor, setEditor] = useState<Template | null>(null)
  const [aplicar, setAplicar] = useState<Template | null>(null)
  const [msg, setMsg] = useState('')

  function carregar() { fetch('/api/templates').then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : [])).catch(() => {}) }
  useEffect(() => { carregar() }, [])

  async function salvar() {
    if (!editor || !editor.nome.trim()) return
    const metodo = editor.id ? 'PUT' : 'POST'
    const r = await fetch('/api/templates', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editor) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { setEditor(null); carregar() } else alert('Não foi possível salvar o modelo.')
  }
  async function excluir(id: string) {
    if (!confirm('Excluir este modelo?')) return
    await fetch(`/api/templates?id=${id}`, { method: 'DELETE' }).catch(() => {})
    carregar()
  }

  const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
  const card: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Modelos de projeto</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Crie um modelo de etapas + tarefas e aplique a um cliente em um clique.</p>
        </div>
        <button onClick={() => setEditor({ ...vazio })} style={{ padding: '10px 18px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Novo modelo</button>
      </div>

      {msg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', fontSize: 13 }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {templates.map(t => (
          <div key={t.id} style={card}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111' }}>{t.nome}</p>
            {t.descricao && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>{t.descricao}</p>}
            <p style={{ margin: '10px 0 12px', fontSize: 12, color: '#aaa' }}>{(t.marcos || []).length} etapa(s) · {(t.tarefas || []).length} tarefa(s)</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAplicar(t)} style={{ flex: 1, padding: '8px 0', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Aplicar a cliente</button>
              <button onClick={() => setEditor(JSON.parse(JSON.stringify(t)))} style={{ padding: '8px 12px', background: '#f5f5f5', color: '#444', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Editar</button>
              <button onClick={() => excluir(t.id)} style={{ padding: '8px 10px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>×</button>
            </div>
          </div>
        ))}
        {templates.length === 0 && <p style={{ color: '#bbb', fontSize: 13 }}>Nenhum modelo ainda. Crie o primeiro.</p>}
      </div>

      {/* Editor */}
      {editor && (
        <div onClick={() => setEditor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, padding: 22, margin: '20px 0' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#111' }}>{editor.id ? 'Editar modelo' : 'Novo modelo'}</h3>
            <input value={editor.nome} onChange={e => setEditor({ ...editor, nome: e.target.value })} placeholder="Nome do modelo (ex.: Onboarding Social Media)" style={{ ...inp, width: '100%', marginBottom: 8 }} />
            <input value={editor.descricao || ''} onChange={e => setEditor({ ...editor, descricao: e.target.value })} placeholder="Descrição (opcional)" style={{ ...inp, width: '100%', marginBottom: 16 }} />

            {/* Etapas */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Etapas do Playbook</span>
              <button onClick={() => setEditor({ ...editor, marcos: [...editor.marcos, { titulo: '', categoria: 'social_media', diasDuracao: 7 }] })} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Etapa</button>
            </div>
            {editor.marcos.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <input value={m.titulo} onChange={e => { const ms = [...editor.marcos]; ms[i] = { ...m, titulo: e.target.value }; setEditor({ ...editor, marcos: ms }) }} placeholder={`Etapa ${i + 1}`} style={{ ...inp, flex: 1 }} />
                <select value={m.categoria} onChange={e => { const ms = [...editor.marcos]; ms[i] = { ...m, categoria: e.target.value }; setEditor({ ...editor, marcos: ms }) }} style={{ ...inp, background: '#fff' }}>
                  {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                <input type="number" min="0" value={m.diasDuracao ?? ''} onChange={e => { const ms = [...editor.marcos]; ms[i] = { ...m, diasDuracao: Number(e.target.value) || 0 }; setEditor({ ...editor, marcos: ms }) }} placeholder="dias" style={{ ...inp, width: 60 }} />
                <button onClick={() => setEditor({ ...editor, marcos: editor.marcos.filter((_, j) => j !== i), tarefas: editor.tarefas.map(t => t.marcoIndice === i ? { ...t, marcoIndice: undefined } : t) })} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}

            {/* Tarefas */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 8px' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Tarefas</span>
              <button onClick={() => setEditor({ ...editor, tarefas: [...editor.tarefas, { titulo: '', tipo: 'tarefa', prioridade: 'media' }] })} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Tarefa</button>
            </div>
            {editor.tarefas.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <input value={t.titulo} onChange={e => { const ts = [...editor.tarefas]; ts[i] = { ...t, titulo: e.target.value }; setEditor({ ...editor, tarefas: ts }) }} placeholder={`Tarefa ${i + 1}`} style={{ ...inp, flex: 1 }} />
                <select value={t.tipo} onChange={e => { const ts = [...editor.tarefas]; ts[i] = { ...t, tipo: e.target.value }; setEditor({ ...editor, tarefas: ts }) }} style={{ ...inp, background: '#fff' }}>
                  {TIPOS.map(tp => <option key={tp} value={tp}>{tp}</option>)}
                </select>
                <select value={t.prioridade} onChange={e => { const ts = [...editor.tarefas]; ts[i] = { ...t, prioridade: e.target.value }; setEditor({ ...editor, tarefas: ts }) }} style={{ ...inp, background: '#fff' }}>
                  {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={t.marcoIndice ?? ''} onChange={e => { const ts = [...editor.tarefas]; ts[i] = { ...t, marcoIndice: e.target.value === '' ? undefined : Number(e.target.value) }; setEditor({ ...editor, tarefas: ts }) }} style={{ ...inp, background: '#fff', maxWidth: 130 }}>
                  <option value="">Sem etapa</option>
                  {editor.marcos.map((m, j) => <option key={j} value={j}>{m.titulo || `Etapa ${j + 1}`}</option>)}
                </select>
                <button onClick={() => setEditor({ ...editor, tarefas: editor.tarefas.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={salvar} disabled={!editor.nome.trim()} style={{ flex: 1, padding: '11px 0', background: editor.nome.trim() ? '#ffc00f' : '#f0f0f0', color: editor.nome.trim() ? '#111' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Salvar modelo</button>
              <button onClick={() => setEditor(null)} style={{ padding: '11px 18px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Aplicar */}
      {aplicar && <AplicarModal template={aplicar} clientes={clientes} onClose={() => setAplicar(null)} onOk={(r) => { setAplicar(null); setMsg(`Modelo "${aplicar.nome}" aplicado: ${r.marcos} etapa(s) e ${r.tarefas} tarefa(s) criadas.`); setTimeout(() => setMsg(''), 8000) }} />}
    </div>
  )
}

function AplicarModal({ template, clientes, onClose, onOk }: { template: Template; clientes: Cliente[]; onClose: () => void; onOk: (r: { marcos: number; tarefas: number }) => void }) {
  const [clienteId, setClienteId] = useState('')
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10))
  const [salvando, setSalvando] = useState(false)
  async function aplicar() {
    if (!clienteId || salvando) return
    setSalvando(true)
    const r = await fetch('/api/templates/aplicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId: template.id, clienteId, dataInicio }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) onOk(r); else alert('Não foi possível aplicar: ' + (r?.error || 'erro'))
  }
  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: 22 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#111' }}>Aplicar modelo</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#888' }}>"{template.nome}" — cria {(template.marcos || []).length} etapa(s) e {(template.tarefas || []).length} tarefa(s) para o cliente.</p>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Cliente</label>
        <select value={clienteId} onChange={e => setClienteId(e.target.value)} style={{ ...inp, marginBottom: 12 }}>
          <option value="">Selecione...</option>
          {[...clientes].filter(c => c.tipo !== 'interno').sort((a, b) => a.nome.localeCompare(b.nome, 'pt')).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Data de início</label>
        <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ ...inp, marginBottom: 18 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={aplicar} disabled={!clienteId || salvando} style={{ flex: 1, padding: '11px 0', background: clienteId ? '#111' : '#f0f0f0', color: clienteId ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{salvando ? 'Aplicando...' : 'Aplicar'}</button>
          <button onClick={onClose} style={{ padding: '11px 18px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

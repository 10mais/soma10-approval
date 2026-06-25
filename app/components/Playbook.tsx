'use client'
import { useEffect, useState } from 'react'
import EntregasMarco, { Entregas } from './EntregasMarco'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string }
type Marco = {
  id: string; clienteId: string; clienteNome: string; titulo: string; descricao?: string
  categoria: string; status: string; dataInicio: string; dataFim?: string; responsavelNome?: string
}

const PERIODOS = [
  { key: 'semanal', label: 'Semanal', dias: 7 },
  { key: 'mensal', label: 'Mensal', dias: 30 },
  { key: 'trimestral', label: 'Trimestral', dias: 90 },
  { key: 'semestral', label: 'Semestral', dias: 180 },
  { key: 'anual', label: 'Anual', dias: 365 },
]

const CATEGORIAS: { key: string; label: string; cor: string }[] = [
  { key: 'social_media', label: 'Social Media', cor: '#1d4ed8' },
  { key: 'trafego', label: 'Trafego pago', cor: '#ea580c' },
  { key: 'branding', label: 'Branding', cor: '#7c3aed' },
  { key: 'landing_page', label: 'Landing Page', cor: '#0891b2' },
  { key: 'estrategia', label: 'Estrategia', cor: '#16a34a' },
  { key: 'reuniao', label: 'Reuniao', cor: '#ca8a04' },
  { key: 'entrega', label: 'Entrega', cor: '#dc2626' },
  { key: 'outro', label: 'Outro', cor: '#6b7280' },
]

const STATUS_COR: Record<string, string> = {
  planejado: '#e0e0e0', em_andamento: '#ffc00f', concluido: '#16a34a', atrasado: '#dc2626', cancelado: '#aaa',
}
const STATUS_LABEL: Record<string, string> = {
  planejado: 'Planejado', em_andamento: 'Em andamento', concluido: 'Concluido', atrasado: 'Atrasado', cancelado: 'Cancelado',
}

function corCategoria(cat: string) { return CATEGORIAS.find(c => c.key === cat)?.cor || '#888' }
function fmtData(iso: string) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '' }

export default function Playbook({ clientes }: { clientes: Cliente[] }) {
  const [marcos, setMarcos] = useState<Marco[]>([])
  const [periodo, setPeriodo] = useState('mensal')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [editModal, setEditModal] = useState<Marco | null>(null)
  const [novoModal, setNovoModal] = useState(false)
  const [refDate, setRefDate] = useState(new Date())

  function carregar() {
    const url = filtroCliente ? `/api/playbook?clienteId=${filtroCliente}` : '/api/playbook'
    fetch(url).then(r => r.json()).then(d => setMarcos(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => { carregar() }, [filtroCliente])

  const periodoAtual = PERIODOS.find(p => p.key === periodo) || PERIODOS[1]
  const inicio = new Date(refDate)
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date(inicio.getTime() + periodoAtual.dias * 24 * 60 * 60 * 1000)

  // Agrupa marcos por cliente
  const clientesComMarcos = clientes.filter(c => !filtroCliente || c.id === filtroCliente).filter(c => marcos.some(m => m.clienteId === c.id))
  const clientesSemMarcos = clientes.filter(c => !filtroCliente || c.id === filtroCliente).filter(c => !marcos.some(m => m.clienteId === c.id))

  const totalDias = periodoAtual.dias
  function posicaoPct(data: string): number {
    const d = new Date(data).getTime()
    const i = inicio.getTime()
    return Math.max(0, Math.min(100, ((d - i) / (fim.getTime() - i)) * 100))
  }
  function larguraPct(di: string, df?: string): number {
    const a = posicaoPct(di)
    const b = df ? posicaoPct(df) : Math.min(a + 3, 100)
    return Math.max(2, b - a)
  }

  // Gera labels de datas no eixo
  const labels: { pct: number; txt: string }[] = []
  const step = periodo === 'semanal' ? 1 : periodo === 'mensal' ? 7 : periodo === 'trimestral' ? 15 : periodo === 'semestral' ? 30 : 60
  for (let d = 0; d <= totalDias; d += step) {
    const dt = new Date(inicio.getTime() + d * 24 * 60 * 60 * 1000)
    labels.push({ pct: (d / totalDias) * 100, txt: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Playbook</h2>
        <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 10, padding: 3 }}>
          {PERIODOS.map(p => (
            <button key={p.key} onClick={() => setPeriodo(p.key)} style={{
              padding: '6px 12px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: periodo === p.key ? '#fff' : 'transparent', color: periodo === p.key ? '#111' : '#888',
              boxShadow: periodo === p.key ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}>{p.label}</button>
          ))}
        </div>
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }}>
          <option value="">Todos os clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setRefDate(d => new Date(d.getTime() - periodoAtual.dias * 24 * 60 * 60 * 1000))} style={{ width: 30, height: 30, border: '1px solid #e0e0e0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#666', fontSize: 14 }}>&#8249;</button>
          <button onClick={() => setRefDate(new Date())} style={{ padding: '0 12px', height: 30, border: '1px solid #e0e0e0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#666', fontSize: 11, fontWeight: 600 }}>Hoje</button>
          <button onClick={() => setRefDate(d => new Date(d.getTime() + periodoAtual.dias * 24 * 60 * 60 * 1000))} style={{ width: 30, height: 30, border: '1px solid #e0e0e0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#666', fontSize: 14 }}>&#8250;</button>
        </div>
        <button onClick={() => setNovoModal(true)} style={{ marginLeft: 'auto', padding: '9px 16px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Novo marco</button>
      </div>

      {/* Legenda de categorias */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {CATEGORIAS.map(c => (
          <span key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#888' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c.cor }} />{c.label}
          </span>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {/* Eixo de datas */}
        <div style={{ position: 'relative', height: 28, borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
          {labels.map((l, i) => (
            <span key={i} style={{ position: 'absolute', left: `${l.pct}%`, top: 6, fontSize: 9, color: '#aaa', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{l.txt}</span>
          ))}
          {/* Linha de hoje */}
          {(() => {
            const hojePct = posicaoPct(new Date().toISOString())
            return hojePct > 0 && hojePct < 100 ? <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${hojePct}%`, width: 2, background: '#ffc00f', zIndex: 2 }} /> : null
          })()}
        </div>

        {clientesComMarcos.length === 0 && clientesSemMarcos.length > 0 && (
          <p style={{ margin: 0, padding: 40, textAlign: 'center', color: '#bbb', fontSize: 13 }}>Nenhum marco cadastrado. Clique em "+ Novo marco" para comecar.</p>
        )}

        {clientesComMarcos.map(c => {
          const marcosCliente = marcos.filter(m => m.clienteId === c.id)
          return (
            <div key={c.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fafafa' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: c.corPrimaria || '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, flexShrink: 0 }}>
                  {c.logo ? <img src={c.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.nome[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{c.nome}</span>
                <span style={{ fontSize: 10, color: '#aaa' }}>{marcosCliente.length} marco(s)</span>
              </div>
              <div style={{ position: 'relative', minHeight: 36 * marcosCliente.length || 36, padding: '4px 0' }}>
                {/* Linha de hoje */}
                {(() => {
                  const hojePct = posicaoPct(new Date().toISOString())
                  return hojePct > 0 && hojePct < 100 ? <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${hojePct}%`, width: 1, background: '#ffc00f33' }} /> : null
                })()}
                {marcosCliente.map((m, i) => {
                  const left = posicaoPct(m.dataInicio)
                  const width = larguraPct(m.dataInicio, m.dataFim)
                  return (
                    <div key={m.id} onClick={() => setEditModal(m)} title={`${m.titulo} (${fmtData(m.dataInicio)}${m.dataFim ? ' - ' + fmtData(m.dataFim) : ''})`}
                      style={{
                        position: 'absolute', top: 4 + i * 34, left: `${left}%`, width: `${width}%`, height: 28,
                        background: corCategoria(m.categoria), borderRadius: 6, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', padding: '0 8px', minWidth: 30, opacity: m.status === 'cancelado' ? 0.4 : m.status === 'concluido' ? 0.7 : 1,
                        border: m.status === 'atrasado' ? '2px solid #dc2626' : 'none',
                      }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titulo}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal novo/editar marco */}
      {(novoModal || editModal) && (
        <MarcoModal marco={editModal} clientes={clientes}
          onClose={() => { setNovoModal(false); setEditModal(null) }}
          onSalvo={() => { setNovoModal(false); setEditModal(null); carregar() }}
          onExcluir={editModal ? async () => { await fetch(`/api/playbook?id=${editModal.id}`, { method: 'DELETE' }); setEditModal(null); carregar() } : undefined}
        />
      )}
    </div>
  )
}

function MarcoModal({ marco, clientes, onClose, onSalvo, onExcluir }: {
  marco: Marco | null; clientes: { id: string; nome: string }[]
  onClose: () => void; onSalvo: () => void; onExcluir?: () => void
}) {
  const [form, setForm] = useState({
    titulo: marco?.titulo || '', descricao: marco?.descricao || '',
    categoria: marco?.categoria || 'outro', status: marco?.status || 'planejado',
    clienteId: marco?.clienteId || '', responsavelNome: marco?.responsavelNome || '',
    dataInicio: marco?.dataInicio ? marco.dataInicio.split('T')[0] : new Date().toISOString().split('T')[0],
    dataFim: marco?.dataFim ? marco.dataFim.split('T')[0] : '',
  })
  const [salvando, setSalvando] = useState(false)
  const [entregas, setEntregas] = useState<Entregas>({ tarefas: [], posts: [], briefings: [] })
  useEffect(() => {
    if (!marco?.clienteId) return
    fetch(`/api/playbook/entregas?clienteId=${marco.clienteId}`).then(r => r.json()).then(d => { if (d && !d.error) setEntregas(d) }).catch(() => {})
  }, [marco?.clienteId])

  async function salvar() {
    setSalvando(true)
    const cli = clientes.find(c => c.id === form.clienteId)
    const body = { ...form, clienteNome: cli?.nome || '', dataInicio: form.dataInicio ? new Date(form.dataInicio).toISOString() : '', dataFim: form.dataFim ? new Date(form.dataFim).toISOString() : '' }
    if (marco) {
      await fetch('/api/playbook', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: marco.id, ...body }) })
    } else {
      await fetch('/api/playbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSalvando(false)
    onSalvo()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>{marco ? 'Editar marco' : 'Novo marco'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Titulo *</label>
            <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex.: Lancamento campanha de inverno"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Descricao</label>
            <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes, objetivos, KPIs..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minHeight: 60, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Cliente *</label>
              <select value={form.clienteId} onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                <option value="">Selecione...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Categoria</label>
              <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Data inicio</label>
              <input type="date" value={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Data fim (opcional)</label>
              <input type="date" value={form.dataFim} onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Responsavel</label>
            <input value={form.responsavelNome} onChange={e => setForm(f => ({ ...f, responsavelNome: e.target.value }))} placeholder="Nome do responsavel"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Entregas vinculadas a esta etapa */}
        {marco && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#111' }}>Entregas desta etapa</h4>
            <EntregasMarco marcoId={marco.id} entregas={entregas} cor={STATUS_COR[form.status] === '#ffc00f' ? '#ca8a04' : '#16a34a'} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          <button onClick={salvar} disabled={salvando || !form.titulo.trim() || !form.clienteId} style={{ flex: 1, padding: '11px 0', background: (form.titulo.trim() && form.clienteId) ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: (form.titulo.trim() && form.clienteId) ? 'pointer' : 'not-allowed' }}>
            {salvando ? 'Salvando...' : (marco ? 'Salvar' : 'Criar marco')}
          </button>
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
          {onExcluir && (
            <button onClick={() => { if (confirm('Excluir este marco?')) onExcluir() }} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>
          )}
        </div>
      </div>
    </div>
  )
}

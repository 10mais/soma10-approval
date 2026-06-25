'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'

const FORMATOS = ['Feed', 'Reel', 'Carrossel', 'Story', 'Indiferente']

export default function SolicitarPage() {
  const { clienteId } = useParams()
  const [form, setForm] = useState({ tema: '', formato: 'Indiferente', objetivo: '', dataDesejada: '', referencia: '', observacoes: '' })
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ texto: string; erro: boolean } | null>(null)

  async function enviar() {
    if (!form.tema.trim()) { setMsg({ texto: 'Informe o tema/título da solicitação.', erro: true }); return }
    setEnviando(true); setMsg(null)
    const r = await fetch('/api/solicitar-briefing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, clienteId }),
    }).then(x => x.json()).catch(() => null)
    setEnviando(false)
    if (!r || r.error) { setMsg({ texto: r?.error ? `Erro: ${r.error}` : 'Não foi possível enviar. Tente novamente.', erro: true }); return }
    setForm({ tema: '', formato: 'Indiferente', objetivo: '', dataDesejada: '', referencia: '', observacoes: '' })
    setMsg({ texto: 'Solicitação enviada! Nossa equipe vai produzir e você acompanha em Entregas/Aprovações.', erro: false })
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
  const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#111' }}>Solicitar conteúdo</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#999' }}>Peça um conteúdo novo. Sua solicitação cai direto para a nossa equipe de criação.</p>

      {msg && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, fontSize: 13, background: msg.erro ? '#fef2f2' : '#f0fdf4', border: `1px solid ${msg.erro ? '#fca5a5' : '#86efac'}`, color: msg.erro ? '#b91c1c' : '#166534' }}>{msg.texto}</div>}

      <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={label}>Tema / título *</label>
          <input value={form.tema} onChange={e => setForm(f => ({ ...f, tema: e.target.value }))} placeholder="Ex: Promoção de inverno, dica do especialista..." style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={label}>Formato</label>
            <select value={form.formato} onChange={e => setForm(f => ({ ...f, formato: e.target.value }))} style={{ ...inputStyle, background: '#fff' }}>
              {FORMATOS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Data desejada</label>
            <input type="date" value={form.dataDesejada} onChange={e => setForm(f => ({ ...f, dataDesejada: e.target.value }))} style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={label}>Objetivo</label>
          <input value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} placeholder="O que você quer alcançar com esse conteúdo?" style={inputStyle} />
        </div>
        <div>
          <label style={label}>Referência (link)</label>
          <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} placeholder="Link de exemplo, Drive, post de referência..." style={inputStyle} />
        </div>
        <div>
          <label style={label}>Observações</label>
          <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Qualquer detalhe importante..." style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} />
        </div>
        <button onClick={enviar} disabled={enviando || !form.tema.trim()} style={{ padding: '12px 0', background: form.tema.trim() ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: form.tema.trim() && !enviando ? 'pointer' : 'not-allowed' }}>
          {enviando ? 'Enviando...' : 'Enviar solicitação'}
        </button>
      </div>
    </div>
  )
}

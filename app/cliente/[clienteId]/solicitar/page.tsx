'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { upload } from '@vercel/blob/client'

const FORMATOS = ['Feed', 'Reel', 'Carrossel', 'Story', 'Indiferente']
type Anexo = { nome: string; url: string; tipo: string }

export default function SolicitarPage() {
  const { clienteId } = useParams()
  const [form, setForm] = useState({ tema: '', formato: 'Indiferente', objetivo: '', dataDesejada: '', referencia: '', observacoes: '' })
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [subindo, setSubindo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ texto: string; erro: boolean } | null>(null)

  async function subirAnexos(files: FileList | null) {
    if (!files || !files.length) return
    setSubindo(true); setMsg(null)
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^\w.\-]+/g, '_')
        const blob = await upload(`solicitacoes/${clienteId}/${Date.now()}-${safe}`, file, {
          access: 'public', handleUploadUrl: '/api/upload', contentType: file.type, clientPayload: file.type,
        })
        setAnexos(a => [...a, { nome: file.name, url: blob.url, tipo: file.type }])
      }
    } catch (e: any) {
      setMsg({ texto: `Falha ao anexar: ${e?.message || 'erro'}`, erro: true })
    } finally { setSubindo(false) }
  }

  async function enviar() {
    if (!form.tema.trim()) { setMsg({ texto: 'Informe o tema/título da solicitação.', erro: true }); return }
    setEnviando(true); setMsg(null)
    const r = await fetch('/api/solicitar-briefing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, anexos, clienteId }),
    }).then(x => x.json()).catch(() => null)
    setEnviando(false)
    if (!r || r.error) { setMsg({ texto: r?.error ? `Erro: ${r.error}` : 'Não foi possível enviar. Tente novamente.', erro: true }); return }
    setForm({ tema: '', formato: 'Indiferente', objetivo: '', dataDesejada: '', referencia: '', observacoes: '' })
    setAnexos([])
    setMsg({ texto: 'Solicitação enviada! Nossa equipe vai produzir e você acompanha em Entregas/Aprovações.', erro: false })
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
  const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, color: 'var(--v2-ink)' }}>Solicitar conteúdo</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--v2-ink3)' }}>Peça um conteúdo novo. Sua solicitação cai direto para a nossa equipe de criação.</p>

      {msg && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, fontSize: 13, background: msg.erro ? 'var(--v2-hot-bg)' : 'var(--v2-ok-bg)', border: `1px solid ${msg.erro ? 'var(--v2-hot-bg)' : 'var(--v2-ok-bg)'}`, color: msg.erro ? 'var(--v2-hot)' : 'var(--v2-ok)' }}>{msg.texto}</div>}

      <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={label}>Tema / título *</label>
          <input value={form.tema} onChange={e => setForm(f => ({ ...f, tema: e.target.value }))} placeholder="Ex: Promoção de inverno, dica do especialista..." style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <div>
            <label style={label}>Formato</label>
            <select value={form.formato} onChange={e => setForm(f => ({ ...f, formato: e.target.value }))} style={{ ...inputStyle, background: 'var(--v2-surface)' }}>
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
          <textarea lang="pt-BR" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Qualquer detalhe importante..." style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} />
        </div>
        <div>
          <label style={label}>Anexos (imagens, PDF, documentos)</label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: '1.5px dashed #d8d8d8', background: '#fbfbfc', cursor: subindo ? 'wait' : 'pointer', fontSize: 13, color: 'var(--v2-ink2)', fontWeight: 600 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49" /></svg>
            {subindo ? 'Enviando anexo...' : 'Adicionar anexo'}
            <input type="file" multiple accept="image/*,video/mp4,video/quicktime,application/pdf,.doc,.docx,.xls,.xlsx,.txt" style={{ display: 'none' }} disabled={subindo} onChange={e => { subirAnexos(e.target.files); e.currentTarget.value = '' }} />
          </label>
          {anexos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
              {anexos.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--v2-surface1)', borderRadius: 8, fontSize: 12.5, color: 'var(--v2-ink)' }}>
                  <a href={a.url} target="_blank" rel="noreferrer" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--v2-info)', textDecoration: 'none' }}>{a.nome}</a>
                  <button onClick={() => setAnexos(arr => arr.filter((_, j) => j !== i))} title="Remover" style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={enviar} disabled={enviando || subindo || !form.tema.trim()} style={{ padding: '12px 0', background: form.tema.trim() && !subindo ? 'var(--marca, var(--v2-amber-on))' : 'var(--v2-surface2)', color: form.tema.trim() && !subindo ? 'var(--marca-texto, var(--v2-ink))' : 'var(--v2-ink3)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: form.tema.trim() && !enviando && !subindo ? 'pointer' : 'not-allowed' }}>
          {enviando ? 'Enviando...' : subindo ? 'Aguarde o anexo...' : 'Enviar solicitação'}
        </button>
      </div>
    </div>
  )
}

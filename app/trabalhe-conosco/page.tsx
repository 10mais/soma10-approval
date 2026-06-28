'use client'
import { useState } from 'react'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'
import UploadProgress from '@/app/components/UploadProgress'

export default function TrabalheConoscoPage() {
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', vaga: '', mensagem: '' })
  const [curriculo, setCurriculo] = useState<{ url: string; nome: string } | null>(null)
  const [enviandoCv, setEnviandoCv] = useState(false)
  const [progCv, setProgCv] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)

  async function enviarCurriculo(file: File) {
    setErro('')
    if (file.type !== 'application/pdf') { setErro('O currículo deve ser um arquivo PDF.'); return }
    if (file.size > 10 * 1024 * 1024) { setErro('O currículo deve ter no máximo 10 MB.'); return }
    setEnviandoCv(true); setProgCv(0)
    try {
      const blob = await upload(`curriculos/${uuid()}.pdf`, file, { access: 'public', handleUploadUrl: '/api/candidaturas/upload', contentType: 'application/pdf', clientPayload: 'application/pdf', onUploadProgress: ({ percentage }) => setProgCv(percentage) })
      setCurriculo({ url: blob.url, nome: file.name })
    } catch (e: any) { setErro(e?.message || 'Erro ao enviar o currículo.') }
    setEnviandoCv(false); setProgCv(null)
  }

  async function enviar() {
    setErro('')
    if (form.nome.trim().length < 2) { setErro('Informe seu nome.'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) { setErro('Informe um e-mail válido.'); return }
    setEnviando(true)
    const r = await fetch('/api/candidaturas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, curriculoUrl: curriculo?.url || '', curriculoNome: curriculo?.nome || '' }),
    }).then(x => x.json()).catch(() => null)
    setEnviando(false)
    if (!r || r.error) { setErro(r?.error || 'Não foi possível enviar. Tente novamente.'); return }
    setEnviado(true)
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }
  const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4', fontFamily: 'Inter, system-ui, sans-serif', padding: '40px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ background: '#111', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="/logo-branco.svg" alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: '#111' }}>Grupo 10+</span>
        </div>

        {enviado ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#111' }}>Candidatura enviada!</h2>
            <p style={{ margin: 0, fontSize: 14, color: '#888', lineHeight: 1.5 }}>Recebemos seus dados. Se o seu perfil corresponder a uma vaga, nossa equipe entrará em contato.</p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h1 style={{ margin: '0 0 6px', fontSize: 22, color: '#111' }}>Trabalhe conosco</h1>
            <p style={{ margin: '0 0 22px', fontSize: 14, color: '#999' }}>Preencha seus dados e anexe seu currículo. Vamos adorar conhecer você.</p>

            {erro && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, fontSize: 13, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c' }}>{erro}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={label}>Nome completo *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>E-mail *</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={label}>Telefone / WhatsApp</label>
                  <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={label}>Vaga / área de interesse</label>
                <input value={form.vaga} onChange={e => setForm(f => ({ ...f, vaga: e.target.value }))} placeholder="Ex: Social Media, Designer, Tráfego..." style={inputStyle} />
              </div>
              <div>
                <label style={label}>Mensagem / sobre você</label>
                <textarea value={form.mensagem} onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))} placeholder="Conte um pouco da sua experiência..." style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} />
              </div>
              <div>
                <label style={label}>Currículo (PDF)</label>
                {curriculo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, fontSize: 13, color: '#166534' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{curriculo.nome}</span>
                    <button onClick={() => setCurriculo(null)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Remover</button>
                  </div>
                ) : (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: '#f5f5f5', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#444' }}>
                    {enviandoCv ? 'Enviando...' : 'Anexar currículo (PDF)'}
                    <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={enviandoCv}
                      onChange={e => { if (e.target.files?.[0]) enviarCurriculo(e.target.files[0]); e.target.value = '' }} />
                  </label>
                )}
                <UploadProgress valor={progCv} rotulo="Enviando currículo..." />
              </div>
              <button onClick={enviar} disabled={enviando || enviandoCv} style={{ marginTop: 6, padding: '13px 0', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: enviando || enviandoCv ? 'not-allowed' : 'pointer' }}>
                {enviando ? 'Enviando...' : 'Enviar candidatura'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

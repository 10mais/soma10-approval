'use client'
import { useState, useEffect } from 'react'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'
import UploadProgress from '@/app/components/UploadProgress'

type RecrutCfg = { logo: string; titulo: string; subtitulo: string; descricao: string; mensagemFinalTitulo: string; mensagemFinal: string; nomeAgencia: string; vagas: string[] }

export default function TrabalheConoscoPage() {
  const [cfg, setCfg] = useState<RecrutCfg>({ logo: '', titulo: 'Trabalhe conosco', subtitulo: 'Preencha seus dados e anexe seu currículo. Vamos adorar conhecer você.', descricao: '', mensagemFinalTitulo: 'Candidatura enviada!', mensagemFinal: 'Recebemos seus dados. Se o seu perfil corresponder a uma vaga, nossa equipe entrará em contato.', nomeAgencia: 'Grupo 10+', vagas: [] })
  const [desabilitado, setDesabilitado] = useState(false)
  useEffect(() => { fetch('/api/recrutamento').then(r => r.json()).then(d => { if (d?.desabilitado) setDesabilitado(true); else if (d && !d.error) setCfg(d) }).catch(() => {}) }, [])
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

  if (desabilitado) {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f4f4', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: 420 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 18, color: '#111' }}>Página não disponível</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#888' }}>Esta instância não possui página de recrutamento.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4', fontFamily: 'Inter, system-ui, sans-serif', padding: '40px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          {cfg.logo
            ? <img src={cfg.logo} alt={cfg.nomeAgencia} style={{ maxHeight: 48, maxWidth: 200, objectFit: 'contain' }} />
            : <span style={{ fontWeight: 800, fontSize: 18, color: '#111' }}>{cfg.nomeAgencia}</span>}
        </div>

        {enviado ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#111' }}>{cfg.mensagemFinalTitulo}</h2>
            <p style={{ margin: 0, fontSize: 14, color: '#888', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{cfg.mensagemFinal}</p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h1 style={{ margin: '0 0 6px', fontSize: 22, color: '#111' }}>{cfg.titulo}</h1>
            <p style={{ margin: '0 0 18px', fontSize: 14, color: '#999' }}>{cfg.subtitulo}</p>

            {cfg.descricao && (
              <div style={{ margin: '0 0 20px', padding: '14px 16px', background: '#f8f9fb', border: '1px solid #eef0f4', borderRadius: 12, fontSize: 13.5, color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{cfg.descricao}</div>
            )}

            {erro &&<div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, fontSize: 13, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c' }}>{erro}</div>}

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
                {cfg.vagas.length > 0 ? (
                  <select value={form.vaga} onChange={e => setForm(f => ({ ...f, vaga: e.target.value }))} style={{ ...inputStyle, background: '#fff' }}>
                    <option value="">Selecione a vaga / área...</option>
                    {cfg.vagas.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input value={form.vaga} onChange={e => setForm(f => ({ ...f, vaga: e.target.value }))} placeholder="Ex: Social Media, Designer, Tráfego..." style={inputStyle} />
                )}
              </div>
              <div>
                <label style={label}>Mensagem / sobre você</label>
                <textarea lang="pt-BR" spellCheck value={form.mensagem} onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))} placeholder="Conte um pouco da sua experiência..." style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} />
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

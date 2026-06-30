'use client'
import { useEffect, useState } from 'react'
import { confirmar } from '@/lib/toast'

type Candidatura = {
  id: string; nome: string; email: string; telefone?: string; vaga?: string; mensagem?: string
  curriculoUrl?: string; curriculoNome?: string; status: string; criadoEm: string
}

const STATUS: { key: string; label: string; cor: string }[] = [
  { key: 'nova', label: 'Nova', cor: '#2563eb' },
  { key: 'em_analise', label: 'Em análise', cor: '#ca8a04' },
  { key: 'aprovada', label: 'Aprovada', cor: '#16a34a' },
  { key: 'reprovada', label: 'Reprovada', cor: '#b91c1c' },
]

export default function Candidaturas() {
  const [lista, setLista] = useState<Candidatura[]>([])
  const [filtro, setFiltro] = useState('')
  const [aberta, setAberta] = useState<Candidatura | null>(null)

  function carregar() {
    fetch('/api/candidaturas').then(r => r.json()).then(d => setLista(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => { carregar() }, [])

  async function mudarStatus(id: string, status: string) {
    setLista(l => l.map(c => c.id === id ? { ...c, status } : c))
    setAberta(a => a && a.id === id ? { ...a, status } : a)
    await fetch('/api/candidaturas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) }).catch(() => {})
  }
  async function excluir(id: string) {
    if (!(await confirmar('Excluir esta candidatura?', { titulo: 'Excluir candidatura', okLabel: 'Excluir', perigo: true }))) return
    await fetch(`/api/candidaturas?id=${id}`, { method: 'DELETE' })
    setAberta(null)
    carregar()
  }

  function baixarCv(url: string, nome: string) {
    fetch(url).then(r => r.blob()).then(blob => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome || 'curriculo.pdf'
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 100)
    }).catch(() => window.open(url, '_blank'))
  }

  const filtradas = filtro ? lista.filter(c => c.status === filtro) : lista
  const cor = (s: string) => STATUS.find(x => x.key === s)?.cor || '#888'
  const lbl = (s: string) => STATUS.find(x => x.key === s)?.label || s

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Trabalhe Conosco — Candidaturas</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Recebidas pela página pública <a href="/trabalhe-conosco" target="_blank" rel="noreferrer" style={{ color: '#1d4ed8' }}>/trabalhe-conosco</a>. Visível só para você (admin).</p>
        </div>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }}>
          <option value="">Todas ({lista.length})</option>
          {STATUS.map(s => <option key={s.key} value={s.key}>{s.label} ({lista.filter(c => c.status === s.key).length})</option>)}
        </select>
      </div>

      {filtradas.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '50px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#aaa', fontSize: 14 }}>Nenhuma candidatura{filtro ? ' neste status' : ''}.</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {filtradas.map(c => (
            <div key={c.id} onClick={() => setAberta(c)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{c.nome}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: cor(c.status), background: `${cor(c.status)}1a`, borderRadius: 999, padding: '2px 8px' }}>{lbl(c.status)}</span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>{c.vaga || 'Sem vaga especificada'} · {c.email}{c.telefone ? ` · ${c.telefone}` : ''}</p>
              </div>
              {c.curriculoUrl && <span style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 600 }}>CV anexado</span>}
              <span style={{ fontSize: 11, color: '#bbb' }}>{new Date(c.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}

      {/* Detalhe */}
      {aberta && (
        <div onClick={() => setAberta(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: '#111' }}>{aberta.nome}</h3>
              <button onClick={() => setAberta(null)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', color: '#888' }}>x</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#333' }}>
              <p style={{ margin: 0 }}><strong>E-mail:</strong> {aberta.email}</p>
              {aberta.telefone && <p style={{ margin: 0 }}><strong>Telefone:</strong> {aberta.telefone}</p>}
              {aberta.vaga && <p style={{ margin: 0 }}><strong>Vaga:</strong> {aberta.vaga}</p>}
              {aberta.mensagem && <div><strong>Mensagem:</strong><p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', color: '#555' }}>{aberta.mensagem}</p></div>}
              <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>Recebida em {new Date(aberta.criadoEm).toLocaleString('pt-BR')}</p>
            </div>

            {aberta.curriculoUrl && (
              <button onClick={() => baixarCv(aberta.curriculoUrl!, aberta.curriculoNome || 'curriculo.pdf')} style={{ marginTop: 14, width: '100%', padding: '10px 0', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Baixar currículo (PDF)</button>
            )}

            <div style={{ marginTop: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#888' }}>Status</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATUS.map(s => (
                  <button key={s.key} onClick={() => mudarStatus(aberta.id, s.key)} style={{ padding: '7px 12px', borderRadius: 8, border: aberta.status === s.key ? `1.5px solid ${s.cor}` : '1px solid #e0e0e0', background: aberta.status === s.key ? `${s.cor}1a` : '#fff', color: aberta.status === s.key ? s.cor : '#666', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{s.label}</button>
                ))}
              </div>
            </div>

            <button onClick={() => excluir(aberta.id)} style={{ marginTop: 16, padding: '8px 14px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Excluir candidatura</button>
          </div>
        </div>
      )}
    </div>
  )
}

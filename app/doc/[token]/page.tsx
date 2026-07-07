'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { sanitizeHtml } from '@/lib/sanitize'

export default function DocPublico() {
  const { token } = useParams()
  const [doc, setDoc] = useState<any>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    fetch(`/api/doc-publico?token=${token}`).then(r => r.json()).then(d => { if (d && !d.error) setDoc(d); else setErro(true) }).catch(() => setErro(true))
  }, [token])

  if (erro) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontFamily: 'Inter, system-ui, sans-serif' }}>Link inválido ou revogado.</div>
  if (!doc) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontFamily: 'Inter, system-ui, sans-serif' }}>Carregando…</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f5', padding: '40px 16px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`.doc-conteudo a{color:#1d4ed8;text-decoration:underline}
        .doc-conteudo h1{font-size:1.6em;font-weight:800;margin:.6em 0 .35em}.doc-conteudo h2{font-size:1.3em;font-weight:800;margin:.6em 0 .3em}.doc-conteudo h3{font-size:1.1em;font-weight:700;margin:.5em 0 .2em}
        .doc-conteudo ul,.doc-conteudo ol{padding-left:1.5em;margin:.4em 0}.doc-conteudo li{margin:.2em 0}
        .doc-conteudo blockquote{border-left:3px solid #e0e0e0;margin:.5em 0;padding:.1em 0 .1em .9em;color:#666}
        .doc-conteudo img{max-width:100%}`}</style>
      <div style={{ maxWidth: 760, margin: '0 auto', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '40px 44px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: '#111' }}>{doc.titulo?.trim() || 'Documento'}</h1>
        <p style={{ margin: '0 0 24px', fontSize: 12.5, color: '#aaa' }}>{doc.autor ? `Por ${doc.autor} · ` : ''}Atualizado em {new Date(doc.atualizadoEm).toLocaleDateString('pt-BR')}</p>
        <div className="doc-conteudo" style={{ fontSize: 15, lineHeight: 1.65, color: '#222', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: doc.conteudo ? sanitizeHtml(doc.conteudo) : '<p style="color:#aaa">Documento vazio.</p>' }} />
      </div>
      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#bbb' }}>Soma10</p>
    </div>
  )
}

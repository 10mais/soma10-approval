'use client'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { sanitizeHtml } from '@/lib/sanitize'
import RichText from '@/app/components/RichText'

// Documento compartilhado por link, sem login. Leitura sempre; quando a equipe
// marca o link como "pode editar" (estilo Google Docs), qualquer pessoa com o
// link edita título/conteúdo aqui mesmo, com autosave via /api/doc-publico PUT.
type DocPub = { titulo: string; conteudo: string; atualizadoEm: string; autor?: string; acessoLink?: 'ver' | 'editar'; fontSize?: number }

export default function DocPublico() {
  const { token } = useParams()
  const [doc, setDoc] = useState<DocPub | null>(null)
  const [erro, setErro] = useState(false)
  const [salvo, setSalvo] = useState<'idle' | 'salvando' | 'ok'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch(`/api/doc-publico?token=${token}`).then(r => r.json()).then(d => { if (d && !d.error) setDoc(d); else setErro(true) }).catch(() => setErro(true))
  }, [token])

  function editar(patch: Partial<DocPub>) {
    setDoc(d => d ? { ...d, ...patch } : d)
    setSalvo('salvando')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const atual = { ...(doc as DocPub), ...patch }
      const r = await fetch('/api/doc-publico', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, titulo: atual.titulo, conteudo: atual.conteudo }) }).then(x => x.json()).catch(() => null)
      if (r?.ok) { setSalvo('ok'); setTimeout(() => setSalvo('idle'), 1500) }
      else setSalvo('idle')
    }, 700)
  }

  if (erro) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontFamily: 'Inter, system-ui, sans-serif' }}>Link inválido ou revogado.</div>
  if (!doc) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontFamily: 'Inter, system-ui, sans-serif' }}>Carregando…</div>

  const podeEditar = doc.acessoLink === 'editar'

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f5', padding: '40px 16px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`.doc-conteudo a{color:#1d4ed8;text-decoration:underline}
        .doc-conteudo h1{font-size:1.6em;font-weight:800;margin:.6em 0 .35em}.doc-conteudo h2{font-size:1.3em;font-weight:800;margin:.6em 0 .3em}.doc-conteudo h3{font-size:1.1em;font-weight:700;margin:.5em 0 .2em}
        .doc-conteudo ul,.doc-conteudo ol{padding-left:1.5em;margin:.4em 0}.doc-conteudo li{margin:.2em 0}
        .doc-conteudo blockquote{border-left:3px solid #e0e0e0;margin:.5em 0;padding:.1em 0 .1em .9em;color:#666}
        .doc-conteudo img{max-width:100%}`}</style>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {podeEditar && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: 12, color: '#92400e' }}>
            <span style={{ fontWeight: 800 }}>Edição liberada</span>
            <span style={{ flex: 1 }}>qualquer pessoa com este link pode editar — as alterações salvam sozinhas.</span>
            {salvo === 'salvando' && <span style={{ flexShrink: 0, color: '#b45309' }}>salvando…</span>}
            {salvo === 'ok' && <span style={{ flexShrink: 0, color: '#16a34a', fontWeight: 700 }}>salvo</span>}
          </div>
        )}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '40px 44px' }}>
          {podeEditar ? (
            <>
              <input value={doc.titulo || ''} onChange={e => editar({ titulo: e.target.value })} placeholder="Título do documento"
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 26, fontWeight: 800, color: '#111', fontFamily: 'inherit', background: 'transparent', marginBottom: 14, boxSizing: 'border-box' }} />
              <RichText value={doc.conteudo} onChange={html => editar({ conteudo: html })} placeholder="Escreva aqui…" minHeight={380} completo sticky fontSize={doc.fontSize || 15} />
            </>
          ) : (
            <>
              <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: '#111' }}>{doc.titulo?.trim() || 'Documento'}</h1>
              <p style={{ margin: '0 0 24px', fontSize: 12.5, color: '#aaa' }}>{doc.autor ? `Por ${doc.autor} · ` : ''}Atualizado em {new Date(doc.atualizadoEm).toLocaleDateString('pt-BR')}</p>
              <div className="doc-conteudo" style={{ fontSize: doc.fontSize || 15, lineHeight: 1.65, color: '#222', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: doc.conteudo ? sanitizeHtml(doc.conteudo) : '<p style="color:#aaa">Documento vazio.</p>' }} />
            </>
          )}
        </div>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#bbb' }}>Soma10</p>
      </div>
    </div>
  )
}

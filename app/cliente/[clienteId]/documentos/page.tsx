'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { sanitizeHtml } from '@/lib/sanitize'
import RichText from '@/app/components/RichText'

// Documentos COMPARTILHADOS com o cliente (estilo Google Docs): a equipe escolhe,
// por documento, se este cliente pode visualizar ou editar. A API já devolve só
// o que foi compartilhado quando quem chama é o cliente; para a equipe vendo o
// portal, filtramos aqui pelo mesmo critério (mostrar o que o cliente vê).
type Doc = { id: string; titulo: string; conteudo: string; clienteId?: string; acessoCliente?: 'ver' | 'editar'; fontSize?: number; atualizadoPorNome?: string; atualizadoEm: string; criadoEm: string }

function quando(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const ESTILO_DOC = `.doc-conteudo a{color:#1d4ed8;text-decoration:underline}
.doc-conteudo h1{font-size:1.6em;font-weight:800;margin:.6em 0 .35em}.doc-conteudo h2{font-size:1.3em;font-weight:800;margin:.6em 0 .3em}.doc-conteudo h3{font-size:1.1em;font-weight:700;margin:.5em 0 .2em}
.doc-conteudo ul,.doc-conteudo ol{padding-left:1.5em;margin:.4em 0}.doc-conteudo li{margin:.2em 0}
.doc-conteudo blockquote{border-left:3px solid #e0e0e0;margin:.5em 0;padding:.1em 0 .1em .9em;color:#666}
.doc-conteudo img{max-width:100%}`

export default function DocumentosDoCliente() {
  const { clienteId } = useParams()
  const [docs, setDocs] = useState<Doc[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState<Doc | null>(null)
  const [salvo, setSalvo] = useState<'idle' | 'salvando' | 'ok'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/documentos').then(r => r.json()).then(d => {
      const lista: Doc[] = Array.isArray(d) ? d : []
      setDocs(lista.filter(x => x.clienteId === clienteId && (x.acessoCliente === 'ver' || x.acessoCliente === 'editar')))
    }).catch(() => {}).finally(() => setCarregando(false))
  }, [clienteId])

  // Autosave da edição do cliente (mesmo debounce do editor da equipe). O
  // servidor só aceita título/conteúdo — e só com permissão 'editar'.
  function editar(patch: Partial<Doc>) {
    setAberto(a => a ? { ...a, ...patch } : a)
    setSalvo('salvando')
    if (timer.current) clearTimeout(timer.current)
    const alvo = aberto?.id
    timer.current = setTimeout(async () => {
      const atual = { ...(aberto as Doc), ...patch }
      const r = await fetch('/api/documentos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: alvo, titulo: atual.titulo, conteudo: atual.conteudo }) }).then(x => x.json()).catch(() => null)
      if (r?.ok) { setSalvo('ok'); setTimeout(() => setSalvo('idle'), 1500); setDocs(ds => ds.map(d => d.id === alvo ? { ...d, titulo: atual.titulo, conteudo: atual.conteudo, atualizadoEm: r.documento?.atualizadoEm || d.atualizadoEm } : d)) }
      else setSalvo('idle')
    }, 700)
  }

  if (carregando) return <p style={{ color: '#aaa', fontSize: 13 }}>Carregando…</p>

  // Documento aberto — leitura ou edição, conforme a permissão dada pela equipe.
  if (aberto) {
    const podeEditar = aberto.acessoCliente === 'editar'
    return (
      <div style={{ maxWidth: 820 }}>
        <style>{ESTILO_DOC}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setAberto(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', color: '#555', border: '1px solid #e8e8e8', borderRadius: 10, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Documentos
          </button>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: podeEditar ? '#166534' : '#475569', background: podeEditar ? '#f0fdf4' : '#f1f5f9', border: `1px solid ${podeEditar ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 999, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{podeEditar ? 'Você pode editar' : 'Somente leitura'}</span>
          {podeEditar && salvo === 'salvando' && <span style={{ fontSize: 11, color: '#aaa' }}>salvando…</span>}
          {podeEditar && salvo === 'ok' && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>salvo</span>}
        </div>

        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', padding: '28px 30px' }}>
          {podeEditar ? (
            <>
              <input value={aberto.titulo} onChange={e => editar({ titulo: e.target.value })} placeholder="Título do documento"
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 22, fontWeight: 800, color: '#111', fontFamily: 'inherit', background: 'transparent', marginBottom: 12, boxSizing: 'border-box' }} />
              <RichText key={aberto.id} value={aberto.conteudo} onChange={html => editar({ conteudo: html })} placeholder="Escreva aqui…" minHeight={360} completo sticky fontSize={aberto.fontSize || 15} />
            </>
          ) : (
            <>
              <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: '#111' }}>{aberto.titulo?.trim() || 'Documento'}</h1>
              <p style={{ margin: '0 0 20px', fontSize: 12, color: '#aaa' }}>Atualizado em {new Date(aberto.atualizadoEm).toLocaleDateString('pt-BR')}{aberto.atualizadoPorNome ? ` por ${aberto.atualizadoPorNome}` : ''}</p>
              <div className="doc-conteudo" style={{ fontSize: aberto.fontSize || 15, lineHeight: 1.65, color: '#222', wordBreak: 'break-word' }}
                dangerouslySetInnerHTML={{ __html: aberto.conteudo ? sanitizeHtml(aberto.conteudo) : '<p style="color:#aaa">Documento vazio.</p>' }} />
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Documentos</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Documentos que a equipe compartilhou com você. Alguns podem ser editados por você.</p>
      </div>
      {docs.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '48px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: 13.5, color: '#999' }}>Nenhum documento compartilhado com você por enquanto.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {docs.map((d, idx) => (
            <div key={d.id} onClick={() => setAberto(d)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderTop: idx ? '1px solid #f6f6f6' : 'none', cursor: 'pointer' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.titulo.trim() || 'Sem título'}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#999' }}>{d.acessoCliente === 'editar' ? 'Você pode editar' : 'Somente leitura'} · atualizado {quando(d.atualizadoEm)}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd0d6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

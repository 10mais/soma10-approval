'use client'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

const CAMPOS: { key: string; label: string; placeholder: string; area?: boolean }[] = [
  { key: 'segmento', label: 'Segmento / Nicho', placeholder: 'Ex.: Clínica de fisioterapia' },
  { key: 'palavrasChave', label: 'Palavras-chave', placeholder: 'dor nas costas, reabilitação, postura...' },
  { key: 'descricao', label: 'Descrição do negócio', placeholder: 'O que a empresa faz, diferenciais, serviços...', area: true },
  { key: 'publicoAlvo', label: 'Público-alvo', placeholder: 'Quem é o cliente ideal...', area: true },
  { key: 'tomDeVoz', label: 'Tom de voz', placeholder: 'Formal, acolhedor, técnico...', area: true },
  { key: 'preferencias', label: 'Preferências / Restrições', placeholder: 'Hashtags padrão, temas a evitar, regras da marca...', area: true },
]

export default function MarcaPage() {
  const { clienteId } = useParams()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const ehEquipe = role === 'admin' || role === 'gerente'

  const [cliente, setCliente] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  function carregar() {
    fetch(`/api/clientes?id=${clienteId}`).then(r => r.json()).then((c: any) => {
      if (c && !c.error) { setCliente(c); setForm({ segmento: c.segmento || '', palavrasChave: c.palavrasChave || '', descricao: c.descricao || '', publicoAlvo: c.publicoAlvo || '', tomDeVoz: c.tomDeVoz || '', preferencias: c.preferencias || '' }) }
    }).catch(() => {})
  }
  useEffect(() => { carregar() }, [clienteId])

  async function salvar() {
    setSalvando(true); setMsg('')
    const r = await fetch('/api/clientes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: clienteId, ...form }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r || r.error) { setMsg('Erro ao salvar. Tente novamente.'); return }
    setCliente((c: any) => ({ ...c, ...form }))
    setEditando(false)
    setMsg('Brand Board salvo!')
    setTimeout(() => setMsg(''), 4000)
  }

  if (!cliente) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Carregando...</div>

  const temDados = CAMPOS.some(c => (cliente[c.key] || '').trim()) || (cliente.documentoMarca || '').trim()
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Marca — Brand Board</h2>
        {ehEquipe && !editando && (
          <button onClick={() => setEditando(true)} style={{ padding: '9px 16px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            {temDados ? 'Editar' : 'Preencher Brand Board'}
          </button>
        )}
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#999' }}>Identidade e DNA do projeto {cliente.nome}.</p>

      {msg && <div style={{ marginBottom: 14, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, fontSize: 13, color: '#166534' }}>{msg}</div>}

      {/* MODO EDIÇÃO (equipe) */}
      {ehEquipe && editando ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {CAMPOS.map(c => (
            <div key={c.key}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>{c.label}</label>
              {c.area
                ? <textarea value={form[c.key] || ''} onChange={e => setForm((f: any) => ({ ...f, [c.key]: e.target.value }))} placeholder={c.placeholder} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
                : <input value={form[c.key] || ''} onChange={e => setForm((f: any) => ({ ...f, [c.key]: e.target.value }))} placeholder={c.placeholder} style={inputStyle} />}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={salvar} disabled={salvando} style={{ flex: 1, padding: '11px 0', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            <button onClick={() => { setEditando(false); carregar() }} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      ) : (
        /* MODO LEITURA */
        <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!temDados && <p style={{ margin: 0, fontSize: 13, color: '#aaa', textAlign: 'center', padding: 20 }}>{ehEquipe ? 'Brand Board ainda não preenchido. Clique em "Preencher Brand Board".' : 'Brand Board em construção.'}</p>}
          {CAMPOS.map(c => cliente[c.key] ? (
            <div key={c.key}>
              <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#888' }}>{c.label}</p>
              <p style={{ margin: 0, fontSize: 14, color: '#222', whiteSpace: 'pre-wrap' }}>{cliente[c.key]}</p>
            </div>
          ) : null)}
          {(cliente.documentos || []).length > 0 && (
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#888' }}>Documentos</p>
              {cliente.documentos.map((d: any, i: number) => (
                <a key={i} href={d.url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 13, color: '#1d4ed8' }}>{d.nome}</a>
              ))}
            </div>
          )}
          {cliente.documentoMarca && (
            <div style={{ borderTop: '1px solid #eee', paddingTop: 14 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 15, color: '#111' }}>Documento de marca (IA)</h3>
              {cliente.documentoMarcaGeradoEm && <p style={{ fontSize: 12, color: '#999', margin: '0 0 8px' }}>Gerado em {new Date(cliente.documentoMarcaGeradoEm).toLocaleString('pt-BR')}</p>}
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, color: '#333', background: '#fafafa', border: '1px solid #eee', borderRadius: 12, padding: 18, maxHeight: 520, overflow: 'auto', margin: 0 }}>{cliente.documentoMarca}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

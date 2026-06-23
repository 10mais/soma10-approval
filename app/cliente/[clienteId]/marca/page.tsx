'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function MarcaPage() {
  const { clienteId } = useParams()
  const [cliente, setCliente] = useState<any>(null)

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(lista => {
      const c = (Array.isArray(lista) ? lista : []).find((x: any) => x.id === clienteId)
      if (c) setCliente(c)
    })
  }, [clienteId])

  if (!cliente) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Carregando...</div>

  const campos = [
    ['Segmento / Nicho', cliente.segmento],
    ['Palavras-chave', cliente.palavrasChave],
    ['Descricao', cliente.descricao],
    ['Publico-alvo', cliente.publicoAlvo],
    ['Tom de voz', cliente.tomDeVoz],
    ['Preferencias / Restricoes', cliente.preferencias],
  ]

  return (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#111' }}>Marca — Brand Board</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#999' }}>Identidade e DNA do projeto {cliente.nome}.</p>

      <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {campos.map(([l, v]) => v ? (
          <div key={l as string}>
            <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#888' }}>{l}</p>
            <p style={{ margin: 0, fontSize: 14, color: '#222', whiteSpace: 'pre-wrap' }}>{v}</p>
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
    </div>
  )
}

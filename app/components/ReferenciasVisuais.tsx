'use client'
import { useEffect, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'
import { toast, confirmar } from '@/lib/toast'
import UploadProgress from './UploadProgress'

// Referências visuais da marca (por cliente). Alimentam a direção de arte da IA
// no Studio: o gerador de criativo "olha" essas imagens para casar estilo/tom.
export default function ReferenciasVisuais({ clienteId }: { clienteId: string }) {
  const [refs, setRefs] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [prog, setProg] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/clientes?id=${clienteId}`).then(r => r.json()).then(d => {
      if (vivo) { setRefs(Array.isArray(d?.referenciasVisuais) ? d.referenciasVisuais : []); setCarregando(false) }
    }).catch(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [clienteId])

  async function salvar(novas: string[]) {
    setRefs(novas)
    await fetch('/api/clientes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: clienteId, referenciasVisuais: novas }),
    }).catch(() => toast('Falha ao salvar referências.', 'erro'))
  }

  async function enviarArquivos(files: FileList) {
    setEnviando(true)
    const novas = [...refs]
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        if (!f.type.startsWith('image/')) continue
        setProg(0)
        const ext = f.name.split('.').pop() || 'jpg'
        const blob = await upload(`referencias/${clienteId}/${uuid()}.${ext}`, f, {
          access: 'public', handleUploadUrl: '/api/upload', contentType: f.type, clientPayload: f.type,
          onUploadProgress: ({ percentage }) => setProg(percentage),
        })
        novas.push(blob.url)
      }
      await salvar(novas)
      toast('Referências adicionadas!', 'sucesso')
    } catch (e: any) {
      toast(`Falha no upload: ${e?.message || 'erro'}`, 'erro')
    } finally {
      setEnviando(false); setProg(null)
    }
  }

  async function remover(url: string) {
    if (!(await confirmar('Remover esta referência?', { titulo: 'Remover referência', okLabel: 'Remover', perigo: true }))) return
    await salvar(refs.filter(u => u !== url))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#111' }}>Referências visuais</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>
            Suba posts e artes que representam a marca. A IA do Studio usa essas imagens para dirigir a arte no estilo do cliente.
          </p>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: enviando ? 'wait' : 'pointer', background: '#111', color: '#fff', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {enviando ? 'Enviando...' : '+ Adicionar imagens'}
          <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={enviando}
            onChange={e => { if (e.target.files?.length) enviarArquivos(e.target.files); e.target.value = '' }} />
        </label>
      </div>

      {prog !== null && <div style={{ marginBottom: 10 }}><UploadProgress valor={prog} /></div>}

      {carregando ? (
        <p style={{ fontSize: 12, color: '#aaa' }}>Carregando...</p>
      ) : refs.length === 0 ? (
        <div style={{ border: '1.5px dashed #e0e0e0', borderRadius: 12, padding: '28px 16px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>
          Nenhuma referência ainda. Adicione imagens para deixar a criação de arte mais fiel à marca.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
          {refs.map(url => (
            <div key={url} style={{ position: 'relative', aspectRatio: '4/5', borderRadius: 10, overflow: 'hidden', border: '1px solid #eee', background: '#f6f6f6' }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => remover(url)} title="Remover"
                style={{ position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

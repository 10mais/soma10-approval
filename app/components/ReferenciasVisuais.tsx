'use client'
import { useEffect, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'
import { toast, confirmar } from '@/lib/toast'
import UploadProgress from './UploadProgress'

type Categoria = 'logo' | 'foto' | 'elemento' | 'icone' | 'print' | 'outro'
type Asset = { id: string; url: string; categoria: Categoria; nome?: string; criadoEm?: string }

const CATS: { key: Categoria; label: string; dica: string }[] = [
  { key: 'logo', label: 'Logo', dica: 'Logomarca em versões (principal, símbolo, negativo)' },
  { key: 'foto', label: 'Fotos', dica: 'Fotos do cliente, produtos, ambiente' },
  { key: 'elemento', label: 'Elementos', dica: 'Grafismos, texturas, formas da identidade' },
  { key: 'icone', label: 'Ícones', dica: 'Ícones e pictogramas da marca' },
  { key: 'print', label: 'Prints', dica: 'Prints de posts/artes p/ a IA ler fonte, cor e estilo' },
  { key: 'outro', label: 'Outros', dica: 'Qualquer outra referência visual' },
]

export default function ReferenciasVisuais({ clienteId }: { clienteId: string }) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [filtro, setFiltro] = useState<Categoria | 'todos'>('todos')
  const [alvo, setAlvo] = useState<Categoria>('logo')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [prog, setProg] = useState<number | null>(null)
  const [envLabel, setEnvLabel] = useState('')
  const [arrasta, setArrasta] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/clientes?id=${clienteId}`).then(r => r.json()).then(d => {
      if (!vivo) return
      let lista: Asset[] = Array.isArray(d?.assetsMarca) ? d.assetsMarca : []
      // Migra referências antigas (string[]) para a categoria "outro".
      if (lista.length === 0 && Array.isArray(d?.referenciasVisuais) && d.referenciasVisuais.length) {
        lista = d.referenciasVisuais.map((url: string) => ({ id: uuid(), url, categoria: 'outro' as Categoria }))
      }
      setAssets(lista); setCarregando(false)
    }).catch(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [clienteId])

  async function salvar(novos: Asset[]) {
    setAssets(novos)
    await fetch('/api/clientes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: clienteId, assetsMarca: novos }),
    }).catch(() => toast('Falha ao salvar ativos.', 'erro'))
  }

  async function enviarArquivos(files: FileList) {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    const lote = imgs.slice(0, 20) // até 20 por vez
    if (imgs.length > 20) toast('Máximo de 20 por vez — enviando os primeiros 20.', 'info')
    setEnviando(true)
    const novos = [...assets]
    try {
      for (let i = 0; i < lote.length; i++) {
        const f = lote[i]
        setEnvLabel(`Enviando ${i + 1} de ${lote.length}…`); setProg(0)
        const ext = f.name.split('.').pop() || 'jpg'
        const blob = await upload(`ativos/${clienteId}/${uuid()}.${ext}`, f, {
          access: 'public', handleUploadUrl: '/api/upload', contentType: f.type, clientPayload: f.type,
          onUploadProgress: ({ percentage }) => setProg(percentage),
        })
        novos.push({ id: uuid(), url: blob.url, categoria: alvo, nome: f.name, criadoEm: new Date().toISOString() })
        await salvar(novos) // salva incremental — se um falhar, o que já subiu fica
      }
      toast(`${lote.length} ativo(s) adicionado(s)!`, 'sucesso')
    } catch (e: any) {
      toast(`Falha no upload: ${e?.message || 'erro'}`, 'erro')
    } finally {
      setEnviando(false); setProg(null); setEnvLabel('')
    }
  }

  async function remover(id: string) {
    if (!(await confirmar('Remover este ativo?', { titulo: 'Remover ativo', okLabel: 'Remover', perigo: true }))) return
    await salvar(assets.filter(a => a.id !== id))
  }

  async function mudarCategoria(id: string, categoria: Categoria) {
    await salvar(assets.map(a => a.id === id ? { ...a, categoria } : a))
  }

  const visiveis = filtro === 'todos' ? assets : assets.filter(a => a.categoria === filtro)
  const contagem = (c: Categoria) => assets.filter(a => a.categoria === c).length

  return (
    <div>
      <style>{`
        .am-chip{transition:all .15s ease;cursor:pointer;border:1px solid transparent}
        .am-chip:hover{transform:translateY(-1px)}
        .am-card{position:relative;border-radius:14px;overflow:hidden;border:1px solid rgba(17,17,17,.07);background:#f6f6f7;aspect-ratio:1/1;transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s}
        .am-card:hover{transform:translateY(-3px);box-shadow:0 12px 26px -14px rgba(0,0,0,.35)}
        .am-card .am-tools{opacity:0;transition:opacity .15s ease}
        .am-card:hover .am-tools{opacity:1}
        .am-drop{transition:border-color .15s,background .15s}
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: 'var(--v2-ink)', letterSpacing: '-0.01em' }}>Ativos da marca</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#8a8a8a', lineHeight: 1.5 }}>
            Suba logo, fotos, elementos, ícones e prints. A IA do Studio <strong>olha esses ativos</strong> para reconhecer fonte, logomarca e cores e dirigir a arte no estilo da marca.
          </p>
        </div>
      </div>

      {/* Filtro por categoria */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
        {([{ key: 'todos' as const, label: 'Todos' }, ...CATS]).map(c => {
          const ativo = filtro === c.key
          const n = c.key === 'todos' ? assets.length : contagem(c.key as Categoria)
          return (
            <button key={c.key} className="am-chip" onClick={() => { setFiltro(c.key as any); if (c.key !== 'todos') setAlvo(c.key as Categoria) }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, background: ativo ? 'var(--v2-ink)' : 'var(--v2-surface)', color: ativo ? 'var(--v2-surface)' : 'var(--v2-ink2)', borderColor: ativo ? 'var(--v2-ink)' : 'var(--v2-surface2)' }}>
              {c.label}
              <span style={{ fontSize: 10.5, fontWeight: 800, color: ativo ? 'var(--v2-amber-on)' : 'var(--v2-ink3)' }}>{n}</span>
            </button>
          )
        })}
      </div>

      {/* Dropzone / upload */}
      <div className="am-drop"
        onDragOver={e => { e.preventDefault(); setArrasta(true) }}
        onDragLeave={() => setArrasta(false)}
        onDrop={e => { e.preventDefault(); setArrasta(false); if (e.dataTransfer.files?.length) enviarArquivos(e.dataTransfer.files) }}
        onClick={() => !enviando && inputRef.current?.click()}
        style={{ border: `1.5px dashed ${arrasta ? 'var(--marca, var(--v2-amber-on))' : '#dcdcdc'}`, background: arrasta ? '#fffdf5' : '#fbfbfc', borderRadius: 16, padding: '20px 18px', textAlign: 'center', cursor: enviando ? 'wait' : 'pointer', marginBottom: 16 }}>
        <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={enviando}
          onChange={e => { if (e.target.files?.length) enviarArquivos(e.target.files); e.target.value = '' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: 'var(--v2-ink)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
            {enviando ? (envLabel || 'Enviando…') : 'Arraste imagens ou clique para enviar (até 20 por vez)'}
          </span>
          <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--v2-ink3)' }}>
            em
            <select value={alvo} onChange={e => setAlvo(e.target.value as Categoria)}
              style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }}>
              {CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </span>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>{CATS.find(c => c.key === alvo)?.dica}</p>
        {prog !== null && <div style={{ marginTop: 10, maxWidth: 320, marginInline: 'auto' }}><UploadProgress valor={prog} /></div>}
      </div>

      {/* Grade de ativos */}
      {carregando ? (
        <p style={{ fontSize: 12.5, color: 'var(--v2-ink3)' }}>Carregando...</p>
      ) : visiveis.length === 0 ? (
        <div style={{ borderRadius: 14, padding: '26px 16px', textAlign: 'center', color: 'var(--v2-ink3)', fontSize: 13, background: 'var(--v2-surface1)', border: '1px solid var(--v2-rule)' }}>
          {filtro === 'todos' ? 'Nenhum ativo ainda. Comece pela logo e por alguns posts de referência.' : `Nenhum ativo em "${CATS.find(c => c.key === filtro)?.label}".`}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(116px, 1fr))', gap: 12 }}>
          {visiveis.map(a => (
            <div key={a.id} className="am-card">
              <img src={a.url} alt={a.nome || ''} style={{ width: '100%', height: '100%', objectFit: a.categoria === 'logo' || a.categoria === 'icone' ? 'contain' : 'cover', background: a.categoria === 'logo' || a.categoria === 'icone' ? 'var(--v2-surface)' : undefined, padding: a.categoria === 'logo' || a.categoria === 'icone' ? 10 : 0, boxSizing: 'border-box' }} />
              <div className="am-tools" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,0) 55%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 6 }}>
                <button onClick={() => remover(a.id)} title="Remover"
                  style={{ alignSelf: 'flex-end', width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,.6)', color: 'var(--v2-surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
                <select value={a.categoria} onChange={e => mudarCategoria(a.id, e.target.value as Categoria)} onClick={e => e.stopPropagation()}
                  style={{ width: '100%', padding: '3px 4px', borderRadius: 7, border: 'none', fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(255,255,255,.92)' }}>
                  {CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

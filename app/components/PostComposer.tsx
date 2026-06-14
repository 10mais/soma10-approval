'use client'
import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'

type Cliente = { id: string; nome: string; instagram: string }
type Midia = { url: string; tipo: 'imagem' | 'video' }
type EmEnvio = { id: string; nome: string; progresso: number }

export type ComposerValue = {
  clienteId: string
  legenda: string
  imagens: string[]
  dataAgendada: string
  formato: 'feed' | 'reel' | 'story'
  colaboradores: string[]
}

type PerfilColab = { username: string; nome: string; foto: string; seguidores: number | null }
const MAX_COLAB = 4

const FORMATOS: { key: ComposerValue['formato']; label: string }[] = [
  { key: 'feed', label: 'Feed' },
  { key: 'reel', label: 'Reel' },
  { key: 'story', label: 'Story' },
]

export default function PostComposer({
  clientes,
  valorInicial,
  onSubmit,
  onSalvarRascunho,
  enviando,
  salvandoRascunho,
  textoBotao = 'Salvar',
}: {
  clientes: Cliente[]
  valorInicial?: Partial<ComposerValue>
  onSubmit: (valor: ComposerValue) => void
  onSalvarRascunho?: (valor: ComposerValue) => void
  enviando?: boolean
  salvandoRascunho?: boolean
  textoBotao?: string
}) {
  const [clienteId, setClienteId] = useState(valorInicial?.clienteId || '')
  const [legenda, setLegenda] = useState(valorInicial?.legenda || '')
  const [midias, setMidias] = useState<Midia[]>(
    (valorInicial?.imagens || []).map(url => ({ url, tipo: /\.(mp4|mov)(\?|$)/i.test(url) ? 'video' : 'imagem' }))
  )
  const [dataAgendada, setDataAgendada] = useState(valorInicial?.dataAgendada || '')
  const [formato, setFormato] = useState<ComposerValue['formato']>(valorInicial?.formato || 'feed')
  const [colaboradores, setColaboradores] = useState<string[]>(valorInicial?.colaboradores || [])
  const [colabBusca, setColabBusca] = useState('')
  const [colabResultado, setColabResultado] = useState<PerfilColab | null>(null)
  const [colabBuscando, setColabBuscando] = useState(false)
  const [colabErro, setColabErro] = useState('')
  const colabTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [emEnvio, setEmEnvio] = useState<EmEnvio[]>([])
  const [erroUpload, setErroUpload] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const cliente = clientes.find(c => c.id === clienteId)

  async function enviarArquivos(arquivos: FileList | File[]) {
    setErroUpload('')
    for (const arquivo of Array.from(arquivos)) {
      const id = uuid()
      const ext = arquivo.name.split('.').pop() || 'bin'
      setEmEnvio(lista => [...lista, { id, nome: arquivo.name, progresso: 0 }])
      try {
        const blob = await upload(`midia/${id}.${ext}`, arquivo, {
          access: 'public',
          handleUploadUrl: '/api/upload',
          contentType: arquivo.type,
          clientPayload: arquivo.type,
          onUploadProgress: ({ percentage }) => {
            setEmEnvio(lista => lista.map(e => e.id === id ? { ...e, progresso: percentage } : e))
          },
        })
        setMidias(m => [...m, { url: blob.url, tipo: arquivo.type.startsWith('video') ? 'video' : 'imagem' }])
      } catch (err: any) {
        setErroUpload(err?.message || 'Erro ao enviar arquivo. Tente novamente.')
      } finally {
        setEmEnvio(lista => lista.filter(e => e.id !== id))
      }
    }
  }

  function removerMidia(idx: number) {
    setMidias(m => m.filter((_, i) => i !== idx))
  }

  function buscarColab(termo: string) {
    setColabBusca(termo)
    setColabResultado(null)
    setColabErro('')
    if (colabTimer.current) clearTimeout(colabTimer.current)
    const limpo = termo.trim().replace(/^@/, '')
    if (limpo.length < 2) { setColabBuscando(false); return }
    if (!clienteId) { setColabBuscando(false); setColabErro('Selecione um cliente primeiro para buscar perfis.'); return }
    setColabBuscando(true)
    colabTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/colab?clienteId=${encodeURIComponent(clienteId)}&username=${encodeURIComponent(limpo)}`)
        const data = await res.json()
        if (data.encontrado) {
          setColabResultado(data.perfil)
          setColabErro('')
        } else {
          setColabResultado(null)
          setColabErro(data.error || 'Perfil não encontrado.')
        }
      } catch {
        setColabErro('Erro ao buscar perfil. Tente novamente.')
      } finally {
        setColabBuscando(false)
      }
    }, 450)
  }

  function adicionarColab(username: string) {
    const limpo = username.trim().replace(/^@/, '')
    if (!limpo) return
    setColaboradores(lista => {
      if (lista.length >= MAX_COLAB || lista.some(c => c.toLowerCase() === limpo.toLowerCase())) return lista
      return [...lista, limpo]
    })
    setColabBusca('')
    setColabResultado(null)
    setColabErro('')
  }

  function removerColab(username: string) {
    setColaboradores(lista => lista.filter(c => c !== username))
  }

  function onColabKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (colabResultado) adicionarColab(colabResultado.username)
      else {
        const limpo = colabBusca.trim().replace(/^@/, '')
        if (/^[A-Za-z0-9._]{1,30}$/.test(limpo)) adicionarColab(limpo)
      }
    }
  }

  function enviar() {
    onSubmit({ clienteId, legenda, imagens: midias.map(m => m.url), dataAgendada, formato, colaboradores })
  }

  function salvarRascunho() {
    onSalvarRascunho?.({ clienteId, legenda, imagens: midias.map(m => m.url), dataAgendada, formato, colaboradores })
  }

  const enviandoArquivo = emEnvio.length > 0
  const podeEnviar = !!clienteId && !!legenda.trim() && midias.length > 0 && !enviando && !enviandoArquivo
  const podeSalvarRascunho = !!clienteId && !enviando && !salvandoRascunho

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(280px, 1fr)', gap: 24, alignItems: 'start' }}>
      {/* Coluna esquerda: formulário/editor */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Cliente</label>
          <select value={clienteId} onChange={e => setClienteId(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}>
            <option value="">Selecione o cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome} (@{c.instagram})</option>)}
          </select>
        </div>

        {/* Upload de mídia */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Mídia (imagens ou vídeos)</label>
          <div
            onDragOver={e => { e.preventDefault(); setArrastando(true) }}
            onDragLeave={() => setArrastando(false)}
            onDrop={e => {
              e.preventDefault()
              setArrastando(false)
              if (e.dataTransfer.files?.length) enviarArquivos(e.dataTransfer.files)
            }}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `1.5px dashed ${arrastando ? '#ffc00f' : '#e0e0e0'}`,
              borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
              background: arrastando ? '#fffbeb' : '#fafafa', transition: 'all .15s',
            }}
          >
            <input ref={inputRef} type="file" multiple accept="image/*,video/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.length) enviarArquivos(e.target.files); e.target.value = '' }} />
            <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
              {enviandoArquivo ? 'Enviando arquivo...' : 'Arraste arquivos aqui ou clique para selecionar'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#bbb' }}>JPG, PNG, WEBP, GIF, MP4, MOV — até 200MB</p>
          </div>

          {emEnvio.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {emEnvio.map(e => (
                <div key={e.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{e.nome}</span>
                    <span>{Math.round(e.progresso)}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: '#eee', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${e.progresso}%`, background: '#ffc00f', transition: 'width .2s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {erroUpload && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#ef4444' }}>{erroUpload}</p>
          )}

          {midias.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
              {midias.map((m, i) => (
                <div key={i} style={{ position: 'relative', width: 84, height: 84, borderRadius: 10, overflow: 'hidden', background: '#eee' }}>
                  {m.tipo === 'video' ? (
                    <video src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                  ) : (
                    <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  )}
                  <button onClick={(e) => { e.stopPropagation(); removerMidia(i) }} style={{
                    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1,
                  }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Legenda</label>
          <textarea value={legenda} onChange={e => setLegenda(e.target.value)}
            placeholder="Escreva a legenda do post..."
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, minHeight: 130, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>

        {/* Formato */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Formato</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {FORMATOS.map(f => (
              <button key={f.key} onClick={() => setFormato(f.key)} type="button" style={{
                padding: '8px 18px', borderRadius: 999, border: '1.5px solid', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                borderColor: formato === f.key ? '#111' : '#e0e0e0',
                background: formato === f.key ? '#111' : '#fff',
                color: formato === f.key ? '#ffc00f' : '#888',
              }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Colaboração (collab) */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>
            Marcar em colab com outro perfil
            <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 6 }}>({colaboradores.length}/{MAX_COLAB})</span>
          </label>

          {/* Tags já selecionadas */}
          {colaboradores.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {colaboradores.map(c => (
                <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#111', color: '#ffc00f', borderRadius: 999, padding: '5px 6px 5px 12px', fontSize: 13, fontWeight: 700 }}>
                  @{c}
                  <button type="button" onClick={() => removerColab(c)} style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </span>
              ))}
            </div>
          )}

          {colaboradores.length < MAX_COLAB && (
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e0e0e0', borderRadius: 10, background: '#fff', padding: '0 14px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: 14, color: '#bbb' }}>@</span>
                <input value={colabBusca} onChange={e => buscarColab(e.target.value)} onKeyDown={onColabKeyDown}
                  placeholder="Buscar perfil no Instagram..."
                  style={{ flex: 1, padding: '12px 8px', border: 'none', outline: 'none', fontSize: 14, fontFamily: 'inherit', background: 'transparent' }} />
                {colabBuscando && <span style={{ fontSize: 11, color: '#bbb' }}>buscando…</span>}
              </div>

              {/* Resultado da busca (Enter ou clique para selecionar) */}
              {colabResultado && (
                <div onClick={() => adicionarColab(colabResultado.username)}
                  style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1.5px solid #e0e0e0', borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.08)', zIndex: 5 }}>
                  {colabResultado.foto
                    ? <img src={colabResultado.foto} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eee', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>@{colabResultado.username}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {colabResultado.nome}{colabResultado.seguidores != null ? ` · ${colabResultado.seguidores.toLocaleString('pt-BR')} seguidores` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>Enter ↵</span>
                </div>
              )}

              {/* Fallback: adicionar qualquer @ digitado (inclui contas pessoais, que a API do Meta não valida) */}
              {!colabResultado && !colabBuscando && /^[A-Za-z0-9._]{2,30}$/.test(colabBusca.trim().replace(/^@/, '')) && (
                <div onClick={() => adicionarColab(colabBusca)}
                  style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1.5px solid #e0e0e0', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.08)', zIndex: 5 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eee', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontWeight: 800 }}>@</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>Adicionar @{colabBusca.trim().replace(/^@/, '')}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#888' }}>{colabErro ? colabErro : 'Perfil não verificado pela API — será marcado mesmo assim.'}</p>
                  </div>
                  <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>Enter ↵</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Data agendada</label>
          <input type="datetime-local" value={dataAgendada} onChange={e => setDataAgendada(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {onSalvarRascunho && (
            <button onClick={salvarRascunho} disabled={!podeSalvarRascunho} type="button"
              style={{ flex: 1, padding: '14px 0', background: '#fff', color: '#111', border: '1.5px solid #e0e0e0', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: podeSalvarRascunho ? 'pointer' : 'not-allowed', opacity: podeSalvarRascunho ? 1 : 0.5 }}>
              {salvandoRascunho ? 'Salvando rascunho...' : 'Deixar em rascunho'}
            </button>
          )}
          <button onClick={enviar} disabled={!podeEnviar}
            style={{ flex: 1.4, padding: '14px 0', background: '#ffc00f', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: podeEnviar ? 'pointer' : 'not-allowed', opacity: podeEnviar ? 1 : 0.5 }}>
            {enviando ? 'Salvando...' : textoBotao}
          </button>
        </div>
      </div>

      {/* Coluna direita: preview ao vivo */}
      <div style={{ position: 'sticky', top: 16 }}>
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Pré-visualização
        </p>
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#111', flexShrink: 0 }}>
              {(cliente?.nome || '?')[0]?.toUpperCase()}
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>
              {cliente ? cliente.instagram.replace(/^@/, '') : 'seu_cliente'}
              {colaboradores.length > 0 && (
                <span style={{ fontWeight: 400, color: '#888' }}> e {colaboradores.map(c => c).join(', ')}</span>
              )}
            </span>
            {formato !== 'feed' && (
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#888', background: '#f5f5f5', borderRadius: 999, padding: '3px 9px', textTransform: 'uppercase' }}>
                {formato === 'reel' ? 'Reel' : 'Story'}
              </span>
            )}
          </div>

          <div style={{
            width: '100%', aspectRatio: formato === 'story' || formato === 'reel' ? '9/16' : '1', background: '#f4f4f4',
            display: 'flex', overflowX: midias.length > 1 ? 'auto' : 'hidden', scrollSnapType: 'x mandatory',
          }}>
            {midias.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 13, textAlign: 'center', padding: 16 }}>
                Suas imagens/vídeos aparecerão aqui
              </div>
            ) : midias.map((m, i) => (
              m.tipo === 'video'
                ? <video key={i} src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover', flexShrink: 0, scrollSnapAlign: 'start' }} muted controls />
                : <img key={i} src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', flexShrink: 0, scrollSnapAlign: 'start' }} />
            ))}
          </div>

          <div style={{ padding: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              <strong>{cliente ? cliente.instagram.replace(/^@/, '') : 'seu_cliente'}</strong>{' '}
              {legenda || <span style={{ color: '#ccc' }}>Sua legenda aparecerá aqui...</span>}
            </p>
            {dataAgendada && (
              <p style={{ margin: '10px 0 0', fontSize: 11, color: '#aaa' }}>
                Agendado para {new Date(dataAgendada).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

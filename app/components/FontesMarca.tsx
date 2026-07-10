'use client'
import { useEffect, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'
import { toast, confirmar } from '@/lib/toast'

// Tipografia + "vibe" da marca (motor de criativos).
// Sobe os arquivos de fonte do cliente (.ttf/.otf/.woff/.woff2) para o Blob e
// registra em Cliente.fontes; o motor embute via @font-face para a arte sair na
// tipografia REAL da marca. A vibe (Cliente.style) é um atalho de direção de arte.

type Fonte = { id: string; nome: string; url: string; papel?: 'titulo' | 'texto'; peso?: number; italico?: boolean; criadoEm?: string }

const ESTILOS: { key: string; label: string; dica: string }[] = [
  { key: 'minimalista', label: 'Minimalista', dica: 'Poucos elementos, muito respiro' },
  { key: 'premium', label: 'Premium', dica: 'Sofisticado, escuro, alto contraste' },
  { key: 'energetico', label: 'Energético', dica: 'Vibrante, dinâmico, chamativo' },
  { key: 'clean', label: 'Clean', dica: 'Claro, leve, organizado' },
  { key: 'elegante', label: 'Elegante', dica: 'Serifas, tons suaves, refinado' },
  { key: 'moderno', label: 'Moderno', dica: 'Geométrico, atual, direto' },
  { key: 'classico', label: 'Clássico', dica: 'Tradicional, confiável, sóbrio' },
  { key: 'divertido', label: 'Divertido', dica: 'Descontraído, cores alegres' },
]

const MIME_POR_EXT: Record<string, string> = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' }

// Deduz peso/itálico/nome da família a partir do nome do arquivo (ex.: Montserrat-SemiBold.ttf).
function inferirFonte(nomeArquivo: string): { nome: string; peso: number; italico: boolean } {
  const base = nomeArquivo.replace(/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/, '')
  const lower = base.toLowerCase()
  let peso = 400
  if (/extrabold|heavy|black/.test(lower)) peso = 800
  else if (/bold/.test(lower)) peso = 700
  else if (/semibold|demibold|medium/.test(lower)) peso = 600
  else if (/light|thin/.test(lower)) peso = 300
  const italico = /italic|oblique/.test(lower)
  const nome = base.replace(/[-_ ]?(extrabold|semibold|demibold|bold|medium|regular|light|thin|heavy|black|italic|oblique)/gi, '').replace(/[-_]+$/, '').trim() || base
  return { nome, peso, italico }
}

export default function FontesMarca({ clienteId }: { clienteId: string }) {
  const [fontes, setFontes] = useState<Fonte[]>([])
  const [estilo, setEstilo] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/clientes?id=${clienteId}`).then(r => r.json()).then(d => {
      if (!vivo) return
      setFontes(Array.isArray(d?.fontes) ? d.fontes : [])
      setEstilo(d?.style || '')
      setCarregando(false)
    }).catch(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [clienteId])

  async function salvarFontes(novas: Fonte[]) {
    setFontes(novas)
    await fetch('/api/clientes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: clienteId, fontes: novas }),
    }).catch(() => toast('Falha ao salvar as fontes.', 'erro'))
  }

  async function salvarEstilo(novo: string) {
    setEstilo(novo)
    const r = await fetch('/api/clientes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: clienteId, style: novo || undefined }),
    }).then(x => x.json()).catch(() => null)
    if (r?.ok) toast('Vibe da marca salva.', 'sucesso')
    else toast('Falha ao salvar a vibe.', 'erro')
  }

  async function enviarArquivos(files: FileList) {
    const validos = Array.from(files).filter(f => MIME_POR_EXT[(f.name.split('.').pop() || '').toLowerCase()])
    if (validos.length === 0) { toast('Envie arquivos de fonte (.ttf, .otf, .woff, .woff2).', 'erro'); return }
    setEnviando(true)
    const novas = [...fontes]
    try {
      for (const f of validos.slice(0, 8)) {
        const ext = (f.name.split('.').pop() || 'ttf').toLowerCase()
        const mime = MIME_POR_EXT[ext]
        const blob = await upload(`fontes/${clienteId}/${uuid()}.${ext}`, f, {
          access: 'public', handleUploadUrl: '/api/upload', contentType: mime, clientPayload: mime,
        })
        const info = inferirFonte(f.name)
        // 1ª fonte vira título; as demais, texto (ajustável depois).
        novas.push({ id: uuid(), nome: info.nome, url: blob.url, papel: novas.length === 0 ? 'titulo' : 'texto', peso: info.peso, italico: info.italico || undefined, criadoEm: new Date().toISOString() })
        await salvarFontes([...novas])
      }
      toast('Fonte(s) adicionada(s)! A IA passa a desenhar com a tipografia da marca.', 'sucesso')
    } catch (e: any) {
      toast(`Falha no upload: ${e?.message || 'erro'}`, 'erro')
    } finally {
      setEnviando(false)
    }
  }

  async function remover(id: string) {
    if (!(await confirmar('Remover esta fonte?', { titulo: 'Remover fonte', okLabel: 'Remover', perigo: true }))) return
    await salvarFontes(fontes.filter(f => f.id !== id))
  }

  async function mudar(id: string, patch: Partial<Fonte>) {
    await salvarFontes(fontes.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  // @font-face das fontes subidas para a PRÉVIA ao vivo na própria tela.
  const cssPreview = fontes.map(f =>
    `@font-face{font-family:'fm-${f.id}';src:url('${f.url}');font-weight:${f.peso || 400};font-style:${f.italico ? 'italic' : 'normal'};font-display:swap}`
  ).join('\n')

  if (carregando) return <p style={{ fontSize: 12.5, color: '#aaa' }}>Carregando...</p>

  return (
    <div>
      <style>{cssPreview}</style>

      <div style={{ marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#111', letterSpacing: '-0.01em' }}>Tipografia e vibe da marca</h3>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#8a8a8a', lineHeight: 1.5 }}>
          Suba as <strong>fontes oficiais</strong> do cliente e escolha a vibe visual — o motor de criativos desenha as artes com a tipografia real e o clima certo da marca.
        </p>
      </div>

      {/* Vibe da marca */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#333', marginBottom: 8 }}>Vibe visual</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {ESTILOS.map(e => {
            const ativo = estilo === e.key
            return (
              <button key={e.key} title={e.dica} onClick={() => salvarEstilo(ativo ? '' : e.key)}
                style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${ativo ? '#111' : '#e6e6e6'}`, background: ativo ? '#111' : '#fff', color: ativo ? '#fff' : '#555' }}>
                {e.label}
              </button>
            )
          })}
        </div>
        {estilo && <p style={{ margin: '7px 0 0', fontSize: 11.5, color: '#999' }}>{ESTILOS.find(e => e.key === estilo)?.dica}</p>}
      </div>

      {/* Upload de fontes */}
      <div
        onClick={() => !enviando && inputRef.current?.click()}
        style={{ border: '1.5px dashed #dcdcdc', background: '#fbfbfc', borderRadius: 14, padding: '16px 18px', textAlign: 'center', cursor: enviando ? 'wait' : 'pointer', marginBottom: 14 }}>
        <input ref={inputRef} type="file" accept=".ttf,.otf,.woff,.woff2" multiple style={{ display: 'none' }} disabled={enviando}
          onChange={e => { if (e.target.files?.length) enviarArquivos(e.target.files); e.target.value = '' }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#333' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2M12 4v16M8 20h8" /></svg>
          {enviando ? 'Enviando…' : 'Clique para enviar as fontes da marca (.ttf, .otf, .woff, .woff2)'}
        </span>
      </div>

      {/* Lista de fontes com prévia ao vivo */}
      {fontes.length === 0 ? (
        <div style={{ borderRadius: 12, padding: '18px 16px', textAlign: 'center', color: '#bbb', fontSize: 12.5, background: '#fafafa', border: '1px solid #f0f0f0' }}>
          Nenhuma fonte ainda. Sem fonte da marca, a IA usa uma tipografia compatível com a vibe.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fontes.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, border: '1px solid #eee', background: '#fff', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontFamily: `'fm-${f.id}', sans-serif`, fontSize: 22, color: '#111', lineHeight: 1.2, fontWeight: f.peso || 400, fontStyle: f.italico ? 'italic' : 'normal' }}>
                  {f.nome || 'Fonte da marca'}
                </div>
                <input value={f.nome} onChange={e => setFontes(fontes.map(x => x.id === f.id ? { ...x, nome: e.target.value } : x))}
                  onBlur={e => mudar(f.id, { nome: e.target.value.trim() || 'Fonte' })}
                  placeholder="Nome da família (ex.: Montserrat)"
                  style={{ marginTop: 4, width: '100%', maxWidth: 260, padding: '4px 8px', borderRadius: 7, border: '1px solid #eee', fontSize: 11.5, color: '#777', fontFamily: 'inherit' }} />
              </div>
              <select value={f.papel || 'texto'} onChange={e => mudar(f.id, { papel: e.target.value as 'titulo' | 'texto' })}
                style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                <option value="titulo">Títulos (destaque)</option>
                <option value="texto">Texto (corpo)</option>
              </select>
              <select value={f.peso || 400} onChange={e => mudar(f.id, { peso: Number(e.target.value) })}
                style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
                <option value={300}>Light</option>
                <option value={400}>Regular</option>
                <option value={600}>SemiBold</option>
                <option value={700}>Bold</option>
                <option value={800}>ExtraBold</option>
              </select>
              <button onClick={() => remover(f.id)} title="Remover fonte"
                style={{ width: 28, height: 28, borderRadius: 8, background: '#f6f6f6', color: '#888', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

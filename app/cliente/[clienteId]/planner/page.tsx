'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Calendar from '@/app/components/Calendar'
import PostComposer from '@/app/components/PostComposer'

// Acompanha o status da publicacao pelo proprio post (resiliente a requisicoes longas:
// Reels demoram e a conexao do navegador pode cair antes do servidor terminar).
async function acompanharPublicacao(id: string): Promise<{ ok: boolean; error?: string }> {
  for (let i = 0; i < 75; i++) { // ~5 min (75 x 4s)
    await new Promise(r => setTimeout(r, 4000))
    const p = await fetch(`/api/posts?id=${id}`).then(r => r.json()).catch(() => null)
    if (p?.status === 'publicado') return { ok: true }
    if (p?.status === 'falha_publicacao') return { ok: false, error: p.erroPublicacao || 'falha na publicação' }
  }
  return { ok: false, error: 'A publicação está demorando mais que o normal (Reels podem demorar). Aguarde alguns instantes e confira se o post foi publicado antes de tentar de novo.' }
}

function capaDoPost(post: any): string {
  const ehVideo = (u: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(u || '')
  if (post?.thumbnail) return post.thumbnail
  const caps = post?.capasVideo || {}
  for (const url of (post?.imagens || [])) { if (caps[url]) return caps[url] }
  const img = (post?.imagens || []).find((u: string) => !ehVideo(u))
  if (img) return img
  return Object.values(caps)[0] as string || (post?.imagens || [])[0] || ''
}

function ImagemComFallback({ src }: { src: string }) {
  const [erro, setErro] = useState(false)
  if (erro) return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 11 }}>Sem imagem</div>
  if (/\.(mp4|mov|m4v)(\?|$)/i.test(src || '')) return <video src={src} muted playsInline preload="metadata" onError={() => setErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  return <img src={src} alt="" onError={() => setErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
}

const STATUS_COLOR: Record<string, string> = { rascunho: '#f0f0f0', agendado: '#fef9c3', publicando: '#dbeafe', publicado: '#dcfce7', falha_publicacao: '#fee2e2' }
const STATUS_LABEL: Record<string, string> = { rascunho: 'Rascunho', agendado: 'Agendado', publicando: 'Publicando...', publicado: 'Publicado', falha_publicacao: 'Falha' }

function paraDatetimeLocal(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 16)
}

export default function PlannerPage() {
  const { clienteId } = useParams()
  const [posts, setPosts] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [cliente, setCliente] = useState<any>(null)
  const [view, setView] = useState<'lista' | 'calendario'>('lista')
  const [preview, setPreview] = useState<any>(null)
  const [novoPost, setNovoPost] = useState(false)
  const [editPost, setEditPost] = useState<any>(null)
  const [enviando, setEnviando] = useState(false)
  const [salvandoRascunho, setSalvandoRascunho] = useState(false)

  function carregar() {
    fetch(`/api/posts?clienteId=${clienteId}`).then(r => r.json()).then(d => setPosts(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => {
    carregar()
    fetch('/api/clientes').then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
    fetch(`/api/clientes?id=${clienteId}`).then(r => r.json()).then(d => { if (d && !d.error) setCliente(d) }).catch(() => {})
  }, [clienteId])

  const corCliente = cliente?.corPrimaria || '#ffc00f'

  // Cria/agenda/publica respeitando a acao escolhida no compositor
  async function enviarPost(valor: any) {
    const acao = valor.acao || 'publicar'
    const dataISO = valor.dataAgendada ? new Date(valor.dataAgendada).toISOString() : ''
    const body: any = { ...valor, dataAgendada: dataISO, clienteId, clienteNome: cliente?.nome }
    if (acao === 'rascunho') body.rascunhoInterno = true
    if (acao === 'agendar') body.statusInicial = 'agendado'

    const res = await fetch('/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()).catch(() => null)

    if (acao === 'publicar' && res?.post?.id) {
      const pub = await fetch('/api/publicar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: res.post.id }),
      }).then(r => r.json()).catch(() => ({ ok: false, error: 'falha de conexão' }))
      if (!pub.ok) alert(`Falha ao publicar: ${pub.error || 'erro desconhecido'}`)
    }
    setNovoPost(false)
    carregar()
  }

  async function criarPost(valor: any) {
    setEnviando(true)
    await enviarPost(valor)
    setEnviando(false)
  }
  async function salvarRascunho(valor: any) {
    setSalvandoRascunho(true)
    await enviarPost({ ...valor, acao: 'rascunho' })
    setSalvandoRascunho(false)
  }

  // Editar um post existente (rascunho/agendado) — usa PUT
  async function atualizarPost(valor: any) {
    if (!editPost) return
    setEnviando(true)
    const acao = valor.acao || 'salvar'
    const dataISO = valor.dataAgendada ? new Date(valor.dataAgendada).toISOString() : ''
    const updates: any = {
      id: editPost.id, legenda: valor.legenda, imagens: valor.imagens, formato: valor.formato,
      capasVideo: valor.capasVideo, redes: valor.redes, colaboradores: valor.colaboradores, dataAgendada: dataISO,
    }
    if (acao === 'agendar') updates.status = 'agendado'
    else if (acao === 'salvar') updates.status = 'rascunho'
    const res = await fetch('/api/posts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }).then(r => r.json()).catch(() => null)
    if (acao === 'publicar' && res?.post?.id) {
      // Dispara a publicacao e acompanha pelo status do post (nao depende da resposta
      // da requisicao longa — Reels demoram e a conexao pode cair antes de terminar).
      fetch('/api/publicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: res.post.id }) }).catch(() => {})
      const pub = await acompanharPublicacao(res.post.id)
      if (!pub.ok) alert(`Ainda não foi possível publicar: ${pub.error}\n\nDica: edite o post e verifique a mídia (vídeos em MP4/MOV; imagens em JPG/PNG até 10 MB).`)
    }
    setEnviando(false)
    setEditPost(null)
    carregar()
  }

  async function excluirPost(id: string) {
    if (!confirm('Excluir este post? Esta ação não pode ser desfeita.')) return
    const r = await fetch(`/api/posts?id=${id}`, { method: 'DELETE' }).then(x => x.json()).catch(() => ({ error: 'falha de conexão' }))
    if (r?.error) { alert(`Não foi possível excluir: ${r.error}`); return }
    setPreview(null)
    carregar()
  }

  function abrirEdicao(post: any) {
    setPreview(null)
    setEditPost(post)
  }

  const [republicando, setRepublicando] = useState(false)
  async function republicar(id: string) {
    setRepublicando(true)
    fetch('/api/publicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {})
    const r = await acompanharPublicacao(id)
    setRepublicando(false)
    if (!r.ok) alert(`Ainda não foi possível publicar: ${r.error}\n\nDica: edite o post e verifique a mídia (vídeos em MP4/MOV; imagens em JPG/PNG até 10 MB).`)
    else { setPreview(null); alert('Publicado com sucesso!') }
    carregar()
  }

  // Planner mostra apenas posts reais (criados no compositor) ou pautas que
  // chegaram em "pronto". Pautas em andamento na esteira (tem planoId/etapa) ficam de fora.
  const filtrados = posts.filter(p => (p as any).etapa === 'pronto' || (!(p as any).etapa && !(p as any).planoId))
    .sort((a, b) => new Date(b.dataAgendada || b.criadoEm).getTime() - new Date(a.dataAgendada || a.criadoEm).getTime())

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Planner</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 10, padding: 3 }}>
            {(['lista', 'calendario'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '7px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: view === v ? '#fff' : 'transparent', color: view === v ? '#111' : '#888',
                boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}>{v === 'lista' ? 'Lista' : 'Calendario'}</button>
            ))}
          </div>
          <button onClick={() => setNovoPost(true)} style={{ padding: '9px 16px', background: corCliente, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nova postagem
          </button>
        </div>
      </div>

      {view === 'calendario' && <Calendar posts={filtrados as any} onSelectPost={(p: any) => setPreview(p)} />}

      {view === 'lista' && (
        <>
          {filtrados.length === 0 && <p style={{ textAlign: 'center', padding: 60, color: '#aaa', background: '#fff', borderRadius: 14, border: '1px solid #eee' }}>Nenhum post ainda.</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {filtrados.map(post => {
              const capa = capaDoPost(post)
              const dataMostrar = post.status === 'agendado' ? (post.dataAgendada || post.criadoEm) : (post.atualizadoEm || post.criadoEm)
              return (
                <div key={post.id} onClick={() => setPreview(post)} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: '1px solid #eee' }}>
                  <div style={{ width: '100%', aspectRatio: post.formato === 'story' || post.formato === 'reel' ? '9/16' : '4/5', background: '#f4f4f4', position: 'relative', overflow: 'hidden' }}>
                    {capa ? <ImagemComFallback src={capa} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 11 }}>Sem imagem</div>}
                  </div>
                  <div style={{ padding: 9 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.clienteNome}</span>
                      <span style={{ background: STATUS_COLOR[post.status] || '#eee', borderRadius: 999, padding: '2px 8px', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                        {STATUS_LABEL[post.status] || post.status}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 5px', fontSize: 10, color: '#aaa' }}>{dataMostrar ? new Date(dataMostrar).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#888', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.legenda}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modal novo post / editar */}
      {(novoPost || editPost) && (
        <div onClick={() => { setNovoPost(false); setEditPost(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 700, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#111' }}>{editPost ? 'Editar postagem' : 'Nova postagem'}</h3>
              <button onClick={() => { setNovoPost(false); setEditPost(null) }} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>x</button>
            </div>
            <PostComposer
              clientes={clientes}
              valorInicial={editPost ? {
                clienteId: editPost.clienteId,
                marcoId: editPost.marcoId || '',
                legenda: editPost.legenda || '',
                dataAgendada: paraDatetimeLocal(editPost.dataAgendada),
                imagens: editPost.imagens || [],
                formato: editPost.formato || 'feed',
                colaboradores: editPost.colaboradores || [],
                capasVideo: editPost.capasVideo || {},
                redes: editPost.redes || ['instagram', 'facebook'],
              } : { clienteId: clienteId as string }}
              onSubmit={editPost ? atualizarPost : criarPost}
              onSalvarRascunho={editPost ? undefined : salvarRascunho}
              enviando={enviando}
              salvandoRascunho={salvandoRascunho}
              textoBotao="Agendar"
              travarCliente
              modoEdicao={!!editPost}
            />
          </div>
        </div>
      )}

      {/* Modal de preview */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {preview.imagens?.[0] && (
              <div style={{ width: '100%', aspectRatio: '1', background: '#000', overflow: 'auto', display: 'flex', gap: 2 }}>
                {preview.imagens.map((m: string, i: number) => {
                  const estilo = { width: preview.imagens.length > 1 ? '90%' : '100%', height: '100%', objectFit: 'cover' as const, flexShrink: 0 }
                  return /\.(mp4|mov|m4v)(\?|$)/i.test(m)
                    ? <video key={i} src={m} poster={(preview.capasVideo || {})[m]} controls playsInline muted style={estilo} />
                    : <img key={i} src={m} alt="" style={estilo} />
                })}
              </div>
            )}
            <div style={{ padding: 16, overflowY: 'auto' }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{preview.legenda}</p>
              {preview.dataAgendada && <p style={{ margin: '0 0 10px', fontSize: 12, color: '#aaa' }}>{new Date(preview.dataAgendada).toLocaleString('pt-BR')}</p>}
              {preview.status === 'falha_publicacao' && preview.erroPublicacao && (
                <p style={{ margin: '0 0 10px', fontSize: 12, color: '#b91c1c', background: '#fef2f2', borderRadius: 8, padding: '8px 10px' }}>Erro: {preview.erroPublicacao}</p>
              )}
              {preview.status === 'falha_publicacao' && (
                <button onClick={() => republicar(preview.id)} disabled={republicando} style={{ width: '100%', padding: '11px 0', background: corCliente, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: republicando ? 'not-allowed' : 'pointer', marginBottom: 8 }}>
                  {republicando ? 'Publicando...' : 'Tentar publicar novamente'}
                </button>
              )}
              {(preview.status === 'rascunho' || preview.status === 'agendado' || preview.status === 'falha_publicacao') && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button onClick={() => abrirEdicao(preview)} style={{ flex: 1, padding: '10px 0', background: corCliente, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Editar</button>
                  <button onClick={() => excluirPost(preview.id)} style={{ flex: 1, padding: '10px 0', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>
                </div>
              )}
              <button onClick={() => setPreview(null)} style={{ width: '100%', padding: '10px 0', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

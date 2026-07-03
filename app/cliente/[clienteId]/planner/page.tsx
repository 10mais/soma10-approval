'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Calendar from '@/app/components/Calendar'
import PostComposer from '@/app/components/PostComposer'
import { toast, confirmar } from '@/lib/toast'

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

const STATUS_COLOR: Record<string, string> = { rascunho: '#f0f0f0', aguardando_aprovacao: '#fef3c7', corrigir: '#ffedd5', aprovado: '#dcfce7', reprovado: '#fee2e2', agendado: '#fef9c3', publicando: '#dbeafe', publicado: '#dcfce7', falha_publicacao: '#fee2e2' }
const STATUS_LABEL: Record<string, string> = { rascunho: 'Rascunho', aguardando_aprovacao: 'Aguardando aprovação', corrigir: 'Ajuste solicitado', aprovado: 'Aprovado', reprovado: 'Reprovado', agendado: 'Agendado', publicando: 'Publicando...', publicado: 'Publicado', falha_publicacao: 'Falha' }

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
  const [previewSlide, setPreviewSlide] = useState(0)
  const [legendaExpandida, setLegendaExpandida] = useState(false)
  useEffect(() => { setPreviewSlide(0); setLegendaExpandida(false) }, [preview])
  const [novoPost, setNovoPost] = useState(false)
  const [editPost, setEditPost] = useState<any>(null)
  const [enviando, setEnviando] = useState(false)
  const [salvandoRascunho, setSalvandoRascunho] = useState(false)
  // Publicacao em segundo plano (o modal "minimiza" e o progresso aparece num card flutuante)
  const [pubBg, setPubBg] = useState<{ id: string; titulo: string; capa: string; status: 'publicando' | 'ok' | 'falha'; error?: string } | null>(null)
  async function publicarEmBackground(id: string, titulo: string, capa: string) {
    setPubBg({ id, titulo, capa, status: 'publicando' })
    fetch('/api/publicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {})
    const r = await acompanharPublicacao(id)
    setPubBg(prev => (prev && prev.id === id ? { ...prev, status: r.ok ? 'ok' : 'falha', error: r.error } : prev))
    carregar()
    if (r.ok) setTimeout(() => setPubBg(prev => (prev && prev.id === id && prev.status === 'ok' ? null : prev)), 6000)
  }

  function carregar() {
    fetch(`/api/posts?clienteId=${clienteId}`).then(r => r.json()).then(d => setPosts(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => {
    carregar()
    fetch('/api/clientes').then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
    fetch(`/api/clientes?id=${clienteId}`).then(r => r.json()).then(d => { if (d && !d.error) setCliente(d) }).catch(() => {})
  }, [clienteId])

  // Layout padrao da agencia (sem cor por cliente): botoes primarios no amarelo Soma10.
  const corCliente = 'var(--marca, #ffc00f)'
  const corClienteTexto = 'var(--marca-texto, #111)'

  // Cria/agenda/publica respeitando a acao escolhida no compositor
  async function enviarPost(valor: any) {
    const acao = valor.acao || 'publicar'
    const dataISO = valor.dataAgendada ? new Date(valor.dataAgendada).toISOString() : ''
    const body: any = { ...valor, dataAgendada: dataISO, clienteId, clienteNome: cliente?.nome }
    if (acao === 'rascunho') body.rascunhoInterno = true
    if (acao === 'agendar') body.statusInicial = 'agendado'
    if (acao === 'aprovacao') body.statusInicial = 'aguardando_aprovacao'

    const res = await fetch('/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()).catch(() => null)

    if (acao === 'aprovacao' && res?.post) {
      // Copia o link ÚNICO do cliente (todos os materiais aguardando aprovação)
      const tk = await fetch('/api/aprovacao-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId }) }).then(x => x.json()).catch(() => null)
      const url = tk?.token ? `${window.location.origin}/aprovacoes/${tk.token}` : ''
      if (url && navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {})
      toast(url ? 'Enviado para aprovação! Link do cliente copiado.' : 'Enviado para aprovação.', 'sucesso')
      setNovoPost(false)
      carregar()
      return
    }

    if (acao === 'publicar' && res?.post?.id) {
      // Minimiza: fecha o modal e publica em segundo plano (com barra de progresso)
      setNovoPost(false)
      const capa = (res.post.imagens || [])[0] || ''
      publicarEmBackground(res.post.id, cliente?.nome || 'Post', capa)
      carregar()
      return
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
    else if (acao === 'aprovacao') updates.status = 'aguardando_aprovacao'
    const res = await fetch('/api/posts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }).then(r => r.json()).catch(() => null)
    if (acao === 'aprovacao') { toast('Reenviado para aprovação!', 'sucesso'); setEnviando(false); setEditPost(null); carregar(); return }
    if (acao === 'publicar' && res?.post?.id) {
      // Minimiza: fecha o modal e publica em segundo plano (com barra de progresso)
      setEnviando(false)
      setEditPost(null)
      const capa = capaDoPost(res.post)
      publicarEmBackground(res.post.id, cliente?.nome || 'Post', capa)
      carregar()
      return
    }
    setEnviando(false)
    setEditPost(null)
    carregar()
  }

  async function excluirPost(id: string) {
    if (!(await confirmar('Excluir este post? Esta ação não pode ser desfeita.', { titulo: 'Excluir post', okLabel: 'Excluir', perigo: true }))) return
    const r = await fetch(`/api/posts?id=${id}`, { method: 'DELETE' }).then(x => x.json()).catch(() => ({ error: 'falha de conexão' }))
    if (r?.error) { toast(`Não foi possível excluir: ${r.error}`, 'erro'); return }
    setPreview(null)
    carregar()
  }

  function abrirEdicao(post: any) {
    setPreview(null)
    setEditPost(post)
  }

  async function republicar(id: string) {
    const post = posts.find(p => p.id === id)
    setPreview(null)
    publicarEmBackground(id, cliente?.nome || 'Post', post ? capaDoPost(post) : '')
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
          <button onClick={() => setNovoPost(true)} style={{ padding: '9px 16px', background: corCliente, color: corClienteTexto, border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
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
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', overflowY: 'auto', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            {preview.imagens?.[0] && (() => {
              const imgs: string[] = preview.imagens
              const idx = Math.min(previewSlide, imgs.length - 1)
              const m = imgs[idx]
              const ehVideo = /\.(mp4|mov|m4v)(\?|$)/i.test(m)
              const ratio = preview.formato === 'story' || preview.formato === 'reel' ? '9/16' : '4/5'
              return (
                <div style={{ position: 'relative', width: '100%', aspectRatio: ratio, maxHeight: '46vh', background: '#000', overflow: 'hidden', flexShrink: 0 }}>
                  {ehVideo
                    ? <video src={m} poster={(preview.capasVideo || {})[m]} controls playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <img src={m} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  {imgs.length > 1 && (
                    <>
                      {idx > 0 && (
                        <button type="button" onClick={() => setPreviewSlide(idx - 1)} aria-label="Anterior"
                          style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.85)', color: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        </button>
                      )}
                      {idx < imgs.length - 1 && (
                        <button type="button" onClick={() => setPreviewSlide(idx + 1)} aria-label="Próxima"
                          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.85)', color: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                        </button>
                      )}
                      <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>{idx + 1}/{imgs.length}</div>
                      <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
                        {imgs.map((_, i) => (
                          <span key={i} onClick={() => setPreviewSlide(i)} style={{ width: 6, height: 6, borderRadius: '50%', background: i === idx ? '#fff' : 'rgba(255,255,255,0.5)', boxShadow: '0 0 2px rgba(0,0,0,0.4)', cursor: 'pointer' }} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })()}
            <div>
              {/* Barra de acoes estilo Instagram */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 14px 6px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z" /></svg>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
              </div>
              {/* Legenda estilo Instagram: username + texto com "... mais" */}
              <div style={{ padding: '0 14px 12px' }}>
                {legendaExpandida ? (
                  <p style={{ margin: 0, fontSize: 13.5, color: '#262626', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    <strong>{(cliente?.instagram || preview.clienteNome || '').replace(/^@/, '')}</strong>{' '}{preview.legenda}
                  </p>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: 13.5, color: '#262626', lineHeight: 1.5, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      <strong>{(cliente?.instagram || preview.clienteNome || '').replace(/^@/, '')}</strong>{' '}{preview.legenda}
                    </p>
                    {(preview.legenda || '').length > 80 && (
                      <button onClick={() => setLegendaExpandida(true)} style={{ background: 'none', border: 'none', padding: 0, marginTop: 2, color: '#8e8e8e', fontSize: 13.5, cursor: 'pointer' }}>... mais</button>
                    )}
                  </>
                )}
              </div>
              <div style={{ padding: '0 14px 14px', borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
              {preview.dataAgendada && <p style={{ margin: '0 0 10px', fontSize: 12, color: '#aaa' }}>{new Date(preview.dataAgendada).toLocaleString('pt-BR')}</p>}
              {preview.status === 'falha_publicacao' && preview.erroPublicacao && (
                <p style={{ margin: '0 0 10px', fontSize: 12, color: '#b91c1c', background: '#fef2f2', borderRadius: 8, padding: '8px 10px' }}>Erro: {preview.erroPublicacao}</p>
              )}
              {(preview.status === 'corrigir' || preview.status === 'reprovado') && (preview.motivoReprovacao || (Array.isArray(preview.anotacoes) && preview.anotacoes.length > 0)) && (
                <div style={{ margin: '0 0 10px', fontSize: 12.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', lineHeight: 1.5 }}>
                  <strong>{preview.status === 'reprovado' ? 'Motivo da reprovação (cliente):' : 'Ajuste solicitado (cliente):'}</strong>
                  {preview.motivoReprovacao && <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{preview.motivoReprovacao}</div>}
                  {Array.isArray(preview.anotacoes) && preview.anotacoes.length > 0 && (
                    <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {preview.anotacoes.map((a: any, i: number) => <li key={i}>{a.text || a.texto}</li>)}
                    </ol>
                  )}
                </div>
              )}
              {preview.status === 'falha_publicacao' && (
                <button onClick={() => republicar(preview.id)} style={{ width: '100%', padding: '11px 0', background: corCliente, color: corClienteTexto, border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
                  Tentar publicar novamente
                </button>
              )}
              {(preview.status === 'rascunho' || preview.status === 'agendado' || preview.status === 'falha_publicacao' || preview.status === 'aguardando_aprovacao' || preview.status === 'corrigir' || preview.status === 'reprovado') && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button onClick={() => abrirEdicao(preview)} style={{ flex: 1, padding: '10px 0', background: corCliente, color: corClienteTexto, border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Editar</button>
                  <button onClick={() => excluirPost(preview.id)} style={{ flex: 1, padding: '10px 0', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>
                </div>
              )}
              <button onClick={() => setPreview(null)} style={{ width: '100%', padding: '10px 0', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card flutuante de publicacao em segundo plano (com barra de progresso) */}
      {pubBg && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, width: 320, background: '#fff', borderRadius: 14, boxShadow: '0 10px 36px rgba(0,0,0,0.20)', padding: 14, zIndex: 2000 }}>
          <style>{`@keyframes somaBarIndet { 0% { left: -40% } 100% { left: 100% } }`}</style>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {pubBg.capa
              ? <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#f4f4f4' }}><ImagemComFallback src={pubBg.capa} /></div>
              : <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f4f4f4', flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pubBg.titulo}</div>
              <div style={{ fontSize: 11, color: pubBg.status === 'ok' ? '#16a34a' : pubBg.status === 'falha' ? '#dc2626' : '#666', marginTop: 1 }}>
                {pubBg.status === 'publicando' ? 'Publicando nas redes...' : pubBg.status === 'ok' ? 'Publicado com sucesso!' : 'Falha ao publicar'}
              </div>
            </div>
            {pubBg.status !== 'publicando' && (
              <button onClick={() => setPubBg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 16, padding: 2, lineHeight: 1 }}>×</button>
            )}
          </div>
          {pubBg.status === 'publicando' && (
            <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: '#eee', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', borderRadius: 999, background: corCliente, animation: 'somaBarIndet 1.2s infinite linear' }} />
            </div>
          )}
          {pubBg.status === 'falha' && (
            <>
              <p style={{ margin: '8px 0', fontSize: 11, color: '#b91c1c', lineHeight: 1.4 }}>{pubBg.error}</p>
              <button onClick={() => publicarEmBackground(pubBg.id, pubBg.titulo, pubBg.capa)} style={{ width: '100%', padding: '8px 0', background: corCliente, color: corClienteTexto, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Tentar de novo</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

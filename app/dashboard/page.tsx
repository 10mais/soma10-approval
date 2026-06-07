'use client'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Calendar from '../components/Calendar'

type Post = { id: string; clienteId?: string; clienteNome: string; status: string; dataAgendada?: string; legenda: string; imagens: string[]; codigo?: string }
type Cliente = { id: string; nome: string; instagram: string; metaConectado?: boolean; instagramUsername?: string; facebookPageId?: string; loginEmail?: string; loginSenha?: string }
type MetaPage = { pageId: string; pageName: string; pageToken: string; instagram: { id: string; username: string; profilePic?: string } | null }

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  aguardando_aprovacao: 'Aguardando',
  aprovado: 'Aprovado',
  corrigir: 'Corrigir',
  reprovado: 'Reprovado',
  publicado: 'Publicado',
}

const STATUS_COLOR: Record<string, string> = {
  rascunho: '#e0e0e0',
  aguardando_aprovacao: '#fef3c7',
  aprovado: '#dcfce7',
  corrigir: '#fff3cd',
  reprovado: '#fee2e2',
  publicado: '#dbeafe',
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  )
}

function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [aba, setAba] = useState<'posts' | 'calendario' | 'biblioteca' | 'clientes' | 'usuarios' | 'novo-post'>('posts')
  const [bibBusca, setBibBusca] = useState('')
  const [bibCliente, setBibCliente] = useState('')
  const [bibStatus, setBibStatus] = useState('')
  const [postPreview, setPostPreview] = useState<Post | null>(null)
  const [novoPost, setNovoPost] = useState({ clienteId: '', legenda: '', dataAgendada: '', imagens: '' })
  const [novoCliente, setNovoCliente] = useState({ nome: '', instagram: '', loginEmail: '' })
  const [credenciaisGeradas, setCredenciaisGeradas] = useState<{ nome: string; email: string; senha: string } | null>(null)
  const [erroCliente, setErroCliente] = useState('')
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', senha: '', role: 'gerente' })
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [linkGerado, setLinkGerado] = useState('')
  const [codigoGerado, setCodigoGerado] = useState('')
  // Conexão manual por ID
  const [conectando, setConectando] = useState<string | null>(null)
  const [pageIdInput, setPageIdInput] = useState('')
  const [conectandoLoading, setConectandoLoading] = useState(false)
  const [conectandoMsg, setConectandoMsg] = useState<{ ok: boolean; msg: string } | null>(null)
  // OAuth Meta
  const [metaPages, setMetaPages] = useState<MetaPage[]>([])
  const [vinculos, setVinculos] = useState<Record<string, string>>({}) // pageId -> clienteId
  const [vinculando, setVinculando] = useState(false)
  const [metaErro, setMetaErro] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status])

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/posts').then(r => r.json()).then(setPosts)
      fetch('/api/clientes').then(r => r.json()).then(setClientes)
      if ((session?.user as any)?.role === 'admin') {
        fetch('/api/usuarios').then(r => r.json()).then(setUsuarios)
      }
    }
  }, [status])

  // Ler páginas do cookie após OAuth
  useEffect(() => {
    if (searchParams.get('meta_pages')) {
      setAba('clientes')
      const cookie = document.cookie.split('; ').find(r => r.startsWith('meta_pages='))
      if (cookie) {
        try {
          const pages = JSON.parse(decodeURIComponent(cookie.split('=').slice(1).join('=')))
          setMetaPages(pages)
          document.cookie = 'meta_pages=; max-age=0; path=/'
        } catch {}
      }
    }
    if (searchParams.get('meta_error')) {
      setAba('clientes')
      const erros: Record<string, string> = {
        acesso_negado: 'Acesso negado pelo Facebook.',
        token_falhou: 'Não foi possível obter o token de acesso.',
        sem_paginas: 'Nenhuma Página do Facebook encontrada. Verifique se você é administrador de alguma página.',
        erro_interno: 'Erro interno. Tente novamente.',
      }
      setMetaErro(erros[searchParams.get('meta_error')!] || 'Erro desconhecido.')
    }
  }, [searchParams])

  const role = (session?.user as any)?.role

  async function criarPost() {
    const imagens = novoPost.imagens.split('\n').map(s => s.trim()).filter(Boolean)
    const cliente = clientes.find(c => c.id === novoPost.clienteId)
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...novoPost, imagens, clienteNome: cliente?.nome }),
    }).then(r => r.json())
    setLinkGerado(res.link)
    setCodigoGerado(res.post.codigo)
    fetch('/api/posts').then(r => r.json()).then(setPosts)
    setNovoPost({ clienteId: '', legenda: '', dataAgendada: '', imagens: '' })
  }

  async function salvarVinculos() {
    setVinculando(true)
    for (const [pageId, clienteId] of Object.entries(vinculos)) {
      if (!clienteId) continue
      const page = metaPages.find(p => p.pageId === pageId)
      if (!page || !page.instagram) continue
      await fetch('/api/clientes/conectar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          facebookPageId: pageId,
          facebookPageToken: page.pageToken,
          instagramBusinessId: page.instagram.id,
          instagramUsername: page.instagram.username,
        }),
      })
    }
    setVinculando(false)
    setMetaPages([])
    setVinculos({})
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
  }

  async function conectarInstagram(clienteId: string) {
    if (!pageIdInput.trim()) return
    setConectandoLoading(true)
    setConectandoMsg(null)
    const res = await fetch('/api/clientes/conectar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId, facebookPageId: pageIdInput.trim() }),
    }).then(r => r.json())
    setConectandoLoading(false)
    if (res.ok) {
      setConectandoMsg({ ok: true, msg: `Instagram @${res.instagram} conectado com sucesso!` })
      fetch('/api/clientes').then(r => r.json()).then(setClientes)
      setTimeout(() => { setConectando(null); setPageIdInput(''); setConectandoMsg(null) }, 2000)
    } else {
      setConectandoMsg({ ok: false, msg: res.error + (res.dica ? ' — ' + res.dica : '') })
    }
  }

  async function desconectarInstagram(clienteId: string) {
    await fetch('/api/clientes/conectar', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId }),
    })
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
  }

  async function criarCliente() {
    setErroCliente('')
    setCredenciaisGeradas(null)
    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoCliente),
    })
    const data = await res.json()
    if (!res.ok) {
      setErroCliente(data?.error || 'Erro ao criar cliente.')
      return
    }
    if (data?.cliente?.loginEmail && data?.cliente?.loginSenha) {
      setCredenciaisGeradas({ nome: data.cliente.nome, email: data.cliente.loginEmail, senha: data.cliente.loginSenha })
    }
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
    setNovoCliente({ nome: '', instagram: '', loginEmail: '' })
  }

  async function criarUsuario() {
    await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoUsuario),
    })
    fetch('/api/usuarios').then(r => r.json()).then(setUsuarios)
    setNovoUsuario({ nome: '', email: '', senha: '', role: 'gerente' })
  }

  if (status === 'loading') return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><p>Carregando...</p></div>

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f8', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#ffc00f', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, boxShadow: '0 2px 8px rgba(0,0,0,0.10)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#111', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#ffc00f', fontWeight: 900, fontSize: 11 }}>10+</span>
          </div>
          <span style={{ fontWeight: 800, color: '#111', fontSize: 15 }}>Soma10Approval</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#333' }}>{session?.user?.name}</span>
          <span style={{ background: '#111', color: '#ffc00f', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{role}</span>
          <button onClick={() => signOut()} style={{ background: 'none', border: '1.5px solid #111', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Sair</button>
        </div>
      </div>

      {/* Nav */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 24px', display: 'flex', gap: 4 }}>
        {(['posts', 'calendario', 'biblioteca', 'novo-post', 'clientes', ...(role === 'admin' ? ['usuarios'] : [])] as const).map(a => (
          <button key={a} onClick={() => setAba(a as any)} style={{
            padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: aba === a ? 700 : 400, color: aba === a ? '#111' : '#888',
            borderBottom: aba === a ? '2px solid #ffc00f' : '2px solid transparent',
            fontSize: 14, transition: 'all 0.15s',
          }}>
            {a === 'posts' ? 'Posts' : a === 'calendario' ? 'Calendário' : a === 'biblioteca' ? 'Biblioteca' : a === 'novo-post' ? 'Novo Post' : a === 'clientes' ? 'Clientes' : 'Usuários'}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* POSTS */}
        {aba === 'posts' && (
          <div>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, color: '#111' }}>Todos os Posts</h2>
            {posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
                <p>Nenhum post criado ainda. Clique em "Novo Post" para começar.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {posts.map(post => (
                  <div key={post.id} style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', gap: 16, alignItems: 'center' }}>
                    {post.imagens?.[0] && <img src={post.imagens[0]} alt="" style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{post.clienteNome}</span>
                        <span style={{ background: STATUS_COLOR[post.status] || '#eee', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 600, color: '#333' }}>{STATUS_LABEL[post.status] || post.status}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.legenda}</p>
                      {post.dataAgendada && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#aaa' }}>{new Date(post.dataAgendada).toLocaleDateString('pt-BR')}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CALENDÁRIO */}
        {aba === 'calendario' && (
          <div>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, color: '#111' }}>Calendário de Conteúdo</h2>
            <Calendar posts={posts as any} onSelectPost={(p: any) => router.push(`/aprovar/${p.id}`)} />
          </div>
        )}

        {/* BIBLIOTECA */}
        {aba === 'biblioteca' && (
          <div>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#111' }}>Biblioteca de Conteúdo</h2>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              <input value={bibBusca} onChange={e => setBibBusca(e.target.value)} placeholder="Buscar por legenda..."
                style={{ flex: 1.5, minWidth: 200, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
              <select value={bibCliente} onChange={e => setBibCliente(e.target.value)}
                style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }}>
                <option value="">Todos os clientes</option>
                {clientes.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
              <select value={bibStatus} onChange={e => setBibStatus(e.target.value)}
                style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }}>
                <option value="">Todos os status</option>
                {Object.keys(STATUS_LABEL).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>

            {(() => {
              const filtrados = posts.filter(p =>
                (!bibBusca || p.legenda?.toLowerCase().includes(bibBusca.toLowerCase())) &&
                (!bibCliente || p.clienteNome === bibCliente) &&
                (!bibStatus || p.status === bibStatus)
              )
              if (filtrados.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: 60, color: '#aaa', background: '#fff', borderRadius: 14, border: '1px solid #eee' }}>
                    <p>Nenhum conteúdo encontrado com esses filtros.</p>
                  </div>
                )
              }
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                  {filtrados.map(post => (
                    <div key={post.id} onClick={() => setPostPreview(post)} style={{
                      background: '#fff', borderRadius: 14, border: '1px solid #eee', overflow: 'hidden', cursor: 'pointer',
                    }}>
                      <div style={{ width: '100%', aspectRatio: '1', background: '#f4f4f4', position: 'relative' }}>
                        {post.imagens?.[0] ? (
                          <img src={post.imagens[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 12 }}>Sem imagem</div>
                        )}
                        {post.imagens?.length > 1 && (
                          <span style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 8px' }}>
                            {post.imagens.length}
                          </span>
                        )}
                      </div>
                      <div style={{ padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{post.clienteNome}</span>
                          <span style={{ background: STATUS_COLOR[post.status] || '#eee', borderRadius: 999, padding: '2px 9px', fontSize: 10, fontWeight: 600, color: '#333' }}>
                            {STATUS_LABEL[post.status] || post.status}
                          </span>
                        </div>
                        <p style={{
                          margin: 0, fontSize: 12, color: '#888', lineHeight: 1.4,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {post.legenda}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Modal de preview */}
            {postPreview && (
              <div onClick={() => setPostPreview(null)} style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
              }}>
                <div onClick={e => e.stopPropagation()} style={{
                  background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                }}>
                  {/* Cabeçalho estilo Instagram */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#111' }}>
                      {postPreview.clienteNome?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{postPreview.clienteNome}</span>
                    <span style={{ marginLeft: 'auto', background: STATUS_COLOR[postPreview.status] || '#eee', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600, color: '#333' }}>
                      {STATUS_LABEL[postPreview.status] || postPreview.status}
                    </span>
                  </div>

                  {/* Imagem principal */}
                  {postPreview.imagens?.[0] && (
                    <div style={{ width: '100%', aspectRatio: '1', background: '#f4f4f4', overflow: 'auto', display: 'flex', gap: 2 }}>
                      {postPreview.imagens.map((img, i) => (
                        <img key={i} src={img} alt="" style={{ width: postPreview.imagens.length > 1 ? '90%' : '100%', height: '100%', objectFit: 'cover', flexShrink: 0, scrollSnapAlign: 'start' }} />
                      ))}
                    </div>
                  )}

                  <div style={{ padding: 16, overflowY: 'auto' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      <strong>{postPreview.clienteNome}</strong>{' '}{postPreview.legenda}
                    </p>
                    {postPreview.dataAgendada && (
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#aaa' }}>
                        Agendado para {new Date(postPreview.dataAgendada).toLocaleString('pt-BR')}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => {
                        const cliente = clientes.find(c => c.nome === postPreview.clienteNome)
                        setNovoPost({
                          clienteId: cliente?.id || '',
                          legenda: postPreview.legenda || '',
                          dataAgendada: '',
                          imagens: (postPreview.imagens || []).join('\n'),
                        })
                        setPostPreview(null)
                        setAba('novo-post')
                      }} style={{ flex: 1, padding: '10px 0', background: '#111', color: '#ffc00f', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        Reaproveitar conteúdo
                      </button>
                      <button onClick={() => setPostPreview(null)} style={{ padding: '10px 18px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* NOVO POST */}
        {aba === 'novo-post' && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 24px', fontSize: 18, color: '#111' }}>Criar novo post</h2>

            {linkGerado ? (
              <div style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 14, padding: 24, textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 16px', color: '#111' }}>Post criado com sucesso!</h3>
                <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid #e0e0e0' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#888' }}>Link de aprovação:</p>
                  <p style={{ margin: '0 0 12px', fontWeight: 700, color: '#111', wordBreak: 'break-all', fontSize: 13 }}>{linkGerado}</p>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#888' }}>Código do cliente:</p>
                  <p style={{ margin: 0, fontWeight: 900, fontSize: 32, color: '#ffc00f', letterSpacing: 8 }}>{codigoGerado}</p>
                </div>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#666' }}>Envie o link + código para o cliente via WhatsApp ou email.</p>
                <button onClick={() => { setLinkGerado(''); setCodigoGerado('') }} style={{ padding: '10px 24px', background: '#ffc00f', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                  Criar outro post
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Cliente</label>
                  <select value={novoPost.clienteId} onChange={e => setNovoPost(p => ({ ...p, clienteId: e.target.value }))}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, background: '#fff', fontFamily: 'inherit' }}>
                    <option value="">Selecione o cliente...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome} (@{c.instagram})</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>URLs das imagens (uma por linha)</label>
                  <textarea value={novoPost.imagens} onChange={e => setNovoPost(p => ({ ...p, imagens: e.target.value }))}
                    placeholder="https://exemplo.com/imagem1.png&#10;https://exemplo.com/imagem2.png"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Legenda</label>
                  <textarea value={novoPost.legenda} onChange={e => setNovoPost(p => ({ ...p, legenda: e.target.value }))}
                    placeholder="Escreva a legenda do post..."
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, minHeight: 120, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Data agendada</label>
                  <input type="datetime-local" value={novoPost.dataAgendada} onChange={e => setNovoPost(p => ({ ...p, dataAgendada: e.target.value }))}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>

                <button onClick={criarPost} disabled={!novoPost.clienteId || !novoPost.legenda || !novoPost.imagens}
                  style={{ padding: '14px 0', background: '#ffc00f', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: (!novoPost.clienteId || !novoPost.legenda) ? 0.5 : 1 }}>
                  Criar post e gerar link de aprovação
                </button>
              </div>
            )}
          </div>
        )}

        {/* CLIENTES */}
        {aba === 'clientes' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Clientes</h2>
              {role === 'admin' && (
                <a href="/api/meta/oauth" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: '#1877f2', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Conectar via Facebook
                </a>
              )}
            </div>

            {/* Erro OAuth */}
            {metaErro && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
                {metaErro}
                <button onClick={() => setMetaErro('')} style={{ marginLeft: 12, background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
            )}

            {/* Painel de páginas encontradas via OAuth */}
            {metaPages.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e0e0e0', marginBottom: 20, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                  <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 14, color: '#111' }}>{metaPages.length} {metaPages.length === 1 ? 'conta encontrada' : 'contas encontradas'}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Selecione a qual cliente cada conta pertence e clique em Salvar.</p>
                </div>
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {metaPages.map(page => (
                    <div key={page.pageId} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
                      {page.instagram?.profilePic && (
                        <img src={page.instagram.profilePic} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111' }}>{page.pageName}</p>
                        {page.instagram ? (
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>@{page.instagram.username}</p>
                        ) : (
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#f59e0b' }}>Sem Instagram vinculado</p>
                        )}
                      </div>
                      {page.instagram && (
                        <select
                          value={vinculos[page.pageId] || ''}
                          onChange={e => setVinculos(v => ({ ...v, [page.pageId]: e.target.value }))}
                          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, background: '#fff', fontFamily: 'inherit', minWidth: 180 }}
                        >
                          <option value="">Selecionar cliente...</option>
                          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ padding: '14px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setMetaPages([]); setVinculos({}) }}
                    style={{ padding: '9px 18px', background: '#f5f5f5', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={salvarVinculos} disabled={vinculando || Object.values(vinculos).every(v => !v)}
                    style={{ padding: '9px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: vinculando ? 0.6 : 1 }}>
                    {vinculando ? 'Salvando...' : 'Salvar vínculos'}
                  </button>
                </div>
              </div>
            )}

            {role === 'admin' && (
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 20, border: '1px solid #e8e8e8' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#555' }}>Adicionar cliente manualmente</h3>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input value={novoCliente.nome} onChange={e => setNovoCliente(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do cliente"
                    style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                  <input value={novoCliente.instagram} onChange={e => setNovoCliente(p => ({ ...p, instagram: e.target.value }))} placeholder="@instagram"
                    style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                  <input value={novoCliente.loginEmail} onChange={e => setNovoCliente(p => ({ ...p, loginEmail: e.target.value }))} placeholder="E-mail de acesso do cliente (opcional)" type="email"
                    style={{ flex: 1.4, minWidth: 220, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                  <button onClick={criarCliente} style={{ padding: '10px 18px', background: '#ffc00f', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Adicionar</button>
                </div>
                <p style={{ margin: '10px 0 0', fontSize: 12, color: '#aaa' }}>
                  Informe o e-mail para gerar automaticamente um login e senha para o cliente acessar o portal de aprovação.
                </p>

                {erroCliente && (
                  <div style={{ marginTop: 14, background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444' }}>
                    {erroCliente}
                  </div>
                )}

                {credenciaisGeradas && (
                  <div style={{ marginTop: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                      Acesso criado para {credenciaisGeradas.nome} — copie e envie ao cliente:
                    </p>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
                      <span style={{ color: '#555' }}>Portal: <strong>{typeof window !== 'undefined' ? window.location.origin : ''}/login</strong></span>
                      <span style={{ color: '#555' }}>E-mail: <strong>{credenciaisGeradas.email}</strong></span>
                      <span style={{ color: '#555' }}>Senha: <strong>{credenciaisGeradas.senha}</strong></span>
                    </div>
                    <button onClick={() => {
                      const texto = `Acesso ao portal de aprovação:\n${typeof window !== 'undefined' ? window.location.origin : ''}/login\nE-mail: ${credenciaisGeradas.email}\nSenha: ${credenciaisGeradas.senha}`
                      navigator.clipboard?.writeText(texto)
                    }} style={{ marginTop: 10, padding: '7px 14px', background: '#111', color: '#ffc00f', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      Copiar dados de acesso
                    </button>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {clientes.map(c => (
                <div key={c.id} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#111' }}>{c.nome}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>@{c.instagram}</p>
                      {c.loginEmail && (
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#16a34a' }}>Acesso ao portal: {c.loginEmail}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ background: '#f5f5f5', borderRadius: 8, padding: '3px 10px', fontSize: 12, color: '#666' }}>
                        {posts.filter(p => p.clienteNome === c.nome).length} posts
                      </span>
                      {c.metaConectado ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                            Instagram conectado
                          </span>
                          {role === 'admin' && (
                            <button onClick={() => desconectarInstagram(c.id)}
                              style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '3px 10px', fontSize: 12, color: '#aaa', cursor: 'pointer' }}>
                              Desconectar
                            </button>
                          )}
                        </div>
                      ) : role === 'admin' ? (
                        <button onClick={() => { setConectando(c.id); setPageIdInput(''); setConectandoMsg(null) }}
                          style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Conectar Instagram
                        </button>
                      ) : (
                        <span style={{ background: '#fff3cd', color: '#b45309', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                          Não conectado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Painel de conexão expandido */}
                  {conectando === c.id && (
                    <div style={{ borderTop: '1px solid #f0f0f0', padding: '16px 18px', background: '#fafafa' }}>
                      <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 13, color: '#111' }}>Conectar Instagram do cliente</p>
                      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#888', lineHeight: 1.5 }}>
                        A conta da 10+ precisa ser <strong>administradora da Página do Facebook</strong> do cliente. Informe o ID da Página abaixo.
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          value={pageIdInput}
                          onChange={e => setPageIdInput(e.target.value)}
                          placeholder="ID da Página do Facebook (ex: 123456789)"
                          style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                        />
                        <button onClick={() => conectarInstagram(c.id)} disabled={conectandoLoading || !pageIdInput.trim()}
                          style={{ padding: '10px 18px', background: '#ffc00f', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: conectandoLoading ? 0.6 : 1 }}>
                          {conectandoLoading ? 'Verificando...' : 'Conectar'}
                        </button>
                        <button onClick={() => setConectando(null)}
                          style={{ padding: '10px 14px', background: '#f0f0f0', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666' }}>
                          Cancelar
                        </button>
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#aaa' }}>
                        Para encontrar o ID: acesse a Página no Facebook → Sobre → ID da Página
                      </p>
                      {conectandoMsg && (
                        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: conectandoMsg.ok ? '#dcfce7' : '#fee2e2', color: conectandoMsg.ok ? '#16a34a' : '#dc2626', fontSize: 13 }}>
                          {conectandoMsg.msg}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USUÁRIOS (admin only) */}
        {aba === 'usuarios' && role === 'admin' && (
          <div>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, color: '#111' }}>Colaboradores</h2>
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Adicionar colaborador</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input value={novoUsuario.nome} onChange={e => setNovoUsuario(p => ({ ...p, nome: e.target.value }))} placeholder="Nome"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit' }} />
                  <input value={novoUsuario.email} onChange={e => setNovoUsuario(p => ({ ...p, email: e.target.value }))} placeholder="Email"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit' }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input type="password" value={novoUsuario.senha} onChange={e => setNovoUsuario(p => ({ ...p, senha: e.target.value }))} placeholder="Senha"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit' }} />
                  <select value={novoUsuario.role} onChange={e => setNovoUsuario(p => ({ ...p, role: e.target.value }))}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, background: '#fff', fontFamily: 'inherit' }}>
                    <option value="gerente">Gerente</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button onClick={criarUsuario} style={{ padding: '10px 20px', background: '#ffc00f', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Adicionar</button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {usuarios.map(u => (
                <div key={u.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: '#111' }}>{u.nome}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>{u.email}</p>
                  </div>
                  <span style={{ background: u.role === 'admin' ? '#fef3c7' : '#f0f0f0', borderRadius: 12, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#333' }}>{u.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

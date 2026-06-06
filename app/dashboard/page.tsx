'use client'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Post = { id: string; clienteNome: string; status: string; dataAgendada?: string; legenda: string; imagens: string[] }
type Cliente = { id: string; nome: string; instagram: string; metaConectado?: boolean; instagramUsername?: string; facebookPageId?: string }

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

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [aba, setAba] = useState<'posts' | 'clientes' | 'usuarios' | 'novo-post'>('posts')
  const [novoPost, setNovoPost] = useState({ clienteId: '', legenda: '', dataAgendada: '', imagens: '' })
  const [novoCliente, setNovoCliente] = useState({ nome: '', instagram: '' })
  const [conectando, setConectando] = useState<string | null>(null) // clienteId sendo conectado
  const [pageIdInput, setPageIdInput] = useState('')
  const [conectandoLoading, setConectandoLoading] = useState(false)
  const [conectandoMsg, setConectandoMsg] = useState<{ ok: boolean; msg: string } | null>(null)
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', senha: '', role: 'gerente' })
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [linkGerado, setLinkGerado] = useState('')
  const [codigoGerado, setCodigoGerado] = useState('')

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
    await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoCliente),
    })
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
    setNovoCliente({ nome: '', instagram: '' })
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
        {(['posts', 'novo-post', 'clientes', ...(role === 'admin' ? ['usuarios'] : [])] as const).map(a => (
          <button key={a} onClick={() => setAba(a as any)} style={{
            padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: aba === a ? 700 : 400, color: aba === a ? '#111' : '#888',
            borderBottom: aba === a ? '2px solid #ffc00f' : '2px solid transparent',
            fontSize: 14, transition: 'all 0.15s',
          }}>
            {a === 'posts' ? 'Posts' : a === 'novo-post' ? 'Novo Post' : a === 'clientes' ? 'Clientes' : 'Usuários'}
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
            <h2 style={{ margin: '0 0 20px', fontSize: 18, color: '#111' }}>Clientes</h2>
            {role === 'admin' && (
              <div style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Adicionar cliente</h3>
                <div style={{ display: 'flex', gap: 12 }}>
                  <input value={novoCliente.nome} onChange={e => setNovoCliente(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do cliente"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit' }} />
                  <input value={novoCliente.instagram} onChange={e => setNovoCliente(p => ({ ...p, instagram: e.target.value }))} placeholder="@instagram"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit' }} />
                  <button onClick={criarCliente} style={{ padding: '10px 20px', background: '#ffc00f', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Adicionar</button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {clientes.map(c => (
                <div key={c.id} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#111' }}>{c.nome}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>@{c.instagram}</p>
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

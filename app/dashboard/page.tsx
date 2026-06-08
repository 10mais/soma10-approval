'use client'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Calendar from '../components/Calendar'
import PostComposer from '../components/PostComposer'

type Post = { id: string; clienteId?: string; clienteNome: string; status: string; dataAgendada?: string; legenda: string; imagens: string[]; codigo?: string; formato?: string; erroPublicacao?: string }
type Cliente = { id: string; nome: string; instagram: string; metaConectado?: boolean; instagramUsername?: string; facebookPageId?: string; loginEmail?: string; loginSenha?: string; logo?: string; corPrimaria?: string; corSecundaria?: string }
type ConfigAgencia = { nomeAgencia: string; emailContato?: string; logo?: string; corPrimaria?: string; corSecundaria?: string }
type MetaPage = { pageId: string; pageName: string; pageToken: string; instagram: { id: string; username: string; profilePic?: string } | null }

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  aguardando_aprovacao: 'Aguardando',
  aprovado: 'Aprovado',
  corrigir: 'Corrigir',
  reprovado: 'Reprovado',
  publicado: 'Publicado',
  falha_publicacao: 'Falha ao publicar',
}

const STATUS_COLOR: Record<string, string> = {
  rascunho: '#e0e0e0',
  aguardando_aprovacao: '#fef3c7',
  aprovado: '#dcfce7',
  corrigir: '#fff3cd',
  reprovado: '#fee2e2',
  publicado: '#dbeafe',
  falha_publicacao: '#fee2e2',
}

// Converte uma data ISO para o formato aceito pelo input datetime-local (YYYY-MM-DDTHH:mm)
function paraDatetimeLocal(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
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
  const [aba, setAba] = useState<'posts' | 'calendario' | 'biblioteca' | 'clientes' | 'usuarios' | 'novo-post' | 'config'>('posts')
  const [configAgencia, setConfigAgencia] = useState<ConfigAgencia>({ nomeAgencia: 'Soma10Approval', corPrimaria: '#ffc00f', corSecundaria: '#111111' })
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [configMsg, setConfigMsg] = useState('')
  const [enviandoLogoAgencia, setEnviandoLogoAgencia] = useState(false)
  const [editandoCliente, setEditandoCliente] = useState<string | null>(null)
  const [edicaoCliente, setEdicaoCliente] = useState<Partial<Cliente>>({})
  const [enviandoLogoCliente, setEnviandoLogoCliente] = useState(false)
  const [editandoUsuario, setEditandoUsuario] = useState<string | null>(null)
  const [edicaoUsuario, setEdicaoUsuario] = useState<{ nome: string; role: string; novaSenha: string }>({ nome: '', role: 'gerente', novaSenha: '' })
  const [bibBusca, setBibBusca] = useState('')
  const [bibCliente, setBibCliente] = useState('')
  const [bibStatus, setBibStatus] = useState('')
  const [postPreview, setPostPreview] = useState<Post | null>(null)
  const [verComoClienteId, setVerComoClienteId] = useState('')
  const [composerPrefill, setComposerPrefill] = useState<any>(null)
  const [composerKey, setComposerKey] = useState(0)
  const [criandoPost, setCriandoPost] = useState(false)
  const [editandoPostId, setEditandoPostId] = useState<string | null>(null)
  const [visualizacaoPosts, setVisualizacaoPosts] = useState<'lista' | 'calendario'>('lista')
  const [novoCliente, setNovoCliente] = useState<{ nome: string; instagram: string; loginEmail: string; logo?: string; corPrimaria?: string; corSecundaria?: string }>({ nome: '', instagram: '', loginEmail: '', corPrimaria: '#ffc00f', corSecundaria: '#111111' })
  const [enviandoLogoNovoCliente, setEnviandoLogoNovoCliente] = useState(false)
  const [credenciaisGeradas, setCredenciaisGeradas] = useState<{ nome: string; email: string; senha: string } | null>(null)
  const [erroCliente, setErroCliente] = useState('')
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', senha: '', role: 'gerente' })
  const [erroUsuario, setErroUsuario] = useState('')
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
        fetch('/api/config').then(r => r.json()).then(setConfigAgencia)
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
  const clienteEmVisualizacao = clientes.find(c => c.id === verComoClienteId)
  const postsView = verComoClienteId ? posts.filter(p => p.clienteId === verComoClienteId) : posts

  async function criarPost(valor: { clienteId: string; legenda: string; imagens: string[]; dataAgendada: string; formato: string }) {
    setCriandoPost(true)
    const cliente = clientes.find(c => c.id === valor.clienteId)
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...valor, clienteNome: cliente?.nome }),
    }).then(r => r.json())
    setCriandoPost(false)
    setLinkGerado(res.link)
    setCodigoGerado(res.post.codigo)
    fetch('/api/posts').then(r => r.json()).then(setPosts)
    setComposerPrefill(null)
    setComposerKey(k => k + 1)
  }

  function iniciarEdicaoPost(post: Post) {
    const cliente = clientes.find(c => c.id === post.clienteId || c.nome === post.clienteNome)
    setEditandoPostId(post.id)
    setComposerPrefill({
      clienteId: cliente?.id || post.clienteId || '',
      legenda: post.legenda || '',
      dataAgendada: paraDatetimeLocal(post.dataAgendada),
      imagens: post.imagens || [],
      formato: (post as any).formato || 'feed',
    })
    setComposerKey(k => k + 1)
    setPostPreview(null)
    setAba('novo-post')
  }

  function cancelarEdicaoPost() {
    setEditandoPostId(null)
    setComposerPrefill(null)
    setComposerKey(k => k + 1)
  }

  async function salvarEdicaoPost(valor: { clienteId: string; legenda: string; imagens: string[]; dataAgendada: string; formato: string }) {
    if (!editandoPostId) return
    setCriandoPost(true)
    const cliente = clientes.find(c => c.id === valor.clienteId)
    await fetch('/api/posts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editandoPostId, ...valor, clienteNome: cliente?.nome }),
    })
    setCriandoPost(false)
    setEditandoPostId(null)
    setComposerPrefill(null)
    setComposerKey(k => k + 1)
    fetch('/api/posts').then(r => r.json()).then(setPosts)
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
    if (novoCliente.nome.trim().length < 2) { setErroCliente('Informe o nome do cliente.'); return }
    if (novoCliente.instagram.trim().length < 2) { setErroCliente('Informe o @instagram do cliente.'); return }
    if (novoCliente.loginEmail.trim() && !emailValido(novoCliente.loginEmail)) { setErroCliente('O e-mail de acesso informado não é válido.'); return }
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
    setNovoCliente({ nome: '', instagram: '', loginEmail: '', corPrimaria: '#ffc00f', corSecundaria: '#111111' })
  }

  async function uploadLogoNovoCliente(arquivo: File) {
    setEnviandoLogoNovoCliente(true)
    const url = await enviarImagem(arquivo)
    if (url) setNovoCliente(c => ({ ...c, logo: url }))
    setEnviandoLogoNovoCliente(false)
  }

  async function criarUsuario() {
    setErroUsuario('')
    if (novoUsuario.nome.trim().length < 2) { setErroUsuario('Informe o nome do colaborador.'); return }
    if (!emailValido(novoUsuario.email)) { setErroUsuario('Informe um e-mail válido.'); return }
    if (novoUsuario.senha.trim().length < 6) { setErroUsuario('A senha deve ter pelo menos 6 caracteres.'); return }
    if (!novoUsuario.role) { setErroUsuario('Selecione o nível de acesso.'); return }
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoUsuario),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setErroUsuario(data?.error || 'Erro ao adicionar colaborador.')
      return
    }
    fetch('/api/usuarios').then(r => r.json()).then(setUsuarios)
    setNovoUsuario({ nome: '', email: '', senha: '', role: 'gerente' })
  }

  async function enviarImagem(arquivo: File): Promise<string | null> {
    const form = new FormData()
    form.append('arquivo', arquivo)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const data = await res.json()
    return res.ok ? data.url : null
  }

  async function salvarConfigAgencia() {
    setSalvandoConfig(true)
    setConfigMsg('')
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configAgencia),
    })
    setSalvandoConfig(false)
    if (res.ok) {
      setConfigMsg('Configurações salvas com sucesso!')
      setTimeout(() => setConfigMsg(''), 3000)
    } else {
      setConfigMsg('Erro ao salvar configurações.')
    }
  }

  async function uploadLogoAgencia(arquivo: File) {
    setEnviandoLogoAgencia(true)
    const url = await enviarImagem(arquivo)
    if (url) setConfigAgencia(c => ({ ...c, logo: url }))
    setEnviandoLogoAgencia(false)
  }

  function iniciarEdicaoCliente(c: Cliente) {
    setEditandoCliente(c.id)
    setEdicaoCliente({ nome: c.nome, instagram: c.instagram, logo: c.logo, corPrimaria: c.corPrimaria || '#ffc00f', corSecundaria: c.corSecundaria || '#111111' })
  }

  async function uploadLogoCliente(arquivo: File) {
    setEnviandoLogoCliente(true)
    const url = await enviarImagem(arquivo)
    if (url) setEdicaoCliente(c => ({ ...c, logo: url }))
    setEnviandoLogoCliente(false)
  }

  async function salvarEdicaoCliente(id: string) {
    await fetch('/api/clientes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...edicaoCliente }),
    })
    setEditandoCliente(null)
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
  }

  async function excluirCliente(id: string, nome: string) {
    if (!confirm(`Tem certeza que deseja excluir o cliente "${nome}"? Essa ação não pode ser desfeita.`)) return
    await fetch('/api/clientes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
  }

  function iniciarEdicaoUsuario(u: any) {
    setEditandoUsuario(u.email)
    setEdicaoUsuario({ nome: u.nome, role: u.role, novaSenha: '' })
  }

  async function salvarEdicaoUsuario(email: string) {
    await fetch('/api/usuarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nome: edicaoUsuario.nome, role: edicaoUsuario.role, novaSenha: edicaoUsuario.novaSenha || undefined }),
    })
    setEditandoUsuario(null)
    fetch('/api/usuarios').then(r => r.json()).then(setUsuarios)
  }

  async function excluirUsuario(email: string, nome: string) {
    if (!confirm(`Tem certeza que deseja excluir o colaborador "${nome}"?`)) return
    await fetch('/api/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    fetch('/api/usuarios').then(r => r.json()).then(setUsuarios)
  }

  // Validação do formulário de novo cliente — não deixa confirmar com dados incompletos/incorretos
  const clienteNomeValido = novoCliente.nome.trim().length >= 2
  const clienteInstagramValido = novoCliente.instagram.trim().length >= 2
  const clienteEmailValido = !novoCliente.loginEmail.trim() || emailValido(novoCliente.loginEmail)
  const clienteFormValido = clienteNomeValido && clienteInstagramValido && clienteEmailValido

  // Validação do formulário de novo usuário — nome, e-mail, senha e nível de acesso obrigatórios
  const usuarioNomeValido = novoUsuario.nome.trim().length >= 2
  const usuarioEmailValido = emailValido(novoUsuario.email)
  const usuarioSenhaValida = novoUsuario.senha.trim().length >= 6
  const usuarioRoleValido = !!novoUsuario.role
  const usuarioFormValido = usuarioNomeValido && usuarioEmailValido && usuarioSenhaValida && usuarioRoleValido

  if (status === 'loading') return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><p>Carregando...</p></div>

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f8', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#111', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, boxShadow: '0 2px 8px rgba(0,0,0,0.25)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div onClick={() => { setVerComoClienteId(''); setAba('posts'); router.push('/dashboard') }} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} title="Ir para o início">
          <div style={{ background: '#fff', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="/logo.svg" alt="Soma10" style={{ width: 24, height: 24, objectFit: 'contain' }} />
          </div>
          <span style={{ fontWeight: 800, color: '#fff', fontSize: 15 }}>Soma10Approval</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#ccc' }}>{session?.user?.name}</span>
          <span style={{ background: '#ffc00f', color: '#111', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{role}</span>
          <button onClick={() => signOut()} style={{ background: 'none', border: '1.5px solid #fff', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff' }}>Sair</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {/* Sidebar */}
        <aside style={{
          width: 232, flexShrink: 0, background: '#fff', borderRight: '1px solid #f0f0f0',
          minHeight: 'calc(100vh - 56px)', position: 'sticky', top: 56, padding: '20px 14px', boxSizing: 'border-box',
        }}>
          {/* Seletor de visualização por cliente — primeira coisa exibida */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, padding: '0 4px' }}>
              Visualizando como
            </label>
            {verComoClienteId ? (
              // Cliente travado: cada cliente é único, sem opção de trocar para outro
              <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                  {clienteEmVisualizacao?.nome || 'Cliente'}
                </p>
                <button onClick={() => setVerComoClienteId('')} style={{
                  background: 'none', border: 'none', color: '#92400e', fontWeight: 700, fontSize: 11,
                  cursor: 'pointer', textDecoration: 'underline', padding: 0,
                }}>
                  ← Voltar para a visão da agência
                </button>
              </div>
            ) : (
              <select value={verComoClienteId} onChange={e => setVerComoClienteId(e.target.value)} style={{
                width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0',
                fontSize: 13, fontWeight: 700, background: '#f8f8f8',
                color: '#111', fontFamily: 'inherit', boxSizing: 'border-box', cursor: 'pointer',
              }}>
                <option value="">Visão da agência (todos)</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
          </div>

          <div style={{ height: 1, background: '#f0f0f0', margin: '0 0 16px' }} />

          {/* Menu vertical */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(['posts', 'clientes', ...(role === 'admin' ? ['usuarios', 'config'] : [])] as const).map(a => (
              <button key={a} onClick={() => setAba(a as any)} style={{
                padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                fontWeight: aba === a ? 700 : 500, color: aba === a ? '#111' : '#888',
                background: aba === a ? '#ffc00f' : 'transparent',
                fontSize: 14, transition: 'all 0.15s',
              }}>
                {a === 'posts' ? 'Posts' : a === 'clientes' ? 'Clientes' : a === 'usuarios' ? 'Usuários' : 'Configurações'}
              </button>
            ))}
          </nav>

          {/* Conteúdo agrupado por cliente: Novo Post / Calendário / Biblioteca */}
          <div style={{ marginTop: 18 }}>
            <p style={{ margin: '0 0 6px', padding: '0 4px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {clienteEmVisualizacao ? clienteEmVisualizacao.nome : 'Conteúdo'}
            </p>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(['novo-post', 'calendario', 'biblioteca'] as const).map(a => (
                <button key={a} onClick={() => setAba(a as any)} style={{
                  padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  fontWeight: aba === a ? 700 : 500, color: aba === a ? '#111' : '#888',
                  background: aba === a ? '#ffc00f' : 'transparent',
                  fontSize: 14, transition: 'all 0.15s',
                }}>
                  {a === 'novo-post' ? 'Novo Post' : a === 'calendario' ? 'Calendário' : 'Biblioteca'}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Conteúdo principal */}
        <div style={{ flex: 1, minWidth: 0, padding: '24px 28px' }}>

        {/* Faixa indicando visualização filtrada por cliente */}
        {clienteEmVisualizacao && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, background: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 12, padding: '10px 16px', marginBottom: 20,
          }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#111', flexShrink: 0 }}>
              {clienteEmVisualizacao.nome[0]?.toUpperCase()}
            </span>
            <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
              Você está visualizando o painel como o cliente <strong>{clienteEmVisualizacao.nome}</strong> (@{clienteEmVisualizacao.instagram}) — somente o conteúdo dele é exibido.
            </p>
            <button onClick={() => setVerComoClienteId('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#92400e', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
              Voltar à visão da agência
            </button>
          </div>
        )}

        {/* POSTS */}
        {aba === 'posts' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>{clienteEmVisualizacao ? `Posts de ${clienteEmVisualizacao.nome}` : 'Todos os Posts'}</h2>
              <div style={{ display: 'flex', gap: 4, background: '#f0f0f0', borderRadius: 10, padding: 4 }}>
                {(['lista', 'calendario'] as const).map(v => (
                  <button key={v} onClick={() => setVisualizacaoPosts(v)} style={{
                    padding: '7px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: visualizacaoPosts === v ? '#111' : 'transparent',
                    color: visualizacaoPosts === v ? '#ffc00f' : '#888',
                  }}>
                    {v === 'lista' ? '☰ Lista' : '📅 Calendário'}
                  </button>
                ))}
              </div>
            </div>

            {/* Aviso de falhas de publicação */}
            {postsView.some(p => p.status === 'falha_publicacao') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <p style={{ margin: 0, fontSize: 13, color: '#b91c1c' }}>
                  {postsView.filter(p => p.status === 'falha_publicacao').length === 1
                    ? 'Há 1 post que falhou ao publicar. Verifique e tente novamente.'
                    : `Há ${postsView.filter(p => p.status === 'falha_publicacao').length} posts que falharam ao publicar. Verifique e tente novamente.`}
                </p>
              </div>
            )}

            {postsView.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
                <p>Nenhum post {clienteEmVisualizacao ? 'para este cliente ainda' : 'criado ainda. Clique em "Novo Post" para começar'}.</p>
              </div>
            ) : visualizacaoPosts === 'calendario' ? (
              <Calendar posts={postsView as any} onSelectPost={(p: any) => router.push(`/aprovar/${p.id}`)} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {postsView.map(post => (
                  <div key={post.id} style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', gap: 16, alignItems: 'center' }}>
                    {post.imagens?.[0] && <img src={post.imagens[0]} alt="" style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{post.clienteNome}</span>
                        <span style={{ background: STATUS_COLOR[post.status] || '#eee', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 600, color: '#333' }}>
                          {post.status === 'falha_publicacao' && '⚠️ '}{STATUS_LABEL[post.status] || post.status}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.legenda}</p>
                      {post.dataAgendada && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#aaa' }}>{new Date(post.dataAgendada).toLocaleDateString('pt-BR')}</p>}
                      {post.status === 'falha_publicacao' && post.erroPublicacao && (
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#b91c1c' }}>Erro: {post.erroPublicacao}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => iniciarEdicaoPost(post)} style={{
                        padding: '8px 14px', background: '#f5f5f5', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, color: '#111', cursor: 'pointer',
                      }}>
                        Editar
                      </button>
                      <button onClick={() => router.push(`/aprovar/${post.id}`)} style={{
                        padding: '8px 14px', background: '#111', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, color: '#ffc00f', cursor: 'pointer',
                      }}>
                        Ver
                      </button>
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
            <Calendar posts={postsView as any} onSelectPost={(p: any) => router.push(`/aprovar/${p.id}`)} />
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
              const filtrados = postsView.filter(p =>
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
                      <button onClick={() => iniciarEdicaoPost(postPreview)} style={{ flex: 1, padding: '10px 0', background: '#f5f5f5', color: '#111', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        Editar
                      </button>
                      <button onClick={() => {
                        const cliente = clientes.find(c => c.nome === postPreview.clienteNome)
                        setComposerPrefill({
                          clienteId: cliente?.id || '',
                          legenda: postPreview.legenda || '',
                          dataAgendada: '',
                          imagens: postPreview.imagens || [],
                          formato: 'feed',
                        })
                        setComposerKey(k => k + 1)
                        setPostPreview(null)
                        setAba('novo-post')
                      }} style={{ flex: 1, padding: '10px 0', background: '#111', color: '#ffc00f', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        Reaproveitar
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>{editandoPostId ? 'Editar post' : 'Criar novo post'}</h2>
              {editandoPostId && (
                <button onClick={cancelarEdicaoPost} style={{ background: 'none', border: 'none', color: '#888', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                  Cancelar edição
                </button>
              )}
            </div>

            {linkGerado ? (
              <div style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 14, padding: 24, textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 16px', color: '#111' }}>Post criado com sucesso!</h3>
                <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid #e0e0e0' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#888' }}>Link de aprovação:</p>
                  <p style={{ margin: '0 0 12px', fontWeight: 700, color: '#111', wordBreak: 'break-all', fontSize: 13 }}>{linkGerado}</p>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#888' }}>Código do cliente:</p>
                  <p style={{ margin: 0, fontWeight: 900, fontSize: 32, color: '#ffc00f', letterSpacing: 8 }}>{codigoGerado}</p>
                </div>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#666' }}>Envie o link + código para o cliente via WhatsApp ou email (ou peça que ele acesse o portal com login próprio).</p>
                <button onClick={() => { setLinkGerado(''); setCodigoGerado('') }} style={{ padding: '10px 24px', background: '#ffc00f', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                  Criar outro post
                </button>
              </div>
            ) : (
              <PostComposer
                key={composerKey}
                clientes={clientes}
                valorInicial={composerPrefill || (verComoClienteId ? { clienteId: verComoClienteId } : undefined)}
                onSubmit={editandoPostId ? salvarEdicaoPost : criarPost}
                enviando={criandoPost}
                textoBotao={editandoPostId ? 'Salvar alterações' : 'Criar post e gerar link de aprovação'}
              />
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
                </div>

                {/* Identidade visual do cliente */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#f5f5f5', border: '1.5px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {novoCliente.logo ? <img src={novoCliente.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 11, color: '#bbb' }}>Logo</span>}
                    </div>
                    <span style={{ fontSize: 12, color: '#666', textDecoration: 'underline' }}>{enviandoLogoNovoCliente ? 'Enviando...' : 'Enviar logomarca'}</span>
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { if (e.target.files?.[0]) uploadLogoNovoCliente(e.target.files[0]); e.target.value = '' }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
                    Cor primária
                    <input type="color" value={novoCliente.corPrimaria || '#ffc00f'} onChange={e => setNovoCliente(p => ({ ...p, corPrimaria: e.target.value }))}
                      style={{ width: 36, height: 32, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
                    Cor secundária
                    <input type="color" value={novoCliente.corSecundaria || '#111111'} onChange={e => setNovoCliente(p => ({ ...p, corSecundaria: e.target.value }))}
                      style={{ width: 36, height: 32, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                  </label>
                  <button onClick={criarCliente} disabled={!clienteFormValido} style={{
                    marginLeft: 'auto', padding: '10px 18px', background: clienteFormValido ? '#ffc00f' : '#f0f0f0', border: 'none', borderRadius: 8,
                    fontWeight: 700, fontSize: 13, cursor: clienteFormValido ? 'pointer' : 'not-allowed', color: clienteFormValido ? '#111' : '#bbb',
                  }}>Adicionar cliente</button>
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
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: c.corPrimaria || '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {c.logo ? <img src={c.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontWeight: 800, fontSize: 14, color: c.corSecundaria || '#111' }}>{c.nome[0]?.toUpperCase()}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#111' }}>{c.nome}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>@{c.instagram}</p>
                      {c.loginEmail && (
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#16a34a' }}>Acesso ao portal: {c.loginEmail}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {role === 'admin' && (
                        <>
                          <button onClick={() => editandoCliente === c.id ? setEditandoCliente(null) : iniciarEdicaoCliente(c)}
                            style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#666', cursor: 'pointer' }}>
                            {editandoCliente === c.id ? 'Fechar' : 'Editar'}
                          </button>
                          <button onClick={() => excluirCliente(c.id, c.nome)}
                            style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#ef4444', cursor: 'pointer' }}>
                            Excluir
                          </button>
                        </>
                      )}
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

                  {/* Painel de edição */}
                  {editandoCliente === c.id && (
                    <div style={{ borderTop: '1px solid #f0f0f0', padding: '16px 18px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <input value={edicaoCliente.nome || ''} onChange={e => setEdicaoCliente(p => ({ ...p, nome: e.target.value }))} placeholder="Nome"
                          style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                        <input value={edicaoCliente.instagram || ''} onChange={e => setEdicaoCliente(p => ({ ...p, instagram: e.target.value }))} placeholder="@instagram"
                          style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#f5f5f5', border: '1.5px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {edicaoCliente.logo ? <img src={edicaoCliente.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 11, color: '#bbb' }}>Logo</span>}
                          </div>
                          <span style={{ fontSize: 12, color: '#666', textDecoration: 'underline' }}>{enviandoLogoCliente ? 'Enviando...' : 'Trocar logomarca'}</span>
                          <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => { if (e.target.files?.[0]) uploadLogoCliente(e.target.files[0]); e.target.value = '' }} />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
                          Cor primária
                          <input type="color" value={edicaoCliente.corPrimaria || '#ffc00f'} onChange={e => setEdicaoCliente(p => ({ ...p, corPrimaria: e.target.value }))}
                            style={{ width: 36, height: 32, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
                          Cor secundária
                          <input type="color" value={edicaoCliente.corSecundaria || '#111111'} onChange={e => setEdicaoCliente(p => ({ ...p, corSecundaria: e.target.value }))}
                            style={{ width: 36, height: 32, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                        </label>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                          <button onClick={() => setEditandoCliente(null)} style={{ padding: '9px 16px', background: '#f0f0f0', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>Cancelar</button>
                          <button onClick={() => salvarEdicaoCliente(c.id)} style={{ padding: '9px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Salvar</button>
                        </div>
                      </div>
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
                  <button onClick={criarUsuario} disabled={!usuarioFormValido} style={{
                    padding: '10px 20px', background: usuarioFormValido ? '#ffc00f' : '#f0f0f0', border: 'none', borderRadius: 10,
                    fontWeight: 700, cursor: usuarioFormValido ? 'pointer' : 'not-allowed', color: usuarioFormValido ? '#111' : '#bbb',
                  }}>Adicionar</button>
                </div>
                {erroUsuario && (
                  <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>{erroUsuario}</p>
                )}
                {!erroUsuario && (novoUsuario.nome || novoUsuario.email || novoUsuario.senha) && !usuarioFormValido && (
                  <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>
                    Preencha nome, e-mail válido, senha (mín. 6 caracteres) e nível de acesso para continuar.
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {usuarios.map(u => (
                <div key={u.id} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#111' }}>{u.nome}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>{u.email}</p>
                    </div>
                    <span style={{ background: u.role === 'admin' ? '#fef3c7' : '#f0f0f0', borderRadius: 12, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#333' }}>{u.role}</span>
                    <button onClick={() => editandoUsuario === u.email ? setEditandoUsuario(null) : iniciarEdicaoUsuario(u)}
                      style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#666', cursor: 'pointer' }}>
                      {editandoUsuario === u.email ? 'Fechar' : 'Editar'}
                    </button>
                    <button onClick={() => excluirUsuario(u.email, u.nome)}
                      style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#ef4444', cursor: 'pointer' }}>
                      Excluir
                    </button>
                  </div>
                  {editandoUsuario === u.email && (
                    <div style={{ borderTop: '1px solid #f0f0f0', padding: '16px 18px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <input value={edicaoUsuario.nome} onChange={e => setEdicaoUsuario(p => ({ ...p, nome: e.target.value }))} placeholder="Nome"
                          style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                        <select value={edicaoUsuario.role} onChange={e => setEdicaoUsuario(p => ({ ...p, role: e.target.value }))}
                          style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, background: '#fff', fontFamily: 'inherit' }}>
                          <option value="gerente">Gerente</option>
                          <option value="admin">Admin</option>
                        </select>
                        <input type="password" value={edicaoUsuario.novaSenha} onChange={e => setEdicaoUsuario(p => ({ ...p, novaSenha: e.target.value }))} placeholder="Nova senha (opcional)"
                          style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditandoUsuario(null)} style={{ padding: '9px 16px', background: '#f0f0f0', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>Cancelar</button>
                        <button onClick={() => salvarEdicaoUsuario(u.email)} style={{ padding: '9px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Salvar</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONFIGURAÇÕES (admin only) */}
        {aba === 'config' && role === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Configurações</h2>

            {/* Dados gerais da agência */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Dados da agência</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>Informações e identidade visual exibidas no sistema.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input value={configAgencia.nomeAgencia || ''} onChange={e => setConfigAgencia(p => ({ ...p, nomeAgencia: e.target.value }))} placeholder="Nome da agência"
                    style={{ flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                  <input value={configAgencia.emailContato || ''} onChange={e => setConfigAgencia(p => ({ ...p, emailContato: e.target.value }))} placeholder="E-mail de contato" type="email"
                    style={{ flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', background: '#f5f5f5', border: '1.5px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {configAgencia.logo ? <img src={configAgencia.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 11, color: '#bbb' }}>Logo</span>}
                    </div>
                    <span style={{ fontSize: 12, color: '#666', textDecoration: 'underline' }}>{enviandoLogoAgencia ? 'Enviando...' : 'Enviar logomarca'}</span>
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { if (e.target.files?.[0]) uploadLogoAgencia(e.target.files[0]); e.target.value = '' }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
                    Cor primária
                    <input type="color" value={configAgencia.corPrimaria || '#ffc00f'} onChange={e => setConfigAgencia(p => ({ ...p, corPrimaria: e.target.value }))}
                      style={{ width: 36, height: 32, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
                    Cor secundária
                    <input type="color" value={configAgencia.corSecundaria || '#111111'} onChange={e => setConfigAgencia(p => ({ ...p, corSecundaria: e.target.value }))}
                      style={{ width: 36, height: 32, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                  </label>
                  <button onClick={salvarConfigAgencia} disabled={salvandoConfig}
                    style={{ marginLeft: 'auto', padding: '10px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: salvandoConfig ? 0.6 : 1 }}>
                    {salvandoConfig ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
                {configMsg && (
                  <p style={{ margin: 0, fontSize: 12, color: configMsg.includes('sucesso') ? '#16a34a' : '#ef4444' }}>{configMsg}</p>
                )}
              </div>
            </div>

            {/* Integrações */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Integrações</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>Status das conexões usadas pelo sistema.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fafafa', borderRadius: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111' }}>Meta (Facebook / Instagram)</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>
                      {clientes.filter(c => c.metaConectado).length} de {clientes.length} cliente(s) com Instagram conectado
                    </p>
                  </div>
                  <button onClick={() => setAba('clientes')}
                    style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Gerenciar conexões
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fafafa', borderRadius: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111' }}>Armazenamento de mídia (Vercel Blob)</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>Usado para upload direto de imagens e vídeos nos posts</p>
                  </div>
                  <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>Ativo</span>
                </div>
              </div>
            </div>

            {/* Notificações */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Notificações por e-mail</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>
                Envio automático de e-mails (ex: ao gerar link de aprovação) usa um servidor SMTP configurado nas variáveis de ambiente da Vercel.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fafafa', borderRadius: 10 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111' }}>Servidor SMTP</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>Para alterar host, usuário ou senha, edite as variáveis SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS na Vercel</p>
                </div>
                <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>Configurado</span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: '#bbb', textAlign: 'center' }}>
              Para editar ou remover clientes e colaboradores, use as abas <strong>Clientes</strong> e <strong>Usuários</strong> — agora com botões de Editar/Excluir em cada item.
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

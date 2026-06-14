'use client'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Calendar from '../components/Calendar'
import PostComposer from '../components/PostComposer'
import ConectarRedesModal from '../components/ConectarRedesModal'
import ChatInterno from '../components/ChatInterno'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'

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

// Ícones de contorno (substituem emojis por um visual mais profissional)
function Icon({ children, size = 16, ...props }: { children: any; size?: number } & Record<string, any>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  )
}
const IconSearch = (p: any) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></Icon>
const IconCalendar = (p: any) => <Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Icon>
const IconList = (p: any) => <Icon {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Icon>
const IconFlow = (p: any) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><path d="M10 6.5h4a3 3 0 0 1 3 3V14M14 17.5H8a3 3 0 0 1-3-3V10" /></Icon>
const IconBell = (p: any) => <Icon {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></Icon>
const IconAlert = (p: any) => <Icon {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></Icon>
const IconLock = (p: any) => <Icon {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Icon>
const IconSave = (p: any) => <Icon {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></Icon>
const IconTrash = (p: any) => <Icon {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /><path d="M10 11v6M14 11v6" /></Icon>
const IconImageOff = (p: any) => <Icon {...p}><path d="M10.5 8.5a2 2 0 1 0 0-.001M3 3l18 18" /><path d="M21 15l-5-5L5 21M3 7v12a2 2 0 0 0 2 2h12M21 17V5a2 2 0 0 0-2-2H9" /></Icon>
const IconChart = (p: any) => <Icon {...p}><path d="M3 3v18h18" /><rect x="7" y="13" width="3" height="5" rx="0.5" /><rect x="12" y="9" width="3" height="9" rx="0.5" /><rect x="17" y="6" width="3" height="12" rx="0.5" /></Icon>
const IconDownload = (p: any) => <Icon {...p}><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 19h16" /></Icon>
const IconSun = (p: any) => <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></Icon>
const IconMoon = (p: any) => <Icon {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></Icon>

// Miniatura de mídia do post — exibe um placeholder profissional quando a imagem não carrega
function PostThumb({ src, size = 60, radius = 10 }: { src?: string; size?: number; radius?: number }) {
  const [erro, setErro] = useState(false)
  if (!src || erro) {
    return (
      <div style={{
        width: size, height: size, borderRadius: radius, background: '#f4f4f4', border: '1px solid #eee',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', flexShrink: 0,
      }}>
        <IconImageOff size={Math.round(size * 0.4)} />
      </div>
    )
  }
  return <img src={src} alt="" onError={() => setErro(true)} style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0, display: 'block' }} />
}

// Imagem que ocupa 100% do container, com fallback visual caso a URL não carregue
function ImagemComFallback({ src }: { src: string }) {
  const [erro, setErro] = useState(false)
  if (erro) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 12, gap: 6, flexDirection: 'column' }}>
        <IconImageOff size={22} />
        Imagem indisponível
      </div>
    )
  }
  return <img src={src} alt="" onError={() => setErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
  const [aba, setAba] = useState<'posts' | 'calendario' | 'biblioteca' | 'clientes' | 'usuarios' | 'novo-post' | 'config' | 'analytics' | 'mensagens'>('posts')
  // Tema (claro/escuro) — persistido no navegador
  const [tema, setTema] = useState<'claro' | 'escuro'>('claro')
  useEffect(() => {
    const salvo = typeof window !== 'undefined' ? localStorage.getItem('soma10-tema') : null
    if (salvo === 'escuro' || salvo === 'claro') setTema(salvo)
  }, [])
  function alternarTema() {
    setTema(t => {
      const novo = t === 'claro' ? 'escuro' : 'claro'
      if (typeof window !== 'undefined') localStorage.setItem('soma10-tema', novo)
      return novo
    })
  }

  // Analytics
  const [analyticsClienteId, setAnalyticsClienteId] = useState('')
  const [analyticsDesde, setAnalyticsDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [analyticsAte, setAnalyticsAte] = useState(() => new Date().toISOString().slice(0, 10))
  const [analyticsData, setAnalyticsData] = useState<any | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsErro, setAnalyticsErro] = useState('')
  const [exportandoPdf, setExportandoPdf] = useState(false)

  const [configAgencia, setConfigAgencia] = useState<ConfigAgencia>({ nomeAgencia: 'Soma10Approval', corPrimaria: '#ffc00f', corSecundaria: '#111111' })
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [configMsg, setConfigMsg] = useState('')
  const [enviandoLogoAgencia, setEnviandoLogoAgencia] = useState(false)
  const [editandoCliente, setEditandoCliente] = useState<string | null>(null)
  const [edicaoCliente, setEdicaoCliente] = useState<Partial<Cliente>>({})
  const [enviandoLogoCliente, setEnviandoLogoCliente] = useState(false)
  const [fotoClienteId, setFotoClienteId] = useState<string | null>(null)
  const [editandoUsuario, setEditandoUsuario] = useState<string | null>(null)
  const [edicaoUsuario, setEdicaoUsuario] = useState<{ nome: string; role: string; novaSenha: string }>({ nome: '', role: 'gerente', novaSenha: '' })
  const [bibBusca, setBibBusca] = useState('')
  const [bibCliente, setBibCliente] = useState('')
  const [bibStatus, setBibStatus] = useState('')
  const [postPreview, setPostPreview] = useState<Post | null>(null)
  const [verComoClienteId, setVerComoClienteId] = useState('')
  const [buscaCliente, setBuscaCliente] = useState('')
  const [composerPrefill, setComposerPrefill] = useState<any>(null)
  const [composerKey, setComposerKey] = useState(0)
  const [criandoPost, setCriandoPost] = useState(false)
  const [salvandoRascunho, setSalvandoRascunho] = useState(false)
  const [rascunhoMsg, setRascunhoMsg] = useState('')
  const [editandoPostId, setEditandoPostId] = useState<string | null>(null)
  const [visualizacaoPosts, setVisualizacaoPosts] = useState<'lista' | 'calendario' | 'fluxo'>('lista')
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
  // OAuth Meta
  const [metaPages, setMetaPages] = useState<MetaPage[]>([])
  const [vinculos, setVinculos] = useState<Record<string, string>>({}) // pageId -> clienteId
  const [vinculando, setVinculando] = useState(false)
  const [metaErro, setMetaErro] = useState('')
  const [metaClienteAlvo, setMetaClienteAlvo] = useState('')
  const [vinculandoPagina, setVinculandoPagina] = useState('')
  const [conectarRedesCliente, setConectarRedesCliente] = useState<string | null>(null)
  // Notificações
  const [notificacoes, setNotificacoes] = useState<any[]>([])
  const [inboxAberto, setInboxAberto] = useState(false)

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

  // Notificações: carrega ao autenticar e atualiza periodicamente
  useEffect(() => {
    if (status !== 'authenticated') return
    const carregarNotificacoes = () => fetch('/api/notificacoes').then(r => r.json()).then(d => setNotificacoes(Array.isArray(d) ? d : []))
    carregarNotificacoes()
    const intervalo = setInterval(carregarNotificacoes, 60000)
    return () => clearInterval(intervalo)
  }, [status])

  async function marcarNotificacaoLida(id: string) {
    setNotificacoes(ns => ns.map(n => n.id === id ? { ...n, lida: true } : n))
    await fetch('/api/notificacoes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }

  async function marcarTodasNotificacoesLidas() {
    setNotificacoes(ns => ns.map(n => ({ ...n, lida: true })))
    await fetch('/api/notificacoes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ todasComoLidas: true }) })
  }

  // Ler páginas do cookie após OAuth
  useEffect(() => {
    const pagesId = searchParams.get('meta_pages')
    if (pagesId) {
      setAba('clientes')
      setMetaClienteAlvo(searchParams.get('meta_cliente') || '')
      fetch(`/api/meta/pages?id=${encodeURIComponent(pagesId)}`)
        .then(r => r.json())
        .then(pages => { if (Array.isArray(pages)) setMetaPages(pages) })
        .catch(() => {})
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

  // Quando estamos numa área travada de cliente (ou o usuário é cliente), o Analytics deve sempre se referir a ele
  useEffect(() => {
    if (role === 'cliente' && (session?.user as any)?.clienteId) {
      setAnalyticsClienteId((session?.user as any).clienteId)
    } else if (verComoClienteId) {
      setAnalyticsClienteId(verComoClienteId)
    }
  }, [verComoClienteId, role, session])

  async function buscarAnalytics() {
    if (!analyticsClienteId) { setAnalyticsErro('Selecione um cliente para ver o desempenho.'); return }
    setAnalyticsLoading(true)
    setAnalyticsErro('')
    setAnalyticsData(null)
    try {
      const params = new URLSearchParams({ clienteId: analyticsClienteId, desde: analyticsDesde, ate: analyticsAte })
      const res = await fetch(`/api/analytics?${params.toString()}`)
      const data = await res.json()
      if (!res.ok || data?.error) {
        setAnalyticsErro(data?.error || 'Não foi possível carregar os dados de desempenho.')
      } else if (data?.conectado === false) {
        setAnalyticsErro(data?.error || 'Este cliente ainda não tem a conta do Instagram conectada via Meta.')
      } else {
        setAnalyticsData(data)
      }
    } catch (e) {
      setAnalyticsErro('Erro de comunicação ao buscar os dados de desempenho.')
    }
    setAnalyticsLoading(false)
  }

  async function exportarAnalyticsPdf() {
    if (!analyticsData) return
    setExportandoPdf(true)
    try {
      const [{ default: jsPDF }] = await Promise.all([import('jspdf')])
      await import('jspdf-autotable')
      const cliente = clientes.find(c => c.id === analyticsClienteId)
      const doc = new jsPDF()
      const totais = analyticsData.totais || {}

      doc.setFontSize(16)
      doc.text(`Relatório de desempenho — ${cliente?.nome || analyticsData.instagramUsername || 'Cliente'}`, 14, 18)
      doc.setFontSize(10)
      doc.setTextColor(120)
      doc.text(`Período: ${analyticsDesde} a ${analyticsAte}${analyticsData.instagramUsername ? '  ·  @' + analyticsData.instagramUsername : ''}`, 14, 25)
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 30)

      ;(doc as any).autoTable({
        startY: 38,
        head: [['Posts', 'Curtidas', 'Comentários', 'Alcance', 'Impressões', 'Salvamentos', 'Compartilhamentos']],
        body: [[
          totais.posts ?? 0, totais.curtidas ?? 0, totais.comentarios ?? 0,
          totais.alcance ?? 0, totais.impressoes ?? 0, totais.salvamentos ?? 0, totais.compartilhamentos ?? 0,
        ]],
        theme: 'grid',
        headStyles: { fillColor: [17, 17, 17], textColor: [255, 192, 15] },
      })

      const posts: any[] = analyticsData.posts || []
      ;(doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 12,
        head: [['Data', 'Tipo', 'Legenda', 'Curtidas', 'Comentários', 'Alcance', 'Impressões']],
        body: posts.map(p => [
          p.publicadoEm ? new Date(p.publicadoEm).toLocaleDateString('pt-BR') : '—',
          p.tipo || '—',
          (p.legenda || '').slice(0, 60) + ((p.legenda || '').length > 60 ? '…' : ''),
          p.curtidas ?? 0, p.comentarios ?? 0, p.alcance ?? 0, p.impressoes ?? 0,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [17, 17, 17], textColor: [255, 192, 15] },
        styles: { fontSize: 8 },
        columnStyles: { 2: { cellWidth: 70 } },
      })

      doc.save(`analytics-${(cliente?.nome || 'cliente').toLowerCase().replace(/\s+/g, '-')}-${analyticsDesde}-a-${analyticsAte}.pdf`)
    } catch (e) {
      alert('Não foi possível gerar o PDF. Tente novamente.')
    }
    setExportandoPdf(false)
  }

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

  async function salvarRascunhoPost(valor: { clienteId: string; legenda: string; imagens: string[]; dataAgendada: string; formato: string }) {
    if (!valor.clienteId) return
    setSalvandoRascunho(true)
    setRascunhoMsg('')
    const cliente = clientes.find(c => c.id === valor.clienteId)
    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...valor, clienteNome: cliente?.nome, rascunhoInterno: true }),
    })
    setSalvandoRascunho(false)
    setRascunhoMsg('Rascunho salvo! Ele fica visível apenas para a equipe — o cliente não recebe nem vê este conteúdo até você publicá-lo para aprovação.')
    setComposerPrefill(null)
    setComposerKey(k => k + 1)
    fetch('/api/posts').then(r => r.json()).then(setPosts)
    setTimeout(() => setRascunhoMsg(''), 6000)
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
      colaboradores: (post as any).colaboradores || [],
      capasVideo: (post as any).capasVideo || {},
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

  async function excluirPost(post: Post) {
    if (!confirm(`Excluir definitivamente este post${post.clienteNome ? ' de ' + post.clienteNome : ''}? Esta ação não pode ser desfeita.`)) return
    setPosts(ps => ps.filter(p => p!.id !== post.id))
    const res = await fetch(`/api/posts?id=${post.id}`, { method: 'DELETE' })
    if (!res.ok) {
      fetch('/api/posts').then(r => r.json()).then(setPosts)
      alert('Não foi possível excluir o post.')
    }
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
    setMetaClienteAlvo('')
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
  }

  // Vincula UMA página (Facebook + Instagram) diretamente ao cliente-alvo da conexão
  async function vincularPaginaACliente(page: MetaPage, clienteId: string) {
    if (!page.instagram) return
    setVinculandoPagina(page.pageId)
    await fetch('/api/clientes/conectar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId,
        facebookPageId: page.pageId,
        facebookPageToken: page.pageToken,
        instagramBusinessId: page.instagram.id,
        instagramUsername: page.instagram.username,
      }),
    })
    setVinculandoPagina('')
    setMetaPages([])
    setVinculos({})
    setMetaClienteAlvo('')
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
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
    try {
      const ext = arquivo.name.split('.').pop() || 'bin'
      const blob = await upload(`midia/${uuid()}.${ext}`, arquivo, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        contentType: arquivo.type,
        clientPayload: arquivo.type,
      })
      return blob.url
    } catch {
      return null
    }
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

  async function uploadFotoCliente(clienteId: string, arquivo: File) {
    setFotoClienteId(clienteId)
    const url = await enviarImagem(arquivo)
    if (url) {
      await fetch('/api/clientes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: clienteId, logo: url }),
      })
      fetch('/api/clientes').then(r => r.json()).then(setClientes)
    }
    setFotoClienteId(null)
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
    <div className={tema === 'escuro' ? 'soma10-tema-escuro' : ''} style={{ minHeight: '100vh', background: '#f8f8f8', fontFamily: 'Inter, sans-serif', ...(tema === 'escuro' ? { filter: 'invert(1) hue-rotate(180deg)' } : {}) }}>
      {/* Inverte de volta imagens, vídeos e miniaturas para que continuem com cores naturais no modo escuro (técnica de inversão = "cores opostas") */}
      <style jsx global>{`
        .soma10-tema-escuro img, .soma10-tema-escuro video, .soma10-tema-escuro iframe {
          filter: invert(1) hue-rotate(180deg);
        }
      `}</style>
      {/* Header */}
      <div style={{ background: '#111', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, boxShadow: '0 2px 8px rgba(0,0,0,0.25)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div onClick={() => { setVerComoClienteId(''); setAba('posts'); router.push('/dashboard') }} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} title="Ir para o início">
          <div style={{ background: '#fff', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="/logo.svg" alt="Soma10" style={{ width: 24, height: 24, objectFit: 'contain' }} />
          </div>
          <span style={{ fontWeight: 800, color: '#fff', fontSize: 15 }}>Soma10Approval</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Alternar modo claro/escuro */}
          <button onClick={alternarTema} title={tema === 'escuro' ? 'Mudar para modo claro' : 'Mudar para modo escuro'} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#fff',
            width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {tema === 'escuro' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>

          {/* Sininho de notificações */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setInboxAberto(v => !v)} title="Notificações" style={{
              position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#fff',
              width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconBell size={18} />
              {notificacoes.some(n => !n.lida) && (
                <span style={{
                  position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 999, background: '#ef4444',
                  color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid #111',
                }}>
                  {notificacoes.filter(n => !n.lida).length > 9 ? '9+' : notificacoes.filter(n => !n.lida).length}
                </span>
              )}
            </button>

            {inboxAberto && (
              <>
                <div onClick={() => setInboxAberto(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
                <div style={{
                  position: 'absolute', top: 44, right: 0, width: 360, maxHeight: 440, overflowY: 'auto', background: '#fff',
                  borderRadius: 14, boxShadow: '0 12px 36px rgba(0,0,0,0.18)', border: '1px solid #eee', zIndex: 200,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#111' }}>Notificações</span>
                    {notificacoes.some(n => !n.lida) && (
                      <button onClick={marcarTodasNotificacoesLidas} style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>
                  {notificacoes.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>Nenhuma notificação por enquanto.</div>
                  ) : (
                    notificacoes.map(n => (
                      <div key={n.id} onClick={() => {
                        if (!n.lida) marcarNotificacaoLida(n.id)
                        if (n.postId) { setInboxAberto(false); router.push(`/aprovar/${n.postId}`) }
                      }} style={{
                        padding: '12px 16px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer',
                        background: n.lida ? '#fff' : '#fffbeb', display: 'flex', gap: 10, alignItems: 'flex-start',
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.lida ? 'transparent' : '#f59e0b', marginTop: 5, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>{n.titulo}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888', lineHeight: 1.4 }}>{n.mensagem}</p>
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#bbb' }}>{new Date(n.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {clienteEmVisualizacao?.logo ? (
                    <img src={clienteEmVisualizacao.logo} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #fde68a' }} />
                  ) : (
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#111', flexShrink: 0 }}>
                      {(clienteEmVisualizacao?.nome || '?')[0]?.toUpperCase()}
                    </span>
                  )}
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                    {clienteEmVisualizacao?.nome || 'Cliente'}
                  </p>
                </div>
                <button onClick={() => { setVerComoClienteId(''); setAba('clientes') }} style={{
                  background: 'none', border: 'none', color: '#92400e', fontWeight: 700, fontSize: 11,
                  cursor: 'pointer', textDecoration: 'underline', padding: 0,
                }}>
                  ← Voltar para a visão da agência
                </button>
              </div>
            ) : (
              <div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#bbb', pointerEvents: 'none', display: 'flex' }}><IconSearch size={14} /></span>
                  <input
                    value={buscaCliente}
                    onChange={e => setBuscaCliente(e.target.value)}
                    placeholder="Buscar cliente..."
                    style={{
                      width: '100%', padding: '10px 12px 10px 34px', borderRadius: 10, border: '1.5px solid #e0e0e0',
                      fontSize: 13, fontWeight: 600, background: '#f8f8f8', color: '#111', fontFamily: 'inherit', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
                  <button onClick={() => { setVerComoClienteId(''); setBuscaCliente('') }} style={{
                    textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'transparent', color: '#888', fontSize: 12, fontWeight: 700,
                  }}>
                    Visão da agência (todos)
                  </button>
                  {clientes
                    .filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()))
                    .map(c => (
                      <button key={c.id} onClick={() => { setVerComoClienteId(c.id); setBuscaCliente(''); setAba('novo-post') }} style={{
                        textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'transparent', color: '#111', fontSize: 13, fontWeight: 600,
                      }}>
                        {c.nome}
                      </button>
                    ))}
                  {buscaCliente && clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase())).length === 0 && (
                    <p style={{ margin: '4px 10px', fontSize: 12, color: '#bbb' }}>Nenhum cliente encontrado.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ height: 1, background: '#f0f0f0', margin: '0 0 16px' }} />

          {/* NÍVEL AGÊNCIA — oculto na visão de cliente */}
          {!verComoClienteId && (
            <>
              <p style={{ margin: '0 0 6px', padding: '0 4px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Agência
              </p>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(['clientes', 'mensagens', ...(role === 'admin' ? ['usuarios', 'config'] : [])] as const).map(a => (
                  <button key={a} onClick={() => setAba(a as any)} style={{
                    padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    fontWeight: aba === a ? 700 : 500, color: aba === a ? '#111' : '#888',
                    background: aba === a ? '#ffc00f' : 'transparent',
                    fontSize: 14, transition: 'all 0.15s',
                  }}>
                    {a === 'clientes' ? 'Clientes' : a === 'mensagens' ? 'Mensagens' : a === 'usuarios' ? 'Usuários' : 'Configurações'}
                  </button>
                ))}
              </nav>
            </>
          )}

          {/* NÍVEL CLIENTE — só na visualização como cliente */}
          {verComoClienteId && (
            <div>
              <p style={{ margin: '0 0 4px', padding: '0 4px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cliente
              </p>
              <p style={{ margin: '0 0 8px', padding: '0 4px', fontSize: 11, color: '#16a34a' }}>
                Vendo como: {clienteEmVisualizacao?.nome}
              </p>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(['novo-post', 'calendario', 'biblioteca', 'analytics'] as const).map(a => (
                  <button key={a} onClick={() => setAba(a as any)} style={{
                    padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    fontWeight: aba === a ? 700 : 500, color: aba === a ? '#111' : '#888',
                    background: aba === a ? '#ffc00f' : 'transparent',
                    fontSize: 14, transition: 'all 0.15s',
                  }}>
                    {a === 'novo-post' ? 'Novo Post' : a === 'calendario' ? 'Calendário' : a === 'biblioteca' ? 'Biblioteca' : 'Analytics'}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </aside>

        {/* Conteúdo principal */}
        <div style={{ flex: 1, minWidth: 0, padding: '24px 28px' }}>

        {/* Faixa indicando visualização filtrada por cliente */}
        {clienteEmVisualizacao && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, background: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 12, padding: '10px 16px', marginBottom: 20,
          }}>
            {clienteEmVisualizacao.logo ? (
              <img src={clienteEmVisualizacao.logo} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #fde68a' }} />
            ) : (
              <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#111', flexShrink: 0 }}>
                {clienteEmVisualizacao.nome[0]?.toUpperCase()}
              </span>
            )}
            <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
              Você está visualizando o painel como o cliente <strong>{clienteEmVisualizacao.nome}</strong> (@{clienteEmVisualizacao.instagram}) — somente o conteúdo dele é exibido.
            </p>
            <button onClick={() => { setVerComoClienteId(''); setAba('clientes') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#92400e', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
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
                {(['lista', 'calendario', 'fluxo'] as const).map(v => (
                  <button key={v} onClick={() => setVisualizacaoPosts(v)} style={{
                    padding: '7px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: visualizacaoPosts === v ? '#111' : 'transparent',
                    color: visualizacaoPosts === v ? '#ffc00f' : '#888',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    {v === 'lista' ? <IconList size={14} /> : v === 'calendario' ? <IconCalendar size={14} /> : <IconFlow size={14} />}
                    {v === 'lista' ? 'Lista' : v === 'calendario' ? 'Calendário' : 'Fluxo'}
                  </button>
                ))}
              </div>
            </div>

            {/* Aviso de falhas de publicação */}
            {postsView.some(p => p.status === 'falha_publicacao') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                <span style={{ color: '#b91c1c', display: 'flex' }}><IconAlert size={18} /></span>
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
            ) : visualizacaoPosts === 'fluxo' ? (
              <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
                {(['rascunho', 'aguardando_aprovacao', 'corrigir', 'aprovado', 'reprovado', 'publicado', 'falha_publicacao'] as const).map(st => {
                  const itens = postsView.filter(p => p.status === st)
                  return (
                    <div key={st} style={{ flex: '0 0 240px', background: '#fafafa', borderRadius: 14, border: '1px solid #eee', display: 'flex', flexDirection: 'column', maxHeight: 640 }}>
                      <div style={{ padding: '12px 14px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#333' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[st] || '#ddd', display: 'inline-block', border: '1px solid rgba(0,0,0,0.08)' }} />
                          {STATUS_LABEL[st]}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', background: '#fff', borderRadius: 999, padding: '2px 8px', border: '1px solid #eee' }}>{itens.length}</span>
                      </div>
                      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                        {itens.length === 0 ? (
                          <p style={{ margin: '8px 4px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>Nenhum post</p>
                        ) : itens.map(post => (
                          <div key={post.id} onClick={() => router.push(`/aprovar/${post.id}`)} style={{
                            background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: 10, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center',
                          }}>
                            <PostThumb src={(post as any).thumbnail || post.imagens?.[0]} size={38} radius={8} />
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.clienteNome}</p>
                              <p style={{ margin: 0, fontSize: 11, color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.legenda}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {postsView.map(post => (
                  <div key={post.id} style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', gap: 16, alignItems: 'center' }}>
                    <PostThumb src={(post as any).thumbnail || post.imagens?.[0]} size={60} radius={10} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        {(() => {
                          const cli = clientes.find(c => c.id === post.clienteId || c.nome === post.clienteNome)
                          return cli?.logo ? (
                            <img src={cli.logo} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          ) : (
                            <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, color: '#111', flexShrink: 0 }}>
                              {(post.clienteNome || '?')[0]?.toUpperCase()}
                            </span>
                          )
                        })()}
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{post.clienteNome}</span>
                        <span style={{ background: STATUS_COLOR[post.status] || '#eee', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 600, color: '#333', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {post.status === 'falha_publicacao' && <IconAlert size={12} />}{STATUS_LABEL[post.status] || post.status}
                        </span>
                        {(post as any).rascunhoInterno && (
                          <span style={{ background: '#eef2ff', color: '#4338ca', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <IconLock size={12} /> Interno (cliente não vê)
                          </span>
                        )}
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
                      {role !== 'cliente' && (
                        <button onClick={() => excluirPost(post)} title="Excluir post" style={{
                          padding: '8px 10px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 8, color: '#b91c1c', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <IconTrash size={14} />
                        </button>
                      )}
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
                        {((post as any).thumbnail || post.imagens?.[0]) ? (
                          <ImagemComFallback src={(post as any).thumbnail || post.imagens[0]} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 12, gap: 6, flexDirection: 'column' }}>
                            <IconImageOff size={22} />
                            Sem imagem
                          </div>
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
                          colaboradores: (postPreview as any).colaboradores || [],
                          capasVideo: (postPreview as any).capasVideo || {},
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
                      {role !== 'cliente' && (
                        <button onClick={() => { excluirPost(postPreview); setPostPreview(null) }} title="Excluir post" style={{
                          padding: '10px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 10, color: '#b91c1c', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS */}
        {aba === 'analytics' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <IconChart size={20} />
              <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Desempenho {clienteEmVisualizacao ? `de ${clienteEmVisualizacao.nome}` : ''}</h2>
            </div>

            {/* Filtros */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
              {!clienteEmVisualizacao && role !== 'cliente' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Cliente</label>
                  <select value={analyticsClienteId} onChange={e => { setAnalyticsClienteId(e.target.value); setAnalyticsData(null); setAnalyticsErro('') }}
                    style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', minWidth: 220 }}>
                    <option value="">Selecione...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>De</label>
                <input type="date" value={analyticsDesde} onChange={e => setAnalyticsDesde(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Até</label>
                <input type="date" value={analyticsAte} onChange={e => setAnalyticsAte(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
              </div>
              <button onClick={buscarAnalytics} disabled={analyticsLoading || !analyticsClienteId} style={{
                padding: '11px 22px', background: '#111', color: '#ffc00f', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13,
                cursor: (analyticsLoading || !analyticsClienteId) ? 'not-allowed' : 'pointer', opacity: (analyticsLoading || !analyticsClienteId) ? 0.5 : 1,
              }}>
                {analyticsLoading ? 'Carregando...' : 'Buscar dados'}
              </button>
              {analyticsData && (
                <button onClick={exportarAnalyticsPdf} disabled={exportandoPdf} style={{
                  padding: '11px 18px', background: '#fff', color: '#111', border: '1.5px solid #e0e0e0', borderRadius: 10, fontWeight: 700, fontSize: 13,
                  cursor: exportandoPdf ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                  <IconDownload size={14} /> {exportandoPdf ? 'Gerando PDF...' : 'Exportar PDF'}
                </button>
              )}
            </div>

            {analyticsErro && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', marginBottom: 18, color: '#b91c1c', fontSize: 13 }}>
                <IconAlert size={16} /> {analyticsErro}
              </div>
            )}

            {!analyticsData && !analyticsErro && !analyticsLoading && (
              <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
                <IconChart size={32} />
                <p style={{ marginTop: 10 }}>Selecione um cliente e um período, depois clique em "Buscar dados" para ver o desempenho real do Instagram (via API do Meta).</p>
              </div>
            )}

            {analyticsData && (
              <>
                {/* Cartões de totais */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14, marginBottom: 20 }}>
                  {[
                    { label: 'Posts no período', valor: analyticsData.totais?.posts },
                    { label: 'Curtidas', valor: analyticsData.totais?.curtidas },
                    { label: 'Comentários', valor: analyticsData.totais?.comentarios },
                    { label: 'Alcance', valor: analyticsData.totais?.alcance },
                    { label: 'Impressões', valor: analyticsData.totais?.impressoes },
                    { label: 'Salvamentos', valor: analyticsData.totais?.salvamentos },
                    { label: 'Compartilhamentos', valor: analyticsData.totais?.compartilhamentos },
                  ].map(card => (
                    <div key={card.label} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</p>
                      <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#111' }}>{(card.valor ?? 0).toLocaleString('pt-BR')}</p>
                    </div>
                  ))}
                  {analyticsData.perfil?.followers_count != null && (
                    <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Seguidores</p>
                      <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#111' }}>{Number(analyticsData.perfil.followers_count).toLocaleString('pt-BR')}</p>
                    </div>
                  )}
                </div>

                {/* Série de alcance/visitas ao perfil por dia */}
                {Array.isArray(analyticsData.insightsConta) && analyticsData.insightsConta.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
                    <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#111' }}>Evolução diária</p>
                    {analyticsData.insightsConta.map((serie: any) => {
                      const valores = (serie.values || []).map((v: any) => Number(v.value) || 0)
                      const max = Math.max(1, ...valores)
                      return (
                        <div key={serie.name} style={{ marginBottom: 16 }}>
                          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'capitalize' }}>
                            {serie.name === 'reach' ? 'Alcance' : serie.name === 'profile_views' ? 'Visitas ao perfil' : serie.name}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70 }}>
                            {(serie.values || []).map((v: any, i: number) => (
                              <div key={i} title={`${new Date(v.end_time).toLocaleDateString('pt-BR')}: ${v.value}`} style={{
                                flex: 1, minWidth: 4, borderRadius: '3px 3px 0 0', background: '#ffc00f',
                                height: `${Math.max(4, (Number(v.value) / max) * 100)}%`,
                              }} />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {analyticsData.erroInsightsConta && (
                  <p style={{ fontSize: 12, color: '#bbb', margin: '-12px 0 16px' }}>Série diária indisponível: {analyticsData.erroInsightsConta}</p>
                )}

                {/* Demografia */}
                {(analyticsData.demografia?.genero || analyticsData.demografia?.idade) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
                    {analyticsData.demografia.genero && (
                      <div style={{ flex: '1 1 260px', background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#111' }}>Gênero dos seguidores</p>
                        {analyticsData.demografia.genero.map((g: any) => {
                          const total = analyticsData.demografia.genero.reduce((a: number, x: any) => a + (Number(x.value) || 0), 0) || 1
                          const pct = Math.round((Number(g.value) / total) * 100)
                          return (
                            <div key={g.dimension_values?.[0]} style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}>
                                <span style={{ textTransform: 'capitalize' }}>{g.dimension_values?.[0]}</span>
                                <span style={{ fontWeight: 700 }}>{pct}%</span>
                              </div>
                              <div style={{ height: 8, background: '#f0f0f0', borderRadius: 999 }}>
                                <div style={{ height: 8, width: `${pct}%`, background: '#ffc00f', borderRadius: 999 }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {analyticsData.demografia.idade && (
                      <div style={{ flex: '1 1 260px', background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#111' }}>Faixa etária dos seguidores</p>
                        {analyticsData.demografia.idade.map((g: any) => {
                          const total = analyticsData.demografia.idade.reduce((a: number, x: any) => a + (Number(x.value) || 0), 0) || 1
                          const pct = Math.round((Number(g.value) / total) * 100)
                          return (
                            <div key={g.dimension_values?.[0]} style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}>
                                <span>{g.dimension_values?.[0]}</span>
                                <span style={{ fontWeight: 700 }}>{pct}%</span>
                              </div>
                              <div style={{ height: 8, background: '#f0f0f0', borderRadius: 999 }}>
                                <div style={{ height: 8, width: `${pct}%`, background: '#111', borderRadius: 999 }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Tabela de posts no período */}
                <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <p style={{ margin: 0, padding: '16px 20px', fontSize: 13, fontWeight: 700, color: '#111', borderBottom: '1px solid #f0f0f0' }}>
                    Posts publicados no período ({analyticsData.posts?.length || 0})
                  </p>
                  {(!analyticsData.posts || analyticsData.posts.length === 0) ? (
                    <p style={{ margin: 0, padding: '30px 20px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>Nenhum post encontrado no período selecionado.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {analyticsData.posts.map((p: any) => (
                        <a key={p.id} href={p.link} target="_blank" rel="noreferrer" style={{
                          display: 'flex', gap: 14, alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #f5f5f5', textDecoration: 'none', color: 'inherit',
                        }}>
                          <PostThumb src={p.midiaUrl} size={48} radius={8} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.legenda || '(sem legenda)'}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>{p.publicadoEm ? new Date(p.publicadoEm).toLocaleDateString('pt-BR') : ''}</p>
                          </div>
                          <div style={{ display: 'flex', gap: 16, flexShrink: 0, fontSize: 12, color: '#666' }}>
                            <span><strong>{p.curtidas}</strong> curtidas</span>
                            <span><strong>{p.comentarios}</strong> coment.</span>
                            <span><strong>{p.alcance}</strong> alcance</span>
                            <span><strong>{p.impressoes}</strong> impr.</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </>
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

            {rascunhoMsg && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#1d4ed8' }}>
                {rascunhoMsg}
              </div>
            )}

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
                onSalvarRascunho={editandoPostId ? undefined : salvarRascunhoPost}
                salvandoRascunho={salvandoRascunho}
                enviando={criandoPost}
                textoBotao={editandoPostId ? 'Salvar alterações' : 'Criar post e gerar link de aprovação'}
              />
            )}
          </div>
        )}

        {/* CLIENTES */}
        {conectarRedesCliente !== null && (
          <ConectarRedesModal
            clienteId={conectarRedesCliente || null}
            clienteNome={clientes.find(c => c.id === conectarRedesCliente)?.nome}
            onClose={() => setConectarRedesCliente(null)}
          />
        )}

        {aba === 'mensagens' && (
          <ChatInterno meuEmail={(session?.user as any)?.email || ''} />
        )}

        {aba === 'clientes' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Clientes</h2>
              {role === 'admin' && (
                <button onClick={() => setConectarRedesCliente('')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                  Conectar redes sociais
                </button>
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
                  {metaClienteAlvo ? (
                    <>
                      <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 14, color: '#111' }}>
                        Vincular ao cliente {clientes.find(c => c.id === metaClienteAlvo)?.nome || ''}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Escolha qual Página do Facebook e conta do Instagram pertencem a este cliente.</p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 14, color: '#111' }}>{metaPages.length} {metaPages.length === 1 ? 'conta encontrada' : 'contas encontradas'}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Selecione a qual cliente cada conta pertence e clique em Salvar.</p>
                    </>
                  )}
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
                        metaClienteAlvo ? (
                          <button onClick={() => vincularPaginaACliente(page, metaClienteAlvo)} disabled={!!vinculandoPagina}
                            style={{ padding: '8px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: vinculandoPagina ? 0.6 : 1, flexShrink: 0 }}>
                            {vinculandoPagina === page.pageId ? 'Vinculando...' : 'Vincular'}
                          </button>
                        ) : (
                          <select
                            value={vinculos[page.pageId] || ''}
                            onChange={e => setVinculos(v => ({ ...v, [page.pageId]: e.target.value }))}
                            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, background: '#fff', fontFamily: 'inherit', minWidth: 180 }}
                          >
                            <option value="">Selecionar cliente...</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                          </select>
                        )
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ padding: '14px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setMetaPages([]); setVinculos({}); setMetaClienteAlvo('') }}
                    style={{ padding: '9px 18px', background: '#f5f5f5', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  {!metaClienteAlvo && (
                    <button onClick={salvarVinculos} disabled={vinculando || Object.values(vinculos).every(v => !v)}
                      style={{ padding: '9px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: vinculando ? 0.6 : 1 }}>
                      {vinculando ? 'Salvando...' : 'Salvar vínculos'}
                    </button>
                  )}
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
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>@{c.instagram?.replace(/^@/, '')}</p>
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
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#dcfce7', color: '#16a34a', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                            Conectado{c.instagramUsername ? ` · @${c.instagramUsername}` : ''}
                          </span>
                          {role === 'admin' && (
                            <button onClick={() => desconectarInstagram(c.id)}
                              style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '3px 10px', fontSize: 12, color: '#aaa', cursor: 'pointer' }}>
                              Desconectar
                            </button>
                          )}
                        </div>
                      ) : role === 'admin' ? (
                        <button onClick={() => setConectarRedesCliente(c.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                          Conectar redes
                        </button>
                      ) : (
                        <span style={{ background: '#fff3cd', color: '#b45309', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                          Não conectado
                        </span>
                      )}
                    </div>
                  </div>

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

            {/* Aparência — modo claro/escuro */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Aparência</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>Escolha como o painel é exibido para você neste navegador.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['claro', 'escuro'] as const).map(opcao => (
                  <button key={opcao} onClick={() => { if (tema !== opcao) alternarTema() }} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '14px 0', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    border: tema === opcao ? '2px solid #111' : '1.5px solid #e0e0e0',
                    background: tema === opcao ? '#111' : '#fff',
                    color: tema === opcao ? '#ffc00f' : '#888',
                  }}>
                    {opcao === 'claro' ? <IconSun size={16} /> : <IconMoon size={16} />}
                    {opcao === 'claro' ? 'Modo claro' : 'Modo escuro'}
                  </button>
                ))}
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 11, color: '#bbb' }}>
                No modo escuro, as cores da interface são invertidas — fundo escuro e textos claros — enquanto fotos e vídeos continuam exibidos com as cores naturais.
              </p>
            </div>

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

            {/* Imagem de perfil dos clientes */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Imagem de perfil dos clientes</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>Defina a foto de perfil de cada cliente — exibida nas pré-visualizações e listagens.</p>
              {clientes.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>Nenhum cliente cadastrado ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {clientes.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: '#fafafa', borderRadius: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: '#eee', border: '1.5px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, color: '#bbb', fontSize: 16 }}>
                        {c.logo ? <img src={c.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (c.nome || '?')[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>@{c.instagram?.replace(/^@/, '')}</p>
                      </div>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: '#111', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, flexShrink: 0, opacity: fotoClienteId === c.id ? 0.6 : 1 }}>
                        {fotoClienteId === c.id ? 'Enviando...' : (c.logo ? 'Trocar imagem' : 'Enviar imagem')}
                        <input type="file" accept="image/*" style={{ display: 'none' }} disabled={fotoClienteId === c.id}
                          onChange={e => { if (e.target.files?.[0]) uploadFotoCliente(c.id, e.target.files[0]); e.target.value = '' }} />
                      </label>
                    </div>
                  ))}
                </div>
              )}
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

            {/* Contas sociais conectadas */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Contas sociais conectadas</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#999' }}>Perfis de Facebook e Instagram vinculados aos clientes.</p>
                </div>
                <button onClick={() => setConectarRedesCliente('')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Conectar redes
                </button>
              </div>

              {clientes.filter(c => c.metaConectado).length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>Nenhuma conta conectada ainda. Use "Conectar redes" para vincular um perfil.</p>
              ) : (
                <div style={{ border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 44px', gap: 8, padding: '10px 14px', background: '#fafafa', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <span>Conta social</span><span>Status</span><span>Tipo</span><span></span>
                  </div>
                  {clientes.filter(c => c.metaConectado).flatMap(c => ([
                    { c, rede: 'facebook' as const, label: c.nome, tipo: 'Página', sub: 'Facebook' },
                    { c, rede: 'instagram' as const, label: c.instagramUsername ? `@${c.instagramUsername}` : (c.instagram?.replace(/^@/, '') || c.nome), tipo: 'Profissional', sub: 'Instagram' },
                  ])).map((row, i) => (
                    <div key={row.c.id + row.rede} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 44px', gap: 8, alignItems: 'center', padding: '12px 14px', borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ position: 'relative', width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: '#eee', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#bbb', fontSize: 13 }}>
                          {row.c.logo ? <img src={row.c.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (row.c.nome[0]?.toUpperCase())}
                          <span style={{ position: 'absolute', bottom: -2, right: -2, width: 15, height: 15, borderRadius: '50%', background: row.rede === 'facebook' ? '#1877f2' : '#dc2743', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="#fff">{row.rede === 'facebook'
                              ? <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                              : <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z"/>}</svg>
                          </span>
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>{row.sub} · {row.c.nome}</p>
                        </div>
                      </div>
                      <span><span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>Conectado</span></span>
                      <span style={{ fontSize: 13, color: '#666' }}>{row.tipo}</span>
                      {row.rede === 'facebook' ? (
                        <button onClick={() => { if (confirm(`Desconectar as contas de ${row.c.nome}?`)) desconectarInstagram(row.c.id) }} title="Desconectar"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: 4 }}>🗑</button>
                      ) : <span />}
                    </div>
                  ))}
                </div>
              )}
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

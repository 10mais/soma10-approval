'use client'
import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Calendar from '../components/Calendar'

type Post = {
  id: string
  clienteId: string
  clienteNome: string
  imagens: string[]
  legenda: string
  status: string
  dataAgendada?: string
  criadoEm: string
  atualizadoEm?: string
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  corrigir: 'Correção solicitada',
  reprovado: 'Reprovado',
  publicado: 'Publicado',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  rascunho: { bg: '#f0f0f0', color: '#888' },
  aguardando_aprovacao: { bg: '#fef3c7', color: '#b45309' },
  aprovado: { bg: '#dcfce7', color: '#15803d' },
  corrigir: { bg: '#fff3cd', color: '#92660a' },
  reprovado: { bg: '#fee2e2', color: '#b91c1c' },
  publicado: { bg: '#dbeafe', color: '#1d4ed8' },
}

export default function PortalPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'pendentes' | 'calendario' | 'historico'>('pendentes')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    const role = (session?.user as any)?.role
    if (role !== 'cliente') {
      router.push('/dashboard')
      return
    }
    carregar()
  }, [status])

  async function carregar() {
    setLoading(true)
    try {
      const res = await fetch('/api/posts')
      const data = await res.json()
      setPosts(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  if (status === 'loading' || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 14 }}>
        Carregando...
      </div>
    )
  }

  const pendentes = posts.filter(p => p.status === 'aguardando_aprovacao' || p.status === 'rascunho')
  const historico = posts.filter(p => !['aguardando_aprovacao', 'rascunho'].includes(p.status))
    .sort((a, b) => new Date(b.atualizadoEm || b.criadoEm).getTime() - new Date(a.atualizadoEm || a.criadoEm).getTime())

  const clienteNome = posts[0]?.clienteNome || session?.user?.name || ''

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f8' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#111', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#ffc00f', fontWeight: 900, fontSize: 13 }}>10+</span>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111' }}>Portal do Cliente</h1>
            {clienteNome && <p style={{ margin: 0, fontSize: 12, color: '#999' }}>{clienteNome}</p>}
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #e0e0e0', background: '#fff', color: '#666', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Sair
        </button>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[
            { key: 'pendentes', label: `Pendentes${pendentes.length ? ` (${pendentes.length})` : ''}` },
            { key: 'calendario', label: 'Calendário' },
            { key: 'historico', label: 'Histórico' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setView(tab.key as any)}
              style={{
                padding: '9px 18px', borderRadius: 10, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                borderColor: view === tab.key ? '#111' : '#e0e0e0',
                background: view === tab.key ? '#111' : '#fff',
                color: view === tab.key ? '#ffc00f' : '#666',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {view === 'pendentes' && (
          <div>
            {pendentes.length === 0 ? (
              <EmptyState texto="Nenhum conteúdo aguardando sua aprovação no momento." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {pendentes.map(p => <PostCard key={p.id} post={p} destaque />)}
              </div>
            )}
          </div>
        )}

        {view === 'calendario' && (
          <Calendar posts={posts as any} onSelectPost={(p: any) => router.push(`/aprovar/${p.id}`)} />
        )}

        {view === 'historico' && (
          <div>
            {historico.length === 0 ? (
              <EmptyState texto="Ainda não há histórico de aprovações." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {historico.map(p => <PostCard key={p.id} post={p} />)}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function EmptyState({ texto }: { texto: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #eee', padding: '60px 20px', textAlign: 'center' }}>
      <p style={{ margin: 0, color: '#aaa', fontSize: 14 }}>{texto}</p>
    </div>
  )
}

function PostCard({ post, destaque }: { post: Post; destaque?: boolean }) {
  const st = STATUS_STYLE[post.status] || STATUS_STYLE.rascunho
  const data = post.dataAgendada ? new Date(post.dataAgendada).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null

  return (
    <Link href={`/aprovar/${post.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: '#fff', borderRadius: 14, border: destaque ? '1.5px solid #ffc00f' : '1px solid #eee',
        overflow: 'hidden', transition: 'box-shadow .15s', cursor: 'pointer',
      }}>
        {post.imagens?.[0] && (
          <div style={{ width: '100%', aspectRatio: '1', background: '#f4f4f4', overflow: 'hidden' }}>
            <img src={post.imagens[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}
        <div style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.color }}>
              {STATUS_LABEL[post.status] || post.status}
            </span>
            {post.imagens?.length > 1 && <span style={{ fontSize: 11, color: '#aaa' }}>{post.imagens.length} imagens</span>}
          </div>
          <p style={{
            margin: 0, fontSize: 13, color: '#444', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {post.legenda}
          </p>
          {data && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#aaa' }}>Agendado para {data}</p>}
        </div>
      </div>
    </Link>
  )
}

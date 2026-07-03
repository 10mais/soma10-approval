'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from '@/lib/toast'

const ehVideoUrl = (u: string) => /\.(mp4|mov|m4v|webm)(\?|$)/i.test(u || '')
type PostA = { id: string; codigo?: string; imagens: string[]; legenda: string; formato?: string; dataAgendada?: string; capasVideo?: Record<string, string> }

const btn = (bg: string, color: string, border?: string): React.CSSProperties => ({ padding: '12px 8px', background: bg, color, border: border ? `1.5px solid ${border}` : 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' })

export default function AprovacoesPublicas() {
  const { token } = useParams()
  const [dados, setDados] = useState<{ clienteNome?: string; logo?: string; posts: PostA[] } | null>(null)
  const [erro, setErro] = useState('')

  async function carregar() {
    const d = await fetch(`/api/aprovacao-link?token=${token}`).then(r => r.json()).catch(() => null)
    if (!d || d.error) { setErro(d?.error || 'Não foi possível carregar.'); setDados({ posts: [] }); return }
    setDados(d)
  }
  useEffect(() => { carregar() }, [token])

  const removerPost = (id: string) => setDados(d => d ? { ...d, posts: d.posts.filter(p => p.id !== id) } : d)

  if (!dados) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fff' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #ffc00f', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Header clienteName={dados.clienteNome || ''} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 60px' }}>
        {erro && <p style={{ color: '#b91c1c', fontSize: 14 }}>{erro}</p>}
        {!erro && dados.posts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>Tudo aprovado! 🎉</p>
            <p style={{ fontSize: 14, color: '#888', margin: 0 }}>Não há materiais aguardando sua aprovação no momento.</p>
          </div>
        )}
        {dados.posts.length > 0 && (
          <p style={{ margin: '0 0 18px', fontSize: 14, color: '#555' }}>
            <strong>{dados.posts.length}</strong> {dados.posts.length === 1 ? 'material aguardando' : 'materiais aguardando'} sua aprovação. Analise cada um abaixo.
          </p>
        )}
        {dados.posts.map(p => (
          <PostCard key={p.id} post={p} token={String(token)} onDecidido={() => removerPost(p.id)} />
        ))}
      </div>
      <Footer />
    </div>
  )
}

function PostCard({ post, token, onDecidido }: { post: PostA; token: string; onDecidido: () => void }) {
  const [cur, setCur] = useState(0)
  const [modo, setModo] = useState<'view' | 'ajuste' | 'reject'>('view')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  const midia = post.imagens[cur]
  const ehVideo = ehVideoUrl(midia)
  const formatoLabel = post.formato === 'story' ? 'Story' : post.formato === 'reel' ? 'Reel' : post.formato === 'feed' ? 'Feed' : ''

  async function decidir(type: 'approved' | 'corrected' | 'rejected', motivo?: string) {
    setEnviando(true)
    const r = await fetch('/api/decision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: post.id, type, rejectReason: motivo || '', token }) }).then(x => x.json()).catch(() => null)
    setEnviando(false)
    if (!r?.ok) { toast(r?.error || 'Não foi possível registrar.', 'erro'); return }
    toast(type === 'approved' ? 'Aprovado!' : type === 'corrected' ? 'Ajuste solicitado.' : 'Reprovado.', type === 'rejected' ? 'erro' : 'sucesso')
    onDecidido()
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 14, marginBottom: 18, overflow: 'hidden' }}>
      <div style={{ position: 'relative', background: ehVideo ? '#000' : '#fafafa' }}>
        {ehVideo
          ? <video src={midia} controls playsInline poster={post.capasVideo?.[midia]} style={{ width: '100%', display: 'block', maxHeight: '62vh' }} />
          : <img src={midia} alt="" style={{ width: '100%', display: 'block' }} />}
        {post.imagens.length > 1 && (<>
          <button onClick={() => setCur(c => (c - 1 + post.imagens.length) % post.imagens.length)} style={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', fontSize: 20, cursor: 'pointer' }}>‹</button>
          <button onClick={() => setCur(c => (c + 1) % post.imagens.length)} style={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', fontSize: 20, cursor: 'pointer' }}>›</button>
          <span style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 999, fontSize: 11, padding: '3px 10px' }}>{cur + 1} / {post.imagens.length}</span>
        </>)}
      </div>
      <div style={{ padding: '16px 18px' }}>
        {(formatoLabel || post.dataAgendada) && (
          <div style={{ display: 'flex', gap: 18, marginBottom: 10, flexWrap: 'wrap', fontSize: 12, color: '#888' }}>
            {formatoLabel && <span><strong style={{ color: '#555' }}>Formato:</strong> {formatoLabel}</span>}
            {post.dataAgendada && <span><strong style={{ color: '#555' }}>Publicação:</strong> {new Date(post.dataAgendada).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
        )}
        {post.legenda && <p style={{ margin: '0 0 14px', fontSize: 14, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{post.legenda}</p>}

        {modo === 'view' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <button onClick={() => decidir('approved')} disabled={enviando} style={btn('#16a34a', '#fff')}>Aprovar</button>
            <button onClick={() => setModo('ajuste')} disabled={enviando} style={btn('#ffc00f', '#111')}>Pedir ajuste</button>
            <button onClick={() => setModo('reject')} disabled={enviando} style={btn('#fff', '#dc2626', '#dc2626')}>Rejeitar</button>
          </div>
        )}
        {(modo === 'ajuste' || modo === 'reject') && (
          <div>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14, color: '#111' }}>{modo === 'ajuste' ? 'Descreva o ajuste desejado' : 'Motivo da reprovação'}</p>
            <textarea autoFocus value={texto} onChange={e => setTexto(e.target.value)} placeholder={modo === 'ajuste' ? 'Ex: trocar a cor do título, ajustar a legenda...' : 'Descreva o motivo...'}
              style={{ width: '100%', padding: '11px 13px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14, minHeight: 84, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => { setModo('view'); setTexto('') }} style={{ flex: 1, ...btn('#f5f5f5', '#555') }}>Voltar</button>
              <button onClick={() => {
                if (!texto.trim()) { toast(modo === 'ajuste' ? 'Descreva o ajuste desejado.' : 'Descreva o motivo da reprovação.', 'erro'); return }
                decidir(modo === 'ajuste' ? 'corrected' : 'rejected', texto)
              }} disabled={enviando} style={{ flex: 2, ...btn(modo === 'ajuste' ? '#ffc00f' : '#dc2626', modo === 'ajuste' ? '#111' : '#fff') }}>
                {enviando ? '...' : (modo === 'ajuste' ? 'Enviar ajuste' : 'Confirmar reprovação')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Header({ clienteName }: { clienteName: string }) {
  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ background: '#111', borderRadius: 7, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#ffc00f', fontWeight: 900, fontSize: 10 }}>10+</span>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111', lineHeight: 1.2 }}>Soma10 Approval</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>Aprovação de Criativos</div>
        </div>
      </div>
      {clienteName && <div style={{ background: '#f5f5f5', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, color: '#555' }}>{clienteName}</div>}
    </div>
  )
}

function Footer() {
  return (
    <div style={{ borderTop: '1px solid #e8e8e8', padding: '16px 24px', textAlign: 'center', background: '#fff' }}>
      <p style={{ margin: 0, fontSize: 11, color: '#ccc', letterSpacing: '0.03em' }}>SOMA10APPROVAL · GRUPO 10+</p>
    </div>
  )
}

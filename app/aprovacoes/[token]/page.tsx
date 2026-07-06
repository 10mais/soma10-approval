'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from '@/lib/toast'

const ehVideoUrl = (u: string) => /\.(mp4|mov|m4v|webm)(\?|$)/i.test(u || '')
type PostA = { id: string; codigo?: string; imagens: string[]; legenda: string; formato?: string; dataAgendada?: string; capasVideo?: Record<string, string> }

const btn = (bg: string, color: string, border?: string): React.CSSProperties => ({ padding: '12px 8px', background: bg, color, border: border ? `1.5px solid ${border}` : 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' })

export default function AprovacoesPublicas() {
  const { token } = useParams()
  const [dados, setDados] = useState<{ clienteNome?: string; logo?: string; instagram?: string; posts: PostA[] } | null>(null)
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
          <PostCard key={p.id} post={p} token={String(token)} handle={(dados.instagram || dados.clienteNome || 'perfil').replace(/^@/, '')} logo={dados.logo} onDecidido={() => removerPost(p.id)} />
        ))}
      </div>
      <Footer />
    </div>
  )
}

function PostCard({ post, token, handle, logo, onDecidido }: { post: PostA; token: string; handle: string; logo?: string; onDecidido: () => void }) {
  const [cur, setCur] = useState(0)
  const [modo, setModo] = useState<'view' | 'ajuste' | 'reject' | 'legenda'>('view')
  const [texto, setTexto] = useState('')
  const [legendaTxt, setLegendaTxt] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [logoErro, setLogoErro] = useState(false)
  // Marcações por ponto no criativo (só no modo "Ajustar layout").
  const [annotations, setAnnotations] = useState<{ x: number; y: number; text: string; id: number; img: number }[]>([])
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null)
  const [pinText, setPinText] = useState('')

  const midia = post.imagens[cur]
  const ehVideo = ehVideoUrl(midia)
  const inicial = (handle || '?').charAt(0).toUpperCase()

  function handleImageClick(e: any) {
    if (modo !== 'ajuste' || ehVideo) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPendingPin({ x, y }); setPinText('')
  }
  function confirmPin() {
    if (!pinText.trim() || !pendingPin) return
    setAnnotations(prev => [...prev, { x: pendingPin.x, y: pendingPin.y, text: pinText, id: Date.now(), img: cur }])
    setPendingPin(null); setPinText('')
  }

  async function decidir(type: 'approved' | 'corrected' | 'rejected' | 'caption', motivo?: string, novaLegenda?: string) {
    setEnviando(true)
    const r = await fetch('/api/decision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: post.id, type, rejectReason: motivo || '', token, novaLegenda, annotations: type === 'corrected' ? annotations : [] }) }).then(x => x.json()).catch(() => null)
    setEnviando(false)
    if (!r?.ok) { toast(r?.error || 'Não foi possível registrar.', 'erro'); return }
    const msg = type === 'approved' ? 'Aprovado!' : type === 'caption' ? 'Legenda corrigida e aprovado!' : type === 'corrected' ? 'Ajuste de layout solicitado.' : 'Reprovado.'
    toast(msg, type === 'rejected' ? 'erro' : 'sucesso')
    onDecidido()
  }

  return (
    <div style={{ maxWidth: 468, margin: '0 auto 26px', border: '1px solid #e8e8e8', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
      {/* Cabeçalho estilo Instagram */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
        <span style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#111', flexShrink: 0 }}>
          {logo && !logoErro ? <img src={logo} alt="" onError={() => setLogoErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : inicial}
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{handle}</span>
        {post.formato && post.formato !== 'feed' && (
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#888', background: '#f5f5f5', borderRadius: 999, padding: '3px 9px', textTransform: 'uppercase' }}>{post.formato === 'reel' ? 'Reel' : 'Story'}</span>
        )}
      </div>

      {/* Mídia nas medidas ORIGINAIS do post (sem recorte) */}
      <div onClick={handleImageClick} style={{ position: 'relative', width: '100%', background: '#000', overflow: 'hidden', lineHeight: 0, cursor: (modo === 'ajuste' && !ehVideo) ? 'crosshair' : 'default' }}>
        {ehVideo
          ? <video src={midia} controls playsInline poster={post.capasVideo?.[midia]} style={{ width: '100%', height: 'auto', maxHeight: '82vh', display: 'block' }} />
          : <img src={midia} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />}
        {post.imagens.length > 1 && (<>
          {cur > 0 && <button onClick={e => { e.stopPropagation(); setCur(cur - 1) }} style={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', color: '#222', border: 'none', fontSize: 18, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>‹</button>}
          {cur < post.imagens.length - 1 && <button onClick={e => { e.stopPropagation(); setCur(cur + 1) }} style={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', color: '#222', border: 'none', fontSize: 18, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>›</button>}
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>{cur + 1}/{post.imagens.length}</div>
          <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
            {post.imagens.map((_, i) => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === cur ? '#fff' : 'rgba(255,255,255,0.5)', boxShadow: '0 0 2px rgba(0,0,0,0.4)' }} />)}
          </div>
        </>)}
        {/* Pinos de marcação do slide atual */}
        {!ehVideo && annotations.filter(a => a.img === cur).map((ann) => {
          const n = annotations.indexOf(ann) + 1
          return (
            <div key={ann.id} onClick={e => e.stopPropagation()} title={ann.text} style={{ position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`, transform: 'translate(-50%, -50%)', zIndex: 5, width: 24, height: 24, borderRadius: '50%', background: '#ffc00f', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', border: '2px solid #fff', cursor: 'default' }}>{n}</div>
          )
        })}
        {/* Popover do pino pendente */}
        {pendingPin && (
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: `${pendingPin.x}%`, top: `${pendingPin.y}%`, transform: 'translate(-50%, -112%)', zIndex: 10 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', width: 250, border: '1px solid #e0e0e0', lineHeight: 1.4 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 700, color: '#111' }}>O que ajustar aqui?</p>
              <textarea autoFocus value={pinText} onChange={e => setPinText(e.target.value)} placeholder="Ex.: trocar a cor do título..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12.5, resize: 'vertical', minHeight: 56, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => { setPendingPin(null); setPinText('') }} style={{ flex: 1, ...btn('#f5f5f5', '#666') }}>Cancelar</button>
                <button onClick={confirmPin} disabled={!pinText.trim()} style={{ flex: 1, ...btn('#ffc00f', '#111') }}>Marcar</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ícones do feed (decorativos) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px 2px', color: '#222' }}>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l7.8-8.5a5.5 5.5 0 0 0 1-7.9z" /></svg>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.5 8.5 0 0 1-11.9 7.8L3 21l1.7-6A8.5 8.5 0 1 1 21 11.5z" /></svg>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ marginLeft: 'auto' }}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
      </div>

      {/* Legenda estilo feed */}
      {post.legenda && (
        <p style={{ margin: 0, padding: '2px 14px 12px', fontSize: 13.5, color: '#222', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <strong>{handle}</strong> {post.legenda}
        </p>
      )}

      {/* Info + decisão */}
      <div style={{ padding: '12px 14px 16px', borderTop: '1px solid #f2f2f2' }}>
        {post.dataAgendada && (
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#888' }}><strong style={{ color: '#555' }}>Publicação prevista:</strong> {new Date(post.dataAgendada).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        )}
        {modo === 'view' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={() => decidir('approved')} disabled={enviando} style={{ flex: '1 1 46%', ...btn('#16a34a', '#fff') }}>Aprovar</button>
            <button onClick={() => { setModo('legenda'); setLegendaTxt(post.legenda || '') }} disabled={enviando} style={{ flex: '1 1 46%', ...btn('#fff', '#166534', '#bbf7d0') }}>Corrigir legenda</button>
            <button onClick={() => { setModo('ajuste'); setAnnotations([]); setPendingPin(null); setTexto('') }} disabled={enviando} style={{ flex: '1 1 46%', ...btn('#ffc00f', '#111') }}>Ajustar layout</button>
            <button onClick={() => setModo('reject')} disabled={enviando} style={{ flex: '1 1 46%', ...btn('#fff', '#dc2626', '#dc2626') }}>Rejeitar</button>
          </div>
        )}
        {modo === 'legenda' && (
          <div>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14, color: '#111' }}>Corrigir a legenda</p>
            <textarea autoFocus value={legendaTxt} onChange={e => setLegendaTxt(e.target.value)} placeholder="Escreva a legenda do jeito que você quer..."
              style={{ width: '100%', padding: '11px 13px', borderRadius: 8, border: '1px solid #86efac', fontSize: 14, minHeight: 120, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none' }} />
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: '#16a34a' }}>Ao salvar, a legenda é substituída e o post segue a programação (é aprovado).</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => setModo('view')} style={{ flex: 1, ...btn('#f5f5f5', '#555') }}>Voltar</button>
              <button onClick={() => decidir('caption', '', legendaTxt)} disabled={enviando} style={{ flex: 2, ...btn('#16a34a', '#fff') }}>{enviando ? '...' : 'Salvar e aprovar'}</button>
            </div>
          </div>
        )}
        {(modo === 'ajuste' || modo === 'reject') && (
          <div>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14, color: '#111' }}>{modo === 'ajuste' ? 'Ajuste de layout' : 'Motivo da reprovação'}</p>
            {modo === 'ajuste' && (
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888', lineHeight: 1.5 }}>
                <strong style={{ color: '#b45309' }}>Clique sobre o criativo</strong> para marcar os pontos a corrigir{post.imagens.length > 1 ? ' (em cada slide)' : ''}, e/ou descreva abaixo.
              </p>
            )}
            {modo === 'ajuste' && annotations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                {annotations.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 8px' }}>
                    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: '#ffc00f', color: '#111', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: '#333' }}>{a.text}{post.imagens.length > 1 ? <em style={{ color: '#aaa' }}> · slide {a.img + 1}</em> : null}</span>
                    <button onClick={() => setAnnotations(prev => prev.filter(x => x.id !== a.id))} style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <textarea autoFocus={modo === 'reject'} value={texto} onChange={e => setTexto(e.target.value)} placeholder={modo === 'ajuste' ? 'Observação geral (opcional)...' : 'Descreva o motivo...'}
              style={{ width: '100%', padding: '11px 13px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14, minHeight: modo === 'ajuste' ? 64 : 84, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => { setModo('view'); setTexto(''); setAnnotations([]); setPendingPin(null) }} style={{ flex: 1, ...btn('#f5f5f5', '#555') }}>Voltar</button>
              <button onClick={() => {
                if (modo === 'ajuste' && annotations.length === 0 && !texto.trim()) { toast('Marque um ponto no criativo ou descreva o ajuste.', 'erro'); return }
                if (modo === 'reject' && !texto.trim()) { toast('Descreva o motivo da reprovação.', 'erro'); return }
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

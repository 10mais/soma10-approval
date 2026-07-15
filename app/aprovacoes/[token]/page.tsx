'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from '@/lib/toast'
import SystemName from '@/app/components/SystemName'

const ehVideoUrl = (u: string) => /\.(mp4|mov|m4v|webm)(\?|$)/i.test(u || '')
type Anot = { x: number; y: number; text: string; id: number; img: number }
type PostA = { id: string; codigo?: string; imagens: string[]; legenda: string; formato?: string; dataAgendada?: string; capasVideo?: Record<string, string>; status?: string; anotacoes?: Anot[]; ajusteCriativo?: string; motivoReprovacao?: string }

const btn = (bg: string, color: string, border?: string): React.CSSProperties => ({ padding: '12px 8px', background: bg, color, border: border ? `1.5px solid ${border}` : 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' })

// ISO -> valor de <input type="datetime-local"> (hora local).
function toLocalInput(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const rotuloAj: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 6 }
const campoAj: React.CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none' }

export default function AprovacoesPublicas() {
  const { token } = useParams()
  const [dados, setDados] = useState<{ clienteNome?: string; logo?: string; logoAlt?: string; instagram?: string; posts: PostA[] } | null>(null)
  const [erro, setErro] = useState('')

  async function carregar() {
    const d = await fetch(`/api/aprovacao-link?token=${token}`).then(r => r.json()).catch(() => null)
    if (d?.suspenso) { setErro('Este acesso está temporariamente suspenso por pendência de pagamento. Fale com a nossa equipe para regularizar.'); setDados({ posts: [] }); return }
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
        {dados.posts.length > 0 && (() => {
          const aguardando = dados.posts.filter(p => p.status !== 'corrigir').length
          const ajuste = dados.posts.length - aguardando
          return (
            <p style={{ margin: '0 0 18px', fontSize: 14, color: '#555' }}>
              {aguardando > 0 ? <><strong>{aguardando}</strong> {aguardando === 1 ? 'material aguardando' : 'materiais aguardando'} sua aprovação.</> : 'Nada aguardando sua aprovação.'}
              {ajuste > 0 ? <> <strong>{ajuste}</strong> em ajuste.</> : ''} Analise cada um abaixo.
            </p>
          )
        })()}
        {dados.posts.map(p => (
          <PostCard key={p.id} post={p} token={String(token)} handle={(dados.instagram || dados.clienteNome || 'perfil').replace(/^@/, '')} onDecidido={() => removerPost(p.id)} />
        ))}
      </div>
      <Footer />
    </div>
  )
}

// A foto do cliente é resolvida INTEIRA no servidor (/api/foto-cliente): ele tenta
// cliente.logo → ativo 'logo' → ícone → qualquer ativo → referência visual, conserta
// o cliente.logo quebrado e, no pior caso, devolve um SVG com a inicial. Por isso o
// card não recebe mais `logo`/`logoAlt`: eram props mortas que fingiam ser fallback.
function PostCard({ post, token, handle, onDecidido }: { post: PostA; token: string; handle: string; onDecidido: () => void }) {
  const [cur, setCur] = useState(0)
  const [modo, setModo] = useState<'view' | 'ajuste' | 'reject'>('view')
  const [texto, setTexto] = useState('')          // observação geral do ajuste / motivo da reprovação
  const [legendaTxt, setLegendaTxt] = useState('')
  const [dataTxt, setDataTxt] = useState('')       // data/hora desejada (datetime-local)
  const [enviando, setEnviando] = useState(false)
  const [logoErro, setLogoErro] = useState(false)
  const [annotations, setAnnotations] = useState<Anot[]>([])
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number; cx: number; cy: number } | null>(null)
  const [pinText, setPinText] = useState('')
  // Estado local do post — reflete "EM AJUSTE" na hora, sem sumir nem recarregar.
  const [st, setSt] = useState({
    status: post.status || 'aguardando_aprovacao', legenda: post.legenda || '', dataAgendada: post.dataAgendada || '',
    anotacoes: (post.anotacoes || []) as Anot[], motivoReprovacao: post.motivoReprovacao || post.ajusteCriativo || '',
  })

  const emAjuste = st.status === 'corrigir'
  const midia = post.imagens[cur]
  const ehVideo = ehVideoUrl(midia)
  const inicial = (handle || '?').charAt(0).toUpperCase()
  // Pinos exibidos: no modo ajuste os que estão sendo criados; em EM AJUSTE (view) os já enviados.
  const pinsMostrar = modo === 'ajuste' ? annotations : (emAjuste ? st.anotacoes : [])
  const legendaMudou = legendaTxt.trim() !== (st.legenda || '').trim()
  const dataMudou = !!dataTxt && dataTxt !== toLocalInput(st.dataAgendada)

  function abrirAjuste() {
    setAnnotations((st.anotacoes || []).map((a, i) => ({ x: a.x, y: a.y, text: a.text, id: a.id || Date.now() + i, img: a.img || 0 })))
    setLegendaTxt(st.legenda || '')
    setDataTxt(toLocalInput(st.dataAgendada))
    setTexto(st.motivoReprovacao || '')
    setPendingPin(null); setPinText('')
    setModo('ajuste')
  }

  function handleImageClick(e: any) {
    if (modo !== 'ajuste' || ehVideo) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPendingPin({ x, y, cx: e.clientX, cy: e.clientY }); setPinText('')
  }
  function confirmPin() {
    if (!pinText.trim() || !pendingPin) return
    setAnnotations(prev => [...prev, { x: pendingPin.x, y: pendingPin.y, text: pinText, id: Date.now(), img: cur }])
    setPendingPin(null); setPinText('')
  }

  async function decidir(type: 'approved' | 'corrected' | 'rejected' | 'caption', opts?: { motivo?: string; novaLegenda?: string; novaData?: string }) {
    setEnviando(true)
    const r = await fetch('/api/decision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: post.id, type, rejectReason: opts?.motivo || '', token, novaLegenda: opts?.novaLegenda, novaData: opts?.novaData, annotations: type === 'corrected' ? annotations : [] }) }).then(x => x.json()).catch(() => null)
    setEnviando(false)
    if (!r?.ok) { toast(r?.error || 'Não foi possível registrar.', 'erro'); return }
    if (type === 'corrected') {
      // Fica EM AJUSTE — não some. Atualiza o card no lugar.
      setSt(s => ({
        ...s, status: 'corrigir',
        legenda: opts?.novaLegenda && opts.novaLegenda.trim() ? opts.novaLegenda : s.legenda,
        dataAgendada: opts?.novaData ? new Date(opts.novaData).toISOString() : s.dataAgendada,
        anotacoes: annotations, motivoReprovacao: opts?.motivo || '',
      }))
      setModo('view')
      toast('Ajustes enviados! O criativo fica marcado como EM AJUSTE — você pode editar o pedido quando quiser.', 'sucesso')
      return
    }
    toast(type === 'approved' ? (opts?.novaLegenda ? 'Legenda corrigida e aprovado!' : 'Aprovado!') : 'Reprovado.', type === 'rejected' ? 'erro' : 'sucesso')
    onDecidido()
  }

  function enviarAjuste() {
    if (annotations.length === 0 && !texto.trim() && !legendaMudou && !dataMudou) {
      toast('Faça pelo menos um ajuste (legenda, layout ou data) antes de enviar.', 'erro'); return
    }
    decidir('corrected', { motivo: texto.trim() || undefined, novaLegenda: legendaMudou ? legendaTxt : undefined, novaData: dataMudou ? dataTxt : undefined })
  }

  return (
    <div style={{ maxWidth: 468, margin: '0 auto 26px', border: emAjuste ? '2px solid #fdba74' : '1px solid #e8e8e8', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
      {/* Cabeçalho estilo Instagram */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
        <span style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#111', flexShrink: 0 }}>
          {!logoErro
            ? <img src={`/api/foto-cliente?token=${encodeURIComponent(token)}`} alt="" onError={() => setLogoErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : inicial}
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{handle}</span>
        {emAjuste && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: '#b45309', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 999, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Em ajuste</span>}
        {post.formato && post.formato !== 'feed' && (
          <span style={{ marginLeft: emAjuste ? 6 : 'auto', fontSize: 10, fontWeight: 700, color: '#888', background: '#f5f5f5', borderRadius: 999, padding: '3px 9px', textTransform: 'uppercase' }}>{post.formato === 'reel' ? 'Reel' : 'Story'}</span>
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
        {/* Pinos de marcação do slide atual (rascunho do ajuste OU já enviados em EM AJUSTE) */}
        {!ehVideo && pinsMostrar.filter(a => a.img === cur).map((ann) => {
          const n = pinsMostrar.indexOf(ann) + 1
          return (
            <div key={ann.id} onClick={e => e.stopPropagation()} title={ann.text} style={{ position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`, transform: 'translate(-50%, -50%)', zIndex: 5, width: 24, height: 24, borderRadius: '50%', background: '#ffc00f', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', border: '2px solid #fff', cursor: 'default' }}>{n}</div>
          )
        })}
      </div>

      {/* Popover do pino pendente — pequeno e ANCORADO no ponto clicado (position:fixed
          nas coords do clique = fora do recorte do quadro e sempre na frente). */}
      {pendingPin && (() => {
        const W = 224
        const vw = typeof window !== 'undefined' ? window.innerWidth : 400
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800
        const left = Math.min(Math.max(10, pendingPin.cx - W / 2), vw - W - 10)
        const abaixo = pendingPin.cy + 190 < vh
        const top = abaixo ? pendingPin.cy + 12 : Math.max(10, pendingPin.cy - 178)
        const mini: React.CSSProperties = { flex: 1, padding: '7px 0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', border: 'none' }
        return (
          <div onClick={() => { setPendingPin(null); setPinText('') }} style={{ position: 'fixed', inset: 0, zIndex: 3000 }}>
            <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left, top, width: W, background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 10px 34px rgba(0,0,0,0.24)', border: '1px solid #e0e0e0', lineHeight: 1.35 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 700, color: '#111' }}>O que ajustar aqui?</p>
              <textarea autoFocus value={pinText} onChange={e => setPinText(e.target.value)} placeholder="Ex.: trocar a cor do título..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12.5, resize: 'vertical', minHeight: 52, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4 }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => { setPendingPin(null); setPinText('') }} style={{ ...mini, background: '#f5f5f5', color: '#666' }}>Cancelar</button>
                <button onClick={confirmPin} disabled={!pinText.trim()} style={{ ...mini, background: '#ffc00f', color: '#111', cursor: pinText.trim() ? 'pointer' : 'not-allowed', opacity: pinText.trim() ? 1 : 0.6 }}>Marcar</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Ícones do feed (decorativos) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px 2px', color: '#222' }}>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l7.8-8.5a5.5 5.5 0 0 0 1-7.9z" /></svg>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.5 8.5 0 0 1-11.9 7.8L3 21l1.7-6A8.5 8.5 0 1 1 21 11.5z" /></svg>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ marginLeft: 'auto' }}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
      </div>

      {/* Legenda estilo feed (reflete a legenda pedida no ajuste) */}
      {st.legenda && (
        <p style={{ margin: 0, padding: '2px 14px 12px', fontSize: 13.5, color: '#222', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <strong>{handle}</strong> {st.legenda}
        </p>
      )}

      {/* Info + decisão */}
      <div style={{ padding: '12px 14px 16px', borderTop: '1px solid #f2f2f2' }}>
        {st.dataAgendada && (
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#888' }}><strong style={{ color: '#555' }}>Publicação prevista:</strong> {new Date(st.dataAgendada).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        )}

        {/* EM AJUSTE — o criativo fica visível e o cliente pode editar o pedido */}
        {emAjuste && modo === 'view' && (
          <div>
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#b45309' }}>Em ajuste</p>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#9a6b2e', lineHeight: 1.5 }}>Seu pedido foi enviado para a agência. Enquanto eles trabalham, você pode continuar editando o que pediu.</p>
            </div>
            {st.anotacoes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                {st.anotacoes.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 8px' }}>
                    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: '#ffc00f', color: '#111', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: '#333' }}>{a.text}{post.imagens.length > 1 ? <em style={{ color: '#aaa' }}> · slide {a.img + 1}</em> : null}</span>
                  </div>
                ))}
              </div>
            )}
            {st.motivoReprovacao && <p style={{ margin: '0 0 8px', fontSize: 12.5, color: '#555' }}><strong>Observação:</strong> {st.motivoReprovacao}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={abrirAjuste} disabled={enviando} style={{ flex: '1 1 55%', ...btn('#ffc00f', '#111') }}>Editar ajuste</button>
              <button onClick={() => decidir('approved')} disabled={enviando} style={{ flex: '1 1 38%', ...btn('#fff', '#166534', '#bbf7d0') }}>Aprovar assim mesmo</button>
            </div>
          </div>
        )}

        {/* Ações padrão (aguardando aprovação) */}
        {!emAjuste && modo === 'view' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={() => decidir('approved')} disabled={enviando} style={{ flex: '1 1 46%', ...btn('#16a34a', '#fff') }}>Aprovar</button>
            <button onClick={abrirAjuste} disabled={enviando} style={{ flex: '1 1 46%', ...btn('#ffc00f', '#111') }}>Solicitar ajustes</button>
            <button onClick={() => setModo('reject')} disabled={enviando} style={{ flex: '1 1 100%', ...btn('#fff', '#dc2626', '#dc2626') }}>Rejeitar</button>
          </div>
        )}

        {/* Solicitar ajustes — TUDO num lugar só: legenda + layout + data/hora */}
        {modo === 'ajuste' && (
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15, color: '#111' }}>Solicitar ajustes</p>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#888', lineHeight: 1.5 }}>Peça tudo de uma vez — legenda, layout e/ou data. Nada é enviado até você clicar em <strong>Enviar solicitação</strong>.</p>

            <label style={rotuloAj}>Legenda</label>
            <textarea value={legendaTxt} onChange={e => setLegendaTxt(e.target.value)} placeholder="Deixe como está ou reescreva do seu jeito..." style={{ ...campoAj, minHeight: 84 }} />

            <label style={{ ...rotuloAj, marginTop: 14 }}>Layout do criativo</label>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888', lineHeight: 1.5 }}><strong style={{ color: '#b45309' }}>Clique sobre o criativo acima</strong> para marcar os pontos a corrigir{post.imagens.length > 1 ? ' (em cada slide)' : ''}.</p>
            {annotations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                {annotations.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 8px' }}>
                    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: '#ffc00f', color: '#111', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: '#333' }}>{a.text}{post.imagens.length > 1 ? <em style={{ color: '#aaa' }}> · slide {a.img + 1}</em> : null}</span>
                    <button onClick={() => setAnnotations(prev => prev.filter(x => x.id !== a.id))} style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Observação geral sobre o layout (opcional)..." style={{ ...campoAj, minHeight: 56 }} />

            <label style={{ ...rotuloAj, marginTop: 14 }}>Data e horário da publicação</label>
            <input type="datetime-local" value={dataTxt} onChange={e => setDataTxt(e.target.value)} style={campoAj} />

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button onClick={() => setModo('view')} disabled={enviando} style={{ ...btn('#f5f5f5', '#555'), flex: '0 0 auto', padding: '12px 16px' }}>Voltar</button>
              {legendaMudou && annotations.length === 0 && !texto.trim() && !dataMudou && (
                <button onClick={() => decidir('caption', { novaLegenda: legendaTxt })} disabled={enviando} style={{ flex: '1 1 40%', ...btn('#16a34a', '#fff') }}>Aprovar com esta legenda</button>
              )}
              <button onClick={enviarAjuste} disabled={enviando} style={{ flex: '1 1 45%', minWidth: 150, ...btn('#ffc00f', '#111') }}>{enviando ? '...' : 'Enviar solicitação'}</button>
            </div>
          </div>
        )}

        {/* Rejeitar */}
        {modo === 'reject' && (
          <div>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14, color: '#111' }}>Motivo da reprovação</p>
            <textarea autoFocus value={texto} onChange={e => setTexto(e.target.value)} placeholder="Descreva o motivo..." style={{ ...campoAj, minHeight: 84 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => { setModo('view'); setTexto('') }} disabled={enviando} style={{ flex: 1, ...btn('#f5f5f5', '#555') }}>Voltar</button>
              <button onClick={() => { if (!texto.trim()) { toast('Descreva o motivo da reprovação.', 'erro'); return } decidir('rejected', { motivo: texto }) }} disabled={enviando} style={{ flex: 2, ...btn('#dc2626', '#fff') }}>{enviando ? '...' : 'Confirmar reprovação'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Header({ clienteName }: { clienteName: string }) {
  // A logo da agência vem de /api/marca (público). O bloco "10+" só aparece
  // enquanto carrega ou quando não há logo configurada — antes ele era fixo no
  // código, então toda instância se anunciava como "10+", fosse qual fosse.
  const [logo, setLogo] = useState('')
  const [logoErro, setLogoErro] = useState(false)
  useEffect(() => {
    fetch('/api/marca').then(r => r.json()).then(d => { if (d?.logo) setLogo(d.logo) }).catch(() => {})
  }, [])
  const temLogo = !!logo && !logoErro
  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {temLogo ? (
          <img src={logo} alt="" onError={() => setLogoErro(true)}
            style={{ height: 30, maxWidth: 120, objectFit: 'contain', display: 'block' }} />
        ) : (
          <div style={{ background: '#111', borderRadius: 7, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#ffc00f', fontWeight: 900, fontSize: 10 }}>10+</span>
          </div>
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111', lineHeight: 1.2 }}><SystemName /></div>
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

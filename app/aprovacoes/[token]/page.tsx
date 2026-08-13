'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import { toast } from '@/lib/toast'

const ehVideoUrl = (u: string) => /\.(mp4|mov|m4v|webm)(\?|$)/i.test(u || '')
type Anot = { x: number; y: number; text: string; id: number; img: number }
type PostA = {
  id: string; codigo?: string; imagens: string[]; legenda: string; formato?: string; dataAgendada?: string; capasVideo?: Record<string, string>; status?: string; anotacoes?: Anot[]; ajusteCriativo?: string; motivoReprovacao?: string
  // Copy em aprovação (linha de montagem): o card vira "arte de texto"
  ehCopy?: boolean; headline?: string; subheadline?: string; textoImagem?: string; cta?: string
  laminas?: { texto: string }[]; medidas?: string; localAplicacao?: string; ajusteCopy?: string
}

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

type ProgItem = { id: string; dataAgendada: string; formato: string; status: string; capa: string; legenda: string; imagens?: string[]; capasVideo?: Record<string, string> }

export default function AprovacoesPublicas() {
  const { token } = useParams()
  const [dados, setDados] = useState<{ clienteNome?: string; logo?: string; logoAlt?: string; instagram?: string; posts: PostA[]; programacao?: ProgItem[] } | null>(null)
  const [erro, setErro] = useState('')
  // Largura da tela SEM media query (o layout usa só estilo inline — ver nota
  // no wrap): desktop = 2 colunas + espelho · medio = 2 colunas · mobile = pilha.
  const [tela, setTela] = useState<'desktop' | 'medio' | 'mobile'>('desktop')
  useEffect(() => {
    const aplicar = () => setTela(window.innerWidth <= 880 ? 'mobile' : window.innerWidth <= 1280 ? 'medio' : 'desktop')
    aplicar()
    window.addEventListener('resize', aplicar)
    return () => window.removeEventListener('resize', aplicar)
  }, [])

  async function carregar() {
    const d = await fetch(`/api/aprovacao-link?token=${token}`).then(r => r.json()).catch(() => null)
    if (d?.suspenso) { setErro('Este acesso está temporariamente suspenso por pendência de pagamento. Fale com a nossa equipe para regularizar.'); setDados({ posts: [] }); return }
    if (!d || d.error) { setErro(d?.error || 'Não foi possível carregar.'); setDados({ posts: [] }); return }
    setDados(d)
  }
  useEffect(() => { carregar() }, [token])

  // Decidiu: some da fila na hora (otimista) e recarrega em fundo — o material
  // aprovado REAPARECE na programação em cascata do painel.
  const removerPost = (id: string) => { setDados(d => d ? { ...d, posts: d.posts.filter(p => p.id !== id) } : d); carregar() }

  if (!dados) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fff' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #ffc00f', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const temProg = (dados.programacao || []).length > 0
  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Header clienteName={dados.clienteNome || ''} />
      {/* Duas colunas no desktop: Programação à ESQUERDA (largura TRAVADA em
          300px), materiais CENTRALIZADOS; no celular a programação desce para
          DEPOIS dos cards. Layout todo em estilo INLINE de propósito: a versão
          com <style>/classes falhou em produção (o painel esticou a tela
          inteira) e os inline nunca deixam de aplicar. */}
      <div style={{ display: 'flex', flexDirection: tela === 'mobile' ? 'column' : 'row', gap: 24, alignItems: 'flex-start', padding: tela === 'mobile' ? '24px 16px 60px' : '24px 24px 60px' }}>
        {temProg && tela !== 'mobile' && (
          <aside style={{ flex: '0 0 300px', width: 300, minWidth: 300, maxWidth: 300, position: 'sticky', top: 16, overflow: 'hidden' }}>
            <Programacao itens={dados.programacao || []} />
          </aside>
        )}
        <div style={{ flex: 1, minWidth: 0, width: tela === 'mobile' ? '100%' : undefined }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {erro && <p style={{ color: '#b91c1c', fontSize: 14 }}>{erro}</p>}
        {!erro && dados.posts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>Tudo aprovado! 🎉</p>
            <p style={{ fontSize: 14, color: '#888', margin: 0 }}>Não há materiais aguardando sua aprovação no momento.{temProg ? ' Veja ao lado o que está programado.' : ''}</p>
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
        {(() => {
          const copies = dados.posts.filter(p => p.ehCopy)
          const criativos = dados.posts.filter(p => !p.ehCopy)
          const handle = (dados.instagram || dados.clienteNome || 'perfil').replace(/^@/, '')
          return (<>
            {copies.length > 0 && <TabelaCopies posts={copies} token={String(token)} onDecidido={removerPost} />}
            {criativos.map(p => <PostCard key={p.id} post={p} token={String(token)} handle={handle} onDecidido={() => removerPost(p.id)} />)}
          </>)
        })()}
        </div>
        </div>
        {/* Espelho da largura do painel no lado direito: mantém os materiais
            CENTRALIZADOS na tela mesmo com a Programação encostada à esquerda. */}
        {temProg && tela === 'desktop' && <div style={{ flex: '0 0 300px' }} />}
        {/* Celular: a programação vem DEPOIS dos materiais (aprovar é a 1ª coisa). */}
        {temProg && tela === 'mobile' && (
          <div style={{ width: '100%', maxWidth: 468, margin: '0 auto' }}>
            <Programacao itens={dados.programacao || []} />
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

// Painel "Programação de postagens": a cascata do que já está aprovado —
// próxima postagem em destaque e as demais em seguida. Lista ou calendário.
function Programacao({ itens }: { itens: ProgItem[] }) {
  const [vista, setVista] = useState<'lista' | 'calendario'>('lista')
  const [mesBase, setMesBase] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [diaSel, setDiaSel] = useState('')
  // Prévia do criativo: clicar num item abre a mídia (carrossel/vídeo) + legenda.
  const [preview, setPreview] = useState<ProgItem | null>(null)
  const [slide, setSlide] = useState(0)
  const fmtDia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const fmtHora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const porDia = itens.reduce((acc: Record<string, ProgItem[]>, it) => { const k = ymd(new Date(it.dataAgendada)); (acc[k] = acc[k] || []).push(it); return acc }, {})
  const STATUS_ROTULO: Record<string, [string, string, string]> = { agendado: ['Agendado', '#166534', '#dcfce7'], publicando: ['Publicando', '#1d4ed8', '#eff6ff'], publicado: ['Publicado', '#475569', '#f1f5f9'] }
  const FORMATO: Record<string, string> = { feed: 'Feed', reel: 'Reel', story: 'Story' }

  const Linha = ({ it, destaque }: { it: ProgItem; destaque?: boolean }) => {
    const [rot, cor, bg] = STATUS_ROTULO[it.status] || STATUS_ROTULO.agendado
    return (
      <div onClick={() => { setSlide(0); setPreview(it) }} title="Ver prévia do criativo"
        style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: destaque ? '#fffbeb' : '#fff', borderTop: '1px solid #f2f2f2', cursor: 'pointer' }}>
        {it.capa
          ? <img src={it.capa} alt="" style={{ width: 34, height: 42, objectFit: 'cover', borderRadius: 7, flexShrink: 0, background: '#f0f0f0' }} />
          : <div style={{ width: 34, height: 42, borderRadius: 7, flexShrink: 0, background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9c9ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L11 18" /></svg>
            </div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#111' }}>
            {destaque && <span style={{ color: '#b45309', marginRight: 6 }}>Próxima:</span>}
            {fmtDia(it.dataAgendada)} · {fmtHora(it.dataAgendada)} <span style={{ fontWeight: 600, color: '#94a3b8' }}>· {FORMATO[it.formato] || it.formato}</span>
          </p>
          {it.legenda && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.legenda.slice(0, 90)}{it.legenda.length > 90 ? '…' : ''}</p>}
          <span style={{ display: 'inline-block', marginTop: 4, fontSize: 9.5, fontWeight: 800, color: cor, background: bg, borderRadius: 999, padding: '2px 8px' }}>{rot}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#111' }}>Programação</p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: '#94a3b8' }}>{itens.length} postagem(ns) a caminho</p>
        </div>
        <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 8, padding: 2 }}>
          {(['lista', 'calendario'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)} style={{ padding: '4px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, background: vista === v ? '#fff' : 'transparent', color: vista === v ? '#111' : '#888', boxShadow: vista === v ? '0 1px 2px rgba(0,0,0,0.12)' : 'none' }}>{v === 'lista' ? 'Lista' : 'Calendário'}</button>
          ))}
        </div>
      </div>

      {vista === 'lista' && (
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {itens.map((it, i) => <Linha key={it.id} it={it} destaque={i === 0 && it.status !== 'publicado'} />)}
        </div>
      )}

      {vista === 'calendario' && (() => {
        const ano = mesBase.getFullYear(), mes = mesBase.getMonth()
        const primeiroDow = new Date(ano, mes, 1).getDay()
        const nDias = new Date(ano, mes + 1, 0).getDate()
        const celulas: (number | null)[] = [...Array(primeiroDow).fill(null), ...Array.from({ length: nDias }, (_, i) => i + 1)]
        const doDia = diaSel ? (porDia[diaSel] || []) : []
        return (
          <div style={{ padding: '4px 12px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <button onClick={() => { setMesBase(new Date(ano, mes - 1, 1)); setDiaSel('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#888', padding: '2px 8px' }}>‹</button>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#111', textTransform: 'capitalize' }}>{mesBase.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => { setMesBase(new Date(ano, mes + 1, 1)); setDiaSel('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#888', padding: '2px 8px' }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i} style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 800, color: '#c0c6cf', padding: '2px 0' }}>{d}</span>)}
              {celulas.map((dia, i) => {
                if (!dia) return <span key={`v${i}`} />
                const k = ymd(new Date(ano, mes, dia))
                const n = (porDia[k] || []).length
                const sel = diaSel === k
                return (
                  <button key={k} onClick={() => setDiaSel(sel ? '' : k)} disabled={n === 0}
                    style={{ aspectRatio: '1', border: 'none', borderRadius: 7, cursor: n > 0 ? 'pointer' : 'default', fontSize: 11, fontWeight: n > 0 ? 800 : 500, background: sel ? '#111' : n > 0 ? '#fff7e0' : 'transparent', color: sel ? '#fff' : n > 0 ? '#111' : '#c4c9d2', position: 'relative', padding: 0 }}>
                    {dia}
                    {n > 0 && !sel && <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#ffc00f' }} />}
                  </button>
                )
              })}
            </div>
            {diaSel && doDia.length > 0 && <div style={{ marginTop: 8, borderTop: '1px solid #f2f2f2' }}>{doDia.map(it => <Linha key={it.id} it={it} />)}</div>}
            {!diaSel && <p style={{ margin: '8px 0 0', fontSize: 10.5, color: '#b6bcc6', textAlign: 'center' }}>Toque num dia marcado para ver as postagens.</p>}
          </div>
        )
      })()}

      {/* PRÉVIA do criativo programado — mídia real (imagem/carrossel/vídeo) + legenda.
          Em PORTAL no <body>: o aside é position:sticky, que cria stacking context
          próprio — renderizado aqui dentro, o modal ficava ATRÁS dos cards
          (zIndex só vale dentro do contexto). */}
      {preview && createPortal((() => {
        const imgs = (preview.imagens || []).filter(Boolean)
        const atual = imgs[slide] || ''
        const video = ehVideoUrl(atual)
        const [rot, cor, bg] = STATUS_ROTULO[preview.status] || STATUS_ROTULO.agendado
        return (
          <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.72)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 430, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,0.4)' }}>
              <div style={{ position: 'relative', background: '#000', lineHeight: 0 }}>
                {atual ? (video
                  ? <video key={atual} src={atual} controls playsInline poster={(preview.capasVideo || {})[atual]} style={{ width: '100%', maxHeight: '62vh', display: 'block' }} />
                  : <img key={atual} src={atual} alt="" style={{ width: '100%', maxHeight: '62vh', objectFit: 'contain', display: 'block' }} />)
                  : <div style={{ padding: '48px 20px', textAlign: 'center', color: '#888', fontSize: 12.5, lineHeight: 1.5 }}>Sem mídia para exibir.</div>}
                {imgs.length > 1 && (<>
                  {slide > 0 && <button onClick={() => setSlide(s => s - 1)} style={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', color: '#222', border: 'none', fontSize: 18, cursor: 'pointer' }}>‹</button>}
                  {slide < imgs.length - 1 && <button onClick={() => setSlide(s => s + 1)} style={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', color: '#222', border: 'none', fontSize: 18, cursor: 'pointer' }}>›</button>}
                  <span style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>{slide + 1}/{imgs.length}</span>
                </>)}
              </div>
              <div style={{ padding: '12px 16px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>{fmtDia(preview.dataAgendada)} · {fmtHora(preview.dataAgendada)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{FORMATO[preview.formato] || preview.formato}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: cor, background: bg, borderRadius: 999, padding: '2px 8px' }}>{rot}</span>
                  <button onClick={() => setPreview(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999', lineHeight: 1, padding: 0 }}>×</button>
                </div>
                {preview.legenda && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#333', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{preview.legenda}</p>}
              </div>
            </div>
          </div>
        )
      })(), document.body)}
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
        <span style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#111', flexShrink: 0,
          // Amarelo SÓ atrás da inicial (fallback). Com logo, o fundo fica NEUTRO:
          // logo com cantos transparentes (como a da Sua Dupla) mostrava o amarelo
          // vazando pelas beiradas.
          background: logoErro ? '#ffc00f' : '#f0f0f0' }}>
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


// Aprovação de COPY/BRIEFING em TABELA (pedido do dono, 12/08): uma LINHA por
// postagem — Imagem | Copy (texto na imagem) | Legenda | Aprovação — no molde
// da planilha que a equipe usava no Notion. Substitui o card estilo Instagram
// e a revisão ponto a ponto (confundiam o cliente). Criativos com arte
// continuam no PostCard. No celular a grade empilha (rótulo por célula).
function TabelaCopies({ posts, token, onDecidido }: { posts: PostA[]; token: string; onDecidido: (id: string) => void }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 14, overflow: 'hidden', marginBottom: 26 }}>
      <style>{`
        .copy-tab-row{display:grid;grid-template-columns:130px 1.15fr 1fr 168px;gap:14px;padding:14px 16px;border-top:1px solid #f0f0f0}
        .copy-tab-head{display:grid;grid-template-columns:130px 1.15fr 1fr 168px;gap:14px;padding:10px 16px;background:#fafafa;border-top:1px solid #f0f0f0}
        .copy-cell-label{display:none}
        @media (max-width:820px){
          .copy-tab-row{grid-template-columns:1fr;gap:10px}
          .copy-tab-head{display:none}
          .copy-cell-label{display:block;font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;margin:0 0 4px}
        }
      `}</style>
      <div style={{ padding: '12px 16px 10px' }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111' }}>Briefings para aprovação</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Leia cada linha e decida: aprovar, pedir ajustes ou rejeitar. A arte é produzida depois que o texto for aprovado.</p>
      </div>
      <div className="copy-tab-head">
        {['Imagem', 'Copy (texto na imagem)', 'Legenda', 'Aprovação'].map(h => (
          <span key={h} style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
        ))}
      </div>
      {posts.map((p, i) => <LinhaCopy key={p.id} post={p} idx={i} token={token} onDecidido={() => onDecidido(p.id)} />)}
    </div>
  )
}

function LinhaCopy({ post, idx, token, onDecidido }: { post: PostA; idx: number; token: string; onDecidido: () => void }) {
  const [modo, setModo] = useState<'view' | 'ajuste' | 'reject'>('view')
  const [enviando, setEnviando] = useState(false)
  const [obs, setObs] = useState('')
  const [campos, setCampos] = useState({ headline: '', subheadline: '', textoImagem: '', cta: '', legenda: '' })
  // Estado local — reflete "EM AJUSTE" e as edições na hora, sem recarregar.
  const [st, setSt] = useState({
    status: post.status || 'aguardando_aprovacao',
    headline: post.headline || '', subheadline: post.subheadline || '', textoImagem: post.textoImagem || '',
    cta: post.cta || '', legenda: post.legenda || '', obs: post.ajusteCopy || '',
  })
  const emAjuste = st.status === 'corrigir'
  const laminas = (post.laminas || []).filter(l => (l.texto || '').trim())
  const capa = (post.imagens || []).find(u => !ehVideoUrl(u)) || (post.capasVideo || {})[(post.imagens || [])[0] || ''] || ''
  const FORMATO: Record<string, string> = { feed: 'Feed', reel: 'Reel', story: 'Story', carrossel: 'Carrossel' }
  const mudouAlgo = campos.headline !== st.headline || campos.subheadline !== st.subheadline || campos.textoImagem !== st.textoImagem || campos.cta !== st.cta || campos.legenda !== st.legenda

  function abrirAjuste() {
    setCampos({ headline: st.headline, subheadline: st.subheadline, textoImagem: st.textoImagem, cta: st.cta, legenda: st.legenda })
    setObs(st.obs || ''); setModo('ajuste')
  }

  async function decidir(type: 'approved' | 'corrected' | 'rejected' | 'caption', comCampos: boolean) {
    setEnviando(true)
    const r = await fetch('/api/decision', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: post.id, type, token, rejectReason: obs.trim() || '',
        ...(comCampos ? { novaLegenda: campos.legenda, novosCampos: { headline: campos.headline, subheadline: campos.subheadline, textoImagem: campos.textoImagem, cta: campos.cta } } : {}),
      }),
    }).then(x => x.json()).catch(() => null)
    setEnviando(false)
    if (!r?.ok) { toast(r?.error || 'Não foi possível registrar.', 'erro'); return }
    if (type === 'corrected') {
      setSt(s => ({ ...s, status: 'corrigir', ...(comCampos ? { ...campos } : {}), obs: obs.trim() }))
      setModo('view')
      toast('Ajustes enviados! A linha fica marcada como EM AJUSTE — você pode editar o pedido quando quiser.', 'sucesso')
      return
    }
    toast(type === 'rejected' ? 'Briefing rejeitado.' : 'Briefing aprovado!', type === 'rejected' ? 'erro' : 'sucesso')
    onDecidido()
  }

  const bloco = (t: string, estilo?: React.CSSProperties) => <p style={{ margin: 0, fontSize: 12.5, color: '#333', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...estilo }}>{t}</p>
  const mini = (bg: string, color: string, border?: string): React.CSSProperties => ({ padding: '9px 10px', background: bg, color, border: border ? `1.5px solid ${border}` : 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer', width: '100%' })

  return (
    <div className="copy-tab-row" style={{ background: emAjuste ? '#fffdf5' : '#fff' }}>
      {/* Col 1 — IMAGEM */}
      <div>
        <span className="copy-cell-label">Imagem</span>
        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: '#111' }}>Postagem {idx + 1}: {FORMATO[post.formato || 'feed'] || post.formato}</p>
        {capa
          ? <img src={capa} alt="" style={{ width: '100%', maxWidth: 130, aspectRatio: '4/5', objectFit: 'cover', borderRadius: 9, border: '1px solid #eee', background: '#f4f4f5' }} />
          : <div style={{ width: '100%', maxWidth: 130, aspectRatio: '4/5', borderRadius: 9, border: '1px dashed #e0e0e0', background: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8, boxSizing: 'border-box' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9c9ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L11 18" /></svg>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#b6bcc6', textAlign: 'center', lineHeight: 1.35 }}>Arte produzida após a aprovação do texto</span>
            </div>}
        {(post.localAplicacao || post.medidas) && <p style={{ margin: '6px 0 0', fontSize: 10.5, color: '#94a3b8' }}>{[post.localAplicacao, post.medidas].filter(Boolean).join(' · ')}</p>}
        {post.dataAgendada && <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#94a3b8' }}>Programado: {new Date(post.dataAgendada).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>}
      </div>

      {/* Col 2 — COPY (texto na imagem) */}
      <div style={{ minWidth: 0 }}>
        <span className="copy-cell-label">Copy (texto na imagem)</span>
        {modo === 'ajuste' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(st.headline || campos.headline) && <textarea value={campos.headline} onChange={e => setCampos(c => ({ ...c, headline: e.target.value }))} placeholder="Frase principal" style={{ ...campoAj, minHeight: 44, fontSize: 12.5 }} />}
            {(st.subheadline || campos.subheadline) && <textarea value={campos.subheadline} onChange={e => setCampos(c => ({ ...c, subheadline: e.target.value }))} placeholder="Frase de apoio" style={{ ...campoAj, minHeight: 44, fontSize: 12.5 }} />}
            {(st.textoImagem || campos.textoImagem) && <textarea value={campos.textoImagem} onChange={e => setCampos(c => ({ ...c, textoImagem: e.target.value }))} placeholder="Texto da arte" style={{ ...campoAj, minHeight: 64, fontSize: 12.5 }} />}
            {(st.cta || campos.cta) && <textarea value={campos.cta} onChange={e => setCampos(c => ({ ...c, cta: e.target.value }))} placeholder="Chamada final" style={{ ...campoAj, minHeight: 38, fontSize: 12.5 }} />}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {st.headline && bloco(st.headline, { fontWeight: 800, color: '#111', fontSize: 13.5 })}
            {st.subheadline && bloco(st.subheadline, { color: '#555' })}
            {st.textoImagem && bloco(st.textoImagem)}
            {laminas.map((l, li) => <p key={li} style={{ margin: 0, fontSize: 12.5, color: '#333', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}><strong style={{ color: '#94a3b8' }}>{li + 1}.</strong> {l.texto}</p>)}
            {st.cta && bloco(st.cta, { fontWeight: 800, color: '#b45309' })}
            {!st.headline && !st.subheadline && !st.textoImagem && laminas.length === 0 && !st.cta && <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>Sem texto de arte — veja a legenda ao lado.</p>}
          </div>
        )}
      </div>

      {/* Col 3 — LEGENDA */}
      <div style={{ minWidth: 0 }}>
        <span className="copy-cell-label">Legenda</span>
        {modo === 'ajuste'
          ? <textarea value={campos.legenda} onChange={e => setCampos(c => ({ ...c, legenda: e.target.value }))} placeholder="Legenda" style={{ ...campoAj, minHeight: 120, fontSize: 12.5 }} />
          : (st.legenda ? bloco(st.legenda) : <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>Sem legenda.</p>)}
      </div>

      {/* Col 4 — APROVAÇÃO */}
      <div>
        <span className="copy-cell-label">Aprovação</span>
        {modo === 'view' && !emAjuste && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => decidir('approved', false)} disabled={enviando} style={mini('#16a34a', '#fff')}>Aprovar</button>
            <button onClick={abrirAjuste} disabled={enviando} style={mini('#ffc00f', '#111')}>Pedir ajustes</button>
            <button onClick={() => { setObs(''); setModo('reject') }} disabled={enviando} style={mini('#fff', '#dc2626', '#dc2626')}>Rejeitar</button>
          </div>
        )}
        {modo === 'view' && emAjuste && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ alignSelf: 'flex-start', fontSize: 10, fontWeight: 800, color: '#b45309', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 999, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Em ajuste</span>
            {st.obs && <p style={{ margin: 0, fontSize: 11.5, color: '#9a6b2e', lineHeight: 1.45 }}>{st.obs}</p>}
            <button onClick={abrirAjuste} disabled={enviando} style={mini('#ffc00f', '#111')}>Editar ajuste</button>
            <button onClick={() => decidir('approved', false)} disabled={enviando} style={mini('#fff', '#166534', '#bbf7d0')}>Aprovar assim mesmo</button>
          </div>
        )}
        {modo === 'ajuste' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Observação (opcional se você já editou os textos)" style={{ ...campoAj, minHeight: 64, fontSize: 12 }} />
            {mudouAlgo && !obs.trim() && <button onClick={() => decidir('caption', true)} disabled={enviando} style={mini('#16a34a', '#fff')}>Aprovar com meus ajustes</button>}
            <button onClick={() => { if (!mudouAlgo && !obs.trim()) { toast('Edite algum texto ou escreva uma observação.', 'erro'); return } decidir('corrected', true) }} disabled={enviando} style={mini('#ffc00f', '#111')}>{enviando ? '...' : 'Enviar ajustes'}</button>
            <button onClick={() => setModo('view')} disabled={enviando} style={mini('#f5f5f5', '#555')}>Cancelar</button>
          </div>
        )}
        {modo === 'reject' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea autoFocus value={obs} onChange={e => setObs(e.target.value)} placeholder="Motivo da rejeição..." style={{ ...campoAj, minHeight: 64, fontSize: 12 }} />
            <button onClick={() => { if (!obs.trim()) { toast('Descreva o motivo da rejeição.', 'erro'); return } decidir('rejected', false) }} disabled={enviando} style={mini('#dc2626', '#fff')}>{enviando ? '...' : 'Confirmar rejeição'}</button>
            <button onClick={() => { setModo('view'); setObs('') }} disabled={enviando} style={mini('#f5f5f5', '#555')}>Voltar</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Header({ clienteName }: { clienteName: string }) {
  // A logo da agência vem de /api/marca (público). Sem logo configurada (ou se
  // ela falhar ao carregar), o fallback é a LOGOMARCA oficial do Soma10 —
  // /soma10-logo.png, a MESMA da sidebar do painel (o /logo.svg é só o ícone
  // quadrado da sidebar recolhida; confundi os dois e o dono corrigiu, 12/08).
  const [logo, setLogo] = useState('')
  const [logoErro, setLogoErro] = useState(false)
  useEffect(() => {
    fetch('/api/marca').then(r => r.json()).then(d => { if (d?.logo) setLogo(d.logo) }).catch(() => {})
  }, [])
  const src = (logo && !logoErro) ? logo : '/soma10-logo.png'
  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={src} alt="Soma10" onError={() => setLogoErro(true)}
          style={{ height: 28, maxWidth: 140, objectFit: 'contain', display: 'block' }} />
        {/* Sem o nome escrito ao lado — a logomarca já diz quem é (pedido do dono, 12/08). */}
        <div style={{ fontSize: 11, color: '#aaa' }}>Aprovação de Criativos</div>
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

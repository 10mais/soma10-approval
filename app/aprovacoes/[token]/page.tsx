'use client'
import { useT, useIdioma } from '@/app/components/Idioma'
import { useEffect, useState } from 'react'
import { labelFormato } from '@/lib/formatoPost'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import CartaoCriativo from '@/app/components/aprovacao/CartaoCriativo'
import TabelaCopies from '@/app/components/aprovacao/TabelaCopies'
import { ehVideoUrl, postarDecisao, type PostA, type CorpoDecisao } from '@/app/components/aprovacao/comum'

type ProgItem = { id: string; dataAgendada: string; formato: string; status: string; capa: string; legenda: string; imagens?: string[]; capasVideo?: Record<string, string> }

export default function AprovacoesPublicas() {
  const tr = useT()
  const { token } = useParams()
  const [dados, setDados] = useState<{ clienteNome?: string; logo?: string; logoAlt?: string; instagram?: string; corMarca?: string; posts: PostA[]; programacao?: ProgItem[] } | null>(null)
  const [erro, setErro] = useState('')
  // Tema do link público: o cliente escolhe (persistido no navegador dele);
  // sem escolha, segue o sistema operacional. Cor oposta sempre disponível.
  const [tema, setTema] = useState<'claro' | 'escuro'>('claro')
  useEffect(() => {
    try {
      const salvo = localStorage.getItem('soma10-tema-cliente')
      if (salvo === 'escuro' || salvo === 'claro') { setTema(salvo); return }
      if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) setTema('escuro')
    } catch { /* sem storage: fica claro */ }
  }, [])
  function alternarTema() {
    setTema(t => { const n = t === 'claro' ? 'escuro' : 'claro'; try { localStorage.setItem('soma10-tema-cliente', n) } catch {} ; return n })
  }
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
    if (d?.suspenso) { setErro(tr('aprov.acesso-suspenso')); setDados({ posts: [] }); return }
    if (!d || d.error) { setErro(d?.error || tr('aprov.falha-carregar')); setDados({ posts: [] }); return }
    setDados(d)
  }
  useEffect(() => { carregar() }, [token])

  // ATUALIZA SOZINHO (dono, 09/09: "priorize e atualize automaticamente quando for alterado
  // no Studio"). O que a equipe muda no Studio — formato, legenda, arte, novos materiais —
  // aparece aqui sem o cliente precisar recarregar: relê ao voltar para a aba e a cada 2 min
  // com a aba visível. Nada de polling em aba escondida, para não gastar bateria à toa.
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregar() }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', aoVoltar)
    const t = setInterval(aoVoltar, 120000)
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', aoVoltar)
      clearInterval(t)
    }
  }, [token])

  // Decidiu: some da fila na hora (otimista) e recarrega em fundo — o material
  // aprovado REAPARECE na programação em cascata do painel.
  const removerPost = (id: string) => { setDados(d => d ? { ...d, posts: d.posts.filter(p => p.id !== id) } : d); carregar() }
  // A decisão sai pela rota única com o TOKEN do link (o portal usa a mesma rota com a sessão).
  const enviarPeloLink = (corpo: CorpoDecisao) => postarDecisao(corpo, { token: String(token) })

  if (!dados) return (
    <div className="soma10-v2" data-theme={tema === 'escuro' ? 'dark' : 'light'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--v2-ground)' }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--v2-amber-on)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const temProg = (dados.programacao || []).length > 0
  return (
    <div className="soma10-v2" data-theme={tema === 'escuro' ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--v2-ground)', color: 'var(--v2-ink)', fontFamily: 'var(--v2-font)' }}>
      <Header clienteName={dados.clienteNome || ''} tema={tema} onTema={alternarTema} />
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
            <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--v2-ink)', margin: '0 0 6px' }}>{tr('aprov.tudo-aprovado')}</p>
            <p style={{ fontSize: 14, color: 'var(--v2-ink3)', margin: 0 }}>Não há materiais aguardando sua aprovação no momento.{temProg ? ' Veja ao lado o que está programado.' : ''}</p>
          </div>
        )}
        {dados.posts.length > 0 && (() => {
          const aguardando = dados.posts.filter(p => p.status !== 'corrigir' && p.status !== 'reprovado').length
          const ajuste = dados.posts.length - aguardando
          return (
            <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--v2-ink2)' }}>
              {aguardando > 0 ? tr('aprov.n-aguardando', { n: aguardando }) : tr('aprov.nada-aguardando')}
              {ajuste > 0 ? tr('aprov.n-em-ajuste', { n: ajuste }) : ''}{tr('aprov.analise-abaixo')}
            </p>
          )
        })()}
        {(() => {
          const copies = dados.posts.filter(p => p.ehCopy)
          const criativos = dados.posts.filter(p => !p.ehCopy)
          const handle = (dados.instagram || dados.clienteNome || 'perfil').replace(/^@/, '')
          return (<>
            {copies.length > 0 && <TabelaCopies posts={copies} enviar={enviarPeloLink} onDecidido={removerPost} corMarca={dados.corMarca} fotoUrl={`/api/foto-cliente?token=${encodeURIComponent(String(token))}`} />}
            {criativos.map(p => <CartaoCriativo key={p.id} post={p} fotoUrl={`/api/foto-cliente?token=${encodeURIComponent(String(token))}`} handle={handle} enviar={enviarPeloLink} onDecidido={() => removerPost(p.id)} />)}
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
  const tr = useT()
  const { idioma } = useIdioma()
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
  const STATUS_ROTULO: Record<string, [string, string, string]> = { agendado: [tr('aprov.status-agendado'), '#166534', '#dcfce7'], publicando: [tr('aprov.status-publicando'), '#1d4ed8', '#eff6ff'], publicado: [tr('aprov.status-publicado'), '#475569', '#f1f5f9'] }

  const Linha = ({ it, destaque }: { it: ProgItem; destaque?: boolean }) => {
    const [rot, cor, bg] = STATUS_ROTULO[it.status] || STATUS_ROTULO.agendado
    return (
      <div onClick={() => { setSlide(0); setPreview(it) }} title={tr('aprov.ver-previa-criativo')}
        style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: destaque ? '#fffbeb' : '#fff', borderTop: '1px solid var(--v2-rule)', cursor: 'pointer' }}>
        {it.capa
          ? <img src={it.capa} alt="" style={{ width: 34, height: 42, objectFit: 'cover', borderRadius: 7, flexShrink: 0, background: 'var(--v2-surface2)' }} />
          : <div style={{ width: 34, height: 42, borderRadius: 7, flexShrink: 0, background: 'var(--v2-surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9c9ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L11 18" /></svg>
            </div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: 'var(--v2-ink)' }}>
            {destaque && <span style={{ color: '#b45309', marginRight: 6 }}>{tr('aprov.proxima')}</span>}
            {fmtDia(it.dataAgendada)} · {fmtHora(it.dataAgendada)} <span style={{ fontWeight: 600, color: 'var(--v2-ink3)' }}>· {labelFormato(it.formato, idioma)}</span>
          </p>
          {it.legenda && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.legenda.slice(0, 90)}{it.legenda.length > 90 ? '…' : ''}</p>}
          <span style={{ display: 'inline-block', marginTop: 4, fontSize: 9.5, fontWeight: 800, color: cor, background: bg, borderRadius: 999, padding: '2px 8px' }}>{rot}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--v2-ink)' }}>{tr('aprov.programacao')}</p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>{itens.length} postagem(ns) a caminho</p>
        </div>
        <div style={{ display: 'flex', background: 'var(--v2-surface2)', borderRadius: 8, padding: 2 }}>
          {(['lista', 'calendario'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)} style={{ padding: '4px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, background: vista === v ? '#fff' : 'transparent', color: vista === v ? '#111' : '#888', boxShadow: vista === v ? '0 1px 2px rgba(0,0,0,0.12)' : 'none' }}>{v === 'lista' ? 'Lista' : tr('aprov.calendario')}</button>
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
              <button onClick={() => { setMesBase(new Date(ano, mes - 1, 1)); setDiaSel('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--v2-ink3)', padding: '2px 8px' }}>‹</button>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--v2-ink)', textTransform: 'capitalize' }}>{mesBase.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => { setMesBase(new Date(ano, mes + 1, 1)); setDiaSel('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--v2-ink3)', padding: '2px 8px' }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i} style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 800, color: 'var(--v2-ink3)', padding: '2px 0' }}>{d}</span>)}
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
            {diaSel && doDia.length > 0 && <div style={{ marginTop: 8, borderTop: '1px solid var(--v2-rule)' }}>{doDia.map(it => <Linha key={it.id} it={it} />)}</div>}
            {!diaSel && <p style={{ margin: '8px 0 0', fontSize: 10.5, color: 'var(--v2-ink3)', textAlign: 'center' }}>{tr('aprov.toque-num-dia-marcado-ver-post')}</p>}
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
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 430, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,0.4)' }}>
              <div style={{ position: 'relative', background: '#000', lineHeight: 0 }}>
                {atual ? (video
                  ? <video key={atual} src={atual} controls playsInline poster={(preview.capasVideo || {})[atual]} style={{ width: '100%', maxHeight: '62vh', display: 'block' }} />
                  : <img key={atual} src={atual} alt="" style={{ width: '100%', maxHeight: '62vh', objectFit: 'contain', display: 'block' }} />)
                  : <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--v2-ink3)', fontSize: 12.5, lineHeight: 1.5 }}>{tr('aprov.sem-midia-exibir')}</div>}
                {imgs.length > 1 && (<>
                  {slide > 0 && <button onClick={() => setSlide(s => s - 1)} style={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', color: 'var(--v2-ink)', border: 'none', fontSize: 18, cursor: 'pointer' }}>‹</button>}
                  {slide < imgs.length - 1 && <button onClick={() => setSlide(s => s + 1)} style={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', color: 'var(--v2-ink)', border: 'none', fontSize: 18, cursor: 'pointer' }}>›</button>}
                  <span style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>{slide + 1}/{imgs.length}</span>
                </>)}
              </div>
              <div style={{ padding: '12px 16px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--v2-ink)' }}>{fmtDia(preview.dataAgendada)} · {fmtHora(preview.dataAgendada)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)' }}>{labelFormato(preview.formato, idioma)}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: cor, background: bg, borderRadius: 999, padding: '2px 8px' }}>{rot}</span>
                  <button onClick={() => setPreview(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--v2-ink3)', lineHeight: 1, padding: 0 }}>×</button>
                </div>
                {preview.legenda && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--v2-ink)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{preview.legenda}</p>}
              </div>
            </div>
          </div>
        )
      })(), document.body)}
    </div>
  )
}

function Header({ clienteName, tema, onTema }: { clienteName: string; tema: 'claro' | 'escuro'; onTema: () => void }) {
  const tr = useT()
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
    <div style={{ background: 'var(--v2-surface)', borderBottom: '1px solid var(--v2-rule)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={src} alt="Soma10" onError={() => setLogoErro(true)}
          style={{ height: 28, maxWidth: 140, objectFit: 'contain', display: 'block' }} />
        {/* Sem o nome escrito ao lado — a logomarca já diz quem é (pedido do dono, 12/08). */}
        <div style={{ fontSize: 11, color: 'var(--v2-ink3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{tr('aprov.aprovacao-criativos')}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {clienteName && <div style={{ background: 'var(--v2-surface2)', borderRadius: 999, padding: '5px 13px', fontSize: 12.5, fontWeight: 500, color: 'var(--v2-ink2)' }}>{clienteName}</div>}
        <button onClick={onTema} type="button" title={tema === 'escuro' ? tr('aprov.tema-claro') : tr('aprov.tema-escuro')} aria-label={tema === 'escuro' ? tr('aprov.tema-claro-mudar') : tr('aprov.tema-escuro-mudar')}
          style={{ width: 36, height: 36, borderRadius: 999, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          {tema === 'escuro'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
        </button>
      </div>
    </div>
  )
}

function Footer() {
  const tr = useT()
  return (
    <div style={{ borderTop: '1px solid var(--v2-rule)', padding: '16px 24px', textAlign: 'center', background: 'var(--v2-surface)' }}>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--v2-ink3)', letterSpacing: '0.12em' }}>{tr('aprov.rodape')}</p>
    </div>
  )
}

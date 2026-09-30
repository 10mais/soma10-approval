'use client'
// CARTÃO DO CRIATIVO na aprovação — o mesmo no LINK PÚBLICO e no PORTAL do cliente (Fase 1 da
// rodada de ajuste, dono 29/09: "um único formulário de pedido no link e no portal"). Veio da
// página do link sem mudar o comportamento; o que muda por tela vem nas props (`enviar`,
// `fotoUrl`, `somenteLeitura`). Tipos e utilitários em ./comum.
import { useState } from 'react'
import { useT, useIdioma } from '@/app/components/Idioma'
import { seloFormato } from '@/lib/formatoPost'
import { toast, confirmar } from '@/lib/toast'
import { problemaDoPedido } from '@/lib/rodadaAjuste'
import { ehVideoUrl, btn, toLocalInput, rotuloAj, campoAj, type Anot, type PostA, type EnviarDecisao } from './comum'

// A foto do cliente é resolvida INTEIRA no servidor (/api/foto-cliente): ele tenta
// cliente.logo → ativo 'logo' → ícone → qualquer ativo → referência visual, conserta
// o cliente.logo quebrado e, no pior caso, devolve um SVG com a inicial. Por isso o
// card não recebe mais `logo`/`logoAlt`: eram props mortas que fingiam ser fallback.
export default function CartaoCriativo({ post, fotoUrl, handle, enviar, onDecidido, somenteLeitura = false, extra }: {
  post: PostA; fotoUrl?: string; handle: string
  enviar: EnviarDecisao // link: token; portal: sessão (comum.ts)
  onDecidido: () => void
  somenteLeitura?: boolean // cliente sem permissão de aprovar: vê, não decide
  extra?: React.ReactNode // ação da tela que hospeda (ex.: "Excluir material" da equipe no portal)
}) {
  const tr = useT()
  const { idioma } = useIdioma()
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

  // Reprovado também está com a agência (refazendo): mesmo estado visual do ajuste, outro selo.
  const reprovado = st.status === 'reprovado'
  const emAjuste = st.status === 'corrigir' || reprovado
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
    // Sem data marcada, aprovar PUBLICA EM SEGUIDA (regra da rota: entra na fila como "agora").
    // O portal antigo barrava sem explicar; o link publicava sem avisar. Agora pergunta.
    if ((type === 'approved' || type === 'caption') && !st.dataAgendada && !(await confirmar(tr('aprov.sem-data-publica-agora'), { titulo: tr('aprov.aprovar'), okLabel: tr('aprov.aprovar-publicar-agora') }))) return
    setEnviando(true)
    const r = await enviar({ id: post.id, type, rejectReason: opts?.motivo || '', novaLegenda: opts?.novaLegenda, novaData: opts?.novaData, annotations: type === 'corrected' ? annotations : [] })
    setEnviando(false)
    if (!r?.ok) { toast(r?.error || tr('aprov.falha-registrar'), 'erro'); return }
    if (type === 'corrected') {
      // Só legenda/data, sem marcação no layout: o servidor APLICA e reprograma na
      // hora (não há retrabalho). O card não pode dizer "em ajuste" nesse caso.
      if (r.aplicadoAutomaticamente) {
        const quando = r.agendadoPara ? new Date(r.agendadoPara) : null
        toast(quando
          ? `Pronto! Ajustes aplicados e publicação reprogramada para ${quando.toLocaleString('pt-BR')}.`
          : tr('aprov.ajustes-aplicados'), 'sucesso')
        onDecidido()
        return
      }
      // Fica EM AJUSTE — não some. Atualiza o card no lugar.
      setSt(s => ({
        ...s, status: 'corrigir',
        legenda: opts?.novaLegenda && opts.novaLegenda.trim() ? opts.novaLegenda : s.legenda,
        dataAgendada: opts?.novaData ? new Date(opts.novaData).toISOString() : s.dataAgendada,
        anotacoes: annotations, motivoReprovacao: opts?.motivo || '',
      }))
      setModo('view')
      toast(tr('aprov.ajustes-enviados-criativo'), 'sucesso')
      return
    }
    toast(type === 'approved' ? (opts?.novaLegenda ? tr('aprov.legenda-corrigida') : tr('aprov.aprovado-ok')) : tr('aprov.reprovado-ok'), type === 'rejected' ? 'erro' : 'sucesso')
    onDecidido()
  }

  function enviarAjuste() {
    // Pedido CLARO (Fase 1): ponto marcado na arte, ou recado que diga o que está errado e
    // como deveria ficar. O servidor confere de novo (lib/rodadaAjuste.problemaDoPedido).
    const problema = problemaDoPedido({ anotacoes: annotations, observacao: texto, mudouLegenda: legendaMudou, mudouData: dataMudou })
    if (problema) { toast(problema === 'vago' ? tr('aprov.pedido-vago') : tr('aprov.faca-um-ajuste'), 'erro'); return }
    decidir('corrected', { motivo: texto.trim() || undefined, novaLegenda: legendaMudou ? legendaTxt : undefined, novaData: dataMudou ? dataTxt : undefined })
  }

  return (
    <div style={{ maxWidth: 468, margin: '0 auto 26px', border: emAjuste ? '2px solid #fdba74' : '1px solid var(--v2-rule)', borderRadius: 18, overflow: 'hidden', background: 'var(--v2-surface)' }}>
      {/* Cabeçalho estilo Instagram */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
        <span style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: 'var(--v2-ink)', flexShrink: 0,
          // Amarelo SÓ atrás da inicial (fallback). Com logo, o fundo fica NEUTRO:
          // logo com cantos transparentes (como a da Sua Dupla) mostrava o amarelo
          // vazando pelas beiradas.
          background: logoErro || !fotoUrl ? 'var(--v2-amber-on)' : 'var(--v2-surface2)' }}>
          {!logoErro && fotoUrl
            ? <img src={fotoUrl} alt="" onError={() => setLogoErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : inicial}
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--v2-ink)' }}>{handle}</span>
        {emAjuste && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: reprovado ? '#b91c1c' : '#b45309', background: reprovado ? '#fef2f2' : '#fff7ed', border: `1px solid ${reprovado ? '#fecaca' : '#fed7aa'}`, borderRadius: 999, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{tr(reprovado ? 'aprov.selo-reprovado' : 'aprov.ajuste')}</span>}
        {seloFormato(post.formato, idioma) && (
          <span style={{ marginLeft: emAjuste ? 6 : 'auto', fontSize: 10, fontWeight: 700, color: 'var(--v2-ink3)', background: 'var(--v2-surface2)', borderRadius: 999, padding: '3px 9px', textTransform: 'uppercase' }}>{seloFormato(post.formato, idioma)}</span>
        )}
      </div>

      {/* Mídia nas medidas ORIGINAIS do post (sem recorte) */}
      <div onClick={handleImageClick} style={{ position: 'relative', width: '100%', background: '#000', overflow: 'hidden', lineHeight: 0, cursor: (modo === 'ajuste' && !ehVideo) ? 'crosshair' : 'default' }}>
        {ehVideo
          ? <video src={midia} controls playsInline poster={post.capasVideo?.[midia]} style={{ width: '100%', height: 'auto', maxHeight: '82vh', display: 'block' }} />
          : <img src={midia} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />}
        {post.imagens.length > 1 && (<>
          {cur > 0 && <button onClick={e => { e.stopPropagation(); setCur(cur - 1) }} style={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', color: 'var(--v2-ink)', border: 'none', fontSize: 18, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>‹</button>}
          {cur < post.imagens.length - 1 && <button onClick={e => { e.stopPropagation(); setCur(cur + 1) }} style={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', color: 'var(--v2-ink)', border: 'none', fontSize: 18, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>›</button>}
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>{cur + 1}/{post.imagens.length}</div>
          <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
            {post.imagens.map((_, i) => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === cur ? '#fff' : 'rgba(255,255,255,0.5)', boxShadow: '0 0 2px rgba(0,0,0,0.4)' }} />)}
          </div>
        </>)}
        {/* Pinos de marcação do slide atual (rascunho do ajuste OU já enviados em EM AJUSTE) */}
        {!ehVideo && pinsMostrar.filter(a => a.img === cur).map((ann) => {
          const n = pinsMostrar.indexOf(ann) + 1
          return (
            <div key={ann.id} onClick={e => e.stopPropagation()} title={ann.text} style={{ position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`, transform: 'translate(-50%, -50%)', zIndex: 5, width: 24, height: 24, borderRadius: '50%', background: '#ffc00f', color: 'var(--v2-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', border: '2px solid #fff', cursor: 'default' }}>{n}</div>
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
            <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left, top, width: W, background: 'var(--v2-surface)', borderRadius: 12, padding: 12, boxShadow: '0 10px 34px rgba(0,0,0,0.24)', border: '1px solid var(--v2-rule)', lineHeight: 1.35 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 700, color: 'var(--v2-ink)' }}>{tr('aprov.que-ajustar-aqui')}</p>
              <textarea lang="pt-BR" autoFocus value={pinText} onChange={e => setPinText(e.target.value)} placeholder={tr('aprov.ex-trocar-cor-titulo')}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12.5, resize: 'vertical', minHeight: 52, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4 }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => { setPendingPin(null); setPinText('') }} style={{ ...mini, background: 'var(--v2-surface2)', color: 'var(--v2-ink2)' }}>{tr('aprov.cancelar')}</button>
                <button onClick={confirmPin} disabled={!pinText.trim()} style={{ ...mini, background: '#ffc00f', color: 'var(--v2-ink)', cursor: pinText.trim() ? 'pointer' : 'not-allowed', opacity: pinText.trim() ? 1 : 0.6 }}>{tr('aprov.marcar')}</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Ícones do feed (decorativos) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px 2px', color: 'var(--v2-ink)' }}>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l7.8-8.5a5.5 5.5 0 0 0 1-7.9z" /></svg>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.5 8.5 0 0 1-11.9 7.8L3 21l1.7-6A8.5 8.5 0 1 1 21 11.5z" /></svg>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ marginLeft: 'auto' }}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
      </div>

      {/* Legenda estilo feed (reflete a legenda pedida no ajuste) */}
      {st.legenda && (
        <p style={{ margin: 0, padding: '2px 14px 12px', fontSize: 13.5, color: 'var(--v2-ink)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <strong>{handle}</strong> {st.legenda}
        </p>
      )}

      {/* Info + decisão */}
      <div style={{ padding: '12px 14px 16px', borderTop: '1px solid var(--v2-rule)' }}>
        {st.dataAgendada && (
          <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--v2-ink3)' }}><strong style={{ color: 'var(--v2-ink2)' }}>{tr('aprov.publicacao-prevista')}</strong> {new Date(st.dataAgendada).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        )}

        {somenteLeitura && <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)', fontStyle: 'italic' }}>{tr('portal.somente-visualizacao-aprovacao')}</p>}

        {/* EM AJUSTE — o criativo fica visível e o cliente pode editar o pedido */}
        {!somenteLeitura && emAjuste && modo === 'view' && (
          <div>
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#b45309' }}>{tr(reprovado ? 'aprov.selo-reprovado' : 'aprov.ajuste')}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#9a6b2e', lineHeight: 1.5 }}>{tr('aprov.seu-pedido-foi-enviado-agencia')}</p>
            </div>
            {st.anotacoes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                {st.anotacoes.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 8px' }}>
                    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: '#ffc00f', color: 'var(--v2-ink)', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: 'var(--v2-ink)' }}>{a.text}{post.imagens.length > 1 ? <em style={{ color: 'var(--v2-ink3)' }}> · slide {a.img + 1}</em> : null}</span>
                  </div>
                ))}
              </div>
            )}
            {st.motivoReprovacao && <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--v2-ink2)' }}><strong>{tr('aprov.observacao')}</strong> {st.motivoReprovacao}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={abrirAjuste} disabled={enviando} style={{ flex: '1 1 55%', ...btn('var(--v2-amber-on)', '#17150E') }}>{tr('aprov.editar-ajuste')}</button>
              <button onClick={() => decidir('approved')} disabled={enviando} style={{ flex: '1 1 38%', ...btn('var(--v2-surface)', 'var(--v2-ok)', 'var(--v2-ok)') }}>{tr('aprov.aprovar-assim-mesmo')}</button>
            </div>
          </div>
        )}

        {/* Ações padrão (aguardando aprovação) */}
        {!somenteLeitura && !emAjuste && modo === 'view' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={() => decidir('approved')} disabled={enviando} style={{ flex: '1 1 46%', ...btn('#16a34a', '#fff') }}>{tr('aprov.aprovar')}</button>
            <button onClick={abrirAjuste} disabled={enviando} style={{ flex: '1 1 46%', ...btn('var(--v2-amber-on)', '#17150E') }}>{tr('aprov.solicitar-ajustes')}</button>
            <button onClick={() => setModo('reject')} disabled={enviando} style={{ flex: '1 1 100%', ...btn('#fff', '#dc2626', '#dc2626') }}>{tr('aprov.rejeitar')}</button>
          </div>
        )}

        {/* Solicitar ajustes — TUDO num lugar só: legenda + layout + data/hora */}
        {modo === 'ajuste' && (
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15, color: 'var(--v2-ink)' }}>{tr('aprov.solicitar-ajustes')}</p>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>{tr('aprov.peca-tudo', { botao: tr('aprov.enviar-solicitacao') })}</p>

            <label style={rotuloAj}>{tr('aprov.legenda')}</label>
            <textarea lang="pt-BR" value={legendaTxt} onChange={e => setLegendaTxt(e.target.value)} placeholder={tr('aprov.deixe-como-esta-ou-reescreva-s')} style={{ ...campoAj, minHeight: 84 }} />

            <label style={{ ...rotuloAj, marginTop: 14 }}>{tr('aprov.layout-criativo')}</label>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--v2-ink3)', lineHeight: 1.5 }}><strong style={{ color: '#b45309' }}>{tr('aprov.clique-sobre-criativo-acima')}</strong> para marcar os pontos a corrigir{post.imagens.length > 1 ? ' (em cada slide)' : ''}.</p>
            {annotations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                {annotations.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 8px' }}>
                    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: '#ffc00f', color: 'var(--v2-ink)', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: 'var(--v2-ink)' }}>{a.text}{post.imagens.length > 1 ? <em style={{ color: 'var(--v2-ink3)' }}> · slide {a.img + 1}</em> : null}</span>
                    <button onClick={() => setAnnotations(prev => prev.filter(x => x.id !== a.id))} style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <textarea lang="pt-BR" value={texto} onChange={e => setTexto(e.target.value)} placeholder={tr('aprov.dica-pedido')} style={{ ...campoAj, minHeight: 56 }} />

            <label style={{ ...rotuloAj, marginTop: 14 }}>{tr('aprov.data-horario-publicacao')}</label>
            <input type="datetime-local" value={dataTxt} onChange={e => setDataTxt(e.target.value)} style={campoAj} />

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button onClick={() => setModo('view')} disabled={enviando} style={{ ...btn('var(--v2-surface2)', 'var(--v2-ink2)'), flex: '0 0 auto', padding: '12px 16px' }}>{tr('aprov.voltar')}</button>
              {(legendaMudou || dataMudou) && annotations.length === 0 && !texto.trim() && (
                <button onClick={() => dataMudou
                  ? decidir('corrected', { novaLegenda: legendaMudou ? legendaTxt : undefined, novaData: dataTxt })
                  : decidir('caption', { novaLegenda: legendaTxt })}
                  disabled={enviando} style={{ flex: '1 1 40%', ...btn('#16a34a', '#fff') }}>
                  {legendaMudou && dataMudou ? tr('aprov.aprovar-com-ajustes') : dataMudou ? tr('aprov.aprovar-nesta-data') : tr('aprov.aprovar-com-legenda')}
                </button>
              )}
              <button onClick={enviarAjuste} disabled={enviando} style={{ flex: '1 1 45%', minWidth: 150, ...btn('var(--v2-amber-on)', '#17150E') }}>{enviando ? '...' : tr('aprov.enviar-solicitacao')}</button>
            </div>
          </div>
        )}

        {/* Rejeitar */}
        {modo === 'reject' && (
          <div>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14, color: 'var(--v2-ink)' }}>{tr('aprov.motivo-reprovacao')}</p>
            <textarea lang="pt-BR" autoFocus value={texto} onChange={e => setTexto(e.target.value)} placeholder={tr('aprov.descreva-motivo')} style={{ ...campoAj, minHeight: 84 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => { setModo('view'); setTexto('') }} disabled={enviando} style={{ flex: 1, ...btn('var(--v2-surface2)', 'var(--v2-ink2)') }}>{tr('aprov.voltar')}</button>
              <button onClick={() => { if (!texto.trim()) { toast(tr('aprov.descreva-motivo-reprovacao'), 'erro'); return } decidir('rejected', { motivo: texto }) }} disabled={enviando} style={{ flex: 2, ...btn('#dc2626', '#fff') }}>{enviando ? '...' : tr('aprov.confirmar-reprovacao')}</button>
            </div>
          </div>
        )}
        {extra && <div style={{ marginTop: 12 }}>{extra}</div>}
      </div>
    </div>
  )
}

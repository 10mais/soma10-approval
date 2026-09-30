'use client'
// TABELA DE COPIES na aprovação — a mesma no LINK PÚBLICO e no PORTAL do cliente (Fase 1 da
// rodada de ajuste, dono 29/09). Veio da página do link sem mudar o comportamento; a decisão
// sai pelo `enviar` de cada tela. Tipos e utilitários em ./comum.
import { useState } from 'react'
import { useT, useIdioma } from '@/app/components/Idioma'
import { labelFormato } from '@/lib/formatoPost'
import { toast } from '@/lib/toast'
import { problemaDoPedido } from '@/lib/rodadaAjuste'
import { ehVideoUrl, campoAj, type PostA, type EnviarDecisao } from './comum'

// Aprovação de COPY/BRIEFING em TABELA (pedido do dono, 12/08): uma LINHA por
// postagem — Imagem | Copy (texto na imagem) | Legenda | Aprovação — no molde
// da planilha que a equipe usava no Notion. Substitui o card estilo Instagram
// e a revisão ponto a ponto (confundiam o cliente). Criativos com arte
// continuam no PostCard. No celular a grade empilha (rótulo por célula).
export default function TabelaCopies({ posts, enviar, onDecidido, somenteLeitura = false, extra }: { posts: PostA[]; enviar: EnviarDecisao; onDecidido: (id: string) => void; somenteLeitura?: boolean; extra?: (p: PostA) => React.ReactNode }) {
  const tr = useT()
  return (
    <div style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 14, overflow: 'hidden', marginBottom: 26 }}>
      <style>{`
        .copy-tab-row{display:grid;grid-template-columns:130px 1.15fr 1fr 168px;gap:14px;padding:14px 16px;border-top:1px solid var(--v2-rule)}
        .copy-tab-head{display:grid;grid-template-columns:130px 1.15fr 1fr 168px;gap:14px;padding:10px 16px;background:var(--v2-surface2);border-top:1px solid var(--v2-rule)}
        .copy-cell-label{display:none}
        @media (max-width:820px){
          .copy-tab-row{grid-template-columns:1fr;gap:10px}
          .copy-tab-head{display:none}
          .copy-cell-label{display:block;font-size:10px;font-weight:600;color:var(--v2-ink3);text-transform:uppercase;letter-spacing:.04em;margin:0 0 4px}
        }
      `}</style>
      <div style={{ padding: '12px 16px 10px' }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--v2-ink)' }}>{tr('aprov.briefings-aprovacao')}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>{tr('aprov.leia-cada-linha-decida-aprovar')}</p>
      </div>
      <div className="copy-tab-head">
        {[tr('aprov.imagem'), tr('aprov.copy-texto-imagem'), tr('aprov.legenda'), tr('aprov.aprovacao')].map(h => (
          <span key={h} style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
        ))}
      </div>
      {posts.map((p, i) => <LinhaCopy key={p.id} post={p} idx={i} enviar={enviar} somenteLeitura={somenteLeitura} extra={extra?.(p)} onDecidido={() => onDecidido(p.id)} />)}
    </div>
  )
}

function LinhaCopy({ post, idx, enviar, somenteLeitura, extra, onDecidido }: { post: PostA; idx: number; enviar: EnviarDecisao; somenteLeitura: boolean; extra?: React.ReactNode; onDecidido: () => void }) {
  const tr = useT()
  const { idioma } = useIdioma()
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
  const mudouAlgo = campos.headline !== st.headline || campos.subheadline !== st.subheadline || campos.textoImagem !== st.textoImagem || campos.cta !== st.cta || campos.legenda !== st.legenda

  function abrirAjuste() {
    setCampos({ headline: st.headline, subheadline: st.subheadline, textoImagem: st.textoImagem, cta: st.cta, legenda: st.legenda })
    setObs(st.obs || ''); setModo('ajuste')
  }

  async function decidir(type: 'approved' | 'corrected' | 'rejected' | 'caption', comCampos: boolean) {
    setEnviando(true)
    const r = await enviar({
      id: post.id, type, rejectReason: obs.trim() || '',
      ...(comCampos ? { novaLegenda: campos.legenda, novosCampos: { headline: campos.headline, subheadline: campos.subheadline, textoImagem: campos.textoImagem, cta: campos.cta } } : {}),
    })
    setEnviando(false)
    if (!r?.ok) { toast(r?.error || tr('aprov.falha-registrar'), 'erro'); return }
    if (type === 'corrected') {
      setSt(s => ({ ...s, status: 'corrigir', ...(comCampos ? { ...campos } : {}), obs: obs.trim() }))
      setModo('view')
      toast(tr('aprov.ajustes-enviados-copy'), 'sucesso')
      return
    }
    toast(type === 'rejected' ? tr('aprov.briefing-rejeitado') : tr('aprov.briefing-aprovado'), type === 'rejected' ? 'erro' : 'sucesso')
    onDecidido()
  }

  const bloco = (t: string, estilo?: React.CSSProperties) => <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...estilo }}>{t}</p>
  const mini = (bg: string, color: string, border?: string): React.CSSProperties => ({ padding: '9px 10px', background: bg, color, border: border ? `1.5px solid ${border}` : 'none', borderRadius: 10, fontWeight: 600, fontSize: 12.5, cursor: 'pointer', width: '100%', fontFamily: 'inherit' })

  return (
    <div className="copy-tab-row" style={{ background: emAjuste ? 'var(--v2-amber-bg)' : 'var(--v2-surface)' }}>
      {/* Col 1 — IMAGEM */}
      <div>
        <span className="copy-cell-label">{tr('aprov.imagem')}</span>
        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: 'var(--v2-ink)' }}>Postagem {idx + 1}: {labelFormato(post.formato, idioma)}</p>
        {capa
          ? <img src={capa} alt="" style={{ width: '100%', maxWidth: 130, aspectRatio: '4/5', objectFit: 'cover', borderRadius: 9, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface2)' }} />
          : <div style={{ width: '100%', maxWidth: 130, aspectRatio: '4/5', borderRadius: 9, border: '1px dashed var(--v2-rule2)', background: 'var(--v2-surface2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8, boxSizing: 'border-box' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9c9ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L11 18" /></svg>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--v2-ink3)', textAlign: 'center', lineHeight: 1.35 }}>{tr('aprov.arte-produzida-apos-aprovacao')}</span>
            </div>}
        {(post.localAplicacao || post.medidas) && <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--v2-ink3)' }}>{[post.localAplicacao, post.medidas].filter(Boolean).join(' · ')}</p>}
        {post.dataAgendada && <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--v2-ink3)' }}>Programado: {new Date(post.dataAgendada).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>}
      </div>

      {/* Col 2 — COPY (texto na imagem) */}
      <div style={{ minWidth: 0 }}>
        <span className="copy-cell-label">{tr('aprov.copy-texto-imagem')}</span>
        {modo === 'ajuste' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(st.headline || campos.headline) && <textarea lang="pt-BR" value={campos.headline} onChange={e => setCampos(c => ({ ...c, headline: e.target.value }))} placeholder={tr('aprov.frase-principal')} style={{ ...campoAj, minHeight: 44, fontSize: 12.5 }} />}
            {(st.subheadline || campos.subheadline) && <textarea lang="pt-BR" value={campos.subheadline} onChange={e => setCampos(c => ({ ...c, subheadline: e.target.value }))} placeholder={tr('aprov.frase-apoio')} style={{ ...campoAj, minHeight: 44, fontSize: 12.5 }} />}
            {(st.textoImagem || campos.textoImagem) && <textarea lang="pt-BR" value={campos.textoImagem} onChange={e => setCampos(c => ({ ...c, textoImagem: e.target.value }))} placeholder={tr('aprov.texto-arte')} style={{ ...campoAj, minHeight: 64, fontSize: 12.5 }} />}
            {(st.cta || campos.cta) && <textarea lang="pt-BR" value={campos.cta} onChange={e => setCampos(c => ({ ...c, cta: e.target.value }))} placeholder={tr('aprov.chamada-final')} style={{ ...campoAj, minHeight: 38, fontSize: 12.5 }} />}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {st.headline && bloco(st.headline, { fontWeight: 800, color: 'var(--v2-ink)', fontSize: 13.5 })}
            {st.subheadline && bloco(st.subheadline, { color: 'var(--v2-ink2)' })}
            {st.textoImagem && bloco(st.textoImagem)}
            {laminas.map((l, li) => <p key={li} style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}><strong style={{ color: 'var(--v2-ink3)' }}>{li + 1}.</strong> {l.texto}</p>)}
            {st.cta && bloco(st.cta, { fontWeight: 800, color: '#b45309' })}
            {!st.headline && !st.subheadline && !st.textoImagem && laminas.length === 0 && !st.cta && <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)' }}>{tr('aprov.sem-texto-arte-veja-legenda-ao')}</p>}
          </div>
        )}
      </div>

      {/* Col 3 — LEGENDA */}
      <div style={{ minWidth: 0 }}>
        <span className="copy-cell-label">{tr('aprov.legenda')}</span>
        {modo === 'ajuste'
          ? <textarea lang="pt-BR" value={campos.legenda} onChange={e => setCampos(c => ({ ...c, legenda: e.target.value }))} placeholder={tr('aprov.legenda')} style={{ ...campoAj, minHeight: 120, fontSize: 12.5 }} />
          : (st.legenda ? bloco(st.legenda) : <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)' }}>{tr('aprov.sem-legenda')}</p>)}
      </div>

      {/* Col 4 — APROVAÇÃO */}
      <div>
        <span className="copy-cell-label">{tr('aprov.aprovacao')}</span>
        {somenteLeitura && <p style={{ margin: 0, fontSize: 11.5, color: 'var(--v2-ink3)', fontStyle: 'italic' }}>{tr('portal.somente-visualizacao-aprovacao')}</p>}
        {!somenteLeitura && modo === 'view' && !emAjuste && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => decidir('approved', false)} disabled={enviando} style={mini('#16a34a', '#fff')}>{tr('aprov.aprovar')}</button>
            <button onClick={abrirAjuste} disabled={enviando} style={mini('var(--v2-amber-on)', '#17150E')}>{tr('aprov.pedir-ajustes')}</button>
            <button onClick={() => { setObs(''); setModo('reject') }} disabled={enviando} style={mini('#fff', '#dc2626', '#dc2626')}>{tr('aprov.rejeitar')}</button>
          </div>
        )}
        {!somenteLeitura && modo === 'view' && emAjuste && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ alignSelf: 'flex-start', fontSize: 10, fontWeight: 800, color: '#b45309', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 999, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{tr('aprov.ajuste')}</span>
            {st.obs && <p style={{ margin: 0, fontSize: 11.5, color: '#9a6b2e', lineHeight: 1.45 }}>{st.obs}</p>}
            <button onClick={abrirAjuste} disabled={enviando} style={mini('var(--v2-amber-on)', '#17150E')}>{tr('aprov.editar-ajuste')}</button>
            <button onClick={() => decidir('approved', false)} disabled={enviando} style={mini('var(--v2-surface)', 'var(--v2-ok)', 'var(--v2-ok)')}>{tr('aprov.aprovar-assim-mesmo')}</button>
          </div>
        )}
        {modo === 'ajuste' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea lang="pt-BR" value={obs} onChange={e => setObs(e.target.value)} placeholder={tr('aprov.observacao-opcional-se-voce-ja')} style={{ ...campoAj, minHeight: 64, fontSize: 12 }} />
            {mudouAlgo && !obs.trim() && <button onClick={() => decidir('caption', true)} disabled={enviando} style={mini('#16a34a', '#fff')}>{tr('aprov.aprovar-meus-ajustes')}</button>}
            <button onClick={() => {
              const problema = problemaDoPedido({ observacao: obs, mudouCampos: mudouAlgo })
              if (problema) { toast(problema === 'vago' ? tr('aprov.pedido-vago') : tr('aprov.edite-algo'), 'erro'); return }
              decidir('corrected', true)
            }} disabled={enviando} style={mini('var(--v2-amber-on)', '#17150E')}>{enviando ? '...' : tr('aprov.enviar-ajustes')}</button>
            <button onClick={() => setModo('view')} disabled={enviando} style={mini('var(--v2-surface2)', 'var(--v2-ink2)')}>{tr('aprov.cancelar')}</button>
          </div>
        )}
        {modo === 'reject' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea lang="pt-BR" autoFocus value={obs} onChange={e => setObs(e.target.value)} placeholder={tr('aprov.motivo-rejeicao')} style={{ ...campoAj, minHeight: 64, fontSize: 12 }} />
            <button onClick={() => { if (!obs.trim()) { toast(tr('aprov.descreva-motivo-rejeicao'), 'erro'); return } decidir('rejected', false) }} disabled={enviando} style={mini('#dc2626', '#fff')}>{enviando ? '...' : tr('aprov.confirmar-rejeicao')}</button>
            <button onClick={() => { setModo('view'); setObs('') }} disabled={enviando} style={mini('var(--v2-surface2)', 'var(--v2-ink2)')}>{tr('aprov.voltar')}</button>
          </div>
        )}
        {extra && <div style={{ marginTop: 8 }}>{extra}</div>}
      </div>
    </div>
  )
}

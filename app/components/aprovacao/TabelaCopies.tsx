'use client'
// TABELA DE COPIES na aprovação — a mesma no LINK PÚBLICO, no PORTAL do cliente e na aba
// Aprovações do dashboard (Fase 1 da rodada de ajuste, dono 29/09). A decisão sai pelo `enviar`
// de cada tela. Tipos e utilitários em ./comum.
//
// 30/09 (dono, print do link): "A Copy de um, aparece em outro. O visual também não está ok."
// A coluna da copy virou a PRÉVIA DA ARTE (./MockupCopy + lib/mockupCopy): o texto disposto
// como vai ficar na peça — título grande, subtítulo menor, demais textos, CTA como botão, espaço
// da imagem — e SÓ com os campos que o Studio usa no formato (o texto escondido no Studio era o
// que aparecia "no lugar errado"). No ajuste, a prévia acompanha o que o cliente escreve, e o
// carrossel é editado lâmina por lâmina.
import { useState } from 'react'
import { useT, useIdioma } from '@/app/components/Idioma'
import { labelFormato } from '@/lib/formatoPost'
import { toast } from '@/lib/toast'
import { problemaDoPedido } from '@/lib/rodadaAjuste'
import { camposDoFormato, normalizarFormato } from '@/lib/mockupCopy'
import MockupCopy from './MockupCopy'
import { ehVideoUrl, campoAj, type PostA, type EnviarDecisao } from './comum'

// Uma LINHA por postagem — Prévia da arte | Legenda | Aprovação — no molde da planilha que a
// equipe usava no Notion (pedido do dono, 12/08). No celular a grade empilha (rótulo por célula).
export default function TabelaCopies({ posts, enviar, onDecidido, somenteLeitura = false, extra, corMarca, fotoUrl }: {
  posts: PostA[]; enviar: EnviarDecisao; onDecidido: (id: string) => void; somenteLeitura?: boolean
  extra?: (p: PostA) => React.ReactNode
  corMarca?: string // cor primária do cliente (a prévia usa no CTA e na faixa)
  fotoUrl?: string  // logo do cliente na prévia
}) {
  const tr = useT()
  return (
    <div style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 14, overflow: 'hidden', marginBottom: 26 }}>
      <style>{`
        .copy-tab-row{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) 168px;gap:18px;padding:16px;border-top:1px solid var(--v2-rule)}
        .copy-tab-head{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) 168px;gap:18px;padding:10px 16px;background:var(--v2-surface2);border-top:1px solid var(--v2-rule)}
        .copy-cell-label{display:none}
        @media (max-width:820px){
          .copy-tab-row{grid-template-columns:1fr;gap:12px}
          .copy-tab-head{display:none}
          .copy-cell-label{display:block;font-size:10px;font-weight:600;color:var(--v2-ink3);text-transform:uppercase;letter-spacing:.04em;margin:0 0 4px}
        }
      `}</style>
      <div style={{ padding: '12px 16px 10px' }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--v2-ink)' }}>{tr('aprov.briefings-aprovacao')}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>{tr('aprov.leia-previa-decida')}</p>
      </div>
      <div className="copy-tab-head">
        {[tr('aprov.previa-arte'), tr('aprov.legenda'), tr('aprov.aprovacao')].map(h => (
          <span key={h} style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
        ))}
      </div>
      {posts.map((p, i) => (
        <LinhaCopy key={p.id} post={p} idx={i} enviar={enviar} somenteLeitura={somenteLeitura} extra={extra?.(p)}
          corMarca={p.corMarca || corMarca} fotoUrl={p.fotoUrl || fotoUrl} onDecidido={() => onDecidido(p.id)} />
      ))}
    </div>
  )
}

type Campos = { headline: string; subheadline: string; textoImagem: string; cta: string; legenda: string; laminas: string[] }

function LinhaCopy({ post, idx, enviar, somenteLeitura, extra, corMarca, fotoUrl, onDecidido }: {
  post: PostA; idx: number; enviar: EnviarDecisao; somenteLeitura: boolean; extra?: React.ReactNode
  corMarca?: string; fotoUrl?: string; onDecidido: () => void
}) {
  const tr = useT()
  const { idioma } = useIdioma()
  const formato = normalizarFormato(post.formato)
  const editaveis = camposDoFormato(formato)
  const [modo, setModo] = useState<'view' | 'ajuste' | 'reject'>('view')
  const [enviando, setEnviando] = useState(false)
  const [obs, setObs] = useState('')
  const vazio: Campos = { headline: '', subheadline: '', textoImagem: '', cta: '', legenda: '', laminas: [] }
  const [campos, setCampos] = useState<Campos>(vazio)
  // Estado local — reflete "EM AJUSTE" e as edições na hora, sem recarregar.
  const [st, setSt] = useState<Campos & { status: string; obs: string }>({
    status: post.status || 'aguardando_aprovacao',
    headline: post.headline || '', subheadline: post.subheadline || '', textoImagem: post.textoImagem || '',
    cta: post.cta || '', legenda: post.legenda || '', obs: post.ajusteCopy || '',
    laminas: (post.laminas || []).map(l => l?.texto || ''),
  })
  const emAjuste = st.status === 'corrigir'
  const capa = (post.imagens || []).find(u => !ehVideoUrl(u)) || (post.capasVideo || {})[(post.imagens || [])[0] || ''] || ''
  const mudouLaminas = campos.laminas.length !== st.laminas.length || campos.laminas.some((t, i) => t !== st.laminas[i])
  const mudouAlgo = campos.headline !== st.headline || campos.subheadline !== st.subheadline || campos.textoImagem !== st.textoImagem || campos.cta !== st.cta || campos.legenda !== st.legenda || mudouLaminas
  // A prévia mostra o que está na tela: no ajuste, o que o cliente está escrevendo.
  const naPrevia = modo === 'ajuste' ? campos : st

  function abrirAjuste() {
    setCampos({ headline: st.headline, subheadline: st.subheadline, textoImagem: st.textoImagem, cta: st.cta, legenda: st.legenda, laminas: [...st.laminas] })
    setObs(st.obs || ''); setModo('ajuste')
  }

  async function decidir(type: 'approved' | 'corrected' | 'rejected' | 'caption', comCampos: boolean) {
    setEnviando(true)
    const r = await enviar({
      id: post.id, type, rejectReason: obs.trim() || '',
      ...(comCampos ? {
        novaLegenda: campos.legenda,
        novosCampos: { headline: campos.headline, subheadline: campos.subheadline, textoImagem: campos.textoImagem, cta: campos.cta },
        ...(editaveis.includes('laminas') ? { novasLaminas: campos.laminas } : {}),
      } : {}),
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
  const rotuloCampo: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 800, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }
  // Rótulo de cada campo no formato (os mesmos nomes do Studio, na língua de quem lê).
  const rotulo = (c: 'headline' | 'subheadline' | 'textoImagem' | 'cta') => tr(
    c === 'headline' ? (formato === 'carrossel' ? 'aprov.campo-titulo-capa' : formato === 'reel' ? 'aprov.campo-abertura' : 'aprov.campo-titulo')
      : c === 'subheadline' ? (formato === 'reel' ? 'aprov.campo-gancho' : 'aprov.campo-subtitulo')
        : c === 'textoImagem' ? (formato === 'reel' ? 'aprov.campo-roteiro' : formato === 'grafico' ? 'aprov.campo-texto-material' : 'aprov.campo-texto-arte')
          : 'aprov.campo-cta')

  return (
    <div className="copy-tab-row" style={{ background: emAjuste ? 'var(--v2-amber-bg)' : 'var(--v2-surface)' }}>
      {/* Col 1 — PRÉVIA DA ARTE */}
      <div style={{ minWidth: 0 }}>
        <span className="copy-cell-label">{tr('aprov.previa-arte')}</span>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: 'var(--v2-ink)' }}>
          {tr('aprov.postagem-n', { n: idx + 1 })}: {labelFormato(post.formato, idioma)}
          {post.dataAgendada && <span style={{ fontWeight: 500, color: 'var(--v2-ink3)' }}> · {new Date(post.dataAgendada).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
        </p>
        <MockupCopy copy={{ formato: post.formato, medidas: post.medidas, headline: naPrevia.headline, subheadline: naPrevia.subheadline, textoImagem: naPrevia.textoImagem, cta: naPrevia.cta, laminas: naPrevia.laminas.map(texto => ({ texto })) }}
          corMarca={corMarca} fotoUrl={fotoUrl} imagemUrl={capa || undefined} />
        {(post.localAplicacao || post.medidas) && <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--v2-ink3)' }}>{[post.localAplicacao, post.medidas].filter(Boolean).join(' · ')}</p>}
        <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--v2-ink3)', lineHeight: 1.4 }}>{tr('aprov.previa-disposicao')}</p>
      </div>

      {/* Col 2 — LEGENDA (e, no ajuste, os textos da arte do formato) */}
      <div style={{ minWidth: 0 }}>
        <span className="copy-cell-label">{tr('aprov.legenda')}</span>
        {modo === 'ajuste' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(['headline', 'subheadline', 'textoImagem'] as const).filter(c => editaveis.includes(c)).map(c => (
              <div key={c}>
                <label style={rotuloCampo}>{rotulo(c)}</label>
                <textarea lang="pt-BR" value={campos[c]} onChange={e => setCampos(x => ({ ...x, [c]: e.target.value }))} style={{ ...campoAj, minHeight: c === 'textoImagem' ? 64 : 44, fontSize: 12.5 }} />
              </div>
            ))}
            {editaveis.includes('laminas') && campos.laminas.map((t, i) => (
              <div key={`l${i}`}>
                <label style={rotuloCampo}>{i === 0 ? tr('aprov.capa') : tr('aprov.lamina-n', { n: i + 1 })}</label>
                <textarea lang="pt-BR" value={t} onChange={e => setCampos(x => ({ ...x, laminas: x.laminas.map((v, j) => j === i ? e.target.value : v) }))} style={{ ...campoAj, minHeight: 56, fontSize: 12.5 }} />
              </div>
            ))}
            {editaveis.includes('cta') && (
              <div>
                <label style={rotuloCampo}>{rotulo('cta')}</label>
                <textarea lang="pt-BR" value={campos.cta} onChange={e => setCampos(x => ({ ...x, cta: e.target.value }))} style={{ ...campoAj, minHeight: 38, fontSize: 12.5 }} />
              </div>
            )}
            {formato !== 'story' && formato !== 'grafico' && (
              <div>
                <label style={rotuloCampo}>{tr('aprov.legenda')}</label>
                <textarea lang="pt-BR" value={campos.legenda} onChange={e => setCampos(x => ({ ...x, legenda: e.target.value }))} style={{ ...campoAj, minHeight: 120, fontSize: 12.5 }} />
              </div>
            )}
          </div>
        ) : (st.legenda ? bloco(st.legenda) : <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)' }}>{tr('aprov.sem-legenda')}</p>)}
      </div>

      {/* Col 3 — APROVAÇÃO */}
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
            <p style={{ margin: '0 0 2px', fontSize: 11.5, color: 'var(--v2-ink3)', lineHeight: 1.4 }}>{tr('aprov.edite-previa-atualiza')}</p>
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

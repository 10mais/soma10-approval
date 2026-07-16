'use client'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { fecharFora } from '@/lib/fecharModal'

function capaDoPost(post: any): string {
  const ehVideo = (u: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(u || '')
  if (post?.thumbnail) return post.thumbnail
  const caps = post?.capasVideo || {}
  for (const url of (post?.imagens || [])) { if (caps[url]) return caps[url] }
  const img = (post?.imagens || []).find((u: string) => !ehVideo(u))
  if (img) return img
  return Object.values(caps)[0] as string || (post?.imagens || [])[0] || ''
}

const ehVideoUrl = (u: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(u || '')

// Todas as midias do post (para o visualizador em tela cheia). Cai na capa se nao houver imagens.
function midiasDoPost(post: any): string[] {
  const arr = (post?.imagens || []).filter(Boolean)
  if (arr.length) return arr
  const c = capaDoPost(post)
  return c ? [c] : []
}

// Retorna { texto, atrasado } da espera em aprovacao (SLA 24h)
function tempoEspera(aguardandoDesde?: string): { texto: string; atrasado: boolean } | null {
  if (!aguardandoDesde) return null
  const ms = Date.now() - new Date(aguardandoDesde).getTime()
  if (ms < 0) return null
  const horas = Math.floor(ms / (60 * 60 * 1000))
  const atrasado = horas >= 24
  const texto = horas < 1 ? 'há poucos minutos' : horas < 24 ? `há ${horas}h` : `há ${Math.floor(horas / 24)} dia(s)`
  return { texto, atrasado }
}

// ISO -> valor de <input type="datetime-local"> (hora local).
function toLocalInput(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function AprovacoesPagina() {
  const { clienteId } = useParams()
  const { data: session } = useSession()
  const [posts, setPosts] = useState<any[]>([])
  const [enviando, setEnviando] = useState<string | null>(null)
  const [comentario, setComentario] = useState<Record<string, string>>({})
  const [rejeitar, setRejeitar] = useState<{ id: string; ehCopy: boolean } | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [editLegenda, setEditLegenda] = useState<{ id: string; texto: string } | null>(null)
  // Painel "Solicitar ajustes" consolidado (legenda + layout + data) — um por vez.
  const [ajuste, setAjuste] = useState<{ id: string; legenda: string; obs: string; data: string } | null>(null)
  const [aprovandoTodos, setAprovandoTodos] = useState(false)
  // Permissao de aprovar (default true). So restringe o proprio cliente; equipe nao.
  const [permAprovar, setPermAprovar] = useState(true)
  // Visualizador de midia em tela cheia (clicar para ampliar o criativo antes de aprovar)
  const [viewer, setViewer] = useState<{ midias: string[]; idx: number } | null>(null)

  useEffect(() => {
    if (!viewer) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setViewer(null)
      else if (e.key === 'ArrowRight') setViewer(v => v ? { ...v, idx: (v.idx + 1) % v.midias.length } : v)
      else if (e.key === 'ArrowLeft') setViewer(v => v ? { ...v, idx: (v.idx - 1 + v.midias.length) % v.midias.length } : v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewer])

  function abrirViewer(post: any, idx = 0) {
    const midias = midiasDoPost(post)
    if (midias.length) setViewer({ midias, idx: Math.min(idx, midias.length - 1) })
  }

  function carregar() {
    fetch(`/api/posts?clienteId=${clienteId}`).then(r => r.json()).then(d => setPosts(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => { carregar() }, [clienteId])
  useEffect(() => {
    const ehCliente = (session?.user as any)?.role === 'cliente'
    if (!ehCliente) { setPermAprovar(true); return }
    fetch(`/api/clientes?id=${clienteId}`).then(r => r.json()).then(c => { if (c && !c.error) setPermAprovar(c.permissoes?.aprovar !== false) }).catch(() => {})
  }, [clienteId, session])

  const pendentes = posts.filter(p => p.etapa === 'aprovacao_copy' || p.etapa === 'aprovacao_criativo')
  // "aguardando" = os que precisam da decisão do cliente; EM AJUSTE (corrigir) ficam visíveis mas não contam no banner/lote.
  const aguardando = pendentes.filter(p => p.status !== 'corrigir')
  // espera mais antiga (para o banner "o que está esperando você")
  const maisAntiga = pendentes.reduce<string | undefined>((min, p) => (p.aguardandoDesde && (!min || p.aguardandoDesde < min)) ? p.aguardandoDesde : min, undefined)

  async function aprovarTodos() {
    if (!(await confirmar(`Aprovar todos os ${aguardando.length} itens pendentes?`, { titulo: 'Aprovar em lote', okLabel: 'Aprovar todos' }))) return
    setAprovandoTodos(true)
    const semData: string[] = []
    for (const p of aguardando) {
      const ehCopy = p.etapa === 'aprovacao_copy'
      const r = await fetch('/api/esteira/aprovar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: p.id, acao: ehCopy ? 'aprovar_copy' : 'aprovar_criativo', comentario: '' }) }).then(x => x.json()).catch(() => ({ error: 'erro' }))
      if (r?.semData) semData.push(p.legenda?.slice(0, 30) || p.id)
    }
    setAprovandoTodos(false)
    carregar()
    if (semData.length) toast(`Estes criativos precisam de data/horário definidos antes de aprovar (peça à equipe): ${semData.join(', ')}`, 'erro')
  }

  async function agir(postId: string, acao: string, comentarioOverride?: string, novaLegenda?: string, novaData?: string) {
    setEnviando(postId)
    const r = await fetch('/api/esteira/aprovar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, acao, comentario: comentarioOverride ?? (comentario[postId] || ''), novaLegenda, novaData }),
    }).then(x => x.json()).catch(() => ({ error: 'Erro de conexao' }))
    if (r?.semData) { toast('Defina a data e horario da postagem antes de aprovar o criativo.', 'erro'); setEnviando(null); return }
    if (r?.error) { toast(r.error, 'erro'); setEnviando(null); return }
    setEnviando(null)
    carregar()
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#111' }}>Aprovações</h2>

      {/* O que está esperando você */}
      {aguardando.length > 0 && (() => { const e = tempoEspera(maisAntiga); const urgente = e?.atrasado; return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: urgente ? '#fef2f2' : '#fffbeb', border: `1.5px solid ${urgente ? '#fecaca' : '#fde68a'}`, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: urgente ? '#b91c1c' : '#92400e' }}>
              {aguardando.length} {aguardando.length === 1 ? 'item aguardando' : 'itens aguardando'} a sua aprovação{e ? ` — o mais antigo ${e.texto}` : ''}.
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: urgente ? '#b91c1c' : '#92400e', opacity: 0.85 }}>Aprovar rápido mantém o ritmo das suas entregas.</p>
          </div>
          {permAprovar && aguardando.length > 1 && (
            <button onClick={aprovarTodos} disabled={aprovandoTodos}
              style={{ padding: '10px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: aprovandoTodos ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
              {aprovandoTodos ? 'Aprovando...' : `Aprovar todos (${aguardando.length})`}
            </button>
          )}
        </div>
      ) })()}

      {pendentes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa', background: '#fff', borderRadius: 14, border: '1px solid #eee' }}>
          <p>Nenhuma pendencia de aprovacao no momento.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pendentes.map(p => {
            const ehCopy = p.etapa === 'aprovacao_copy'
            const capa = capaDoPost(p)
            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '16px 18px' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {capa && (
                    <div onClick={() => abrirViewer(p, 0)} title="Clique para ampliar" style={{ position: 'relative', width: 96, height: 96, borderRadius: 10, overflow: 'hidden', background: '#eee', flexShrink: 0, cursor: 'zoom-in' }}>
                      {ehVideoUrl(capa) ? <video src={capa} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <img src={capa} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      <div style={{ position: 'absolute', right: 4, bottom: 4, width: 22, height: 22, borderRadius: 6, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></svg>
                      </div>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{p.clienteNome}</span>
                      <span style={{ background: p.status === 'corrigir' ? '#fff7ed' : ehCopy ? '#dbeafe' : '#fef3c7', border: p.status === 'corrigir' ? '1px solid #fed7aa' : 'none', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: p.status === 'corrigir' ? '#b45309' : ehCopy ? '#1d4ed8' : '#92400e' }}>
                        {p.status === 'corrigir' ? 'Em ajuste' : ehCopy ? 'Aprovar copy' : 'Aprovar criativo'}
                      </span>
                      {(() => { const e = tempoEspera(p.aguardandoDesde); return e ? (
                        <span style={{ background: e.atrasado ? '#fee2e2' : '#f0f0f0', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: e.atrasado ? '#b91c1c' : '#888' }}>
                          aguardando {e.texto}
                        </span>
                      ) : null })()}
                    </div>
                    {p.briefing && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#888' }}>Briefing: {p.briefing}</p>}
                    <p style={{ margin: '0 0 6px', fontSize: 13, color: '#333', whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto', lineHeight: 1.5 }}>{p.legenda || '(sem texto)'}</p>
                    {(p.imagens || []).length > 0 && !ehCopy && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                          {p.imagens.map((m: string, i: number) => (
                            <div key={i} onClick={() => abrirViewer(p, i)} title="Clique para ampliar" style={{ width: 68, height: 68, borderRadius: 8, overflow: 'hidden', background: '#eee', flexShrink: 0, cursor: 'zoom-in' }}>
                              {ehVideoUrl(m) ? <video src={m} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <img src={m} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            </div>
                          ))}
                        </div>
                        <p style={{ margin: '5px 0 0', fontSize: 11, color: '#aaa' }}>Toque em uma imagem para ampliar{p.imagens.length > 1 ? ` — ${p.imagens.length} itens no carrossel` : ''}.</p>
                      </div>
                    )}
                    {permAprovar ? (
                      <>
                      {p.status === 'corrigir' ? (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: '#b45309' }}>Em ajuste</p>
                            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9a6b2e', lineHeight: 1.5 }}>Seu pedido foi enviado para a agência. Você pode continuar editando enquanto eles trabalham.</p>
                            {(ehCopy ? p.ajusteCopy : p.ajusteCriativo) && <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#7c4a12' }}><strong>Você pediu:</strong> {ehCopy ? p.ajusteCopy : p.ajusteCriativo}</p>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button onClick={() => setAjuste({ id: p.id, legenda: p.legenda || '', obs: (ehCopy ? p.ajusteCopy : p.ajusteCriativo) || '', data: toLocalInput(p.dataAgendada) })} disabled={enviando === p.id}
                              style={{ padding: '8px 16px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Editar ajuste</button>
                            <button onClick={() => agir(p.id, ehCopy ? 'aprovar_copy' : 'aprovar_criativo')} disabled={enviando === p.id}
                              style={{ padding: '8px 16px', background: '#fff', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Aprovar assim mesmo</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button onClick={() => agir(p.id, ehCopy ? 'aprovar_copy' : 'aprovar_criativo')} disabled={enviando === p.id}
                            style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Aprovar</button>
                          <button onClick={() => setAjuste({ id: p.id, legenda: p.legenda || '', obs: '', data: toLocalInput(p.dataAgendada) })} disabled={enviando === p.id}
                            style={{ padding: '8px 16px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Solicitar ajustes</button>
                          <button onClick={() => { setRejeitar({ id: p.id, ehCopy }); setMotivoRejeicao('') }} disabled={enviando === p.id}
                            style={{ padding: '8px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Rejeitar</button>
                        </div>
                      )}

                      {ajuste?.id === p.id && (() => {
                        const legendaMudou = ajuste.legenda.trim() !== (p.legenda || '').trim()
                        const dataMudou = !ehCopy && !!ajuste.data && ajuste.data !== toLocalInput(p.dataAgendada)
                        const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }
                        const rot: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 800, color: '#374151', margin: '10px 0 5px' }
                        return (
                          <div style={{ marginTop: 10, background: '#fffdf7', border: '1px solid #fde68a', borderRadius: 10, padding: 12 }}>
                            <p style={{ margin: '0 0 2px', fontSize: 13.5, fontWeight: 800, color: '#111' }}>Solicitar ajustes</p>
                            <p style={{ margin: '0 0 4px', fontSize: 11.5, color: '#999', lineHeight: 1.5 }}>Peça tudo de uma vez. Nada é enviado até você clicar em <strong>Enviar solicitação</strong>.</p>
                            <label style={rot}>Legenda</label>
                            <textarea value={ajuste.legenda} onChange={e => setAjuste(a => a && { ...a, legenda: e.target.value })} rows={4} style={campo} />
                            {!ehCopy ? (<>
                              <label style={rot}>O que ajustar no layout</label>
                              <textarea value={ajuste.obs} onChange={e => setAjuste(a => a && { ...a, obs: e.target.value })} rows={3} placeholder="Ex.: trocar a cor do título, aumentar a logo, mudar a foto..." style={campo} />
                              <label style={rot}>Data e horário da publicação</label>
                              <input type="datetime-local" value={ajuste.data} onChange={e => setAjuste(a => a && { ...a, data: e.target.value })} style={campo} />
                            </>) : (<>
                              <label style={rot}>Observação (opcional)</label>
                              <textarea value={ajuste.obs} onChange={e => setAjuste(a => a && { ...a, obs: e.target.value })} rows={3} placeholder="O que ajustar no texto..." style={campo} />
                            </>)}
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10, flexWrap: 'wrap' }}>
                              <button onClick={() => setAjuste(null)} style={{ padding: '8px 14px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Voltar</button>
                              <button disabled={enviando === p.id} onClick={() => {
                                if (!ajuste.obs.trim() && !legendaMudou && !dataMudou) { toast('Faça pelo menos um ajuste (legenda, layout ou data) antes de enviar.', 'erro'); return }
                                const obs = ajuste.obs.trim(); const nl = legendaMudou ? ajuste.legenda : undefined; const nd = dataMudou ? ajuste.data : undefined
                                setAjuste(null)
                                agir(p.id, ehCopy ? 'ajuste_copy' : 'ajuste_criativo', obs || 'Ajuste solicitado', nl, nd)
                              }} style={{ padding: '8px 18px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{enviando === p.id ? '...' : 'Enviar solicitação'}</button>
                            </div>
                          </div>
                        )
                      })()}
                      </>
                    ) : (
                      <p style={{ margin: 0, textAlign: 'right', fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>Somente visualização — a aprovação é feita pela equipe.</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {rejeitar && (
        <div onClick={fecharFora(() => setRejeitar(null))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', padding: 22 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#b91c1c' }}>Rejeitar {rejeitar.ehCopy ? 'copy' : 'criativo'}</h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#888' }}>Informe o motivo. O material voltara para a equipe.</p>
            <textarea value={motivoRejeicao} onChange={e => setMotivoRejeicao(e.target.value)} placeholder="Motivo da rejeicao..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #fca5a5', fontSize: 13, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14 }} autoFocus />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setRejeitar(null)} style={{ padding: '9px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              <button disabled={!motivoRejeicao.trim()} onClick={async () => { await agir(rejeitar.id, rejeitar.ehCopy ? 'ajuste_copy' : 'ajuste_criativo', `REJEITADO: ${motivoRejeicao}`); setRejeitar(null) }}
                style={{ padding: '9px 20px', background: motivoRejeicao.trim() ? '#b91c1c' : '#f0f0f0', color: motivoRejeicao.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: motivoRejeicao.trim() ? 'pointer' : 'not-allowed' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Visualizador de midia em tela cheia */}
      {viewer && (() => {
        const cur = viewer.midias[viewer.idx]
        const varios = viewer.midias.length > 1
        const ir = (delta: number) => setViewer(v => v ? { ...v, idx: (v.idx + delta + v.midias.length) % v.midias.length } : v)
        return (
          <div onClick={fecharFora(() => setViewer(null), { perguntar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
            <button onClick={() => setViewer(null)} title="Fechar (Esc)" style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            {varios && (
              <button onClick={e => { e.stopPropagation(); ir(-1) }} title="Anterior" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
            )}
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              {ehVideoUrl(cur)
                ? <video src={cur} controls autoPlay style={{ maxWidth: '92vw', maxHeight: '82vh', borderRadius: 10, background: '#000' }} />
                : <img src={cur} alt="" style={{ maxWidth: '92vw', maxHeight: '82vh', objectFit: 'contain', borderRadius: 10 }} />}
              {varios && <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, opacity: 0.85 }}>{viewer.idx + 1} / {viewer.midias.length}</span>}
            </div>
            {varios && (
              <button onClick={e => { e.stopPropagation(); ir(1) }} title="Próximo" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            )}
          </div>
        )
      })()}
    </div>
  )
}

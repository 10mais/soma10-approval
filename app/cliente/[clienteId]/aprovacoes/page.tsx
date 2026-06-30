'use client'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'

function capaDoPost(post: any): string {
  const ehVideo = (u: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(u || '')
  if (post?.thumbnail) return post.thumbnail
  const caps = post?.capasVideo || {}
  for (const url of (post?.imagens || [])) { if (caps[url]) return caps[url] }
  const img = (post?.imagens || []).find((u: string) => !ehVideo(u))
  if (img) return img
  return Object.values(caps)[0] as string || (post?.imagens || [])[0] || ''
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

export default function AprovacoesPagina() {
  const { clienteId } = useParams()
  const { data: session } = useSession()
  const [posts, setPosts] = useState<any[]>([])
  const [enviando, setEnviando] = useState<string | null>(null)
  const [comentario, setComentario] = useState<Record<string, string>>({})
  const [rejeitar, setRejeitar] = useState<{ id: string; ehCopy: boolean } | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [aprovandoTodos, setAprovandoTodos] = useState(false)
  // Permissao de aprovar (default true). So restringe o proprio cliente; equipe nao.
  const [permAprovar, setPermAprovar] = useState(true)

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
  // espera mais antiga (para o banner "o que está esperando você")
  const maisAntiga = pendentes.reduce<string | undefined>((min, p) => (p.aguardandoDesde && (!min || p.aguardandoDesde < min)) ? p.aguardandoDesde : min, undefined)

  async function aprovarTodos() {
    if (!(await confirmar(`Aprovar todos os ${pendentes.length} itens pendentes?`, { titulo: 'Aprovar em lote', okLabel: 'Aprovar todos' }))) return
    setAprovandoTodos(true)
    const semData: string[] = []
    for (const p of pendentes) {
      const ehCopy = p.etapa === 'aprovacao_copy'
      const r = await fetch('/api/esteira/aprovar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: p.id, acao: ehCopy ? 'aprovar_copy' : 'aprovar_criativo', comentario: '' }) }).then(x => x.json()).catch(() => ({ error: 'erro' }))
      if (r?.semData) semData.push(p.legenda?.slice(0, 30) || p.id)
    }
    setAprovandoTodos(false)
    carregar()
    if (semData.length) toast(`Estes criativos precisam de data/horário definidos antes de aprovar (peça à equipe): ${semData.join(', ')}`, 'erro')
  }

  async function agir(postId: string, acao: string, comentarioOverride?: string) {
    setEnviando(postId)
    const r = await fetch('/api/esteira/aprovar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, acao, comentario: comentarioOverride ?? (comentario[postId] || '') }),
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
      {pendentes.length > 0 && (() => { const e = tempoEspera(maisAntiga); const urgente = e?.atrasado; return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: urgente ? '#fef2f2' : '#fffbeb', border: `1.5px solid ${urgente ? '#fecaca' : '#fde68a'}`, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: urgente ? '#b91c1c' : '#92400e' }}>
              {pendentes.length} {pendentes.length === 1 ? 'item aguardando' : 'itens aguardando'} a sua aprovação{e ? ` — o mais antigo ${e.texto}` : ''}.
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: urgente ? '#b91c1c' : '#92400e', opacity: 0.85 }}>Aprovar rápido mantém o ritmo das suas entregas.</p>
          </div>
          {permAprovar && pendentes.length > 1 && (
            <button onClick={aprovarTodos} disabled={aprovandoTodos}
              style={{ padding: '10px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: aprovandoTodos ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
              {aprovandoTodos ? 'Aprovando...' : `Aprovar todos (${pendentes.length})`}
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
                    <div style={{ width: 80, height: 80, borderRadius: 10, overflow: 'hidden', background: '#eee', flexShrink: 0 }}>
                      {/\.(mp4|mov|m4v)(\?|$)/i.test(capa) ? <video src={capa} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <img src={capa} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{p.clienteNome}</span>
                      <span style={{ background: ehCopy ? '#dbeafe' : '#fef3c7', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: ehCopy ? '#1d4ed8' : '#92400e' }}>
                        {ehCopy ? 'Aprovar copy' : 'Aprovar criativo'}
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
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto' }}>
                        {p.imagens.map((m: string, i: number) => (
                          <div key={i} style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', background: '#eee', flexShrink: 0 }}>
                            {/\.(mp4|mov|m4v)(\?|$)/i.test(m) ? <video src={m} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <img src={m} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                        ))}
                      </div>
                    )}
                    {permAprovar ? (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => agir(p.id, ehCopy ? 'aprovar_copy' : 'aprovar_criativo')} disabled={enviando === p.id}
                          style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Aprovar</button>
                        <button onClick={() => agir(p.id, ehCopy ? 'ajuste_copy' : 'ajuste_criativo')} disabled={enviando === p.id}
                          style={{ padding: '8px 16px', background: '#fff', color: '#92400e', border: '1px solid #fde68a', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Pedir ajuste</button>
                        <button onClick={() => { setRejeitar({ id: p.id, ehCopy }); setMotivoRejeicao('') }} disabled={enviando === p.id}
                          style={{ padding: '8px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Rejeitar</button>
                      </div>
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
        <div onClick={() => setRejeitar(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
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
    </div>
  )
}

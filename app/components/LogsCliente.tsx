'use client'
import { useEffect, useMemo, useState } from 'react'

type Cliente = { id: string; nome: string }
type Log = {
  id: string; ts: number; clienteId: string; clienteNome: string
  tipo: string; acao: string; postId?: string; resumo?: string; motivo?: string; origem?: string
  postStatus?: string; postEtapa?: string; postExiste?: boolean // status ATUAL do criativo
  mudancas?: { campo: string; antes: string; depois: string }[] // antes -> depois do pedido
}
type Anot = { x: number; y: number; text: string; id?: number; img?: number }
type PostDet = { id: string; imagens?: string[]; legenda?: string; anotacoes?: Anot[]; motivoReprovacao?: string; ajusteCriativo?: string; formato?: string }

const ESTILO: Record<string, { cor: string; bg: string; label: string }> = {
  aprovacao: { cor: '#16a34a', bg: '#f0fdf4', label: 'Aprovação' },
  ajuste_layout: { cor: '#ea580c', bg: '#fff7ed', label: 'Ajuste de layout' },
  ajuste_copy: { cor: '#ca8a04', bg: '#fefce8', label: 'Ajuste de copy' },
  reprovacao: { cor: '#dc2626', bg: '#fef2f2', label: 'Reprovação' },
  corrigir_legenda: { cor: '#1d4ed8', bg: '#eff6ff', label: 'Correção de legenda' },
  solicitacao_conteudo: { cor: '#7c3aed', bg: '#f3e8ff', label: 'Solicitação de conteúdo' },
}

function haQuanto(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d} dia${d > 1 ? 's' : ''}`
}

// Onde o CRIATIVO está AGORA (não o que o cliente pediu, que é o histórico). Um
// "Ajuste de layout" já refeito e reenviado vira "Em revisão" — deixa de parecer
// pendência aberta.
function chipStatusPost(l: Log): { label: string; cor: string; bg: string } | null {
  if (!l.postId) return null
  if (l.postExiste === false) return { label: 'Excluído', cor: '#6b7280', bg: '#f3f4f6' }
  const st = l.postStatus || '', et = l.postEtapa || ''
  if (st === 'excluido') return { label: 'Na lixeira', cor: '#6b7280', bg: '#f3f4f6' }
  if (st === 'aguardando_aprovacao' || et === 'aprovacao_copy' || et === 'aprovacao_criativo') return { label: 'Em revisão', cor: '#1d4ed8', bg: '#eff6ff' }
  if (st === 'corrigir') return { label: 'A refazer', cor: '#b45309', bg: '#fff7ed' }
  if (st === 'reprovado') return { label: 'Reprovado', cor: '#b91c1c', bg: '#fef2f2' }
  if (st === 'agendado' || st === 'aprovado') return { label: 'Agendado', cor: '#16a34a', bg: '#f0fdf4' }
  if (st === 'publicado' || st === 'publicando') return { label: 'Publicado', cor: '#166534', bg: '#dcfce7' }
  if (st === 'rascunho') return { label: 'Em produção', cor: '#1d4ed8', bg: '#eff6ff' }
  return null
}

export default function LogsCliente({ clientes = [], onAbrirPost, onVerNoPlanner }: { clientes?: Cliente[]; onAbrirPost?: (postId: string) => void; onVerNoPlanner?: (postId: string) => void }) {
  const [logs, setLogs] = useState<Log[]>([])
  const [carregando, setCarregando] = useState(true)
  const [cliente, setCliente] = useState('')
  const [tipo, setTipo] = useState('')
  const [busca, setBusca] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [postCache, setPostCache] = useState<Record<string, PostDet | 'loading' | 'erro'>>({})

  // Abrir o card = LER o pedido aqui mesmo (busca o material para mostrar os
  // pontos marcados/legenda). Navegar para o editor fica só no link explícito.
  function toggleExpand(l: Log) {
    const novo = expandido === l.id ? null : l.id
    setExpandido(novo)
    if (novo && l.postId && !postCache[l.postId]) {
      const pid = l.postId
      setPostCache(c => ({ ...c, [pid]: 'loading' }))
      fetch(`/api/posts?id=${pid}`).then(r => r.ok ? r.json() : Promise.reject())
        .then((p: PostDet) => setPostCache(c => ({ ...c, [pid]: p })))
        .catch(() => setPostCache(c => ({ ...c, [pid]: 'erro' })))
    }
  }

  function carregar() {
    setCarregando(true)
    fetch(`/api/logs-cliente${cliente ? `?clienteId=${cliente}` : ''}`)
      .then(r => r.json()).then(d => setLogs(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [cliente])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return logs.filter(l => (!tipo || l.tipo === tipo) && (!q || `${l.clienteNome} ${l.acao} ${l.resumo || ''} ${l.motivo || ''}`.toLowerCase().includes(q)))
  }, [logs, tipo, busca])

  const inputS: React.CSSProperties = { padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', background: '#fff' }
  const rotuloExp: React.CSSProperties = { margin: '0 0 4px', fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Solicitações do cliente</h2>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: '#999' }}>Histórico de tudo que o cliente aprovou, pediu ajuste, reprovou ou solicitou. Fica registrado por 30 dias — não some quando você edita.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '16px 0 18px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por cliente, ação ou texto..." style={{ ...inputS, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <select value={cliente} onChange={e => setCliente(e.target.value)} style={inputS}>
          <option value="">Todos os clientes</option>
          {[...clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt')).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={tipo} onChange={e => setTipo(e.target.value)} style={inputS}>
          <option value="">Todos os tipos</option>
          {Object.entries(ESTILO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={carregar} disabled={carregando} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{carregando ? 'Atualizando...' : 'Atualizar'}</button>
      </div>

      {carregando && logs.length === 0 && <p style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Carregando...</p>}
      {!carregando && filtrados.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#aaa', fontSize: 14, background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>Nenhuma solicitação registrada{(busca || tipo || cliente) ? ' com esse filtro.' : ' nos últimos 30 dias.'}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtrados.map(l => {
          const e = ESTILO[l.tipo] || { cor: '#6b7280', bg: '#f3f4f6', label: l.tipo }
          // O que o cliente já RESOLVEU não pede correção — pede só ser encontrado.
          // Aprovação é óbvia; correção de legenda entra aqui porque o servidor
          // (api/decision) troca o texto e SEGUE a programação: o post já está no
          // Planner com a legenda nova. Oferecer "Abrir e corrigir" convidava a
          // desfazer, na mão, o ajuste que o cliente acabou de pedir.
          // Já tratado = o criativo saiu de "a refazer/reprovado" (refeito e reenviado,
          // agendado, publicado…): a solicitação não é mais uma pendência aberta, então
          // leva ao Planner (ver) em vez do editor (corrigir).
          const jaTratado = !!(l.postId && l.postStatus && !['corrigir', 'reprovado'].includes(l.postStatus))
          const resolvido = l.tipo === 'aprovacao' || l.tipo === 'corrigir_legenda' || jaTratado
          const acaoPost = resolvido ? onVerNoPlanner : onAbrirPost
          const abrivel = !!(l.postId && acaoPost) // solicitação de conteúdo não tem post
          const titulo = !abrivel ? undefined
            : l.tipo === 'corrigir_legenda' ? 'Ver no Planner — a legenda corrigida já está aplicada'
            : resolvido ? 'Ver o post no Planner'
            : 'Abrir o post no editor para corrigir e reenviar'
          const expansivel = !!(l.postId || l.motivo || l.resumo)
          const aberto = expandido === l.id
          const p = l.postId ? postCache[l.postId] : undefined
          const post = (p && p !== 'loading' && p !== 'erro') ? p as PostDet : null
          const anot = post?.anotacoes || []
          const mostrarPins = (l.tipo === 'ajuste_layout' || l.tipo === 'reprovacao') && anot.length > 0
          const obs = post ? (post.motivoReprovacao || '') : (l.motivo || '')
          const legenda = post ? (post.legenda || '') : (l.resumo || '')
          const mudancas = l.mudancas || []
          const mudouLegenda = mudancas.some(m => m.campo === 'Legenda')
          // Log gravado antes de 27/08 não tem o antes/depois: dizer isso é melhor
          // do que mostrar dois textos parecidos sem rótulo (a confusão original).
          const semHistorico = !mudancas.length && (l.tipo === 'ajuste_layout' || l.tipo === 'ajuste_copy' || l.tipo === 'corrigir_legenda')
          const imgsComPins = Array.from(new Set(anot.map(a => a.img ?? 0)))
          return (
            <div key={l.id} onClick={() => expansivel && toggleExpand(l)} title={aberto ? undefined : 'Clique para ler o pedido do cliente'}
              style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: aberto ? '1px solid #dbeafe' : '1px solid #f0f0f0', padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', cursor: expansivel ? 'pointer' : 'default' }}>
              <span style={{ flexShrink: 0, marginTop: 2, fontSize: 10.5, fontWeight: 800, color: e.cor, background: e.bg, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{e.label}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, color: '#111' }}><strong>{l.clienteNome}</strong> · {l.acao}</p>
                {l.resumo && <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#666', ...(aberto ? { whiteSpace: 'pre-wrap' } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }}>“{l.resumo}”</p>}
                {l.motivo && !aberto && <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.motivo}</p>}

                {aberto && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {p === 'loading' && <p style={{ margin: 0, fontSize: 12.5, color: '#aaa' }}>Carregando o material…</p>}

                    {obs && (
                      <div>
                        <p style={rotuloExp}>O que o cliente pediu</p>
                        <p style={{ margin: 0, fontSize: 13, color: '#111', whiteSpace: 'pre-wrap', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px' }}>{obs}</p>
                      </div>
                    )}

                    {mudancas.length > 0 && (
                      <div>
                        <p style={rotuloExp}>O que o cliente alterou ({mudancas.length})</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {mudancas.map((m, i) => (
                            <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                              <p style={{ margin: 0, padding: '5px 10px', fontSize: 11, fontWeight: 800, color: '#475569', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.campo}</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 240px', minWidth: 0, padding: '8px 10px', background: '#fef2f2', borderRight: '1px solid #fee2e2' }}>
                                  <p style={{ margin: '0 0 3px', fontSize: 10.5, fontWeight: 800, color: '#b91c1c' }}>ANTES</p>
                                  <p style={{ margin: 0, fontSize: 12.5, color: '#7f1d1d', whiteSpace: 'pre-wrap' }}>{m.antes || <span style={{ color: '#c4b5b5' }}>(vazio)</span>}</p>
                                </div>
                                <div style={{ flex: '1 1 240px', minWidth: 0, padding: '8px 10px', background: '#f0fdf4' }}>
                                  <p style={{ margin: '0 0 3px', fontSize: 10.5, fontWeight: 800, color: '#15803d' }}>DEPOIS (pedido do cliente)</p>
                                  <p style={{ margin: 0, fontSize: 12.5, color: '#14532d', whiteSpace: 'pre-wrap' }}>{m.depois || <span style={{ color: '#a7c4b0' }}>(vazio)</span>}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {mostrarPins && (
                      <div>
                        <p style={rotuloExp}>Pontos marcados no layout ({anot.length})</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          {imgsComPins.map(imgIdx => {
                            const src = post?.imagens?.[imgIdx]
                            if (!src) return null
                            return (
                              <div key={imgIdx} style={{ position: 'relative', width: 220, maxWidth: '100%', flexShrink: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid #eee', lineHeight: 0 }}>
                                <img src={src} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
                                {anot.filter(a => (a.img ?? 0) === imgIdx).map(a => (
                                  <span key={a.id ?? `${a.x}-${a.y}`} title={a.text} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-50%, -50%)', width: 22, height: 22, borderRadius: '50%', background: '#ffc00f', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', border: '2px solid #fff' }}>{anot.indexOf(a) + 1}</span>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                        <ol style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {anot.map((a, i) => <li key={a.id ?? i} style={{ fontSize: 12.5, color: '#333' }}>{a.text || <span style={{ color: '#aaa' }}>(sem texto — marca visual)</span>}</li>)}
                        </ol>
                      </div>
                    )}

                    {legenda && !mudouLegenda && (
                      <div>
                        <p style={rotuloExp}>Legenda atual do material</p>
                        <p style={{ margin: 0, fontSize: 13, color: '#333', whiteSpace: 'pre-wrap' }}>{legenda}</p>
                        {semHistorico && (
                          <p style={{ margin: '5px 0 0', fontSize: 11.5, color: '#94a3b8' }}>
                            Esta solicitação é anterior ao registro de alterações — o sistema não guardou como a legenda estava antes do pedido.
                          </p>
                        )}
                      </div>
                    )}

                    {p !== 'loading' && !obs && !mostrarPins && !legenda && !mudancas.length && (
                      <p style={{ margin: 0, fontSize: 12.5, color: '#aaa' }}>{p === 'erro' ? 'Não foi possível carregar o material.' : 'Sem detalhes de texto — abra no editor para ver o material.'}</p>
                    )}

                    {abrivel && (
                      <div>
                        <button onClick={ev => { ev.stopPropagation(); acaoPost!(l.postId!) }} title={titulo}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: resolvido ? '#f0fdf4' : '#eff6ff', color: resolvido ? e.cor : '#1d4ed8', border: `1px solid ${resolvido ? '#bbf7d0' : '#bfdbfe'}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {resolvido ? 'Ver no planner' : 'Abrir e corrigir'}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {(() => { const chip = chipStatusPost(l); return chip ? <span title="Onde o criativo está agora" style={{ fontSize: 10.5, fontWeight: 800, color: chip.cor, background: chip.bg, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>{chip.label}</span> : null })()}
                <span style={{ fontSize: 11.5, color: '#aaa', whiteSpace: 'nowrap' }} title={new Date(l.ts).toLocaleString('pt-BR')}>{haQuanto(l.ts)}</span>
                {abrivel && (
                  <span onClick={ev => { ev.stopPropagation(); acaoPost!(l.postId!) }} title={titulo}
                    style={{ fontSize: 11.5, fontWeight: 700, color: resolvido ? e.cor : '#1d4ed8', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    {resolvido ? 'Ver no planner' : 'Abrir e corrigir'}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

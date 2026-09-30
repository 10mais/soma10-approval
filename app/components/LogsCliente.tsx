'use client'
import { useEffect, useMemo, useState } from 'react'
import { apareceNoPlanner } from '@/lib/plannerFiltro'
import { pedidoDaEntrada, emRodadaDeAjuste, type VersaoNova } from '@/lib/rodadaAjuste'
import { aprovarEReenviar } from '@/lib/reenvioCliente'
import { toast } from '@/lib/toast'

type Cliente = { id: string; nome: string }
type Log = {
  id: string; ts: number; clienteId: string; clienteNome: string
  tipo: string; acao: string; postId?: string; resumo?: string; motivo?: string; origem?: string
  postStatus?: string; postEtapa?: string; postExiste?: boolean // status ATUAL do criativo
  postVersaoNova?: boolean // o designer entregou e a versão espera a revisão da equipe (lib/rodadaAjuste)
  mudancas?: { campo: string; antes: string; depois: string }[] // antes -> depois do pedido
}
type Anot = { x: number; y: number; text: string; id?: number; img?: number }
type PostDet = {
  id: string; clienteId?: string; status?: string; etapa?: string; dataAgendada?: string
  imagens?: string[]; legenda?: string; anotacoes?: Anot[]; motivoReprovacao?: string; ajusteCriativo?: string; formato?: string
  versaoNova?: VersaoNova; versoes?: any[]; rodada?: number
}

const ESTILO: Record<string, { cor: string; bg: string; label: string }> = {
  aprovacao: { cor: 'var(--v2-ok)', bg: 'var(--v2-ok-bg)', label: 'Aprovação' },
  ajuste_layout: { cor: '#ea580c', bg: '#fff7ed', label: 'Ajuste de layout' },
  ajuste_copy: { cor: 'var(--v2-amber)', bg: '#fefce8', label: 'Ajuste de copy' },
  reprovacao: { cor: 'var(--v2-hot)', bg: 'var(--v2-hot-bg)', label: 'Reprovação' },
  corrigir_legenda: { cor: 'var(--v2-info)', bg: 'var(--v2-info-bg)', label: 'Correção de legenda' },
  // Verde: o cliente mexeu só em legenda/data, o sistema aplicou e reprogramou —
  // não é pendência da equipe, é aviso do que já aconteceu.
  ajuste_aplicado: { cor: '#0f766e', bg: '#f0fdfa', label: 'Ajuste aplicado' },
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
  if (l.postExiste === false) return { label: 'Excluído', cor: 'var(--v2-ink3)', bg: 'var(--v2-surface2)' }
  const st = l.postStatus || '', et = l.postEtapa || ''
  if (st === 'excluido') return { label: 'Na lixeira', cor: 'var(--v2-ink3)', bg: 'var(--v2-surface2)' }
  if (st === 'aguardando_aprovacao' || et === 'aprovacao_copy' || et === 'aprovacao_criativo') return { label: 'Em revisão', cor: 'var(--v2-info)', bg: 'var(--v2-info-bg)' }
  if ((st === 'corrigir' || st === 'reprovado') && l.postVersaoNova) return { label: 'Nova versão para revisar', cor: 'var(--v2-info)', bg: 'var(--v2-info-bg)' }
  if (st === 'corrigir') return { label: 'A refazer', cor: 'var(--v2-amber)', bg: '#fff7ed' }
  if (st === 'reprovado') return { label: 'Reprovado', cor: 'var(--v2-hot)', bg: 'var(--v2-hot-bg)' }
  if (st === 'agendado' || st === 'aprovado') return { label: 'Agendado', cor: 'var(--v2-ok)', bg: 'var(--v2-ok-bg)' }
  if (st === 'publicado' || st === 'publicando') return { label: 'Publicado', cor: 'var(--v2-ok)', bg: 'var(--v2-ok-bg)' }
  if (st === 'rascunho') return { label: 'Em produção', cor: 'var(--v2-info)', bg: 'var(--v2-info-bg)' }
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
  // Mesa de ajustes (dono, 29/09): reenviar a versão nova e devolver ao designer, daqui mesmo.
  const [acaoEm, setAcaoEm] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<Record<string, string>>({}) // postId -> mensagem pronta do reenvio
  const [devolvendo, setDevolvendo] = useState<{ postId: string; texto: string } | null>(null)

  async function reenviar(post: PostDet) {
    setAcaoEm(post.id)
    const r = await aprovarEReenviar(post)
    setAcaoEm(null)
    if (!r.ok) { toast(r.erro || 'Não foi possível reenviar.', 'erro'); return }
    if (r.post) setPostCache(c => ({ ...c, [post.id]: r.post }))
    if (r.mensagem) setMensagens(m => ({ ...m, [post.id]: r.mensagem! }))
    toast(r.copiado ? 'Reenviado ao cliente. Mensagem copiada — cole no WhatsApp dele.' : (r.erro || 'Reenviado ao cliente. Copie a mensagem abaixo.'), 'sucesso')
    carregar()
  }

  async function devolverAoDesigner(post: PostDet, texto: string) {
    setAcaoEm(post.id)
    const r = await fetch('/api/esteira/aprovar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: post.id, acao: 'ajuste_interno', comentario: texto.trim() }) })
      .then(x => x.json()).catch(() => null)
    setAcaoEm(null)
    if (!r?.ok) { toast(r?.error || 'Não foi possível devolver ao designer.', 'erro'); return }
    setDevolvendo(null)
    toast(r.tarefaReaberta ? 'Devolvido ao designer: a tarefa foi reaberta com o seu pedido.' : 'Pedido registrado, mas esta peça não tem tarefa vinculada.', r.tarefaReaberta ? 'sucesso' : 'erro')
    fetch(`/api/posts?id=${post.id}`).then(x => x.ok ? x.json() : null).then(p => { if (p && !p.error) setPostCache(c => ({ ...c, [post.id]: p })) }).catch(() => {})
    carregar()
  }

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

  const inputS: React.CSSProperties = { padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }
  const rotuloExp: React.CSSProperties = { margin: '0 0 4px', fontSize: 11, fontWeight: 800, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.04em' }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--v2-ink)' }}>Solicitações do cliente</h2>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--v2-ink3)' }}>Histórico de tudo que o cliente aprovou, pediu ajuste, reprovou ou solicitou. Fica registrado por 30 dias — não some quando você edita.</p>
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
        <button onClick={carregar} disabled={carregando} style={{ padding: '9px 16px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{carregando ? 'Atualizando...' : 'Atualizar'}</button>
      </div>

      {carregando && logs.length === 0 && <p style={{ textAlign: 'center', padding: 40, color: 'var(--v2-ink3)' }}>Carregando...</p>}
      {!carregando && filtrados.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--v2-ink3)', fontSize: 14, background: 'var(--v2-surface)', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>Nenhuma solicitação registrada{(busca || tipo || cliente) ? ' com esse filtro.' : ' nos últimos 30 dias.'}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtrados.map(l => {
          const e = ESTILO[l.tipo] || { cor: 'var(--v2-ink3)', bg: 'var(--v2-surface2)', label: l.tipo }
          // O que o cliente já RESOLVEU não pede correção — pede só ser encontrado.
          // Aprovação é óbvia; correção de legenda entra aqui porque o servidor
          // (api/decision) troca o texto e SEGUE a programação: o post já está no
          // Planner com a legenda nova. Oferecer "Abrir e corrigir" convidava a
          // desfazer, na mão, o ajuste que o cliente acabou de pedir.
          // Já tratado = o criativo saiu de "a refazer/reprovado" (refeito e reenviado,
          // agendado, publicado…): a solicitação não é mais uma pendência aberta, então
          // leva ao Planner (ver) em vez do editor (corrigir).
          const jaTratado = !!(l.postId && l.postStatus && !['corrigir', 'reprovado'].includes(l.postStatus))
          const resolvido = l.tipo === 'aprovacao' || l.tipo === 'corrigir_legenda' || l.tipo === 'ajuste_aplicado' || jaTratado
          const acaoPost = resolvido ? onVerNoPlanner : onAbrirPost
          const abrivel = !!(l.postId && acaoPost) // solicitação de conteúdo não tem post
          // Pauta sem arte (briefing/copy/criativo) vive no STUDIO, não no Planner —
          // o rótulo tem que dizer para onde o clique leva de verdade.
          const noStudio = !!l.postId && l.postExiste !== false && !apareceNoPlanner({ status: l.postStatus, etapa: l.postEtapa })
          const rotuloAcao = noStudio ? 'Abrir no Studio' : resolvido ? 'Ver no planner' : 'Abrir e corrigir'
          const titulo = !abrivel ? undefined
            : noStudio ? 'Abrir a pauta no Studio — a copy é editada lá, antes da arte'
            : l.tipo === 'corrigir_legenda' ? 'Ver no Planner — a legenda corrigida já está aplicada'
            : resolvido ? 'Ver o post no Planner'
            : 'Abrir o post no editor para corrigir e reenviar'
          const expansivel = !!(l.postId || l.motivo || l.resumo)
          const aberto = expandido === l.id
          const p = l.postId ? postCache[l.postId] : undefined
          const post = (p && p !== 'loading' && p !== 'erro') ? p as PostDet : null
          // O pedido sobre a ARTE QUE O CLIENTE VIU (lib/rodadaAjuste.pedidoDaEntrada): rodada
          // já reenviada lê do histórico — antes os pinos velhos iam para cima da arte nova.
          // Lê também o pedido feito pelo portal (ajusteCriativo), que antes aparecia vazio.
          const ehPedidoDeArte = l.tipo === 'ajuste_layout' || l.tipo === 'reprovacao'
          const pedido = post && ehPedidoDeArte ? pedidoDaEntrada(l.ts, post) : null
          const anot = (pedido?.anotacoes || []) as Anot[]
          const mostrarPins = ehPedidoDeArte && anot.length > 0
          const obs = pedido ? (pedido.texto || l.motivo || '') : (l.motivo || '')
          const versaoPendente = post && post.versaoNova && emRodadaDeAjuste(post) && pedido && !pedido.encerrado ? post.versaoNova : null
          const legenda = post ? (post.legenda || '') : (l.resumo || '')
          const mudancas = l.mudancas || []
          const mudouLegenda = mudancas.some(m => m.campo === 'Legenda')
          // Log gravado antes de 27/08 não tem o antes/depois: dizer isso é melhor
          // do que mostrar dois textos parecidos sem rótulo (a confusão original).
          const semHistorico = !mudancas.length && (l.tipo === 'ajuste_layout' || l.tipo === 'ajuste_copy' || l.tipo === 'corrigir_legenda')
          const jaReprogramado = l.tipo === 'ajuste_aplicado'
          const imgsComPins = Array.from(new Set(anot.map(a => a.img ?? 0)))
          return (
            <div key={l.id} onClick={() => expansivel && toggleExpand(l)} title={aberto ? undefined : 'Clique para ler o pedido do cliente'}
              style={{ background: 'var(--v2-surface)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: aberto ? '1px solid var(--v2-info-bg)' : '1px solid var(--v2-surface2)', padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', cursor: expansivel ? 'pointer' : 'default' }}>
              <span style={{ flexShrink: 0, marginTop: 2, fontSize: 10.5, fontWeight: 800, color: e.cor, background: e.bg, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{e.label}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--v2-ink)' }}><strong>{l.clienteNome}</strong> · {l.acao}</p>
                {l.resumo && <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--v2-ink2)', ...(aberto ? { whiteSpace: 'pre-wrap' } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }}>“{l.resumo}”</p>}
                {l.motivo && !aberto && <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--v2-amber)', background: 'var(--v2-amber-bg)', border: '1px solid var(--v2-amber-bg)', borderRadius: 8, padding: '6px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.motivo}</p>}

                {aberto && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {p === 'loading' && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Carregando o material…</p>}

                    {obs && (
                      <div>
                        <p style={rotuloExp}>O que o cliente pediu</p>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink)', whiteSpace: 'pre-wrap', background: 'var(--v2-amber-bg)', border: '1px solid var(--v2-amber-bg)', borderRadius: 8, padding: '8px 10px' }}>{obs}</p>
                      </div>
                    )}

                    {jaReprogramado && (
                      <p style={{ margin: 0, fontSize: 12.5, color: '#0f766e', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '8px 10px' }}>
                        Aplicado automaticamente — o material já está com estes ajustes e reprogramado. Nada a refazer.
                      </p>
                    )}

                    {mudancas.length > 0 && (
                      <div>
                        <p style={rotuloExp}>O que o cliente alterou ({mudancas.length})</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {mudancas.map((m, i) => (
                            <div key={i} style={{ border: '1px solid var(--v2-rule)', borderRadius: 10, overflow: 'hidden' }}>
                              <p style={{ margin: 0, padding: '5px 10px', fontSize: 11, fontWeight: 800, color: 'var(--v2-ink2)', background: 'var(--v2-surface1)', borderBottom: '1px solid var(--v2-rule)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.campo}</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 240px', minWidth: 0, padding: '8px 10px', background: 'var(--v2-hot-bg)', borderRight: '1px solid var(--v2-hot-bg)' }}>
                                  <p style={{ margin: '0 0 3px', fontSize: 10.5, fontWeight: 800, color: 'var(--v2-hot)' }}>ANTES</p>
                                  <p style={{ margin: 0, fontSize: 12.5, color: '#7f1d1d', whiteSpace: 'pre-wrap' }}>{m.antes || <span style={{ color: '#c4b5b5' }}>(vazio)</span>}</p>
                                </div>
                                <div style={{ flex: '1 1 240px', minWidth: 0, padding: '8px 10px', background: 'var(--v2-ok-bg)' }}>
                                  <p style={{ margin: '0 0 3px', fontSize: 10.5, fontWeight: 800, color: 'var(--v2-ok)' }}>DEPOIS (pedido do cliente)</p>
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
                            const src = pedido?.imagens?.[imgIdx]
                            if (!src) return null
                            return (
                              <div key={imgIdx} style={{ position: 'relative', width: 220, maxWidth: '100%', flexShrink: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--v2-rule)', lineHeight: 0 }}>
                                <img src={src} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
                                {anot.filter(a => (a.img ?? 0) === imgIdx).map(a => (
                                  <span key={a.id ?? `${a.x}-${a.y}`} title={a.text} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-50%, -50%)', width: 22, height: 22, borderRadius: '50%', background: 'var(--v2-amber-on)', color: '#17150E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', border: '2px solid var(--v2-surface)' }}>{anot.indexOf(a) + 1}</span>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                        <ol style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {anot.map((a, i) => <li key={a.id ?? i} style={{ fontSize: 12.5, color: 'var(--v2-ink)' }}>{a.text || <span style={{ color: 'var(--v2-ink3)' }}>(sem texto — marca visual)</span>}</li>)}
                        </ol>
                      </div>
                    )}

                    {legenda && !mudouLegenda && (
                      <div>
                        <p style={rotuloExp}>Legenda atual do material</p>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink)', whiteSpace: 'pre-wrap' }}>{legenda}</p>
                        {semHistorico && (
                          <p style={{ margin: '5px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>
                            Esta solicitação é anterior ao registro de alterações — o sistema não guardou como a legenda estava antes do pedido.
                          </p>
                        )}
                      </div>
                    )}

                    {p !== 'loading' && !obs && !mostrarPins && !legenda && !mudancas.length && (
                      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>{p === 'erro' ? 'Não foi possível carregar o material.' : 'Sem detalhes de texto — abra no editor para ver o material.'}</p>
                    )}

                    {/* NOVA VERSÃO do designer esperando a revisão da equipe (lib/rodadaAjuste).
                        Aprovar e reenviar = revisão + reenvio num clique (decisão do dono, 29/09). */}
                    {versaoPendente && post && (
                      <div onClick={ev => ev.stopPropagation()} style={{ border: '1px solid #bfdbfe', background: 'var(--v2-info-bg)', borderRadius: 12, padding: 12, cursor: 'default' }}>
                        <p style={{ ...rotuloExp, color: 'var(--v2-info)' }}>Nova versão entregue{versaoPendente.por ? ` por ${versaoPendente.por}` : ''}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '6px 0 10px' }}>
                          {versaoPendente.imagens.map((u, i) => (
                            <a key={i} href={u} target="_blank" rel="noreferrer" style={{ lineHeight: 0, borderRadius: 9, overflow: 'hidden', border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)' }}>
                              {/\.(mp4|mov|m4v)(\?|$)/i.test(u)
                                ? <video src={u} style={{ width: 120, height: 120, objectFit: 'cover' }} muted />
                                : <img src={u} alt="" style={{ width: 120, height: 120, objectFit: 'cover' }} />}
                            </a>
                          ))}
                        </div>
                        {versaoPendente.completa ? (
                          <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--v2-ink2)' }}>O cliente ainda vê a versão anterior. Ao reenviar, esta entra no lugar e a anterior fica guardada no histórico.</p>
                        ) : (
                          <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--v2-amber)' }}>Entrega parcial: {versaoPendente.imagens.length} arquivo(s) para um carrossel de {(post.imagens || []).length} lâminas. Monte a sequência no editor e reenvie por lá.</p>
                        )}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {versaoPendente.completa && (
                            <button onClick={() => reenviar(post)} disabled={acaoEm === post.id}
                              style={{ padding: '9px 16px', background: 'var(--v2-ok)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 800, cursor: acaoEm === post.id ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                              {acaoEm === post.id ? 'Reenviando…' : 'Aprovar e reenviar ao cliente'}
                            </button>
                          )}
                          <button onClick={() => setDevolvendo(d => d?.postId === post.id ? null : { postId: post.id, texto: '' })} disabled={acaoEm === post.id}
                            style={{ padding: '9px 14px', background: 'var(--v2-surface)', color: 'var(--v2-hot)', border: '1px solid var(--v2-hot-bg)', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Pedir outro ajuste ao designer
                          </button>
                        </div>
                        {devolvendo?.postId === post.id && (
                          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <textarea value={devolvendo.texto} onChange={e => setDevolvendo({ postId: post.id, texto: e.target.value })} autoFocus
                              placeholder="O que ainda precisa mudar nesta versão?"
                              style={{ width: '100%', boxSizing: 'border-box', minHeight: 70, padding: '9px 11px', borderRadius: 9, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', background: 'var(--v2-surface)' }} />
                            <button onClick={() => devolverAoDesigner(post, devolvendo.texto)} disabled={!devolvendo.texto.trim() || acaoEm === post.id}
                              style={{ alignSelf: 'flex-start', padding: '8px 14px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: !devolvendo.texto.trim() ? 'not-allowed' : 'pointer', opacity: !devolvendo.texto.trim() ? 0.5 : 1, fontFamily: 'inherit' }}>
                              Devolver ao designer
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mensagem pronta do reenvio (link + o que mudou), para colar no WhatsApp do cliente. */}
                    {post && mensagens[post.id] && (
                      <div onClick={ev => ev.stopPropagation()} style={{ border: '1px solid var(--v2-ok-bg)', background: 'var(--v2-ok-bg)', borderRadius: 12, padding: 12, cursor: 'default' }}>
                        <p style={{ ...rotuloExp, color: 'var(--v2-ok)' }}>Mensagem para o cliente</p>
                        <pre style={{ margin: '6px 0 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 13, color: 'var(--v2-ink)' }}>{mensagens[post.id]}</pre>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button onClick={() => { navigator.clipboard?.writeText(mensagens[post.id]).then(() => toast('Mensagem copiada.', 'sucesso')).catch(() => toast('Não foi possível copiar. Selecione o texto e copie.', 'erro')) }}
                            style={{ padding: '8px 14px', background: 'var(--v2-surface)', color: 'var(--v2-ok)', border: '1px solid var(--v2-ok)', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Copiar de novo
                          </button>
                          {/* Abre o WhatsApp com o texto pronto; a pessoa escolhe o contato e envia (nada sai sozinho). */}
                          <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(mensagens[post.id])}`, '_blank', 'noopener')}
                            style={{ padding: '8px 14px', background: '#25d366', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Abrir no WhatsApp
                          </button>
                        </div>
                      </div>
                    )}

                    {abrivel && (
                      <div>
                        <button onClick={ev => { ev.stopPropagation(); acaoPost!(l.postId!) }} title={titulo}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: resolvido ? 'var(--v2-ok-bg)' : 'var(--v2-info-bg)', color: resolvido ? e.cor : 'var(--v2-info)', border: `1px solid ${resolvido ? 'var(--v2-ok-bg)' : '#bfdbfe'}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {rotuloAcao}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {(() => { const chip = chipStatusPost(l); return chip ? <span title="Onde o criativo está agora" style={{ fontSize: 10.5, fontWeight: 800, color: chip.cor, background: chip.bg, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>{chip.label}</span> : null })()}
                <span style={{ fontSize: 11.5, color: 'var(--v2-ink3)', whiteSpace: 'nowrap' }} title={new Date(l.ts).toLocaleString('pt-BR')}>{haQuanto(l.ts)}</span>
                {abrivel && (
                  <span onClick={ev => { ev.stopPropagation(); acaoPost!(l.postId!) }} title={titulo}
                    style={{ fontSize: 11.5, fontWeight: 700, color: resolvido ? e.cor : 'var(--v2-info)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    {rotuloAcao}
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

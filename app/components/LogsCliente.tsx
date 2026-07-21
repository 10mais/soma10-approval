'use client'
import { useEffect, useMemo, useState } from 'react'

type Cliente = { id: string; nome: string }
type Log = {
  id: string; ts: number; clienteId: string; clienteNome: string
  tipo: string; acao: string; postId?: string; resumo?: string; motivo?: string; origem?: string
}

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

export default function LogsCliente({ clientes = [], onAbrirPost, onVerNoPlanner }: { clientes?: Cliente[]; onAbrirPost?: (postId: string) => void; onVerNoPlanner?: (postId: string) => void }) {
  const [logs, setLogs] = useState<Log[]>([])
  const [carregando, setCarregando] = useState(true)
  const [cliente, setCliente] = useState('')
  const [tipo, setTipo] = useState('')
  const [busca, setBusca] = useState('')

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
          const resolvido = l.tipo === 'aprovacao' || l.tipo === 'corrigir_legenda'
          const acaoPost = resolvido ? onVerNoPlanner : onAbrirPost
          const abrivel = !!(l.postId && acaoPost) // solicitação de conteúdo não tem post
          const titulo = !abrivel ? undefined
            : l.tipo === 'corrigir_legenda' ? 'Ver no Planner — a legenda corrigida já está aplicada'
            : resolvido ? 'Ver o post no Planner'
            : 'Abrir o post no editor para corrigir e reenviar'
          return (
            <div key={l.id} onClick={() => abrivel && acaoPost!(l.postId!)} title={titulo}
              style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', cursor: abrivel ? 'pointer' : 'default' }}>
              <span style={{ flexShrink: 0, marginTop: 2, fontSize: 10.5, fontWeight: 800, color: e.cor, background: e.bg, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{e.label}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, color: '#111' }}><strong>{l.clienteNome}</strong> · {l.acao}</p>
                {l.resumo && <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{l.resumo}”</p>}
                {l.motivo && <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 10px', whiteSpace: 'pre-wrap' }}>{l.motivo}</p>}
              </div>
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span style={{ fontSize: 11.5, color: '#aaa', whiteSpace: 'nowrap' }} title={new Date(l.ts).toLocaleString('pt-BR')}>{haQuanto(l.ts)}</span>
                {abrivel && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: resolvido ? e.cor : '#1d4ed8', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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

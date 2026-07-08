'use client'
import { useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'

const fmtR$ = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const STAT_COR: Record<string, string> = { saudavel: '#16a34a', atencao: '#b45309', risco: '#b91c1c' }
const STAT_BG: Record<string, string> = { saudavel: '#f0fdf4', atencao: '#fffbeb', risco: '#fef2f2' }
const STAT_LABEL: Record<string, string> = { saudavel: 'Saudável', atencao: 'Atenção', risco: 'Risco' }
const npsCor = (n: number) => n <= 6 ? '#e24b4a' : n <= 8 ? '#efa927' : '#1d9e75'

function Kpi({ label, valor, cor = '#111', sub }: { label: string; valor: string; cor?: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 800, color: cor }}>{valor}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#aaa' }}>{sub}</p>}
    </div>
  )
}

export default function DashboardVendas() {
  const [d, setD] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [npsCliente, setNpsCliente] = useState('')
  const [npsPeriodo, setNpsPeriodo] = useState('mensal')
  const [npsLink, setNpsLink] = useState('')

  useEffect(() => {
    fetch('/api/dashboard-vendas').then(r => r.json()).then(x => setD(x && !x.error ? x : null)).finally(() => setCarregando(false))
  }, [])

  async function gerarLinkNps() {
    if (!npsCliente) return
    const r = await fetch('/api/nps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId: npsCliente, acao: 'link' }) }).then(x => x.json()).catch(() => null)
    if (r?.token) {
      const link = `${window.location.origin}/nps/${r.token}?p=${npsPeriodo}`
      setNpsLink(link)
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(() => toast('Link do NPS copiado!', 'sucesso')).catch(() => {})
    } else toast('Falha ao gerar link.', 'erro')
  }

  // Revoga o link de NPS atual (para de funcionar) e gera um novo.
  async function revogarLinkNps() {
    if (!npsCliente) return
    if (!(await confirmar('Revogar o link de NPS atual? O link que você já enviou vai PARAR de funcionar e um novo será gerado no lugar.', { titulo: 'Revogar link de NPS', okLabel: 'Revogar e gerar novo', perigo: true }))) return
    const r = await fetch('/api/nps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId: npsCliente, acao: 'link', rotacionar: true }) }).then(x => x.json()).catch(() => null)
    if (r?.token) {
      const link = `${window.location.origin}/nps/${r.token}?p=${npsPeriodo}`
      setNpsLink(link)
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).catch(() => {})
      toast('Link de NPS antigo revogado. Novo link gerado e copiado.', 'sucesso')
    } else toast('Não foi possível revogar o link.', 'erro')
  }

  if (carregando) return <p style={{ color: '#aaa' }}>Carregando...</p>
  if (!d) return <p style={{ color: '#aaa' }}>Sem dados ou acesso não autorizado.</p>
  const c = d.conversao, r = d.retencao
  const saude: any[] = d.saude || []
  const nps = d.nps || { score: null, total: 0, ultimos: [] }
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 } as const
  const card = { background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as const
  const sel: any = { padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', background: '#fff' }
  const secao: any = { margin: '0 0 10px', fontSize: 12.5, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.04em' }

  return (
    <div style={{ maxWidth: 1000 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#111' }}>Conversão & Retenção</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#999' }}>Visão de vendas (funil do CRM) e de retenção da carteira (renovações, churn e LTV).</p>

      {/* CONVERSÃO */}
      <p style={{ margin: '0 0 10px', fontSize: 12.5, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Conversão</p>
      <div style={{ ...grid, marginBottom: 14 }}>
        <Kpi label="Taxa de ganho" valor={`${c.winRate}%`} cor="#16a34a" sub="ganhos ÷ (ganhos+perdidos)" />
        <Kpi label="Ticket médio" valor={fmtR$(c.ticketMedio)} sub="média dos negócios ganhos" />
        <Kpi label="Em aberto" valor={fmtR$(c.emAbertoValor)} cor="#1d4ed8" sub={`${c.emAbertoQtd} oportunidade(s)`} />
        <Kpi label="Ganhos no mês" valor={fmtR$(c.ganhosMesValor)} cor="#16a34a" sub={`${c.ganhosMesQtd} negócio(s)`} />
      </div>
      {c.porVendedor.length > 0 && (
        <div style={{ ...card, marginBottom: 26 }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: '#111' }}>Pipeline por vendedor</p>
          {(() => {
            const max = Math.max(1, ...c.porVendedor.map((v: any) => v.abertoValor + v.ganhoValor))
            return c.porVendedor.map((v: any) => (
              <div key={v.nome} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: '#333' }}>{v.nome}</span>
                  <span style={{ color: '#888' }}>{fmtR$(v.ganhoValor)} ganho · {fmtR$(v.abertoValor)} aberto</span>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: '#f0f0f0', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${(v.ganhoValor / max) * 100}%`, background: '#16a34a' }} />
                  <div style={{ width: `${(v.abertoValor / max) * 100}%`, background: '#93c5fd' }} />
                </div>
              </div>
            ))
          })()}
        </div>
      )}

      {/* RETENÇÃO */}
      <p style={{ margin: '0 0 10px', fontSize: 12.5, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Retenção</p>
      <div style={{ ...grid, marginBottom: 14 }}>
        <Kpi label="Clientes ativos" valor={String(r.clientesAtivos)} />
        <Kpi label="MRR (recorrente)" valor={fmtR$(r.mrr)} cor="#16a34a" sub="soma dos contratos mensais" />
        <Kpi label="LTV médio" valor={fmtR$(r.ltvMedio)} sub="valor já gerado por cliente" />
        <Kpi label="Risco de churn" valor={String(r.churn.length)} cor={r.churn.length ? '#b91c1c' : '#16a34a'} sub="clientes inativos ≥ 21 dias" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        {/* Renovações */}
        <div style={card}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: '#111' }}>Renovações (próximos 45 dias)</p>
          {r.renovacoes.length === 0 ? <p style={{ margin: 0, fontSize: 12.5, color: '#aaa' }}>Nenhuma renovação próxima.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.renovacoes.map((x: any) => (
                <div key={x.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: '#fafafa', borderRadius: 9 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.nome}</span>
                  <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>{fmtR$(x.valor)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: x.faltam <= 7 ? '#b91c1c' : '#92400e', background: x.faltam <= 7 ? '#fee2e2' : '#fef3c7', borderRadius: 999, padding: '2px 8px' }}>{x.faltam === 0 ? 'hoje' : `${x.faltam}d`}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Churn */}
        <div style={card}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: '#111' }}>Risco de churn (inatividade)</p>
          {r.churn.length === 0 ? <p style={{ margin: 0, fontSize: 12.5, color: '#aaa' }}>Nenhum cliente inativo. 🎉</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.churn.map((x: any) => (
                <div key={x.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: '#fef2f2', borderRadius: 9 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.nome}</span>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#b91c1c', background: '#fee2e2', borderRadius: 999, padding: '2px 8px' }}>{x.semAtividade ? 'sem posts' : `${x.diasInativo}d sem post`}</span>
                </div>
              ))}
            </div>
          )}
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#bbb' }}>Baseado no último post agendado/publicado de cada cliente.</p>
        </div>
      </div>

      {/* SAÚDE DOS CLIENTES */}
      <p style={{ ...secao, marginTop: 26 }}>Saúde dos clientes</p>
      <div style={{ ...grid, marginBottom: 14 }}>
        <Kpi label="Saudáveis" valor={String(saude.filter(s => s.status === 'saudavel').length)} cor="#16a34a" />
        <Kpi label="Atenção" valor={String(saude.filter(s => s.status === 'atencao').length)} cor="#b45309" />
        <Kpi label="Risco" valor={String(saude.filter(s => s.status === 'risco').length)} cor="#b91c1c" />
        <Kpi label="NPS geral" valor={nps.score === null ? '—' : String(nps.score)} cor={nps.score === null ? '#111' : npsCor(nps.score >= 0 ? 9 : 5)} sub={`${nps.total} resposta(s)`} />
      </div>
      <div style={{ ...card, marginBottom: 26 }}>
        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: '#111' }}>Todos os clientes</p>
        {saude.length === 0 ? <p style={{ margin: 0, fontSize: 12.5, color: '#aaa' }}>Nenhum cliente ativo.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {saude.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: STAT_BG[s.status], borderRadius: 9 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAT_COR[s.status], flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nome}</span>
                {s.nps !== null && <span style={{ fontSize: 11, fontWeight: 700, color: '#555', background: '#fff', borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>NPS {s.nps}</span>}
                <span style={{ fontSize: 11, color: '#888', flexShrink: 0, display: 'none' }} className="saude-motivo">{s.motivos.join(' · ')}</span>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: STAT_COR[s.status], textTransform: 'uppercase', flexShrink: 0 }}>{STAT_LABEL[s.status]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NPS */}
      <p style={secao}>NPS (satisfação)</p>
      <div style={{ ...card, marginBottom: 14 }}>
        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: '#111' }}>Criar pesquisa de NPS</p>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#999' }}>Gere um link para o cliente avaliar de 0 a 10. Envie mensal ou trimestralmente.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={npsCliente} onChange={e => { setNpsCliente(e.target.value); setNpsLink('') }} style={sel}>
            <option value="">Escolher cliente…</option>
            {saude.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <select value={npsPeriodo} onChange={e => setNpsPeriodo(e.target.value)} style={sel}>
            <option value="mensal">Mensal</option>
            <option value="trimestral">Trimestral</option>
          </select>
          <button onClick={gerarLinkNps} disabled={!npsCliente} style={{ padding: '10px 18px', background: npsCliente ? '#111' : '#f0f0f0', color: npsCliente ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: npsCliente ? 'pointer' : 'default' }}>Gerar link</button>
          <button onClick={revogarLinkNps} disabled={!npsCliente} title="Revoga o link de NPS atual (para de funcionar) e gera um novo" style={{ padding: '10px 16px', background: '#fff', color: npsCliente ? '#b91c1c' : '#ccc', border: `1.5px solid ${npsCliente ? '#fecaca' : '#eee'}`, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: npsCliente ? 'pointer' : 'default' }}>Revogar</button>
        </div>
        {npsLink && <p style={{ margin: '12px 0 0', fontSize: 12.5, color: '#16a34a', wordBreak: 'break-all' }}>Link copiado — envie ao cliente: <a href={npsLink} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8' }}>{npsLink}</a></p>}
      </div>
      {nps.ultimos.length > 0 && (
        <div style={card}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: '#111' }}>Últimas respostas</p>
          {nps.ultimos.map((x: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < nps.ultimos.length - 1 ? '1px solid #f4f4f5' : 'none' }}>
              <span style={{ width: 36, height: 36, borderRadius: 9, background: npsCor(x.score), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{x.score}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#111' }}>{x.nome || 'Cliente'}</p>
                {x.comentario && <p style={{ margin: 0, fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.comentario}</p>}
              </div>
              <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0 }}>{new Date(x.criadoEm).toLocaleDateString('pt-BR')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

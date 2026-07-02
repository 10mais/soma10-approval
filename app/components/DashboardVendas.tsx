'use client'
import { useEffect, useState } from 'react'

const fmtR$ = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

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

  useEffect(() => {
    fetch('/api/dashboard-vendas').then(r => r.json()).then(x => setD(x && !x.error ? x : null)).finally(() => setCarregando(false))
  }, [])

  if (carregando) return <p style={{ color: '#aaa' }}>Carregando...</p>
  if (!d) return <p style={{ color: '#aaa' }}>Sem dados ou acesso não autorizado.</p>
  const c = d.conversao, r = d.retencao
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 } as const
  const card = { background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as const

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
    </div>
  )
}

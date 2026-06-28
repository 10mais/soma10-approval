'use client'
import { useEffect, useMemo, useState } from 'react'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string; tipo?: string; contratoValor?: number }
type Usuario = { email: string; nome: string; custoHora?: number }

function brl(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtH(min: number) { return `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}` }

export default function Rentabilidade({ clientes, usuarios }: { clientes: Cliente[]; usuarios: Usuario[] }) {
  const [tarefas, setTarefas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const hoje = new Date()
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`) // '' = tudo

  useEffect(() => {
    fetch('/api/tarefas').then(r => r.json()).then(d => { setTarefas(Array.isArray(d) ? d : []); setCarregando(false) }).catch(() => setCarregando(false))
  }, [])

  const custoHora = useMemo(() => {
    const m: Record<string, number> = {}
    for (const u of usuarios) m[u.email] = Number(u.custoHora) || 0
    return m
  }, [usuarios])

  // Agrega minutos e custo por cliente e por profissional, filtrando pelo mes
  const { porCliente, porProf, totalMin, totalCusto } = useMemo(() => {
    const porCliente: Record<string, { min: number; custo: number }> = {}
    const porProf: Record<string, { nome: string; min: number; custo: number }> = {}
    let totalMin = 0, totalCusto = 0
    for (const t of tarefas) {
      for (const a of (t.apontamentos || [])) {
        if (mes) { const d = new Date(a.data); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (k !== mes) continue }
        const min = Number(a.minutos) || 0
        const custo = (min / 60) * (custoHora[a.usuarioEmail] || 0)
        const cid = t.clienteId || 'sem_cliente'
        porCliente[cid] = porCliente[cid] || { min: 0, custo: 0 }
        porCliente[cid].min += min; porCliente[cid].custo += custo
        porProf[a.usuarioEmail] = porProf[a.usuarioEmail] || { nome: a.usuarioNome || a.usuarioEmail, min: 0, custo: 0 }
        porProf[a.usuarioEmail].min += min; porProf[a.usuarioEmail].custo += custo
        totalMin += min; totalCusto += custo
      }
    }
    return { porCliente, porProf, totalMin, totalCusto }
  }, [tarefas, custoHora, mes])

  const linhas = useMemo(() => {
    return clientes
      .filter(c => c.tipo !== 'interno')
      .map(c => {
        const ag = porCliente[c.id] || { min: 0, custo: 0 }
        const receita = Number(c.contratoValor) || 0
        const margem = receita - ag.custo
        return { c, min: ag.min, custo: ag.custo, receita, margem, pct: receita > 0 ? (margem / receita) * 100 : null }
      })
      .sort((a, b) => a.margem - b.margem) // pior margem primeiro
  }, [clientes, porCliente])

  const receitaTotal = linhas.reduce((s, l) => s + l.receita, 0)
  const margemTotal = receitaTotal - totalCusto

  // ultimos 6 meses como opcoes
  const opcoesMes = useMemo(() => {
    const arr: { v: string; label: string }[] = [{ v: '', label: 'Tudo' }]
    for (let i = 0; i < 6; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      arr.push({ v: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) })
    }
    return arr
  }, [])

  const card = { background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Rentabilidade</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Horas, custo e margem por cliente e por profissional. Baseado nos apontamentos das tarefas e no custo/hora dos colaboradores.</p>
        </div>
        <select value={mes} onChange={e => setMes(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
          {opcoesMes.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      </div>

      {carregando ? <p style={{ color: '#aaa' }}>Carregando...</p> : (
        <>
          {/* Resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
            <div style={card}><p style={{ margin: 0, fontSize: 12, color: '#888' }}>Horas trabalhadas</p><p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#111' }}>{fmtH(totalMin)}</p></div>
            <div style={card}><p style={{ margin: 0, fontSize: 12, color: '#888' }}>Custo de produção</p><p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{brl(totalCusto)}</p></div>
            <div style={card}><p style={{ margin: 0, fontSize: 12, color: '#888' }}>Receita (contratos)</p><p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#111' }}>{brl(receitaTotal)}</p></div>
            <div style={card}><p style={{ margin: 0, fontSize: 12, color: '#888' }}>Margem</p><p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: margemTotal >= 0 ? '#16a34a' : '#dc2626' }}>{brl(margemTotal)}</p></div>
          </div>

          {/* Por cliente */}
          <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', fontSize: 13, fontWeight: 700, color: '#111' }}>Por cliente</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafafa', color: '#888', fontSize: 11, textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '10px 18px', fontWeight: 700 }}>Cliente</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>Horas</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>Custo</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>Receita</th>
                    <th style={{ textAlign: 'right', padding: '10px 18px', fontWeight: 700 }}>Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l => (
                    <tr key={l.c.id} style={{ borderTop: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '10px 18px', fontWeight: 600, color: '#111' }}>{l.c.nome}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555' }}>{fmtH(l.min)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555' }}>{brl(l.custo)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555' }}>{l.receita > 0 ? brl(l.receita) : <span style={{ color: '#ccc' }}>—</span>}</td>
                      <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 800, color: l.receita === 0 ? '#bbb' : l.margem >= 0 ? '#16a34a' : '#dc2626' }}>
                        {l.receita > 0 ? brl(l.margem) : '—'}{l.pct !== null && <span style={{ fontSize: 11, fontWeight: 600, color: '#aaa' }}> ({Math.round(l.pct)}%)</span>}
                      </td>
                    </tr>
                  ))}
                  {linhas.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#bbb' }}>Sem dados no período.</td></tr>}
                </tbody>
              </table>
            </div>
            <p style={{ margin: 0, padding: '10px 18px', fontSize: 11, color: '#bbb', borderTop: '1px solid #f5f5f5' }}>Receita = valor do contrato do cliente. Defina-a em Clientes e o custo/hora em Colaboradores.</p>
          </div>

          {/* Por profissional */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', fontSize: 13, fontWeight: 700, color: '#111' }}>Por profissional</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafafa', color: '#888', fontSize: 11, textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '10px 18px', fontWeight: 700 }}>Profissional</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>Horas</th>
                    <th style={{ textAlign: 'right', padding: '10px 18px', fontWeight: 700 }}>Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(porProf).sort((a, b) => b.min - a.min).map((p, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '10px 18px', fontWeight: 600, color: '#111' }}>{p.nome}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555' }}>{fmtH(p.min)}</td>
                      <td style={{ padding: '10px 18px', textAlign: 'right', color: '#555' }}>{brl(p.custo)}</td>
                    </tr>
                  ))}
                  {Object.keys(porProf).length === 0 && <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: '#bbb' }}>Sem apontamentos no período.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

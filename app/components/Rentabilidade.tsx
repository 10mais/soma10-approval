'use client'
import { useEffect, useMemo, useState } from 'react'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string; tipo?: string; contratoValor?: number; receitasAvulsas?: { id: string; mes: string; valor: number; descricao?: string }[] }
type Usuario = { email: string; nome: string; role?: string; custoHora?: number; salarioFixo?: number; salarioVariavel?: number }
type Despesa = { id: string; descricao: string; valor: number; tipo: 'fixo' | 'variavel'; categoria?: string; mes: string }

function brl(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtH(min: number) { return `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}` }

export default function Rentabilidade({ clientes, usuarios }: { clientes: Cliente[]; usuarios: Usuario[] }) {
  const [tarefas, setTarefas] = useState<any[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [contas, setContas] = useState<{ id: string; nome: string; saldo: number; atualizadoEm?: string }[]>([])
  const [gerenciarContas, setGerenciarContas] = useState(false)
  const [salvandoContas, setSalvandoContas] = useState(false)
  const [carregando, setCarregando] = useState(true)
  // #1 — ocultar/mostrar informacoes financeiras (privacidade; persistido)
  const [ocultar, setOcultar] = useState(false)
  useEffect(() => { try { setOcultar(localStorage.getItem('rent_ocultar') === '1') } catch {} }, [])
  function toggleOcultar() { setOcultar(v => { const n = !v; try { localStorage.setItem('rent_ocultar', n ? '1' : '0') } catch {} return n }) }
  const hoje = new Date()
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`)

  // form de despesa
  const [dDesc, setDDesc] = useState('')
  const [dValor, setDValor] = useState('')
  const [dTipo, setDTipo] = useState<'fixo' | 'variavel'>('fixo')
  const [dRecorrente, setDRecorrente] = useState(false)
  const [dRecModo, setDRecModo] = useState<'n' | 'ate'>('n')
  const [dRecN, setDRecN] = useState('12')
  const [dRecAte, setDRecAte] = useState('')
  const [salvandoD, setSalvandoD] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/tarefas').then(r => r.json()).catch(() => []),
      fetch('/api/despesas').then(r => r.json()).catch(() => []),
      fetch('/api/financeiro/contas').then(r => r.json()).catch(() => []),
    ]).then(([t, d, ct]) => { setTarefas(Array.isArray(t) ? t : []); setDespesas(Array.isArray(d) ? d : []); setContas(Array.isArray(ct) ? ct : []); setCarregando(false) })
  }, [])

  function mesesRecorrentes(inicio: string): string[] {
    const [y, m] = inicio.split('-').map(Number)
    const arr: string[] = []
    let cur = new Date(y, m - 1, 1)
    if (dRecModo === 'ate' && /^\d{4}-\d{2}$/.test(dRecAte)) {
      const [fy, fm] = dRecAte.split('-').map(Number); const fim = new Date(fy, fm - 1, 1)
      while (cur <= fim && arr.length < 60) { arr.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`); cur.setMonth(cur.getMonth() + 1) }
    } else {
      const qt = Math.max(1, Math.min(60, Number(dRecN) || 1))
      for (let i = 0; i < qt; i++) { arr.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`); cur.setMonth(cur.getMonth() + 1) }
    }
    return arr
  }
  async function addDespesa() {
    if (!dDesc.trim() || !(Number(dValor) > 0) || salvandoD) return
    setSalvandoD(true)
    const inicio = mes || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
    const meses = dRecorrente ? mesesRecorrentes(inicio) : [inicio]
    const r = await fetch('/api/despesas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ descricao: dDesc.trim(), valor: Number(dValor), tipo: dTipo, meses }) }).then(x => x.json()).catch(() => null)
    setSalvandoD(false)
    if (r?.despesas) { setDespesas(d => [...r.despesas, ...d]); setDDesc(''); setDValor(''); setDRecorrente(false) }
  }
  async function delDespesa(id: string) {
    await fetch(`/api/despesas?id=${id}`, { method: 'DELETE' }).catch(() => {})
    setDespesas(d => d.filter(x => x.id !== id))
  }

  const custoHora = useMemo(() => { const m: Record<string, number> = {}; for (const u of usuarios) m[u.email] = Number(u.custoHora) || 0; return m }, [usuarios])

  // Custo operacional por cliente/profissional (via apontamentos x custo/hora)
  const { porCliente, porProf, totalMin, totalCustoOp } = useMemo(() => {
    const porCliente: Record<string, { min: number; custo: number }> = {}
    const porProf: Record<string, { nome: string; min: number; custo: number }> = {}
    let totalMin = 0, totalCustoOp = 0
    for (const t of tarefas) for (const a of (t.apontamentos || [])) {
      if (mes) { const d = new Date(a.data); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (k !== mes) continue }
      const min = Number(a.minutos) || 0
      const custo = (min / 60) * (custoHora[a.usuarioEmail] || 0)
      const cid = t.clienteId || 'sem_cliente'
      porCliente[cid] = porCliente[cid] || { min: 0, custo: 0 }; porCliente[cid].min += min; porCliente[cid].custo += custo
      porProf[a.usuarioEmail] = porProf[a.usuarioEmail] || { nome: a.usuarioNome || a.usuarioEmail, min: 0, custo: 0 }; porProf[a.usuarioEmail].min += min; porProf[a.usuarioEmail].custo += custo
      totalMin += min; totalCustoOp += custo
    }
    return { porCliente, porProf, totalMin, totalCustoOp }
  }, [tarefas, custoHora, mes])

  const linhasCliente = useMemo(() => clientes.filter(c => c.tipo !== 'interno').map(c => {
    const ag = porCliente[c.id] || { min: 0, custo: 0 }
    const avulsas = (c.receitasAvulsas || []).filter(r => !mes || r.mes === mes).reduce((s, r) => s + (Number(r.valor) || 0), 0)
    const receita = (Number(c.contratoValor) || 0) + avulsas
    const margem = receita - ag.custo
    return { c, min: ag.min, custo: ag.custo, receita, margem, pct: receita > 0 ? (margem / receita) * 100 : null }
  }).sort((a, b) => a.margem - b.margem), [clientes, porCliente, mes])

  // Equipe (folha) — exclui clientes
  const equipe = usuarios.filter(u => u.role !== 'cliente')
  const folhaFixa = equipe.reduce((s, u) => s + (Number(u.salarioFixo) || 0), 0)
  const folhaVar = equipe.reduce((s, u) => s + (Number(u.salarioVariavel) || 0), 0)
  const folha = folhaFixa + folhaVar

  // Despesas do mes selecionado (ou todas se 'Tudo')
  const despesasMes = despesas.filter(d => !mes || d.mes === mes)
  const despFixas = despesasMes.filter(d => d.tipo === 'fixo').reduce((s, d) => s + (Number(d.valor) || 0), 0)
  const despVar = despesasMes.filter(d => d.tipo === 'variavel').reduce((s, d) => s + (Number(d.valor) || 0), 0)
  const despesasTotal = despFixas + despVar

  const receitaTotal = linhasCliente.reduce((s, l) => s + l.receita, 0)
  const lucro = receitaTotal - folha - despesasTotal
  const margemPct = receitaTotal > 0 ? (lucro / receitaTotal) * 100 : null

  // Saúde do Caixa — capacidade de arcar com a despesa operacional por 60 dias (open doors)
  // = saldo das contas ÷ reserva p/ 60 dias (= 2 × despesa operacional mensal). 100% = cobre 2 meses.
  const saldoContas = contas.reduce((s, c) => s + (Number(c.saldo) || 0), 0)
  const mesesUlt2 = useMemo(() => [1, 2].map(i => { const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }), [])
  const despMediaMensal = useMemo(() => {
    const soma = mesesUlt2.reduce((acc, m) => acc + despesas.filter(d => d.mes === m).reduce((s, d) => s + (Number(d.valor) || 0), 0), 0)
    return soma / 2
  }, [despesas, mesesUlt2])
  const despOpMensal = folha + despMediaMensal // despesa operacional mensal (folha + despesas)
  const reserva60 = despOpMensal * 2
  const saudeCaixa = reserva60 > 0 ? (saldoContas / reserva60) * 100 : null
  const corSaude = saudeCaixa === null ? '#999' : saudeCaixa >= 80 ? '#16a34a' : saudeCaixa >= 50 ? '#f59e0b' : '#dc2626'

  async function salvarContas(lista: typeof contas) {
    setSalvandoContas(true)
    const r = await fetch('/api/financeiro/contas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contas: lista }) }).then(x => x.json()).catch(() => null)
    setSalvandoContas(false)
    if (r?.contas) setContas(r.contas)
  }

  const opcoesMes = useMemo(() => {
    const arr: { v: string; label: string }[] = [{ v: '', label: 'Tudo' }]
    for (let i = 0; i < 6; i++) { const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1); arr.push({ v: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }) }
    return arr
  }, [])

  const card: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 18px', fontWeight: 700 }
  const thr: React.CSSProperties = { textAlign: 'right', padding: '10px 12px', fontWeight: 700 }

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Rentabilidade</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Resultado financeiro: receita dos contratos menos folha (fixo + variável) e despesas.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={toggleOcultar} title={ocultar ? 'Mostrar valores' : 'Ocultar valores'} aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 10, border: '1.5px solid #e0e0e0', background: '#fff', color: '#555', cursor: 'pointer' }}>
            {ocultar ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><path d="M1 1l22 22" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
          </button>
          <select value={mes} onChange={e => setMes(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
            {opcoesMes.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {carregando ? <p style={{ color: '#aaa' }}>Carregando...</p> : (
        <div style={{ filter: ocultar ? 'blur(7px)' : 'none', pointerEvents: ocultar ? 'none' : 'auto', userSelect: ocultar ? 'none' : 'auto', transition: 'filter .18s' }}>
          {/* DRE — Resultado do mes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
            <div style={card}><p style={{ margin: 0, fontSize: 12, color: '#888' }}>Receita (contratos)</p><p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#111' }}>{brl(receitaTotal)}</p></div>
            <div style={card}><p style={{ margin: 0, fontSize: 12, color: '#888' }}>Folha (fixo + variável)</p><p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{brl(folha)}</p></div>
            <div style={card}><p style={{ margin: 0, fontSize: 12, color: '#888' }}>Despesas</p><p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{brl(despesasTotal)}</p></div>
            <div style={{ ...card, background: lucro >= 0 ? '#f0fdf4' : '#fef2f2' }}><p style={{ margin: 0, fontSize: 12, color: '#888' }}>Lucro</p><p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: lucro >= 0 ? '#16a34a' : '#dc2626' }}>{brl(lucro)}{margemPct !== null && <span style={{ fontSize: 12, fontWeight: 700, color: '#999' }}> ({Math.round(margemPct)}%)</span>}</p></div>
          </div>

          {/* Saúde do Caixa — termômetro (open doors 60 dias) */}
          <div style={{ ...card, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              {/* Termômetro */}
              <div style={{ position: 'relative', width: 30, height: 156, flexShrink: 0 }}>
                <div style={{ position: 'absolute', left: 9, top: 0, width: 12, height: 130, background: '#eee', borderRadius: 6 }} />
                <div style={{ position: 'absolute', left: 9, bottom: 22, width: 12, height: Math.max(2, Math.min(100, saudeCaixa ?? 0) / 100 * 122), background: corSaude, borderRadius: 6, transition: 'height .3s' }} />
                <div style={{ position: 'absolute', left: 3, bottom: 0, width: 24, height: 24, borderRadius: '50%', background: corSaude, border: '3px solid #fff', boxShadow: '0 0 0 1px #eee' }} />
              </div>
              {/* Indicador */}
              <div style={{ flex: 1, minWidth: 180 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#555' }}>Saúde do Caixa</p>
                <p style={{ margin: '2px 0 0', fontSize: 34, fontWeight: 800, color: corSaude, lineHeight: 1.1 }}>{saudeCaixa === null ? '—' : `${Math.round(saudeCaixa)}%`}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>
                  {saudeCaixa === null ? 'Cadastre contas e despesas para calcular.' : `Cobre ~${Math.round(Math.min(saudeCaixa, 999) / 100 * 60)} dias de operação sem nenhuma receita. Meta: 60 dias (100%).`}
                </p>
              </div>
              {/* Composição */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: '#666', minWidth: 200 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>Saldo em contas <strong style={{ color: '#111' }}>{brl(saldoContas)}</strong></span>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>Despesa op. mensal <strong style={{ color: '#dc2626' }}>{brl(despOpMensal)}</strong></span>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>Reserva p/ 60 dias <strong style={{ color: '#111' }}>{brl(reserva60)}</strong></span>
                <button onClick={() => setGerenciarContas(v => !v)} style={{ alignSelf: 'flex-start', marginTop: 2, background: 'none', border: 'none', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>{gerenciarContas ? 'Fechar' : 'Gerenciar contas bancárias'}</button>
              </div>
            </div>
            {gerenciarContas && (
              <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 14, paddingTop: 14 }}>
                <p style={{ margin: '0 0 8px', fontSize: 11.5, color: '#888' }}>Saldo atual de cada conta (atualize manualmente). A soma alimenta a Saúde do Caixa.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {contas.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input value={c.nome} onChange={e => setContas(cs => cs.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} placeholder="Conta (ex.: Itaú PJ)" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                      <input type="number" value={c.saldo || ''} onChange={e => setContas(cs => cs.map((x, j) => j === i ? { ...x, saldo: Number(e.target.value) || 0 } : x))} placeholder="Saldo R$" style={{ width: 130, padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                      <button onClick={() => setContas(cs => cs.filter((_, j) => j !== i))} title="Remover" style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16, padding: 4 }}>×</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => setContas(cs => [...cs, { id: '', nome: '', saldo: 0 }])} style={{ padding: '8px 14px', background: '#f5f5f5', color: '#444', border: '1px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>+ Conta</button>
                  <button onClick={() => salvarContas(contas)} disabled={salvandoContas} style={{ padding: '8px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{salvandoContas ? 'Salvando...' : 'Salvar contas'}</button>
                </div>
              </div>
            )}
          </div>

          {/* Despesas */}
          <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', fontSize: 13, fontWeight: 700, color: '#111' }}>Despesas {mes && `· ${opcoesMes.find(o => o.v === mes)?.label}`}</div>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={dDesc} onChange={e => setDDesc(e.target.value)} placeholder="Descrição (ex.: Aluguel, Ads, Software)" style={{ flex: 1, minWidth: 180, padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                <input type="number" min="0" value={dValor} onChange={e => setDValor(e.target.value)} placeholder="Valor R$" style={{ width: 110, padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                <select value={dTipo} onChange={e => setDTipo(e.target.value as any)} style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                  <option value="fixo">Fixa</option>
                  <option value="variavel">Variável</option>
                </select>
                <select value={dRecorrente ? 'rec' : 'uni'} onChange={e => setDRecorrente(e.target.value === 'rec')} style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                  <option value="uni">Pagamento único</option>
                  <option value="rec">Recorrente</option>
                </select>
                <button onClick={addDespesa} disabled={salvandoD || !dDesc.trim() || !(Number(dValor) > 0)} style={{ padding: '9px 16px', background: (dDesc.trim() && Number(dValor) > 0) ? '#111' : '#f0f0f0', color: (dDesc.trim() && Number(dValor) > 0) ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Adicionar</button>
              </div>
              {dRecorrente && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: '#888' }}>
                  <span>Começa em <strong style={{ color: '#111' }}>{mes || 'mês atual'}</strong> e repete por:</span>
                  <select value={dRecModo} onChange={e => setDRecModo(e.target.value as any)} style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
                    <option value="n">Nº de meses</option>
                    <option value="ate">Até o mês (vencimento)</option>
                  </select>
                  {dRecModo === 'n'
                    ? <input type="number" min="1" max="60" value={dRecN} onChange={e => setDRecN(e.target.value)} style={{ width: 70, padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
                    : <input type="month" value={dRecAte} onChange={e => setDRecAte(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />}
                  <span style={{ color: '#bbb' }}>Cria um lançamento em cada mês.</span>
                </div>
              )}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {despesasMes.map(d => (
                    <tr key={d.id} style={{ borderTop: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '10px 18px', color: '#111' }}>{d.descricao}</td>
                      <td style={{ padding: '10px 12px', color: '#888' }}><span style={{ fontSize: 11, fontWeight: 700, color: d.tipo === 'fixo' ? '#0891b2' : '#ca8a04', background: d.tipo === 'fixo' ? '#ecfeff' : '#fefce8', borderRadius: 999, padding: '2px 8px' }}>{d.tipo === 'fixo' ? 'Fixa' : 'Variável'}</span></td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555', fontWeight: 600 }}>{brl(d.valor)}</td>
                      <td style={{ padding: '10px 18px', textAlign: 'right' }}><button onClick={() => delDespesa(d.id)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 15 }}>×</button></td>
                    </tr>
                  ))}
                  {despesasMes.length === 0 && <tr><td colSpan={4} style={{ padding: 18, textAlign: 'center', color: '#bbb' }}>Nenhuma despesa lançada.</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 18px', borderTop: '1px solid #f0f0f0', fontSize: 12, color: '#888', display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
              <span>Fixas: <strong style={{ color: '#111' }}>{brl(despFixas)}</strong></span>
              <span>Variáveis: <strong style={{ color: '#111' }}>{brl(despVar)}</strong></span>
            </div>
          </div>

          {/* Remuneração da equipe */}
          <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', fontSize: 13, fontWeight: 700, color: '#111' }}>Remuneração da equipe (mensal)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#fafafa', color: '#888', fontSize: 11, textTransform: 'uppercase' }}><th style={th}>Colaborador</th><th style={thr}>Fixo</th><th style={thr}>Variável</th><th style={{ ...thr, padding: '10px 18px' }}>Total</th></tr></thead>
                <tbody>
                  {equipe.map(u => (
                    <tr key={u.email} style={{ borderTop: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '10px 18px', fontWeight: 600, color: '#111' }}>{u.nome}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555' }}>{brl(Number(u.salarioFixo) || 0)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555' }}>{brl(Number(u.salarioVariavel) || 0)}</td>
                      <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 700, color: '#111' }}>{brl((Number(u.salarioFixo) || 0) + (Number(u.salarioVariavel) || 0))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ borderTop: '2px solid #eee', background: '#fafafa' }}><td style={{ padding: '10px 18px', fontWeight: 800, color: '#111' }}>Total folha</td><td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{brl(folhaFixa)}</td><td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{brl(folhaVar)}</td><td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 800 }}>{brl(folha)}</td></tr></tfoot>
              </table>
            </div>
            <p style={{ margin: 0, padding: '10px 18px', fontSize: 11, color: '#bbb', borderTop: '1px solid #f5f5f5' }}>Edite os valores em Pessoas e Cultura → Colaboradores.</p>
          </div>

          {/* Por cliente (operacional) */}
          <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', fontSize: 13, fontWeight: 700, color: '#111' }}>Por cliente — esforço operacional <span style={{ color: '#aaa', fontWeight: 500 }}>(horas × custo/hora)</span></div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#fafafa', color: '#888', fontSize: 11, textTransform: 'uppercase' }}><th style={th}>Cliente</th><th style={thr}>Horas</th><th style={thr}>Custo op.</th><th style={thr}>Receita</th><th style={{ ...thr, padding: '10px 18px' }}>Margem op.</th></tr></thead>
                <tbody>
                  {linhasCliente.map(l => (
                    <tr key={l.c.id} style={{ borderTop: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '10px 18px', fontWeight: 600, color: '#111' }}>{l.c.nome}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555' }}>{fmtH(l.min)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555' }}>{brl(l.custo)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555' }}>{l.receita > 0 ? brl(l.receita) : <span style={{ color: '#ccc' }}>—</span>}</td>
                      <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 800, color: l.receita === 0 ? '#bbb' : l.margem >= 0 ? '#16a34a' : '#dc2626' }}>{l.receita > 0 ? brl(l.margem) : '—'}{l.pct !== null && <span style={{ fontSize: 11, fontWeight: 600, color: '#aaa' }}> ({Math.round(l.pct)}%)</span>}</td>
                    </tr>
                  ))}
                  {linhasCliente.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#bbb' }}>Sem dados no período.</td></tr>}
                </tbody>
              </table>
            </div>
            <p style={{ margin: 0, padding: '10px 18px', fontSize: 11, color: '#bbb', borderTop: '1px solid #f5f5f5' }}>Custo operacional = horas apontadas × custo/hora do colaborador. Total no período: {fmtH(totalMin)} · {brl(totalCustoOp)}.</p>
          </div>

          {/* Por profissional */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', fontSize: 13, fontWeight: 700, color: '#111' }}>Por profissional — horas</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#fafafa', color: '#888', fontSize: 11, textTransform: 'uppercase' }}><th style={th}>Profissional</th><th style={thr}>Horas</th><th style={{ ...thr, padding: '10px 18px' }}>Custo op.</th></tr></thead>
                <tbody>
                  {Object.values(porProf).sort((a, b) => b.min - a.min).map((p, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f5f5f5' }}><td style={{ padding: '10px 18px', fontWeight: 600, color: '#111' }}>{p.nome}</td><td style={{ padding: '10px 12px', textAlign: 'right', color: '#555' }}>{fmtH(p.min)}</td><td style={{ padding: '10px 18px', textAlign: 'right', color: '#555' }}>{brl(p.custo)}</td></tr>
                  ))}
                  {Object.keys(porProf).length === 0 && <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: '#bbb' }}>Sem apontamentos no período.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

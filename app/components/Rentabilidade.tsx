'use client'
import { useEffect, useMemo, useState } from 'react'
import { totalMensalModulos, type ClienteModulos } from '@/lib/modulos'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string; tipo?: string; contratoValor?: number; modulos?: ClienteModulos; inadimplente?: boolean; receitasAvulsas?: { id: string; mes: string; valor: number; descricao?: string }[] }
type Usuario = { email: string; nome: string; role?: string; custoHora?: number; salarioFixo?: number; salarioVariavel?: number }
type Despesa = { id: string; descricao: string; valor: number; tipo: 'fixo' | 'variavel'; categoria?: string; mes: string }

function brlFmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtH(min: number) { return `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}` }

export default function Rentabilidade({ clientes, usuarios }: { clientes: Cliente[]; usuarios: Usuario[] }) {
  const [tarefas, setTarefas] = useState<any[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [contas, setContas] = useState<{ id: string; nome: string; saldo: number; atualizadoEm?: string }[]>([])
  const [gerenciarContas, setGerenciarContas] = useState(false)
  const [salvandoContas, setSalvandoContas] = useState(false)
  const [periodoFluxo, setPeriodoFluxo] = useState(6) // meses no gráfico de fluxo de caixa
  const [saudeDias, setSaudeDias] = useState(60) // meta da Saúde do Caixa (configurável)
  const [lancamentos, setLancamentos] = useState<{ id: string; tipo: 'entrada' | 'saida'; descricao: string; valor: number; data: string; clienteId?: string; recebido?: boolean; reservaId?: string }[]>([])
  const [lTipo, setLTipo] = useState<'entrada' | 'saida'>('saida')
  const [lDesc, setLDesc] = useState('')
  const [lValor, setLValor] = useState('')
  const [lData, setLData] = useState('')
  const [carregando, setCarregando] = useState(true)
  // #1 — ocultar/mostrar informacoes financeiras (privacidade; persistido)
  const [ocultar, setOcultar] = useState(false)
  useEffect(() => { try { setOcultar(localStorage.getItem('rent_ocultar') === '1') } catch {} }, [])
  function toggleOcultar() { setOcultar(v => { const n = !v; try { localStorage.setItem('rent_ocultar', n ? '1' : '0') } catch {} return n }) }
  // Mascara só os VALORES quando o olho está ativo (não desfoca a tela toda)
  const brl = (v: number) => ocultar ? 'R$ •••••' : brlFmt(v)
  const mascP = (s: string | number) => ocultar ? '•••' : String(s)
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
    fetch('/api/operacional').then(r => r.json()).then(d => { if (d?.saudeDias) setSaudeDias(Number(d.saudeDias)) }).catch(() => {})
    Promise.all([
      fetch('/api/tarefas').then(r => r.json()).catch(() => []),
      fetch('/api/despesas').then(r => r.json()).catch(() => []),
      fetch('/api/financeiro/contas').then(r => r.json()).catch(() => []),
      fetch('/api/financeiro/lancamentos').then(r => r.json()).catch(() => []),
    ]).then(([t, d, ct, lc]) => { setTarefas(Array.isArray(t) ? t : []); setDespesas(Array.isArray(d) ? d : []); setContas(Array.isArray(ct) ? ct : []); setLancamentos(Array.isArray(lc) ? lc : []); setCarregando(false) })
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
    const modulos = totalMensalModulos(c.modulos)
    const receita = (Number(c.contratoValor) || 0) + modulos + avulsas
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
  // MRR só dos add-ons de módulos (recorrência do plano modular), para destaque.
  const mrrModulos = useMemo(() => clientes.filter(c => c.tipo !== 'interno').reduce((s, c) => s + totalMensalModulos(c.modulos), 0), [clientes])
  // MRR EM RISCO: mensalidade (contrato + módulos) dos clientes suspensos por inadimplência.
  const mrrRisco = useMemo(() => clientes.filter(c => c.tipo !== 'interno' && c.inadimplente).reduce((s, c) => s + (Number(c.contratoValor) || 0) + totalMensalModulos(c.modulos), 0), [clientes])
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
  const reserva60 = despOpMensal * (saudeDias / 30) // reserva para a meta de dias
  const saudeCaixa = reserva60 > 0 ? (saldoContas / reserva60) * 100 : null
  const corSaude = saudeCaixa === null ? '#999' : saudeCaixa >= 80 ? '#16a34a' : saudeCaixa >= 50 ? '#f59e0b' : '#dc2626'
  // Contagiro (medidor de ponteiro) da Saúde do Caixa
  const gaugePt = (v: number, r: number) => { const a = (180 - Math.max(0, Math.min(100, v)) / 100 * 180) * Math.PI / 180; return [100 + r * Math.cos(a), 100 - r * Math.sin(a)] as const }
  const gaugeArc = (v0: number, v1: number, r = 80) => { const [x0, y0] = gaugePt(v0, r); const [x1, y1] = gaugePt(v1, r); return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}` }
  const ponteiro = gaugePt(saudeCaixa ?? 0, 62)

  async function salvarContas(lista: typeof contas) {
    setSalvandoContas(true)
    const r = await fetch('/api/financeiro/contas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contas: lista }) }).then(x => x.json()).catch(() => null)
    setSalvandoContas(false)
    if (r?.contas) setContas(r.contas)
  }

  // Fluxo de caixa — entradas (receita) x saídas (folha + despesas) por mês.
  // Janela: termina 3 meses no futuro (meses futuros = previsão dos recorrentes já lançados).
  const fluxo = useMemo(() => {
    const recorrente = clientes.filter(c => c.tipo !== 'interno').reduce((s, c) => s + (Number(c.contratoValor) || 0) + totalMensalModulos(c.modulos), 0)
    const out: { mes: string; label: string; entradas: number; saidas: number; saldo: number; futuro: boolean }[] = []
    for (let i = -(periodoFluxo - 4); i <= 3; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const avulsas = clientes.reduce((s, c) => s + (c.receitasAvulsas || []).filter(r => r.mes === mk).reduce((a, r) => a + (Number(r.valor) || 0), 0), 0)
      const desp = despesas.filter(x => x.mes === mk).reduce((s, x) => s + (Number(x.valor) || 0), 0)
      const entradas = recorrente + avulsas
      const saidas = folha + desp
      out.push({ mes: mk, label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), entradas, saidas, saldo: entradas - saidas, futuro: i > 0 })
    }
    return out
  }, [clientes, despesas, folha, periodoFluxo])
  const fluxoMax = Math.max(1, ...fluxo.map(f => Math.max(f.entradas, f.saidas)))

  // Saldo PREVISTO — projeção do saldo ao longo do tempo conforme datas de
  // recebimento (dia de vencimento por cliente) e lançamentos futuros.
  async function addLancamento() {
    if (!lDesc.trim() || !(Number(lValor) > 0) || !lData) return
    const r = await fetch('/api/financeiro/lancamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: lTipo, descricao: lDesc.trim(), valor: Number(lValor), data: lData }) }).then(x => x.json()).catch(() => null)
    if (r?.lancamento) { setLancamentos(ls => [...ls, r.lancamento].sort((a, b) => a.data.localeCompare(b.data))); setLDesc(''); setLValor(''); setLData('') }
  }
  async function delLancamento(id: string) {
    await fetch(`/api/financeiro/lancamentos?id=${id}`, { method: 'DELETE' }).catch(() => {})
    setLancamentos(ls => ls.filter(x => x.id !== id))
  }

  // Próximos eventos (60 dias): recebimentos recorrentes (dia de vencimento) + lançamentos futuros,
  // com SALDO PREVISTO acumulado após cada evento, partindo do saldo atual das contas.
  const previsao = useMemo(() => {
    const hojeD = new Date(); hojeD.setHours(0, 0, 0, 0)
    const limite = new Date(hojeD); limite.setDate(limite.getDate() + 60)
    const eventos: { data: Date; tipo: 'entrada' | 'saida'; desc: string; valor: number }[] = []
    for (const c of clientes) {
      if (c.tipo === 'interno') continue
      const v = (Number(c.contratoValor) || 0) + totalMensalModulos(c.modulos)
      const dia = Number((c as any).diaVencimento) || 0
      if (v <= 0 || dia < 1) continue
      for (let k = 0; k <= 2; k++) {
        const d = new Date(hojeD.getFullYear(), hojeD.getMonth() + k, Math.min(dia, 28))
        if (d >= hojeD && d <= limite) eventos.push({ data: d, tipo: 'entrada', desc: `${c.nome} (mensalidade)`, valor: v })
      }
    }
    for (const l of lancamentos) {
      const d = new Date(l.data + 'T00:00:00')
      if (d >= hojeD && d <= limite) eventos.push({ data: d, tipo: l.tipo, desc: l.descricao, valor: Number(l.valor) || 0 })
    }
    eventos.sort((a, b) => a.data.getTime() - b.data.getTime())
    let saldo = saldoContas
    const linhas = eventos.map(e => { saldo += e.tipo === 'entrada' ? e.valor : -e.valor; return { ...e, saldoApos: saldo } })
    const menor = linhas.reduce((m, l) => Math.min(m, l.saldoApos), saldoContas)
    return { linhas, saldoFinal: saldo, menor }
  }, [clientes, lancamentos, saldoContas])

  const opcoesMes = useMemo(() => {
    const arr: { v: string; label: string }[] = [{ v: '', label: 'Tudo' }]
    // Do mais futuro (+6) ao mais passado (-6); meses futuros servem para previsão/lançamentos futuros
    for (let i = 6; i >= -6; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)
      const base = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      arr.push({ v: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: i === 0 ? `${base} (atual)` : i > 0 ? `${base} (previsto)` : base })
    }
    return arr
  }, [])

  const card: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 18px', fontWeight: 700 }
  const thr: React.CSSProperties = { textAlign: 'right', padding: '10px 12px', fontWeight: 700 }

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Financeiro</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Resultado financeiro: receita recorrente (contratos + assinaturas de módulos) menos folha (fixo + variável) e despesas.</p>
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
        <div>
          {/* DRE — Resultado do mes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
            <div style={card}><p style={{ margin: 0, fontSize: 12, color: '#888' }}>Receita recorrente</p><p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#111' }}>{brl(receitaTotal)}</p><p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>Contratos + módulos{mrrModulos > 0 ? ` · ${brl(mrrModulos)} em módulos` : ''}</p>{mrrRisco > 0 && <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 700, color: '#b91c1c' }}>{brl(mrrRisco)}/mês em risco (suspensos)</p>}</div>
            <div style={card}><p style={{ margin: 0, fontSize: 12, color: '#888' }}>Folha (fixo + variável)</p><p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{brl(folha)}</p></div>
            <div style={card}><p style={{ margin: 0, fontSize: 12, color: '#888' }}>Despesas</p><p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{brl(despesasTotal)}</p></div>
            <div style={{ ...card, background: lucro >= 0 ? '#f0fdf4' : '#fef2f2' }}><p style={{ margin: 0, fontSize: 12, color: '#888' }}>Lucro</p><p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: lucro >= 0 ? '#16a34a' : '#dc2626' }}>{brl(lucro)}{margemPct !== null && <span style={{ fontSize: 12, fontWeight: 700, color: '#999' }}> ({mascP(Math.round(margemPct))}%)</span>}</p></div>
          </div>

          {/* Saúde do Caixa — termômetro (open doors 60 dias) */}
          <div style={{ ...card, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              {/* Contagiro (medidor de ponteiro) */}
              <div style={{ width: 160, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <svg viewBox="0 0 200 112" width={160} height={90}>
                  <path d={gaugeArc(0, 100)} stroke="#eee" strokeWidth={13} fill="none" strokeLinecap="round" />
                  <path d={gaugeArc(0, 50)} stroke="#dc2626" strokeWidth={13} fill="none" strokeLinecap="round" />
                  <path d={gaugeArc(50, 80)} stroke="#f59e0b" strokeWidth={13} fill="none" />
                  <path d={gaugeArc(80, 100)} stroke="#16a34a" strokeWidth={13} fill="none" strokeLinecap="round" />
                  <line x1={100} y1={100} x2={ponteiro[0]} y2={ponteiro[1]} stroke="#111" strokeWidth={3.5} strokeLinecap="round" style={{ transition: 'all .4s' }} />
                  <circle cx={100} cy={100} r={7} fill="#111" />
                </svg>
                <p style={{ margin: '-4px 0 0', fontSize: 24, fontWeight: 800, color: corSaude, lineHeight: 1 }}>{saudeCaixa === null ? '—' : ocultar ? '•••' : `${Math.round(saudeCaixa)}%`}</p>
              </div>
              {/* Indicador */}
              <div style={{ flex: 1, minWidth: 180 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#555' }}>Saúde do Caixa</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>
                  {saudeCaixa === null ? 'Cadastre contas e despesas para calcular.' : ocultar ? 'Valores ocultos (clique no olho para mostrar).' : `Cobre ~${Math.round(Math.min(saudeCaixa, 999) / 100 * saudeDias)} dias de operação sem nenhuma receita. Meta: ${saudeDias} dias (100%).`}
                </p>
              </div>
              {/* Composição */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: '#666', minWidth: 200 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>Saldo em contas <strong style={{ color: '#111' }}>{brl(saldoContas)}</strong></span>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>Despesa op. mensal <strong style={{ color: '#dc2626' }}>{brl(despOpMensal)}</strong></span>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>Reserva p/ {saudeDias} dias <strong style={{ color: '#111' }}>{brl(reserva60)}</strong></span>
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

          {/* Fluxo de caixa */}
          <div style={{ ...card, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#555' }}>Fluxo de caixa</p>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#aaa' }}>Entradas (receita) e saídas (folha + despesas) por mês. Meses à frente = previsão dos recorrentes já lançados.</p>
              </div>
              <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 9, padding: 3 }}>
                {[6, 12].map(p => (
                  <button key={p} onClick={() => setPeriodoFluxo(p)} style={{ padding: '6px 14px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: periodoFluxo === p ? '#fff' : 'transparent', color: periodoFluxo === p ? '#111' : '#888', boxShadow: periodoFluxo === p ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>{p}m</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 150, overflowX: 'auto', paddingBottom: 4 }}>
              {fluxo.map(f => (
                <div key={f.mes} title={`${f.label}: entradas ${brl(f.entradas)} · saídas ${brl(f.saidas)} · saldo ${brl(f.saldo)}`} style={{ flex: '1 0 38px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: f.futuro ? 0.55 : 1 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, width: '100%', justifyContent: 'center' }}>
                    <div style={{ width: 11, height: `${Math.max(2, f.entradas / fluxoMax * 118)}px`, background: '#16a34a', borderRadius: '3px 3px 0 0' }} />
                    <div style={{ width: 11, height: `${Math.max(2, f.saidas / fluxoMax * 118)}px`, background: '#dc2626', borderRadius: '3px 3px 0 0' }} />
                  </div>
                  <span style={{ fontSize: 10.5, color: f.futuro ? '#aaa' : '#888', fontWeight: f.mes === `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}` ? 800 : 500, whiteSpace: 'nowrap' }}>{f.label}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: f.saldo >= 0 ? '#16a34a' : '#dc2626' }}>{ocultar ? '•••' : `${f.saldo >= 0 ? '+' : ''}${Math.round(f.saldo / 1000)}k`}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11.5, color: '#888' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#16a34a' }} />Entradas</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#dc2626' }} />Saídas</span>
              <span style={{ marginLeft: 'auto', color: '#bbb' }}>valores em milhares (k) abaixo de cada mês = saldo</span>
            </div>
          </div>

          {/* Saldo previsto (60 dias) */}
          <div style={{ ...card, marginBottom: 18 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#555' }}>Saldo previsto · próximos 60 dias</p>
            <p style={{ margin: '2px 0 12px', fontSize: 11.5, color: '#aaa' }}>Parte do saldo atual das contas e aplica os recebimentos (dia de vencimento de cada cliente) e os lançamentos futuros, na ordem das datas.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 120, background: '#fafafa', borderRadius: 10, padding: '10px 12px' }}><p style={{ margin: 0, fontSize: 11, color: '#888' }}>Saldo atual</p><p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: '#111' }}>{brl(saldoContas)}</p></div>
              <div style={{ flex: 1, minWidth: 120, background: '#fafafa', borderRadius: 10, padding: '10px 12px' }}><p style={{ margin: 0, fontSize: 11, color: '#888' }}>Previsto em 60d</p><p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: previsao.saldoFinal >= 0 ? '#16a34a' : '#dc2626' }}>{brl(previsao.saldoFinal)}</p></div>
              <div style={{ flex: 1, minWidth: 120, background: previsao.menor < 0 ? '#fef2f2' : '#fafafa', borderRadius: 10, padding: '10px 12px' }}><p style={{ margin: 0, fontSize: 11, color: '#888' }}>Menor saldo no período</p><p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: previsao.menor < 0 ? '#dc2626' : '#111' }}>{brl(previsao.menor)}</p></div>
            </div>
            {previsao.menor < 0 && <p style={{ margin: '0 0 10px', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Atenção: o saldo fica negativo em algum momento dos próximos 60 dias.</p>}
            {previsao.linhas.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12.5, color: '#bbb' }}>Sem eventos previstos. Defina o dia de vencimento dos clientes (Configurações → Clientes) e adicione lançamentos futuros abaixo.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 240, overflowY: 'auto' }}>
                {previsao.linhas.map((l, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: i % 2 ? '#fafafa' : '#fff', fontSize: 12.5 }}>
                    <span style={{ width: 52, flexShrink: 0, color: '#888', fontWeight: 700 }}>{l.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                    <span style={{ flex: 1, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.desc}</span>
                    <span style={{ flexShrink: 0, fontWeight: 700, color: l.tipo === 'entrada' ? '#16a34a' : '#dc2626' }}>{l.tipo === 'entrada' ? '+' : '−'}{brl(l.valor)}</span>
                    <span style={{ width: 110, flexShrink: 0, textAlign: 'right', fontWeight: 800, color: l.saldoApos < 0 ? '#dc2626' : '#111' }}>{brl(l.saldoApos)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lançamentos futuros */}
          <div style={{ ...card, marginBottom: 18 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#555' }}>Lançamentos futuros</p>
            <p style={{ margin: '2px 0 12px', fontSize: 11.5, color: '#aaa' }}>Entradas e saídas planejadas que entram na previsão de saldo.</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 8, padding: 3 }}>
                {(['entrada', 'saida'] as const).map(t => (
                  <button key={t} onClick={() => setLTipo(t)} style={{ padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, textTransform: 'capitalize', background: lTipo === t ? '#fff' : 'transparent', color: lTipo === t ? (t === 'entrada' ? '#16a34a' : '#dc2626') : '#888' }}>{t === 'saida' ? 'saída' : t}</button>
                ))}
              </div>
              <input type="date" value={lData} onChange={e => setLData(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12.5, fontFamily: 'inherit' }} />
              <input value={lDesc} onChange={e => setLDesc(e.target.value)} placeholder="Descrição" style={{ flex: 1, minWidth: 140, padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12.5, fontFamily: 'inherit' }} />
              <input type="number" min="0" value={lValor} onChange={e => setLValor(e.target.value)} placeholder="Valor R$" style={{ width: 110, padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12.5, fontFamily: 'inherit' }} />
              <button onClick={addLancamento} disabled={!lDesc.trim() || !(Number(lValor) > 0) || !lData} style={{ padding: '8px 14px', background: (lDesc.trim() && Number(lValor) > 0 && lData) ? '#111' : '#f0f0f0', color: (lDesc.trim() && Number(lValor) > 0 && lData) ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Adicionar</button>
            </div>
            {lancamentos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {lancamentos.map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#fafafa', borderRadius: 8, fontSize: 12.5 }}>
                    <span style={{ width: 52, flexShrink: 0, color: '#888', fontWeight: 700 }}>{new Date(l.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                    <span style={{ flex: 1, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descricao}</span>
                    {l.reservaId && <span title="Gerado da reserva — atualiza junto com ela" style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: '#1d4ed8', background: '#eff6ff', borderRadius: 999, padding: '2px 8px' }}>reserva</span>}
                    {l.recebido && <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '2px 8px' }}>recebido</span>}
                    <span style={{ flexShrink: 0, fontWeight: 700, color: l.tipo === 'entrada' ? '#16a34a' : '#dc2626' }}>{l.tipo === 'entrada' ? '+' : '−'}{brl(Number(l.valor) || 0)}</span>
                    {/* Lançamento de reserva não sai daqui: apagar só a cópia mentiria o caixa — cancele/edite a reserva. */}
                    {l.reservaId
                      ? <span style={{ width: 15, flexShrink: 0 }} />
                      : <button onClick={() => delLancamento(l.id)} title="Remover" style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>×</button>}
                  </div>
                ))}
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
                      <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 800, color: l.receita === 0 ? '#bbb' : l.margem >= 0 ? '#16a34a' : '#dc2626' }}>{l.receita > 0 ? brl(l.margem) : '—'}{l.pct !== null && <span style={{ fontSize: 11, fontWeight: 600, color: '#aaa' }}> ({mascP(Math.round(l.pct))}%)</span>}</td>
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

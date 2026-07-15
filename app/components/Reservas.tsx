'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { LayoutVeiculo, Poltrona, capacidadeLayout } from '@/lib/layoutVeiculo'
import { valorDaReserva, vendePoltrona } from '@/lib/pacoteViagem'
import { FinanceiroReserva, MetodoPagamento, METODOS, gerarParcelas, saldoDevedor, totalPago } from '@/lib/financeiroReserva'
import { v4 as uuid } from 'uuid'

// Reservas de viagem + MAPA DE POLTRONAS visual. Jamais duas pessoas na mesma
// poltrona (o servidor recusa; aqui as ocupadas ficam travadas).

type Veiculo = { id: string; nome: string; layout: LayoutVeiculo }
type Viagem = { id: string; titulo: string; dataIda: string; veiculoId?: string; valorPacote: number; status: string; tipo?: 'pacote' | 'fretamento'; valorFechado?: number; contratante?: string }
type Passageiro = { nome: string; cpf?: string; nascimento?: string; poltrona?: string }
type Reserva = { id: string; viagemId: string; contratanteNome: string; passageiros: Passageiro[]; desconto?: number; status: string; vendedorNome?: string; financeiro?: FinanceiroReserva }
type FormReserva = { id?: string; contratanteNome: string; contatoId?: string; passageiros: Passageiro[]; desconto: string; financeiro?: FinanceiroReserva }

const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (s?: string) => s ? new Date(s + 'T00:00').toLocaleDateString('pt-BR') : ''
const stReserva: Record<string, { label: string; cor: string; bg: string }> = {
  'pre-reserva': { label: 'Pré-reserva', cor: '#a16207', bg: '#fef9c3' },
  'confirmada': { label: 'Confirmada', cor: '#166534', bg: '#dcfce7' },
  'cancelada': { label: 'Cancelada', cor: '#9ca3af', bg: '#f4f4f5' },
}

// Grade de um andar: poltronas + elementos (amenidades) por (fileira-coluna).
function gradeAndar(layout: LayoutVeiculo, andar: number) {
  const ps = layout.poltronas.filter(p => p.andar === andar)
  const els = (layout.elementos || []).filter(e => e.andar === andar)
  const todos = [...ps.map(p => ({ f: p.fileira, c: p.coluna })), ...els.map(e => ({ f: e.fileira, c: e.coluna }))]
  const maxFileira = todos.length ? Math.max(...todos.map(x => x.f)) : 0
  const maxColuna = todos.length ? Math.max(...todos.map(x => x.c)) : 0
  const mapa = new Map<string, Poltrona>()
  ps.forEach(p => mapa.set(`${p.fileira}-${p.coluna}`, p))
  const elMapa = new Map<string, string>()
  els.forEach(e => elMapa.set(`${e.fileira}-${e.coluna}`, e.label))
  return { maxFileira, maxColuna, mapa, elMapa }
}

// Mapa visual de poltronas (por andar). Ocupadas travadas; selecionadas destacadas.
function MapaPoltronas({ layout, ocupadas, selecionadas, onToggle, readOnly }: {
  layout: LayoutVeiculo; ocupadas: Set<string>; selecionadas: Set<string>; onToggle?: (n: string) => void; readOnly?: boolean
}) {
  const andares = Array.from({ length: layout.andares }, (_, i) => i + 1)
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
      {andares.map(andar => {
        const { maxFileira, maxColuna, mapa, elMapa } = gradeAndar(layout, andar)
        if (!maxFileira) return null
        return (
          <div key={andar}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>{layout.andares > 1 ? (andar === 1 ? 'Inferior' : 'Superior') : 'Poltronas'}</div>
            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, background: '#fafafa', border: '1px solid #eee', borderRadius: 10, padding: 8 }}>
              {Array.from({ length: maxFileira }, (_, f) => f + 1).map(fileira => (
                <div key={fileira} style={{ display: 'flex', gap: 4 }}>
                  {Array.from({ length: maxColuna }, (_, c) => c + 1).map(coluna => {
                    const p = mapa.get(`${fileira}-${coluna}`)
                    if (!p) {
                      const el = elMapa.get(`${fileira}-${coluna}`)
                      if (el) return <span key={coluna} title={el} style={{ minWidth: 30, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', borderRadius: 5, padding: '0 4px', whiteSpace: 'nowrap' }}>{el}</span>
                      return <span key={coluna} style={{ width: 30, height: 26 }} /> // corredor
                    }
                    const ocupada = ocupadas.has(p.numero)
                    const sel = selecionadas.has(p.numero)
                    const cor = ocupada ? { bg: '#e5e7eb', bd: '#d1d5db', tx: '#9ca3af' } : sel ? { bg: '#111', bd: '#111', tx: '#fff' } : { bg: '#fff', bd: '#cbd5e1', tx: '#334155' }
                    return (
                      <button key={coluna} type="button" title={`Poltrona ${p.numero}${ocupada ? ' (ocupada)' : ''} · ${p.tipo}`}
                        disabled={readOnly || ocupada}
                        onClick={() => !ocupada && onToggle?.(p.numero)}
                        style={{ width: 30, height: 26, borderRadius: 6, border: `1.5px solid ${cor.bd}`, background: cor.bg, color: cor.tx, fontSize: 10, fontWeight: 800, cursor: readOnly || ocupada ? 'default' : 'pointer', padding: 0 }}>{p.numero}</button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Reservas({ podeEditar = true, podeExcluir = false, meuEmail = '', meuNome = '' }: { podeEditar?: boolean; podeExcluir?: boolean; meuEmail?: string; meuNome?: string }) {
  const [viagens, setViagens] = useState<Viagem[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [viagemSel, setViagemSel] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState<FormReserva | null>(null)
  const [salvando, setSalvando] = useState(false)
  // Config do gerador de parcelas / lançamento de pagamento (financeiro da reserva)
  const [parcVezes, setParcVezes] = useState(1)
  const [parcMetodo, setParcMetodo] = useState<MetodoPagamento>('pix')
  const [parcVenc, setParcVenc] = useState('')
  const [pagValor, setPagValor] = useState('')
  const [pagMetodo, setPagMetodo] = useState<MetodoPagamento>('pix')

  const carregarBase = useCallback(() => {
    Promise.all([fetch('/api/viagens').then(r => r.json()), fetch('/api/frota').then(r => r.json())]).then(([e, o]) => {
      const exs = Array.isArray(e?.viagens) ? e.viagens : []
      setViagens(exs); if (Array.isArray(o?.veiculos)) setVeiculos(o.veiculos)
      setViagemSel(prev => prev || exs[0]?.id || '')
    }).catch(() => {}).finally(() => setCarregando(false))
  }, [])
  useEffect(() => { carregarBase() }, [carregarBase])

  const carregarReservas = useCallback(() => {
    if (!viagemSel) { setReservas([]); return }
    fetch(`/api/reservas?viagemId=${viagemSel}`).then(r => r.json()).then(d => { if (Array.isArray(d?.reservas)) setReservas(d.reservas) }).catch(() => {})
  }, [viagemSel])
  useEffect(() => { carregarReservas() }, [carregarReservas])

  const viagem = viagens.find(e => e.id === viagemSel)
  // Fretamento não vende poltrona: o contratante leva o veículo inteiro, e o valor
  // é fechado. Sem isto, o mapa apareceria e o total sairia × passageiro.
  const comPoltrona = !viagem || vendePoltrona(viagem)
  const layout = useMemo(() => {
    if (viagem && !vendePoltrona(viagem)) return null
    return veiculos.find(x => x.id === viagem?.veiculoId)?.layout || null
  }, [veiculos, viagem, comPoltrona])
  // Ocupadas = poltronas das reservas não canceladas (ignorando a que está sendo editada)
  const ocupadas = useMemo(() => {
    const s = new Set<string>()
    for (const r of reservas) {
      if (r.status === 'cancelada' || (form?.id && r.id === form.id)) continue
      for (const p of r.passageiros) if (p.poltrona) s.add(p.poltrona)
    }
    return s
  }, [reservas, form])
  const selecionadas = useMemo(() => new Set((form?.passageiros || []).map(p => p.poltrona).filter(Boolean) as string[]), [form])
  const vagas = layout ? capacidadeLayout(layout) : 0
  const vendidas = ocupadas.size

  function novaReserva() {
    if (!viagem) { toast('Selecione uma viagem.', 'erro'); return }
    setForm({ contratanteNome: '', passageiros: [], desconto: '' })
  }
  function editarReserva(r: Reserva) {
    setForm({ id: r.id, contratanteNome: r.contratanteNome, passageiros: r.passageiros.map(p => ({ ...p })), desconto: r.desconto ? String(r.desconto) : '', financeiro: r.financeiro })
  }
  // Financeiro: gerar parcelas e lançar pagamento parcial (abatendo o saldo)
  function gerarParc() {
    setForm(f => { if (!f) return f; const venc = parcVenc || new Date().toISOString().slice(0, 10); return { ...f, financeiro: { valorTotal: valorForm, parcelas: gerarParcelas(valorForm, parcVezes, venc, parcMetodo), pagamentos: f.financeiro?.pagamentos || [] } } })
  }
  function toggleParcela(id: string) {
    setForm(f => { if (!f?.financeiro) return f; return { ...f, financeiro: { ...f.financeiro, parcelas: f.financeiro.parcelas.map(p => p.id === id ? { ...p, status: p.status === 'pago' ? 'pendente' : 'pago', pagoEm: p.status === 'pago' ? undefined : new Date().toISOString().slice(0, 10) } : p) } } })
  }
  function lancarPagamento() {
    const v = Number(pagValor) || 0
    if (v <= 0) { toast('Informe o valor do pagamento.', 'erro'); return }
    setForm(f => { if (!f) return f; const fin = f.financeiro || { valorTotal: valorForm, parcelas: [], pagamentos: [] }; return { ...f, financeiro: { ...fin, pagamentos: [...fin.pagamentos, { id: uuid(), data: new Date().toISOString().slice(0, 10), valor: v, metodo: pagMetodo }] } } })
    setPagValor('')
  }
  const removerPagamento = (id: string) => setForm(f => f?.financeiro ? ({ ...f, financeiro: { ...f.financeiro, pagamentos: f.financeiro.pagamentos.filter(p => p.id !== id) } }) : f)
  // Link público para o cliente escolher a poltrona
  async function gerarLinkCliente() {
    if (!form?.id) return
    const r = await fetch('/api/reservas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: form.id, gerarLink: true }) }).then(x => x.json()).catch(() => null)
    if (r?.ok && r.token) {
      const url = `${location.origin}/reserva/${r.token}`
      navigator.clipboard?.writeText(url).then(() => toast('Link copiado! Envie ao cliente para escolher a poltrona.', 'sucesso')).catch(() => toast(url, 'info'))
    } else toast(r?.error || 'Falha ao gerar o link.', 'erro')
  }
  // Clicar numa poltrona no form: adiciona/remove um passageiro naquele assento.
  function togglePoltrona(n: string) {
    setForm(f => {
      if (!f) return f
      const existe = f.passageiros.find(p => p.poltrona === n)
      if (existe) return { ...f, passageiros: f.passageiros.filter(p => p.poltrona !== n) }
      const nome = f.passageiros.length === 0 ? f.contratanteNome : ''
      return { ...f, passageiros: [...f.passageiros, { nome, poltrona: n }] }
    })
  }
  const setPax = (i: number, patch: Partial<Passageiro>) => setForm(f => f && ({ ...f, passageiros: f.passageiros.map((p, j) => j === i ? { ...p, ...patch } : p) }))

  const valorForm = viagem ? valorDaReserva(viagem, form?.passageiros.length || 0, Number(form?.desconto) || 0) : 0

  async function salvar() {
    if (!form || !viagem || salvando) return
    if (!form.contratanteNome.trim()) { toast('Informe o contratante.', 'erro'); return }
    if (!form.passageiros.length) { toast('Selecione ao menos uma poltrona.', 'erro'); return }
    if (form.passageiros.some(p => !p.nome.trim())) { toast('Preencha o nome de todos os passageiros.', 'erro'); return }
    setSalvando(true)
    const corpo: any = { ...form, viagemId: viagem.id, desconto: Number(form.desconto) || 0, vendedorEmail: meuEmail, vendedorNome: meuNome, financeiro: form.financeiro ? { ...form.financeiro, valorTotal: valorForm } : undefined }
    const r = await fetch('/api/reservas', { method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast(form.id ? 'Reserva atualizada.' : 'Reserva criada.', 'sucesso'); setForm(null); carregarReservas() }
    else toast(r?.error || 'Falha ao salvar a reserva.', 'erro')
  }
  async function excluir(r: Reserva) {
    if (!(await confirmar(`Excluir a reserva de "${r.contratanteNome}"?`, { titulo: 'Excluir reserva', okLabel: 'Excluir', perigo: true }))) return
    const x = await fetch('/api/reservas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) }).then(y => y.json()).catch(() => null)
    if (x?.ok) { toast('Reserva excluída.', 'sucesso'); carregarReservas() } else toast('Falha ao excluir.', 'erro')
  }

  const inputStyle: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#111' }}>Reservas</h2>
        <select value={viagemSel} onChange={e => setViagemSel(e.target.value)} style={{ ...inputStyle, minWidth: 220, background: '#fff' }}>
          <option value="">Selecione a viagem...</option>
          {viagens.map(e => <option key={e.id} value={e.id}>{e.titulo} · {fmtData(e.dataIda)}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        {podeEditar && viagem && <button onClick={novaReserva} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Reserva</button>}
      </div>

      {carregando ? <p style={{ color: '#aaa', fontSize: 13 }}>Carregando...</p>
        : !viagem ? <p style={{ color: '#aaa', fontSize: 13 }}>Selecione uma viagem para ver as reservas e o mapa de poltronas.</p>
        : (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              {!comPoltrona ? (
                <>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', borderRadius: 999, padding: '5px 12px' }}>Fretamento — veículo inteiro</span>
                  {viagem.contratante && <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', background: '#f1f5f9', borderRadius: 999, padding: '5px 12px' }}>Contratante: {viagem.contratante}</span>}
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '5px 12px' }}>{fmtBRL(viagem.valorFechado || 0)} fechado</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '5px 12px' }}>{vendidas} vendidas</span>
                  {layout && <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', background: '#f1f5f9', borderRadius: 999, padding: '5px 12px' }}>{vagas - vendidas} livres de {vagas}</span>}
                  {!layout && <span style={{ fontSize: 12.5, color: '#b45309', background: '#fef3c7', borderRadius: 999, padding: '5px 12px' }}>Viagem sem veículo/croqui — defina o veículo para o mapa de poltronas.</span>}
                </>
              )}
            </div>
            {!comPoltrona && (
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#bbb' }}>No fretamento não se vende poltrona: registre o contrato e, se quiser, a lista de passageiros (manifesto).</p>
            )}

            {layout && !form && (
              <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 16, marginBottom: 18 }}>
                <MapaPoltronas layout={layout} ocupadas={ocupadas} selecionadas={new Set()} readOnly />
              </div>
            )}

            {/* Lista de reservas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reservas.length === 0 ? <p style={{ color: '#aaa', fontSize: 13 }}>Nenhuma reserva nesta viagem.</p>
                : reservas.map(r => {
                  const st = stReserva[r.status] || stReserva['pre-reserva']
                  const poltronas = r.passageiros.map(p => p.poltrona).filter(Boolean).join(', ')
                  const valor = valorDaReserva(viagem, r.passageiros.length, r.desconto || 0)
                  return (
                    <div key={r.id} onClick={() => podeEditar && editarReserva(r)} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '11px 14px', cursor: podeEditar ? 'pointer' : 'default', opacity: r.status === 'cancelada' ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{r.contratanteNome}</span>
                        <span style={{ fontSize: 10, fontWeight: 800, color: st.cor, background: st.bg, borderRadius: 999, padding: '2px 8px' }}>{st.label}</span>
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>{fmtBRL(valor)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{r.passageiros.length} pax · poltronas {poltronas || '—'}</div>
                    </div>
                  )
                })}
            </div>
          </>
        )}

      {/* Modal criar/editar reserva */}
      {form && viagem && (
        <div onClick={() => setForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 640, width: '100%', margin: 'auto', padding: 22 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16.5, color: '#111' }}>{form.id ? 'Editar reserva' : 'Nova reserva'}</h3>
            <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#999' }}>{viagem.titulo} · {fmtData(viagem.dataIda)} · {fmtBRL(viagem.valorPacote)}/pessoa</p>
            <input value={form.contratanteNome} onChange={e => setForm(f => f && ({ ...f, contratanteNome: e.target.value, passageiros: f.passageiros.map((p, i) => i === 0 && !p.nome ? { ...p, nome: e.target.value } : p) }))} placeholder="Contratante (nome) *" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontSize: 14, marginBottom: 12 }} />

            {layout ? (
              <>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8 }}>Clique nas poltronas livres para escolher</label>
                <div style={{ marginBottom: 14, overflowX: 'auto' }}>
                  <MapaPoltronas layout={layout} ocupadas={ocupadas} selecionadas={selecionadas} onToggle={togglePoltrona} />
                </div>
              </>
            ) : <p style={{ fontSize: 12.5, color: '#b45309', marginBottom: 12 }}>Defina o ônibus da viagem para escolher poltronas.</p>}

            {form.passageiros.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Passageiros ({form.passageiros.length})</label>
                {form.passageiros.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ width: 34, textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#111', background: '#f1f5f9', borderRadius: 6, padding: '6px 0', flexShrink: 0 }}>{p.poltrona}</span>
                    <input value={p.nome} onChange={e => setPax(i, { nome: e.target.value })} placeholder="Nome do passageiro" style={{ ...inputStyle, flex: 2, minWidth: 140 }} />
                    <input value={p.cpf || ''} onChange={e => setPax(i, { cpf: e.target.value })} placeholder="CPF" style={{ ...inputStyle, flex: 1, minWidth: 100 }} />
                    <input type="date" value={p.nascimento || ''} onChange={e => setPax(i, { nascimento: e.target.value })} title="Nascimento" style={{ ...inputStyle, width: 140 }} />
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#666', fontWeight: 600 }}>
                Desconto (R$)
                <input type="number" min={0} step="0.01" value={form.desconto} onChange={e => setForm(f => f && ({ ...f, desconto: e.target.value }))} placeholder="0" style={{ ...inputStyle, width: 100 }} />
              </label>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 15, fontWeight: 800, color: '#166534' }}>Total: {fmtBRL(valorForm)}</span>
            </div>

            {/* Financeiro (parcelas + pagamento parcial) — só na reserva já salva */}
            {form.id && (() => {
              const fin = form.financeiro
              const pago = fin ? totalPago(fin) : 0
              const saldo = Math.max(0, valorForm - pago)
              return (
                <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>Financeiro</label>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: '#666' }}>Pago {fmtBRL(pago)}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: saldo > 0 ? '#b45309' : '#166534' }}>Saldo {fmtBRL(saldo)}</span>
                  </div>
                  {/* Gerar parcelas */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 9, padding: 9 }}>
                    <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Parcelar em</span>
                    <input type="number" min={1} max={36} value={parcVezes} onChange={e => setParcVezes(Math.max(1, Number(e.target.value) || 1))} style={{ ...inputStyle, width: 56 }} />
                    <span style={{ fontSize: 12, color: '#666' }}>×</span>
                    <select value={parcMetodo} onChange={e => setParcMetodo(e.target.value as MetodoPagamento)} style={{ ...inputStyle, background: '#fff' }}>{METODOS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
                    <input type="date" value={parcVenc} onChange={e => setParcVenc(e.target.value)} title="1º vencimento" style={{ ...inputStyle, width: 140 }} />
                    <button type="button" onClick={gerarParc} style={{ padding: '8px 12px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Gerar</button>
                  </div>
                  {fin && fin.parcelas.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                      {fin.parcelas.map(p => (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '5px 8px', background: p.status === 'pago' ? '#f0fdf4' : '#fff', border: '1px solid #f0f0f0', borderRadius: 8, cursor: 'pointer' }}>
                          <input type="checkbox" checked={p.status === 'pago'} onChange={() => toggleParcela(p.id)} style={{ width: 15, height: 15 }} />
                          <span style={{ fontWeight: 700, color: '#333' }}>{p.numero}ª</span>
                          <span style={{ color: '#666' }}>{fmtBRL(p.valor)}</span>
                          <span style={{ color: '#999' }}>venc. {fmtData(p.vencimento)}</span>
                          <span style={{ flex: 1 }} />
                          {p.status === 'pago' && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#166534' }}>PAGO</span>}
                        </label>
                      ))}
                    </div>
                  )}
                  {/* Lançar pagamento avulso (o cliente vai pagando sem valor fixo) */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Registrar pagamento</span>
                    <input type="number" min={0} step="0.01" value={pagValor} onChange={e => setPagValor(e.target.value)} placeholder="R$" style={{ ...inputStyle, width: 100 }} />
                    <select value={pagMetodo} onChange={e => setPagMetodo(e.target.value as MetodoPagamento)} style={{ ...inputStyle, background: '#fff' }}>{METODOS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
                    <button type="button" onClick={lancarPagamento} style={{ padding: '8px 12px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Lançar</button>
                  </div>
                  {fin && fin.pagamentos.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
                      {fin.pagamentos.map(pg => (
                        <div key={pg.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555' }}>
                          <span style={{ fontWeight: 700, color: '#166534' }}>{fmtBRL(pg.valor)}</span>
                          <span style={{ color: '#999' }}>{fmtData(pg.data)}{pg.metodo ? ` · ${pg.metodo}` : ''}</span>
                          <span style={{ flex: 1 }} />
                          <button type="button" onClick={() => removerPagamento(pg.id)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 15 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
              {form.id && podeExcluir && <button onClick={() => { const r = reservas.find(x => x.id === form.id); if (r) { setForm(null); excluir(r) } }} style={{ padding: '9px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 9, color: '#b91c1c', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginRight: 'auto' }}>Excluir</button>}
              {form.id && layout && <button onClick={gerarLinkCliente} title="Gera um link para o cliente escolher a poltrona" style={{ padding: '9px 14px', background: '#fff', border: '1px solid #bfdbfe', borderRadius: 9, color: '#1d4ed8', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Link do cliente</button>}
              <span style={{ flex: form.id ? undefined : 1 }} />
              <button onClick={() => setForm(null)} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 9, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ padding: '10px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: salvando ? 'wait' : 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar reserva'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

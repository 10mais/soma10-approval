'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { diasENoites, resumoParcelamento } from '@/lib/pacoteViagem'
import { v4 as uuid } from 'uuid'

// PACOTES DE VIAGEM (turismo): o modelo reutilizável — "Foz do Iguaçu 3 dias" sai
// 5x no ano. A Viagem COPIA o pacote; mexer aqui depois não reescreve viagem já
// vendida (de propósito).
//
// As DATAS aqui são de REFERÊNCIA (uma saída típica): servem para preencher
// natural e para o sistema CALCULAR dias/noites. O roteiro e os hotéis ficam em
// DIA RELATIVO (Dia 1 = ida) — é o que faz o mesmo pacote servir julho e dezembro.
//
// ⚠️ Nada a ver com os pacotes de TRATAMENTO da clínica (/api/pacotes).

type ParadaModelo = { id: string; dia: number; hora?: string; titulo: string; local?: string; tipo?: string; observacoes?: string }
type Hotel = { id: string; nome: string; checkinDia?: number; checkinHora?: string; checkoutDia?: number; checkoutHora?: string }
type Precos = { valorCrianca?: number; valorMeia?: number; entrada?: number; parcelas?: number; valorParcela?: number; formasAceitas?: string[] }
type Pacote = {
  id: string; nome: string; destino?: string
  dataIdaRef?: string; dataVoltaRef?: string; horaSaida?: string; horaRetorno?: string
  dias?: number; noites?: number; valorBase: number; precos?: Precos
  inclusos?: string[]; roteiroPadrao?: ParadaModelo[]; hoteis?: Hotel[]
  observacoes?: string; ativo?: boolean
}
type Form = {
  id?: string; nome: string; destino: string
  dataIdaRef: string; dataVoltaRef: string; horaSaida: string; horaRetorno: string
  valorBase: string; valorCrianca: string; valorMeia: string
  entrada: string; parcelas: string; valorParcela: string; formasAceitas: string[]
  inclusos: string[]; roteiroPadrao: ParadaModelo[]; hoteis: Hotel[]
  observacoes: string; ativo: boolean
}

const TIPOS_PARADA = ['embarque', 'passeio', 'refeicao', 'hospedagem', 'translado', 'livre']
const FORMAS: { key: string; label: string }[] = [
  { key: 'pix', label: 'Pix' }, { key: 'cartao', label: 'Cartão' }, { key: 'boleto', label: 'Boleto' },
  { key: 'dinheiro', label: 'Dinheiro' }, { key: 'transferencia', label: 'Transferência' },
]
const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const vazio = (): Form => ({
  nome: '', destino: '', dataIdaRef: '', dataVoltaRef: '', horaSaida: '', horaRetorno: '',
  valorBase: '', valorCrianca: '', valorMeia: '', entrada: '', parcelas: '', valorParcela: '', formasAceitas: [],
  inclusos: [], roteiroPadrao: [], hoteis: [], observacoes: '', ativo: true,
})

const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 5 }
const secaoStyle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#111' }

export default function PacotesViagem({ podeEditar = true, podeExcluir = false }: { podeEditar?: boolean; podeExcluir?: boolean }) {
  const [lista, setLista] = useState<Pacote[]>([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(() => {
    setCarregando(true)
    fetch('/api/pacotes-viagem').then(r => r.json()).then(d => { if (Array.isArray(d?.pacotes)) setLista(d.pacotes) }).catch(() => {}).finally(() => setCarregando(false))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  // Dias/noites saem das DATAS — nunca digitados. Digitar geraria "3 dias" numa
  // viagem de 20 a 25/07.
  const dn = useMemo(() => diasENoites(form?.dataIdaRef, form?.dataVoltaRef), [form?.dataIdaRef, form?.dataVoltaRef])
  const dataInvertida = !!form?.dataIdaRef && !!form?.dataVoltaRef && dn.dias === undefined

  function abrirNovo() { setForm(vazio()) }
  function abrirEditar(p: Pacote) {
    setForm({
      id: p.id, nome: p.nome, destino: p.destino || '',
      dataIdaRef: p.dataIdaRef || '', dataVoltaRef: p.dataVoltaRef || '', horaSaida: p.horaSaida || '', horaRetorno: p.horaRetorno || '',
      valorBase: p.valorBase ? String(p.valorBase) : '',
      valorCrianca: p.precos?.valorCrianca !== undefined ? String(p.precos.valorCrianca) : '',
      valorMeia: p.precos?.valorMeia !== undefined ? String(p.precos.valorMeia) : '',
      entrada: p.precos?.entrada ? String(p.precos.entrada) : '',
      parcelas: p.precos?.parcelas ? String(p.precos.parcelas) : '',
      valorParcela: p.precos?.valorParcela ? String(p.precos.valorParcela) : '',
      formasAceitas: p.precos?.formasAceitas || [],
      inclusos: p.inclusos || [], roteiroPadrao: p.roteiroPadrao || [], hoteis: p.hoteis || [],
      observacoes: p.observacoes || '', ativo: p.ativo !== false,
    })
  }

  // ── Inclusos: TÓPICOS, uma linha por item (etiqueta não cabe "Hospedagem 2
  // diárias com café da manhã no Hotel Central") ────────────────────────────
  const addIncluso = () => setForm(f => f && ({ ...f, inclusos: [...f.inclusos, ''] }))
  const setIncluso = (i: number, v: string) => setForm(f => f && ({ ...f, inclusos: f.inclusos.map((x, j) => j === i ? v : x) }))
  const rmIncluso = (i: number) => setForm(f => f && ({ ...f, inclusos: f.inclusos.filter((_, j) => j !== i) }))

  const addHotel = () => setForm(f => f && ({ ...f, hoteis: [...f.hoteis, { id: uuid(), nome: '', checkinDia: 1, checkoutDia: Math.max(1, dn.dias || 1) }] }))
  const setHotel = (id: string, patch: Partial<Hotel>) => setForm(f => f && ({ ...f, hoteis: f.hoteis.map(h => h.id === id ? { ...h, ...patch } : h) }))
  const rmHotel = (id: string) => setForm(f => f && ({ ...f, hoteis: f.hoteis.filter(h => h.id !== id) }))

  const addParada = () => setForm(f => {
    if (!f) return f
    const ultimo = f.roteiroPadrao.reduce((m, p) => Math.max(m, p.dia), 1)
    return { ...f, roteiroPadrao: [...f.roteiroPadrao, { id: uuid(), dia: ultimo, titulo: '' }] }
  })
  const setParada = (id: string, patch: Partial<ParadaModelo>) => setForm(f => f && ({ ...f, roteiroPadrao: f.roteiroPadrao.map(p => p.id === id ? { ...p, ...patch } : p) }))
  const rmParada = (id: string) => setForm(f => f && ({ ...f, roteiroPadrao: f.roteiroPadrao.filter(p => p.id !== id) }))
  const toggleForma = (k: string) => setForm(f => f && ({ ...f, formasAceitas: f.formasAceitas.includes(k) ? f.formasAceitas.filter(x => x !== k) : [...f.formasAceitas, k] }))

  async function salvar() {
    if (!form || salvando) return
    if (!form.nome.trim()) { toast('Informe o nome do pacote.', 'erro'); return }
    if (dataInvertida) { toast('A volta não pode ser antes da ida.', 'erro'); return }
    if (form.roteiroPadrao.some(p => !p.titulo.trim())) { toast('Há parada no roteiro sem título — preencha ou remova.', 'erro'); return }
    if (form.hoteis.some(h => !h.nome.trim())) { toast('Há hotel sem nome — preencha ou remova.', 'erro'); return }
    setSalvando(true)
    const num = (s: string) => (s === '' ? undefined : Number(s))
    const corpo = {
      ...form,
      valorBase: Number(form.valorBase) || 0,
      precos: {
        valorCrianca: num(form.valorCrianca), valorMeia: num(form.valorMeia),
        entrada: num(form.entrada), parcelas: num(form.parcelas), valorParcela: num(form.valorParcela),
        formasAceitas: form.formasAceitas,
      },
      inclusos: form.inclusos.map(s => s.trim()).filter(Boolean),
      roteiroPadrao: form.roteiroPadrao.filter(p => p.titulo.trim()),
      hoteis: form.hoteis.filter(h => h.nome.trim()),
    }
    const r = await fetch('/api/pacotes-viagem', {
      method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast(form.id ? 'Pacote atualizado.' : 'Pacote cadastrado.', 'sucesso'); setForm(null); carregar() }
    else toast(r?.error || 'Falha ao salvar.', 'erro')
  }

  async function excluir(p: Pacote) {
    const ok = await confirmar(
      `Excluir o pacote "${p.nome}"? As viagens que já nasceram dele continuam inteiras — elas copiaram os dados.`,
      { titulo: 'Excluir pacote', okLabel: 'Excluir', perigo: true },
    )
    if (!ok) return
    const r = await fetch('/api/pacotes-viagem', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { toast('Pacote excluído.', 'sucesso'); setForm(null); carregar() } else toast(r?.error || 'Falha ao excluir.', 'erro')
  }

  const porDia = (paradas: ParadaModelo[]) => {
    const dias = Array.from(new Set(paradas.map(p => p.dia))).sort((a, b) => a - b)
    return dias.map(d => ({ dia: d, paradas: paradas.filter(p => p.dia === d).sort((a, b) => (a.hora || '').localeCompare(b.hora || '')) }))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#111' }}>Pacotes</h2>
        <span style={{ flex: 1 }} />
        {podeEditar && <button onClick={abrirNovo} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Pacote</button>}
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#999' }}>Modelos reutilizáveis de viagem. Preencha as datas de uma saída típica: o roteiro e os hotéis são guardados em dias (Dia 1, Dia 2…), então o mesmo pacote serve qualquer data — a viagem copia tudo e vira datas reais.</p>

      {carregando ? <p style={{ color: '#aaa', fontSize: 13 }}>Carregando...</p>
        : lista.length === 0 ? <p style={{ color: '#aaa', fontSize: 13 }}>Nenhum pacote cadastrado.</p>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {lista.map(p => (
              <div key={p.id} onClick={() => podeEditar && abrirEditar(p)} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: podeEditar ? 'pointer' : 'default', opacity: p.ativo === false ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{p.nome}</span>
                  {p.ativo === false && <span style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', background: '#f4f4f5', borderRadius: 999, padding: '2px 8px' }}>Inativo</span>}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>{fmtBRL(p.valorBase)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: '#666', marginTop: 4 }}>
                  {p.destino || 'sem destino'}
                  {p.dias ? ` · ${p.dias} dia(s)` : ''}{p.noites ? ` / ${p.noites} noite(s)` : ''}
                </div>
                {resumoParcelamento(p.precos) && <div style={{ fontSize: 11.5, color: '#166534', marginTop: 3 }}>ou {resumoParcelamento(p.precos)}</div>}
                <div style={{ fontSize: 11.5, color: '#999', marginTop: 6 }}>
                  {[p.roteiroPadrao?.length ? `${p.roteiroPadrao.length} parada(s)` : '', p.hoteis?.length ? `${p.hoteis.length} hotel(is)` : '', p.inclusos?.length ? `${p.inclusos.length} incluso(s)` : ''].filter(Boolean).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        )}

      {form && (
        <div onClick={() => setForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 700, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16.5, color: '#111' }}>{form.id ? 'Editar pacote' : 'Novo pacote'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input value={form.nome} onChange={e => setForm(f => f && ({ ...f, nome: e.target.value }))} placeholder="Nome (ex.: Rio e Paraty)" style={{ ...inputStyle, fontSize: 14 }} />
              <input value={form.destino} onChange={e => setForm(f => f && ({ ...f, destino: e.target.value }))} placeholder="Destino (ex.: Rio de Janeiro e Paraty (RJ))" style={inputStyle} />

              {/* ── Datas e horários: dias/noites saem DAQUI ── */}
              <div>
                <span style={secaoStyle}>Datas e horários</span>
                <p style={{ margin: '2px 0 8px', fontSize: 11, color: '#bbb' }}>De uma saída típica. O roteiro é guardado em Dia 1/Dia 2, então o pacote continua servindo qualquer data.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 130 }}><label style={labelStyle}>Ida</label><input type="date" value={form.dataIdaRef} onChange={e => setForm(f => f && ({ ...f, dataIdaRef: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                  <div style={{ flex: 1, minWidth: 120 }}><label style={labelStyle}>Saída</label><input type="time" value={form.horaSaida} onChange={e => setForm(f => f && ({ ...f, horaSaida: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                  <div style={{ flex: 1, minWidth: 130 }}><label style={labelStyle}>Volta</label><input type="date" value={form.dataVoltaRef} onChange={e => setForm(f => f && ({ ...f, dataVoltaRef: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                  <div style={{ flex: 1, minWidth: 120 }}><label style={labelStyle}>Retorno</label><input type="time" value={form.horaRetorno} onChange={e => setForm(f => f && ({ ...f, horaRetorno: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                </div>
                {dataInvertida
                  ? <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>A volta está antes da ida.</p>
                  : dn.dias !== undefined && (
                    <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 800, color: '#166534' }}>
                      {dn.dias} {dn.dias === 1 ? 'dia' : 'dias'} / {dn.noites} {dn.noites === 1 ? 'noite' : 'noites'}
                      <span style={{ fontWeight: 600, color: '#bbb', fontSize: 11, marginLeft: 6 }}>calculado das datas</span>
                    </p>
                  )}
              </div>

              {/* ── Valores ── */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <span style={secaoStyle}>Valores</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <div style={{ flex: 1, minWidth: 120 }}><label style={labelStyle}>À vista — adulto</label><input type="number" min={0} step="0.01" value={form.valorBase} onChange={e => setForm(f => f && ({ ...f, valorBase: e.target.value }))} placeholder="0,00" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                  <div style={{ flex: 1, minWidth: 110 }}><label style={labelStyle}>Criança</label><input type="number" min={0} step="0.01" value={form.valorCrianca} onChange={e => setForm(f => f && ({ ...f, valorCrianca: e.target.value }))} placeholder="igual adulto" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                  <div style={{ flex: 1, minWidth: 110 }}><label style={labelStyle}>Meia</label><input type="number" min={0} step="0.01" value={form.valorMeia} onChange={e => setForm(f => f && ({ ...f, valorMeia: e.target.value }))} placeholder="igual adulto" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#bbb' }}>Criança/meia em branco = cobra o valor de adulto. Zero é respeitado (colo não paga).</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <div style={{ flex: 1, minWidth: 110 }}><label style={labelStyle}>Entrada / sinal</label><input type="number" min={0} step="0.01" value={form.entrada} onChange={e => setForm(f => f && ({ ...f, entrada: e.target.value }))} placeholder="0,00" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                  <div style={{ flex: 1, minWidth: 90 }}><label style={labelStyle}>Parcelas</label><input type="number" min={1} value={form.parcelas} onChange={e => setForm(f => f && ({ ...f, parcelas: e.target.value }))} placeholder="10" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                  <div style={{ flex: 1, minWidth: 110 }}><label style={labelStyle}>Valor da parcela</label><input type="number" min={0} step="0.01" value={form.valorParcela} onChange={e => setForm(f => f && ({ ...f, valorParcela: e.target.value }))} placeholder="0,00" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                </div>
                {resumoParcelamento({ entrada: Number(form.entrada) || undefined, parcelas: Number(form.parcelas) || undefined, valorParcela: Number(form.valorParcela) || undefined }) && (
                  <p style={{ margin: '8px 0 0', fontSize: 12.5, fontWeight: 700, color: '#166534' }}>
                    {fmtBRL(Number(form.valorBase) || 0)} à vista, ou {resumoParcelamento({ entrada: Number(form.entrada) || undefined, parcelas: Number(form.parcelas) || undefined, valorParcela: Number(form.valorParcela) || undefined })}
                  </p>
                )}
                <div style={{ marginTop: 10 }}>
                  <label style={{ ...labelStyle, marginBottom: 6 }}>Formas aceitas</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {FORMAS.map(fm => {
                      const on = form.formasAceitas.includes(fm.key)
                      return <button key={fm.key} type="button" onClick={() => toggleForma(fm.key)} style={{ padding: '6px 11px', borderRadius: 999, border: on ? '1.5px solid #1d4ed8' : '1px solid #e6e6e6', background: on ? '#eff6ff' : '#fff', color: on ? '#1d4ed8' : '#777', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{fm.label}</button>
                    })}
                  </div>
                </div>
              </div>

              {/* ── Roteiro padrão (dia relativo) ── */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={secaoStyle}>Roteiro padrão</span>
                  <span style={{ flex: 1 }} />
                  <button type="button" onClick={addParada} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Parada</button>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 11, color: '#bbb' }}>Dia 1 = dia da ida. Ao criar a viagem, isto vira data de verdade.</p>
                {form.roteiroPadrao.length === 0 && <p style={{ margin: 0, fontSize: 12, color: '#ccc' }}>Sem roteiro — a viagem começa em branco.</p>}
                {form.roteiroPadrao.map(p => (
                  <div key={p.id} style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#888' }}>Dia</span>
                    <input type="number" min={1} value={p.dia} onChange={e => setParada(p.id, { dia: Math.max(1, Number(e.target.value) || 1) })} style={{ ...inputStyle, width: 62 }} />
                    <input type="time" value={p.hora || ''} onChange={e => setParada(p.id, { hora: e.target.value })} style={{ ...inputStyle, width: 110 }} />
                    <input value={p.titulo} onChange={e => setParada(p.id, { titulo: e.target.value })} placeholder="O que acontece" style={{ ...inputStyle, flex: 2, minWidth: 140 }} />
                    <input value={p.local || ''} onChange={e => setParada(p.id, { local: e.target.value })} placeholder="Local" style={{ ...inputStyle, flex: 1, minWidth: 100 }} />
                    <select value={p.tipo || ''} onChange={e => setParada(p.id, { tipo: e.target.value })} style={{ ...inputStyle, background: '#fff', minWidth: 110 }}>
                      <option value="">Tipo</option>
                      {TIPOS_PARADA.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button type="button" onClick={() => rmParada(p.id)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18 }}>×</button>
                  </div>
                ))}
                {form.roteiroPadrao.filter(p => p.titulo.trim()).length > 0 && (
                  <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 10, border: '1px solid #eee' }}>
                    {porDia(form.roteiroPadrao.filter(p => p.titulo.trim())).map(({ dia, paradas }) => (
                      <div key={dia} style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#111' }}>Dia {dia}: </span>
                        <span style={{ fontSize: 11.5, color: '#666' }}>{paradas.map(p => `${p.hora ? p.hora + ' ' : ''}${p.titulo}`).join(' · ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Hotéis: ficha com check-in/out ── */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={secaoStyle}>Hotéis</span>
                  <span style={{ flex: 1 }} />
                  <button type="button" onClick={addHotel} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Hotel</button>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 11, color: '#bbb' }}>Check-in e check-out também em dias — viram data real junto com a viagem.</p>
                {form.hoteis.length === 0 && <p style={{ margin: 0, fontSize: 12, color: '#ccc' }}>Nenhum hotel previsto.</p>}
                {form.hoteis.map(h => (
                  <div key={h.id} style={{ border: '1px solid #eee', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input value={h.nome} onChange={e => setHotel(h.id, { nome: e.target.value })} placeholder="Nome do hotel" style={{ ...inputStyle, flex: 1 }} />
                      <button type="button" onClick={() => rmHotel(h.id)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18 }}>×</button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#166534', width: 62 }}>Check-in</span>
                      <span style={{ fontSize: 11, color: '#888' }}>Dia</span>
                      <input type="number" min={1} value={h.checkinDia ?? ''} onChange={e => setHotel(h.id, { checkinDia: Number(e.target.value) || undefined })} style={{ ...inputStyle, width: 58 }} />
                      <input type="time" value={h.checkinHora || ''} onChange={e => setHotel(h.id, { checkinHora: e.target.value })} style={{ ...inputStyle, width: 110 }} />
                      <span style={{ width: 12 }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#b45309', width: 68 }}>Check-out</span>
                      <span style={{ fontSize: 11, color: '#888' }}>Dia</span>
                      <input type="number" min={1} value={h.checkoutDia ?? ''} onChange={e => setHotel(h.id, { checkoutDia: Number(e.target.value) || undefined })} style={{ ...inputStyle, width: 58 }} />
                      <input type="time" value={h.checkoutHora || ''} onChange={e => setHotel(h.id, { checkoutHora: e.target.value })} style={{ ...inputStyle, width: 110 }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Inclusos: TÓPICOS ── */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={secaoStyle}>Incluso no pacote</span>
                  <span style={{ flex: 1 }} />
                  <button type="button" onClick={addIncluso} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Item</button>
                </div>
                {form.inclusos.length === 0 && <p style={{ margin: 0, fontSize: 12, color: '#ccc' }}>Nenhum item. Cada linha é um tópico do que está incluso.</p>}
                {form.inclusos.map((inc, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ color: '#cbd5e1', fontSize: 16, lineHeight: 1 }}>•</span>
                    <input value={inc} onChange={e => setIncluso(i, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIncluso() } }}
                      placeholder="Ex.: Hospedagem 2 diárias com café da manhã" style={{ ...inputStyle, flex: 1 }} />
                    <button type="button" onClick={() => rmIncluso(i)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18 }}>×</button>
                  </div>
                ))}
              </div>

              <textarea value={form.observacoes} onChange={e => setForm(f => f && ({ ...f, observacoes: e.target.value }))} placeholder="Observações" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#333', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => f && ({ ...f, ativo: e.target.checked }))} style={{ width: 16, height: 16 }} /> Ativo (aparece ao criar viagem)
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 18, alignItems: 'center' }}>
              {form.id && podeExcluir && (
                <button onClick={() => { const p = lista.find(x => x.id === form.id); if (p) excluir(p) }}
                  style={{ padding: '9px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 9, color: '#b91c1c', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginRight: 'auto' }}>Excluir</button>
              )}
              <span style={{ flex: form.id && podeExcluir ? undefined : 1 }} />
              <button onClick={() => setForm(null)} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 9, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ padding: '10px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: salvando ? 'wait' : 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

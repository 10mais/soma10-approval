'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { layoutPorId, totalPoltronas } from '@/lib/layoutsOnibus'
import RoteiroExcursao, { type Parada } from './RoteiroExcursao'

// Excursões (turismo): uma saída com ônibus, motoristas, valor do pacote e inclusos.
// As reservas (poltronas + passageiros) vivem no módulo Reservas.

type Onibus = { id: string; nome: string; layoutId: string; ativo?: boolean }
type Motorista = { nome: string; cpf?: string; cnh?: string; email?: string }
type MotoristaCad = { id: string; nome: string; cnh?: string; email: string }
type Excursao = {
  id: string; titulo: string; roteiro?: string; dataIda: string; dataVolta?: string
  horaSaida?: string; horaRetorno?: string
  onibusId?: string; motoristas?: Motorista[]; valorPacote: number; descontoPadrao?: number
  inclusos?: string[]; paradas?: Parada[]; status: string; observacoes?: string
}
type Form = Omit<Excursao, 'id' | 'valorPacote' | 'descontoPadrao'> & { id?: string; valorPacote: string; descontoPadrao: string; inclusoNovo: string }

const STATUS: { key: string; label: string; cor: string; bg: string }[] = [
  { key: 'planejada', label: 'Planejada', cor: '#a16207', bg: '#fef9c3' },
  { key: 'aberta', label: 'Aberta (vendas)', cor: '#166534', bg: '#dcfce7' },
  { key: 'realizada', label: 'Realizada', cor: '#374151', bg: '#e5e7eb' },
  { key: 'cancelada', label: 'Cancelada', cor: '#9ca3af', bg: '#f4f4f5' },
]
const stInfo = (s: string) => STATUS.find(x => x.key === s) || STATUS[1]
const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (s?: string) => s ? new Date(s + 'T00:00').toLocaleDateString('pt-BR') : ''

const vazio = (): Form => ({ titulo: '', roteiro: '', dataIda: '', dataVolta: '', horaSaida: '', horaRetorno: '', onibusId: '', motoristas: [], valorPacote: '', descontoPadrao: '', inclusos: [], status: 'aberta', observacoes: '', inclusoNovo: '' })

export default function Excursoes({ podeEditar = true, podeExcluir = false }: { podeEditar?: boolean; podeExcluir?: boolean }) {
  const [lista, setLista] = useState<Excursao[]>([])
  const [onibus, setOnibus] = useState<Onibus[]>([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [formInicial, setFormInicial] = useState('')
  const [motoristasCad, setMotoristasCad] = useState<MotoristaCad[]>([])
  const [roteiroDe, setRoteiroDe] = useState<Excursao | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(() => {
    setCarregando(true)
    Promise.all([
      fetch('/api/excursoes').then(r => r.json()),
      fetch('/api/onibus').then(r => r.json()),
      fetch('/api/equipe').then(r => r.json()).catch(() => []),
    ]).then(([e, o, eq]) => {
      if (Array.isArray(e?.excursoes)) setLista(e.excursoes)
      if (Array.isArray(o?.onibus)) setOnibus(o.onibus)
      setMotoristasCad(Array.isArray(eq) ? eq.filter((u: any) => u.tipoTurismo === 'motorista').map((u: any) => ({ id: u.id, nome: u.nome, cnh: u.cnh, email: u.email })) : [])
    }).catch(() => {}).finally(() => setCarregando(false))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const vagasDe = (onibusId?: string) => { const o = onibus.find(x => x.id === onibusId); const l = o && layoutPorId(o.layoutId); return l ? totalPoltronas(l) : 0 }

  const snap = (f: Form | null) => f ? JSON.stringify({ ...f, inclusoNovo: '' }) : ''
  function abrirNovo() { const f = vazio(); setForm(f); setFormInicial(snap(f)) }
  function abrirEditar(e: Excursao) {
    const f: Form = { id: e.id, titulo: e.titulo, roteiro: e.roteiro || '', dataIda: e.dataIda, dataVolta: e.dataVolta || '', horaSaida: e.horaSaida || '', horaRetorno: e.horaRetorno || '', onibusId: e.onibusId || '', motoristas: e.motoristas || [], valorPacote: String(e.valorPacote || ''), descontoPadrao: e.descontoPadrao ? String(e.descontoPadrao) : '', inclusos: e.inclusos || [], status: e.status, observacoes: e.observacoes || '', inclusoNovo: '' }
    setForm(f); setFormInicial(snap(f))
  }
  async function fecharForm() {
    if (form && snap(form) !== formInicial) {
      const ok = await confirmar('Você tem alterações não salvas nesta excursão.', { titulo: 'Alterações não salvas', okLabel: 'Sair sem salvar', cancelLabel: 'Continuar editando', perigo: true })
      if (!ok) return
    }
    setForm(null)
  }
  const setMot = (i: number, patch: Partial<Motorista>) => setForm(f => f && ({ ...f, motoristas: (f.motoristas || []).map((m, j) => j === i ? { ...m, ...patch } : m) }))
  const addMot = () => setForm(f => f && ({ ...f, motoristas: [...(f.motoristas || []), { nome: '' }] }))
  const addMotCad = (u: MotoristaCad) => setForm(f => f && ({ ...f, motoristas: [...(f.motoristas || []), { nome: u.nome, cnh: u.cnh || '', email: u.email }] }))
  const rmMot = (i: number) => setForm(f => f && ({ ...f, motoristas: (f.motoristas || []).filter((_, j) => j !== i) }))
  const addIncluso = () => setForm(f => { if (!f || !f.inclusoNovo.trim()) return f; return { ...f, inclusos: [...(f.inclusos || []), f.inclusoNovo.trim()], inclusoNovo: '' } })
  const rmIncluso = (i: number) => setForm(f => f && ({ ...f, inclusos: (f.inclusos || []).filter((_, j) => j !== i) }))

  async function salvar() {
    if (!form || salvando) return
    if (!form.titulo.trim()) { toast('Informe o título da excursão.', 'erro'); return }
    if (!form.dataIda) { toast('Informe a data de ida.', 'erro'); return }
    setSalvando(true)
    const corpo = { ...form, valorPacote: Number(form.valorPacote) || 0, descontoPadrao: Number(form.descontoPadrao) || 0, motoristas: (form.motoristas || []).filter(m => m.nome.trim()) }
    const r = await fetch('/api/excursoes', { method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast(form.id ? 'Excursão atualizada.' : 'Excursão criada.', 'sucesso'); setForm(null); carregar() }
    else toast(r?.error || 'Falha ao salvar.', 'erro')
  }
  async function excluir(e: Excursao) {
    if (!(await confirmar(`Excluir a excursão "${e.titulo}"?`, { titulo: 'Excluir excursão', okLabel: 'Excluir', perigo: true }))) return
    const r = await fetch('/api/excursoes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { toast('Excursão excluída.', 'sucesso'); carregar() } else toast(r?.error || 'Falha ao excluir.', 'erro')
  }

  const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 5 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#111' }}>Excursões</h2>
        <span style={{ flex: 1 }} />
        {podeEditar && <button onClick={abrirNovo} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Excursão</button>}
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#999' }}>Saídas da operadora. Defina ônibus, motoristas, valor do pacote e o que está incluso.</p>

      {carregando ? <p style={{ color: '#aaa', fontSize: 13 }}>Carregando...</p>
        : lista.length === 0 ? <p style={{ color: '#aaa', fontSize: 13 }}>Nenhuma excursão cadastrada.</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lista.map(e => {
              const st = stInfo(e.status); const vagas = vagasDe(e.onibusId); const o = onibus.find(x => x.id === e.onibusId)
              return (
                <div key={e.id} onClick={() => podeEditar && abrirEditar(e)} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: podeEditar ? 'pointer' : 'default' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{e.titulo}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: st.cor, background: st.bg, borderRadius: 999, padding: '2px 8px' }}>{st.label}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>{fmtBRL(e.valorPacote)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#666', marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{fmtData(e.dataIda)}{e.horaSaida ? ` ${e.horaSaida}` : ''}{e.dataVolta ? ` → ${fmtData(e.dataVolta)}` : ''}</span>
                    {o && <span>· {o.nome}{vagas ? ` (${vagas} lug.)` : ''}</span>}
                    {e.motoristas && e.motoristas.length > 0 && <span>· {e.motoristas.length} motorista(s)</span>}
                  </div>
                  {e.inclusos && e.inclusos.length > 0 && <div style={{ fontSize: 11.5, color: '#999', marginTop: 6 }}>Inclusos: {e.inclusos.join(' · ')}</div>}
                  {(podeEditar || (e.paradas && e.paradas.length > 0)) && (
                    <div style={{ marginTop: 8 }}>
                      <button type="button" onClick={ev => { ev.stopPropagation(); setRoteiroDe(e) }} style={{ fontSize: 11.5, fontWeight: 700, color: '#2563eb', background: '#eff6ff', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>Roteiro{e.paradas && e.paradas.length ? ` (${e.paradas.length})` : ''}</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      {form && (
        <div onClick={fecharForm} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 540, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16.5, color: '#111' }}>{form.id ? 'Editar excursão' : 'Nova excursão'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={form.titulo} onChange={e => setForm(f => f && ({ ...f, titulo: e.target.value }))} placeholder="Título (ex.: Foz do Iguaçu — Julho)" style={{ ...inputStyle, fontSize: 14 }} />
              <input value={form.roteiro} onChange={e => setForm(f => f && ({ ...f, roteiro: e.target.value }))} placeholder="Roteiro (cidades/pontos)" style={inputStyle} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 130 }}><label style={labelStyle}>Ida</label><input type="date" value={form.dataIda} onChange={e => setForm(f => f && ({ ...f, dataIda: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: 1, minWidth: 130 }}><label style={labelStyle}>Volta</label><input type="date" value={form.dataVolta} onChange={e => setForm(f => f && ({ ...f, dataVolta: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 130 }}><label style={labelStyle}>Horário de saída</label><input type="time" value={form.horaSaida || ''} onChange={e => setForm(f => f && ({ ...f, horaSaida: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: 1, minWidth: 130 }}><label style={labelStyle}>Horário de retorno</label><input type="time" value={form.horaRetorno || ''} onChange={e => setForm(f => f && ({ ...f, horaRetorno: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
              </div>
              <div>
                <label style={labelStyle}>Ônibus</label>
                <select value={form.onibusId} onChange={e => setForm(f => f && ({ ...f, onibusId: e.target.value }))} style={{ ...inputStyle, width: '100%', background: '#fff' }}>
                  <option value="">Sem ônibus definido</option>
                  {onibus.filter(o => o.ativo !== false).map(o => <option key={o.id} value={o.id}>{o.nome} ({vagasDe(o.id)} lug.)</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 130 }}><label style={labelStyle}>Valor do pacote (R$)</label><input type="number" min={0} step="0.01" value={form.valorPacote} onChange={e => setForm(f => f && ({ ...f, valorPacote: e.target.value }))} placeholder="0,00" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: 1, minWidth: 130 }}>
                  <label style={labelStyle}>Situação</label>
                  <select value={form.status} onChange={e => setForm(f => f && ({ ...f, status: e.target.value }))} style={{ ...inputStyle, width: '100%', background: '#fff' }}>
                    {STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              {/* Motoristas */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Motoristas</label>
                  {motoristasCad.length > 0 && (
                    <select value="" onChange={e => { const u = motoristasCad.find(m => m.email === e.target.value); if (u) addMotCad(u) }} style={{ ...inputStyle, padding: '6px 10px', fontSize: 12, background: '#fff' }}>
                      <option value="">+ Do cadastro…</option>
                      {motoristasCad.filter(m => !(form.motoristas || []).some(x => x.email === m.email)).map(m => <option key={m.email} value={m.email}>{m.nome}{m.cnh ? ` (CNH ${m.cnh})` : ''}</option>)}
                    </select>
                  )}
                  <button type="button" onClick={addMot} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>+ Manual</button>
                </div>
                {motoristasCad.length === 0 && <p style={{ margin: '0 0 6px', fontSize: 11, color: '#bbb' }}>Cadastre motoristas em Colaboradores (Tipo = Motorista) para escolhê-los aqui.</p>}
                {(form.motoristas || []).map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input value={m.nome} onChange={e => setMot(i, { nome: e.target.value })} placeholder="Nome" style={{ ...inputStyle, flex: 2 }} />
                    <input value={m.cnh || ''} onChange={e => setMot(i, { cnh: e.target.value })} placeholder="CNH" style={{ ...inputStyle, flex: 1, minWidth: 80 }} />
                    <button type="button" onClick={() => rmMot(i)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18 }}>×</button>
                  </div>
                ))}
              </div>
              {/* Inclusos */}
              <div>
                <label style={labelStyle}>Inclusos no pacote</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input value={form.inclusoNovo} onChange={e => setForm(f => f && ({ ...f, inclusoNovo: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIncluso() } }} placeholder="Ex.: Hospedagem 2 diárias" style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={addIncluso} style={{ padding: '9px 14px', background: '#f4f4f5', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', color: '#333' }}>Add</button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(form.inclusos || []).map((inc, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#333', background: '#f4f4f5', borderRadius: 999, padding: '4px 10px' }}>{inc}<button type="button" onClick={() => rmIncluso(i)} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button></span>
                  ))}
                </div>
              </div>
              <textarea value={form.observacoes} onChange={e => setForm(f => f && ({ ...f, observacoes: e.target.value }))} placeholder="Observações" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
              {form.id && podeExcluir && <button onClick={() => { const e = lista.find(x => x.id === form.id); if (e) excluir(e) }} style={{ padding: '9px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 9, color: '#b91c1c', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginRight: 'auto' }}>Excluir</button>}
              <span style={{ flex: form.id ? undefined : 1 }} />
              <button onClick={fecharForm} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 9, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ padding: '10px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: salvando ? 'wait' : 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
      {roteiroDe && (
        <RoteiroExcursao excursao={roteiroDe} podeEditar={podeEditar} onClose={() => setRoteiroDe(null)} onSaved={carregar} />
      )}
    </div>
  )
}

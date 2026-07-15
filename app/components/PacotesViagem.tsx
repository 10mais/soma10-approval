'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { v4 as uuid } from 'uuid'

// PACOTES DE VIAGEM (turismo): o modelo reutilizável — "Foz do Iguaçu 3 dias" sai
// 5x no ano. A Viagem COPIA o pacote; mexer aqui depois não reescreve viagem já
// vendida (de propósito).
//
// O roteiro é por DIA RELATIVO (Dia 1 = dia da ida), nunca data absoluta: é o que
// faz o mesmo pacote servir julho e dezembro.
//
// ⚠️ Nada a ver com os pacotes de TRATAMENTO da clínica (/api/pacotes).

type ParadaModelo = { id: string; dia: number; hora?: string; titulo: string; local?: string; tipo?: string; observacoes?: string }
type Pacote = {
  id: string; nome: string; destino?: string; dias?: number; noites?: number
  valorBase: number; inclusos?: string[]; roteiroPadrao?: ParadaModelo[]
  hoteis?: string[]; observacoes?: string; ativo?: boolean
}
type Form = Omit<Pacote, 'id' | 'valorBase' | 'dias' | 'noites'> & {
  id?: string; valorBase: string; dias: string; noites: string; inclusoNovo: string; hotelNovo: string
}

const TIPOS_PARADA = ['embarque', 'passeio', 'refeicao', 'hospedagem', 'translado', 'livre']
const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const vazio = (): Form => ({ nome: '', destino: '', dias: '', noites: '', valorBase: '', inclusos: [], roteiroPadrao: [], hoteis: [], observacoes: '', ativo: true, inclusoNovo: '', hotelNovo: '' })

const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 5 }

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

  function abrirNovo() { setForm(vazio()) }
  function abrirEditar(p: Pacote) {
    setForm({
      id: p.id, nome: p.nome, destino: p.destino || '', dias: p.dias ? String(p.dias) : '', noites: p.noites ? String(p.noites) : '',
      valorBase: p.valorBase ? String(p.valorBase) : '', inclusos: p.inclusos || [], roteiroPadrao: p.roteiroPadrao || [],
      hoteis: p.hoteis || [], observacoes: p.observacoes || '', ativo: p.ativo !== false, inclusoNovo: '', hotelNovo: '',
    })
  }

  const addIncluso = () => setForm(f => { if (!f || !f.inclusoNovo.trim()) return f; return { ...f, inclusos: [...(f.inclusos || []), f.inclusoNovo.trim()], inclusoNovo: '' } })
  const rmIncluso = (i: number) => setForm(f => f && ({ ...f, inclusos: (f.inclusos || []).filter((_, j) => j !== i) }))
  const addHotel = () => setForm(f => { if (!f || !f.hotelNovo.trim()) return f; return { ...f, hoteis: [...(f.hoteis || []), f.hotelNovo.trim()], hotelNovo: '' } })
  const rmHotel = (i: number) => setForm(f => f && ({ ...f, hoteis: (f.hoteis || []).filter((_, j) => j !== i) }))

  const addParada = () => setForm(f => {
    if (!f) return f
    // Nasce no último dia usado (ou 1): quem monta roteiro adiciona em sequência.
    const ultimo = (f.roteiroPadrao || []).reduce((m, p) => Math.max(m, p.dia), 1)
    return { ...f, roteiroPadrao: [...(f.roteiroPadrao || []), { id: uuid(), dia: ultimo, titulo: '' }] }
  })
  const setParada = (id: string, patch: Partial<ParadaModelo>) => setForm(f => f && ({ ...f, roteiroPadrao: (f.roteiroPadrao || []).map(p => p.id === id ? { ...p, ...patch } : p) }))
  const rmParada = (id: string) => setForm(f => f && ({ ...f, roteiroPadrao: (f.roteiroPadrao || []).filter(p => p.id !== id) }))

  async function salvar() {
    if (!form || salvando) return
    if (!form.nome.trim()) { toast('Informe o nome do pacote.', 'erro'); return }
    const semTitulo = (form.roteiroPadrao || []).some(p => !p.titulo.trim())
    if (semTitulo) { toast('Há parada no roteiro sem título — preencha ou remova.', 'erro'); return }
    setSalvando(true)
    const corpo = {
      ...form,
      dias: form.dias ? Number(form.dias) : undefined,
      noites: form.noites ? Number(form.noites) : undefined,
      valorBase: Number(form.valorBase) || 0,
      roteiroPadrao: (form.roteiroPadrao || []).filter(p => p.titulo.trim()),
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

  // Paradas agrupadas por dia, para o roteiro ler como itinerário.
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
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#999' }}>Modelos reutilizáveis de viagem. O roteiro fica em dias (Dia 1, Dia 2…) para o mesmo pacote sair em qualquer data — a viagem copia tudo e vira datas reais.</p>

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
                {p.roteiroPadrao && p.roteiroPadrao.length > 0 && <div style={{ fontSize: 11.5, color: '#999', marginTop: 6 }}>Roteiro com {p.roteiroPadrao.length} parada(s)</div>}
                {p.inclusos && p.inclusos.length > 0 && <div style={{ fontSize: 11.5, color: '#999', marginTop: 4 }}>Inclusos: {p.inclusos.join(' · ')}</div>}
              </div>
            ))}
          </div>
        )}

      {form && (
        <div onClick={() => setForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 640, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16.5, color: '#111' }}>{form.id ? 'Editar pacote' : 'Novo pacote'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={form.nome} onChange={e => setForm(f => f && ({ ...f, nome: e.target.value }))} placeholder="Nome (ex.: Foz do Iguaçu 3 dias)" style={{ ...inputStyle, fontSize: 14 }} />
              <input value={form.destino} onChange={e => setForm(f => f && ({ ...f, destino: e.target.value }))} placeholder="Destino (ex.: Foz do Iguaçu/PR)" style={inputStyle} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 90 }}><label style={labelStyle}>Dias</label><input type="number" min={1} value={form.dias} onChange={e => setForm(f => f && ({ ...f, dias: e.target.value }))} placeholder="3" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: 1, minWidth: 90 }}><label style={labelStyle}>Noites</label><input type="number" min={0} value={form.noites} onChange={e => setForm(f => f && ({ ...f, noites: e.target.value }))} placeholder="2" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: 1.4, minWidth: 130 }}>
                  <label style={labelStyle}>Valor por cliente (R$)</label>
                  <input type="number" min={0} step="0.01" value={form.valorBase} onChange={e => setForm(f => f && ({ ...f, valorBase: e.target.value }))} placeholder="0,00" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                </div>
              </div>
              <p style={{ margin: '-4px 0 0', fontSize: 11, color: '#bbb' }}>Dias define a volta sugerida da viagem (ida + dias − 1). O valor é o ponto de partida — cada viagem pode ajustar sem mexer no pacote.</p>

              {/* Roteiro padrão — DIA RELATIVO */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Roteiro padrão</label>
                  <span style={{ flex: 1 }} />
                  <button type="button" onClick={addParada} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Parada</button>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 11, color: '#bbb' }}>Dia 1 = dia da ida. Ao criar a viagem, isto vira data de verdade.</p>
                {(form.roteiroPadrao || []).length === 0 && <p style={{ margin: 0, fontSize: 12, color: '#ccc' }}>Sem roteiro — a viagem começa em branco.</p>}
                {(form.roteiroPadrao || []).map(p => (
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
                {(form.roteiroPadrao || []).filter(p => p.titulo.trim()).length > 0 && (
                  <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 10, border: '1px solid #eee' }}>
                    {porDia((form.roteiroPadrao || []).filter(p => p.titulo.trim())).map(({ dia, paradas }) => (
                      <div key={dia} style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#111' }}>Dia {dia}: </span>
                        <span style={{ fontSize: 11.5, color: '#666' }}>{paradas.map(p => `${p.hora ? p.hora + ' ' : ''}${p.titulo}`).join(' · ')}</span>
                      </div>
                    ))}
                  </div>
                )}
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

              {/* Hotéis previstos — vira vínculo com o cadastro de Hotéis na fase 4 */}
              <div>
                <label style={labelStyle}>Hotéis previstos</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input value={form.hotelNovo} onChange={e => setForm(f => f && ({ ...f, hotelNovo: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHotel() } }} placeholder="Nome do hotel" style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={addHotel} style={{ padding: '9px 14px', background: '#f4f4f5', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', color: '#333' }}>Add</button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(form.hoteis || []).map((h, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#1d4ed8', background: '#eff6ff', borderRadius: 999, padding: '4px 10px' }}>{h}<button type="button" onClick={() => rmHotel(i)} style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button></span>
                  ))}
                </div>
              </div>

              <textarea value={form.observacoes} onChange={e => setForm(f => f && ({ ...f, observacoes: e.target.value }))} placeholder="Observações" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#333', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.ativo !== false} onChange={e => setForm(f => f && ({ ...f, ativo: e.target.checked }))} style={{ width: 16, height: 16 }} /> Ativo (aparece ao criar viagem)
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
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

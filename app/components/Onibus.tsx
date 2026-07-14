'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { LAYOUTS, layoutPorId, totalPoltronas } from '@/lib/layoutsOnibus'

// Frota de ônibus (turismo). Cada ônibus tem um layout de poltronas (preset) —
// a excursão herda o mapa dele. CRUD simples.

type Onibus = {
  id: string; nome: string; placa?: string; layoutId: string
  amenidades?: string[]; ativo?: boolean; observacoes?: string
}
type Form = { nome: string; placa: string; layoutId: string; amenidades: string[]; ativo: boolean; observacoes: string }

const AMENIDADES = ['Starlink', 'Wi-Fi', 'Ar-condicionado', 'Banheiro', 'Frigobar', 'Tomadas', 'TV', 'Café/Água']

const vazio = (): Form => ({ nome: '', placa: '', layoutId: LAYOUTS[0]?.id || '', amenidades: ['Starlink'], ativo: true, observacoes: '' })

export default function OnibusModulo({ podeEditar = true, podeExcluir = false }: { podeEditar?: boolean; podeExcluir?: boolean }) {
  const [lista, setLista] = useState<Onibus[]>([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState<(Form & { id?: string }) | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(() => {
    setCarregando(true)
    fetch('/api/onibus').then(r => r.json()).then(d => { if (Array.isArray(d?.onibus)) setLista(d.onibus) }).catch(() => {}).finally(() => setCarregando(false))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() { setForm(vazio()) }
  function abrirEditar(o: Onibus) { setForm({ id: o.id, nome: o.nome, placa: o.placa || '', layoutId: o.layoutId, amenidades: o.amenidades || [], ativo: o.ativo !== false, observacoes: o.observacoes || '' }) }
  const toggleAmen = (a: string) => setForm(f => f && ({ ...f, amenidades: f.amenidades.includes(a) ? f.amenidades.filter(x => x !== a) : [...f.amenidades, a] }))

  async function salvar() {
    if (!form || salvando) return
    if (!form.nome.trim()) { toast('Informe o nome do ônibus.', 'erro'); return }
    setSalvando(true)
    const r = await fetch('/api/onibus', {
      method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast(form.id ? 'Ônibus atualizado.' : 'Ônibus cadastrado.', 'sucesso'); setForm(null); carregar() }
    else toast(r?.error || 'Falha ao salvar.', 'erro')
  }
  async function excluir(o: Onibus) {
    if (!(await confirmar(`Excluir o ônibus "${o.nome}"?`, { titulo: 'Excluir ônibus', okLabel: 'Excluir', perigo: true }))) return
    const r = await fetch('/api/onibus', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { toast('Ônibus excluído.', 'sucesso'); carregar() } else toast(r?.error || 'Falha ao excluir.', 'erro')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#111' }}>Ônibus</h2>
        <span style={{ flex: 1 }} />
        {podeEditar && <button onClick={abrirNovo} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Ônibus</button>}
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#999' }}>Frota da operadora. O layout define o mapa de poltronas usado nas reservas.</p>

      {carregando ? <p style={{ color: '#aaa', fontSize: 13 }}>Carregando...</p>
        : lista.length === 0 ? <p style={{ color: '#aaa', fontSize: 13 }}>Nenhum ônibus cadastrado.</p>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {lista.map(o => {
              const layout = layoutPorId(o.layoutId)
              return (
                <div key={o.id} onClick={() => podeEditar && abrirEditar(o)} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: podeEditar ? 'pointer' : 'default', opacity: o.ativo === false ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{o.nome}</span>
                    {o.placa && <span style={{ fontSize: 11.5, color: '#999', fontWeight: 600 }}>{o.placa}</span>}
                    {o.ativo === false && <span style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', background: '#f4f4f5', borderRadius: 999, padding: '2px 8px' }}>Inativo</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{layout ? `${layout.nome} · ${totalPoltronas(layout)} poltronas` : 'layout inválido'}</div>
                  {o.amenidades && o.amenidades.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                      {o.amenidades.map(a => <span key={a} style={{ fontSize: 10.5, fontWeight: 600, color: '#1d4ed8', background: '#eff6ff', borderRadius: 999, padding: '2px 8px' }}>{a}</span>)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      {form && (
        <div onClick={() => setForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16.5, color: '#111' }}>{form.id ? 'Editar ônibus' : 'Novo ônibus'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={form.nome} onChange={e => setForm(f => f && ({ ...f, nome: e.target.value }))} placeholder="Nome (ex.: DD 01 - Prata)" style={{ flex: 2, padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13.5, fontFamily: 'inherit' }} />
                <input value={form.placa} onChange={e => setForm(f => f && ({ ...f, placa: e.target.value.toUpperCase() }))} placeholder="Placa" style={{ flex: 1, minWidth: 90, padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13.5, fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 5 }}>Layout de poltronas</label>
                <select value={form.layoutId} onChange={e => setForm(f => f && ({ ...f, layoutId: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                  {LAYOUTS.map(l => <option key={l.id} value={l.id}>{l.nome} · {totalPoltronas(l)} lugares</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Amenidades</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {AMENIDADES.map(a => {
                    const on = form.amenidades.includes(a)
                    return <button key={a} type="button" onClick={() => toggleAmen(a)} style={{ padding: '6px 11px', borderRadius: 999, border: on ? '1.5px solid #1d4ed8' : '1px solid #e6e6e6', background: on ? '#eff6ff' : '#fff', color: on ? '#1d4ed8' : '#777', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{a}</button>
                  })}
                </div>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#333', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => f && ({ ...f, ativo: e.target.checked }))} style={{ width: 16, height: 16 }} /> Ativo (disponível para excursões)
              </label>
              <textarea value={form.observacoes} onChange={e => setForm(f => f && ({ ...f, observacoes: e.target.value }))} placeholder="Observações" rows={2} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
              {form.id && podeExcluir && <button onClick={() => { const o = lista.find(x => x.id === form.id); if (o) excluir(o) }} style={{ padding: '9px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 9, color: '#b91c1c', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginRight: 'auto' }}>Excluir</button>}
              <span style={{ flex: form.id ? undefined : 1 }} />
              <button onClick={() => setForm(null)} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 9, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ padding: '10px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: salvando ? 'wait' : 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

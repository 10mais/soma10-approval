'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'

// Procedimentos e Métodos (perfil clínica): catálogo do que a clínica atende.
// A Agenda (tipo de atendimento) e o pós-atendimento consomem esta lista.

type Procedimento = { id: string; nome: string; categoria?: string; valorPadrao?: number; duracaoMin?: number; descricao?: string }
type Form = { id?: string; nome: string; categoria: string; valorPadrao: string; duracaoMin: string; descricao: string }

const vazio = (): Form => ({ nome: '', categoria: '', valorPadrao: '', duracaoMin: '', descricao: '' })
const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Procedimentos({ podeEditar = false }: { podeEditar?: boolean }) {
  const [lista, setLista] = useState<Procedimento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(() => {
    fetch('/api/procedimentos').then(r => r.json())
      .then(d => { if (Array.isArray(d?.procedimentos)) setLista(d.procedimentos) })
      .catch(() => {}).finally(() => setCarregando(false))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function salvar() {
    if (!form || salvando) return
    if (!form.nome.trim()) { toast('Informe o nome do procedimento.', 'erro'); return }
    setSalvando(true)
    const corpo = { ...form, valorPadrao: Number(form.valorPadrao) || 0, duracaoMin: Number(form.duracaoMin) || 0 }
    const r = await fetch('/api/procedimentos', { method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast(form.id ? 'Procedimento atualizado.' : 'Procedimento cadastrado.', 'sucesso'); setForm(null); carregar() }
    else toast(r?.error || 'Falha ao salvar.', 'erro')
  }
  async function excluir(p: Procedimento) {
    if (!(await confirmar(`Excluir o procedimento "${p.nome}"?`, { titulo: 'Excluir procedimento', okLabel: 'Excluir', perigo: true }))) return
    const r = await fetch(`/api/procedimentos?id=${p.id}`, { method: 'DELETE' }).then(x => x.json()).catch(() => null)
    if (r?.ok) { toast('Procedimento excluído.', 'sucesso'); carregar() } else toast(r?.error || 'Falha ao excluir.', 'erro')
  }

  // Agrupa por categoria (sem categoria vai para "Geral")
  const grupos = lista.reduce<Record<string, Procedimento[]>>((acc, p) => {
    const cat = (p.categoria || 'Geral').trim() || 'Geral'
    ;(acc[cat] = acc[cat] || []).push(p)
    return acc
  }, {})

  const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 5 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#111' }}>Procedimentos e Métodos</h2>
        <span style={{ flex: 1 }} />
        {podeEditar && <button onClick={() => setForm(vazio())} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Procedimento</button>}
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#999' }}>Tudo o que a clínica atende. A Agenda e o registro pós-atendimento usam esta lista.</p>

      {carregando ? <p style={{ color: '#aaa', fontSize: 13 }}>Carregando...</p>
        : lista.length === 0 ? <p style={{ color: '#aaa', fontSize: 13 }}>Nenhum procedimento cadastrado ainda. {podeEditar ? 'Comece pelo botão "+ Procedimento".' : ''}</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {Object.entries(grupos).map(([cat, itens]) => (
              <div key={cat}>
                <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {itens.map(p => (
                    <div key={p.id} onClick={() => podeEditar && setForm({ id: p.id, nome: p.nome, categoria: p.categoria || '', valorPadrao: p.valorPadrao ? String(p.valorPadrao) : '', duracaoMin: p.duracaoMin ? String(p.duracaoMin) : '', descricao: p.descricao || '' })}
                      style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: podeEditar ? 'pointer' : 'default' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: '#111' }}>{p.nome}</span>
                        <span style={{ flex: 1 }} />
                        {p.duracaoMin ? <span style={{ fontSize: 12, color: '#888' }}>{p.duracaoMin} min</span> : null}
                        {p.valorPadrao ? <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>{fmtBRL(p.valorPadrao)}</span> : null}
                      </div>
                      {p.descricao && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>{p.descricao}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      {form && (
        <div onClick={() => setForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16.5, color: '#111' }}>{form.id ? 'Editar procedimento' : 'Novo procedimento'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={form.nome} onChange={e => setForm(f => f && ({ ...f, nome: e.target.value }))} placeholder="Nome (ex.: Limpeza de pele profunda)" style={{ ...inputStyle, fontSize: 14 }} />
              <input value={form.categoria} onChange={e => setForm(f => f && ({ ...f, categoria: e.target.value }))} list="proc-categorias" placeholder="Categoria (ex.: Facial, Corporal, Método próprio)" style={inputStyle} />
              <datalist id="proc-categorias">{Object.keys(grupos).map(c => <option key={c} value={c} />)}</datalist>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Valor padrão (R$)</label><input type="number" min={0} step="0.01" value={form.valorPadrao} onChange={e => setForm(f => f && ({ ...f, valorPadrao: e.target.value }))} placeholder="0,00" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Duração (min)</label><input type="number" min={0} value={form.duracaoMin} onChange={e => setForm(f => f && ({ ...f, duracaoMin: e.target.value }))} placeholder="Ex.: 60" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
              </div>
              <textarea value={form.descricao} onChange={e => setForm(f => f && ({ ...f, descricao: e.target.value }))} placeholder="Descrição / observações (opcional)" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
              {form.id && <button onClick={() => { const p = lista.find(x => x.id === form.id); if (p) excluir(p) }} style={{ padding: '9px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 9, color: '#b91c1c', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginRight: 'auto' }}>Excluir</button>}
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

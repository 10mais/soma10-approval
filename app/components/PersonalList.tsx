'use client'
import { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'

type Item = { id: string; texto: string; feito: boolean }
type Nota = { id: string; texto: string; cor?: string }

// Paleta estilo post-it / Notas do iOS
const CORES = ['#fff8b8', '#ffd8e4', '#cfe8ff', '#d6f5d6', '#ffe0b2', '#e9d5ff']

export default function PersonalList() {
  const [notas, setNotas] = useState<Nota[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [novo, setNovo] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvo, setSalvo] = useState<'idle' | 'salvando' | 'ok'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montado = useRef(false)

  useEffect(() => {
    fetch('/api/personal').then(r => r.json()).then(d => {
      if (d && !d.error) {
        // Migra o rascunho antigo (texto único) para uma nota, se ainda não houver notas
        const ns: Nota[] = Array.isArray(d.notas) && d.notas.length
          ? d.notas
          : (d.rascunho && d.rascunho.trim() ? [{ id: uuid(), texto: d.rascunho, cor: CORES[0] }] : [])
        setNotas(ns)
        setItens(Array.isArray(d.itens) ? d.itens : [])
      }
      setCarregando(false); montado.current = true
    }).catch(() => { setCarregando(false); montado.current = true })
  }, [])

  // Salvamento automático (debounce)
  useEffect(() => {
    if (!montado.current) return
    setSalvo('salvando')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      fetch('/api/personal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rascunho: '', notas, itens }) })
        .then(() => { setSalvo('ok'); setTimeout(() => setSalvo('idle'), 1500) })
        .catch(() => setSalvo('idle'))
    }, 700)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [notas, itens])

  function addItem() { const t = novo.trim(); if (!t) return; setItens(a => [...a, { id: uuid(), texto: t, feito: false }]); setNovo('') }
  function addNota() { setNotas(a => [{ id: uuid(), texto: '', cor: CORES[a.length % CORES.length] }, ...a]) }
  const setNota = (id: string, patch: Partial<Nota>) => setNotas(a => a.map(n => n.id === id ? { ...n, ...patch } : n))

  const feitos = itens.filter(i => i.feito).length

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Personal list</h2>
          {salvo === 'salvando' && <span style={{ fontSize: 11.5, color: '#aaa' }}>salvando…</span>}
          {salvo === 'ok' && <span style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600 }}>salvo</span>}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Seu espaço privado. Só você vê — não entra em Tarefas nem na Esteira.</p>
      </div>

      {carregando ? <p style={{ color: '#aaa' }}>Carregando...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* NOTAS (post-its) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>Notas</span>
              <button onClick={addNota} style={{ padding: '8px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>+ Nova nota</button>
            </div>
            {notas.length === 0 ? (
              <div onClick={addNota} style={{ border: '2px dashed #e0e0e0', borderRadius: 14, padding: '28px 16px', textAlign: 'center', color: '#bbb', fontSize: 13, cursor: 'pointer' }}>
                Nenhuma nota ainda. Clique para criar a primeira.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, alignItems: 'start' }}>
                {notas.map(n => (
                  <div key={n.id} style={{ background: n.cor || CORES[0], borderRadius: 12, padding: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 150 }}>
                    <textarea value={n.texto} onChange={e => setNota(n.id, { texto: e.target.value })} placeholder="Escreva sua nota…"
                      style={{ flex: 1, minHeight: 96, border: 'none', background: 'transparent', resize: 'vertical', fontSize: 13.5, lineHeight: 1.5, fontFamily: 'inherit', color: '#3a3320', outline: 'none' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {CORES.map(c => (
                        <button key={c} onClick={() => setNota(n.id, { cor: c })} title="Cor" style={{ width: 15, height: 15, borderRadius: '50%', background: c, border: (n.cor || CORES[0]) === c ? '2px solid rgba(0,0,0,0.45)' : '1px solid rgba(0,0,0,0.12)', cursor: 'pointer', padding: 0 }} />
                      ))}
                      <button onClick={() => setNotas(a => a.filter(x => x.id !== n.id))} title="Excluir nota" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(0,0,0,0.35)', cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: 0 }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Microtarefas */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>Microtarefas</span>
              {itens.length > 0 && <span style={{ fontSize: 11.5, color: '#999' }}>{feitos}/{itens.length}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: itens.length ? 12 : 0 }}>
              <input value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addItem() }} placeholder="Adicionar microtarefa e Enter..."
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <button onClick={addItem} style={{ flexShrink: 0, padding: '10px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Adicionar</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {itens.map(it => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#fafafa', borderRadius: 10 }}>
                  <input type="checkbox" checked={it.feito} onChange={() => setItens(arr => arr.map(x => x.id === it.id ? { ...x, feito: !x.feito } : x))} style={{ width: 17, height: 17, cursor: 'pointer', flexShrink: 0 }} />
                  <input value={it.texto} onChange={e => setItens(arr => arr.map(x => x.id === it.id ? { ...x, texto: e.target.value } : x))}
                    style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13.5, fontFamily: 'inherit', color: it.feito ? '#aaa' : '#222', textDecoration: it.feito ? 'line-through' : 'none', outline: 'none' }} />
                  <button onClick={() => setItens(arr => arr.filter(x => x.id !== it.id))} title="Remover" style={{ flexShrink: 0, background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

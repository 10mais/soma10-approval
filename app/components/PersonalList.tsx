'use client'
import { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'

type Item = { id: string; texto: string; feito: boolean }

export default function PersonalList() {
  const [rascunho, setRascunho] = useState('')
  const [itens, setItens] = useState<Item[]>([])
  const [novo, setNovo] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvo, setSalvo] = useState<'idle' | 'salvando' | 'ok'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montado = useRef(false)

  useEffect(() => {
    fetch('/api/personal').then(r => r.json()).then(d => {
      if (d && !d.error) { setRascunho(d.rascunho || ''); setItens(Array.isArray(d.itens) ? d.itens : []) }
      setCarregando(false)
      montado.current = true
    }).catch(() => { setCarregando(false); montado.current = true })
  }, [])

  // Salvamento automatico (debounce) sempre que rascunho/itens mudam — apos a carga inicial
  useEffect(() => {
    if (!montado.current) return
    setSalvo('salvando')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      fetch('/api/personal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rascunho, itens }) })
        .then(() => { setSalvo('ok'); setTimeout(() => setSalvo('idle'), 1500) })
        .catch(() => setSalvo('idle'))
    }, 700)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [rascunho, itens])

  function addItem() {
    const t = novo.trim()
    if (!t) return
    setItens(arr => [...arr, { id: uuid(), texto: t, feito: false }])
    setNovo('')
  }

  const feitos = itens.filter(i => i.feito).length

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Personal list</h2>
          {salvo === 'salvando' && <span style={{ fontSize: 11.5, color: '#aaa' }}>salvando…</span>}
          {salvo === 'ok' && <span style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600 }}>salvo</span>}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Seu espaço privado de rascunhos e microtarefas. Só você vê — não entra em Tarefas nem na Esteira.</p>
      </div>

      {carregando ? <p style={{ color: '#aaa' }}>Carregando...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

          {/* Rascunho livre */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#111', marginBottom: 10 }}>Rascunho</span>
            <textarea value={rascunho} onChange={e => setRascunho(e.target.value)} placeholder="Anote ideias, esboços, lembretes... antes de virar um processo ou tarefa."
              style={{ width: '100%', minHeight: 200, padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13.5, lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
        </div>
      )}
    </div>
  )
}

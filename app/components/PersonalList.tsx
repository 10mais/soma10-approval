'use client'
import { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import RichText from './RichText'
import { confirmar } from '@/lib/toast'

type Item = { id: string; texto: string; feito: boolean }
type Notepad = { id: string; titulo: string; conteudo: string; criadoEm?: string; atualizadoEm?: string }

// Texto puro a partir do HTML (para a prévia na lista)
function textoDe(html: string) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}

export default function PersonalList() {
  const [notepads, setNotepads] = useState<Notepad[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [novo, setNovo] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvo, setSalvo] = useState<'idle' | 'salvando' | 'ok'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montado = useRef(false)

  useEffect(() => {
    fetch('/api/personal').then(r => r.json()).then(d => {
      if (d && !d.error) {
        let nps: Notepad[] = Array.isArray(d.notepads) ? d.notepads : []
        // Migra dados antigos: notas post-it OU rascunho único viram notepads
        if (!nps.length) {
          if (Array.isArray(d.notas) && d.notas.length) {
            nps = d.notas.map((n: any) => ({ id: uuid(), titulo: (String(n.texto || '').split('\n')[0] || '').slice(0, 60), conteudo: String(n.texto || ''), criadoEm: new Date().toISOString() }))
          } else if (d.rascunho && String(d.rascunho).trim()) {
            nps = [{ id: uuid(), titulo: 'Minhas anotações', conteudo: String(d.rascunho), criadoEm: new Date().toISOString() }]
          }
        }
        setNotepads(nps)
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
      fetch('/api/personal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rascunho: '', notepads, itens }) })
        .then(() => { setSalvo('ok'); setTimeout(() => setSalvo('idle'), 1500) })
        .catch(() => setSalvo('idle'))
    }, 700)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [notepads, itens])

  function addItem() { const t = novo.trim(); if (!t) return; setItens(a => [...a, { id: uuid(), texto: t, feito: false }]); setNovo('') }
  function novaNota() {
    const id = uuid()
    setNotepads(a => [{ id, titulo: '', conteudo: '', criadoEm: new Date().toISOString() }, ...a])
    setAbertoId(id)
  }
  const patchNota = (id: string, patch: Partial<Notepad>) => setNotepads(a => a.map(n => n.id === id ? { ...n, ...patch, atualizadoEm: new Date().toISOString() } : n))
  function excluirNota(id: string) { setNotepads(a => a.filter(n => n.id !== id)); if (abertoId === id) setAbertoId(null) }

  const aberto = notepads.find(n => n.id === abertoId)
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
          {/* NOTEPADS */}
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: notepads.length ? '1px solid #f0f0f0' : 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>Notepads</span>
              <button onClick={novaNota} style={{ padding: '8px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>+ Nova nota</button>
            </div>
            {notepads.length === 0 ? (
              <div onClick={novaNota} style={{ padding: '34px 16px', textAlign: 'center', color: '#bbb', fontSize: 13, cursor: 'pointer' }}>
                Nenhuma nota ainda. Clique em <b>+ Nova nota</b> para criar a primeira.
              </div>
            ) : (
              <div>
                {notepads.map(n => {
                  const previa = textoDe(n.conteudo)
                  return (
                    <div key={n.id} onClick={() => setAbertoId(n.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderTop: '1px solid #f6f6f6', cursor: 'pointer' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.titulo.trim() || 'Sem título'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previa || 'Nota vazia'}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); excluirNota(n.id) }} title="Excluir" style={{ flexShrink: 0, background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
                    </div>
                  )
                })}
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

      {/* Editor do notepad em MODAL */}
      {aberto && (
        <div onClick={async () => { if (await confirmar('Deseja fechar a nota? Ela já foi salva automaticamente.', { titulo: 'Fechar nota', okLabel: 'Sair', cancelLabel: 'Continuar editando' })) setAbertoId(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid #f0f0f0' }}>
              <input value={aberto.titulo} onChange={e => patchNota(aberto.id, { titulo: e.target.value })} placeholder="Título da nota" autoFocus
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 16, fontWeight: 800, color: '#111', fontFamily: 'inherit', background: 'transparent' }} />
              {salvo === 'salvando' && <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>salvando…</span>}
              {salvo === 'ok' && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, flexShrink: 0 }}>salvo</span>}
              <button onClick={() => excluirNota(aberto.id)} title="Excluir nota" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', display: 'flex', alignItems: 'center', padding: 4, flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /></svg>
              </button>
              <button onClick={() => setAbertoId(null)} title="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 22, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto' }}>
              <RichText key={aberto.id} value={aberto.conteudo} onChange={html => patchNota(aberto.id, { conteudo: html })} completo placeholder="Escreva aqui… use a barra para tópicos, listas numeradas, títulos, cor e links." minHeight={320} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

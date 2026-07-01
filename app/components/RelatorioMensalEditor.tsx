'use client'
import { useState } from 'react'
import type { RelatorioMensalModelo } from '@/lib/relatorioMensal'

// Editor do relatório mensal: ajusta o conteúdo antes de exportar o PDF.
export default function RelatorioMensalEditor({ cliente, inicial, onClose }: { cliente: any; inicial: RelatorioMensalModelo; onClose: () => void }) {
  const [m, setM] = useState<RelatorioMensalModelo>(inicial)
  const [gerando, setGerando] = useState(false)
  const set = (patch: Partial<RelatorioMensalModelo>) => setM(x => ({ ...x, ...patch }))
  const setIncluir = (k: keyof RelatorioMensalModelo['incluir']) => setM(x => ({ ...x, incluir: { ...x.incluir, [k]: !x.incluir[k] } }))

  async function baixar() {
    setGerando(true)
    try { const { gerarRelatorioMensal } = await import('@/lib/relatorioMensal'); await gerarRelatorioMensal({ cliente, modelo: m }) } catch {}
    setGerando(false)
  }

  const inp: React.CSSProperties = { padding: '7px 9px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box' }
  const secTitle: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: '#111', margin: '0 0 8px' }

  const Toggle = ({ k, label }: { k: keyof RelatorioMensalModelo['incluir']; label: string }) => (
    <button type="button" onClick={() => setIncluir(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, border: m.incluir[k] ? '1.5px solid #16a34a' : '1.5px solid #e0e0e0', background: m.incluir[k] ? '#f0fdf4' : '#fff', color: m.incluir[k] ? '#16a34a' : '#999', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.incluir[k] ? '#16a34a' : '#ccc' }} />{label}
    </button>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#111' }}>Relatório mensal — {cliente?.nome}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#999', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>Ajuste o conteúdo e depois exporte o PDF com a marca do cliente.</p>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Título</label><input value={m.tituloRelatorio} onChange={e => set({ tituloRelatorio: e.target.value })} style={{ ...inp, width: '100%' }} /></div>
          <div style={{ width: 150 }}><label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Período</label><input value={m.mesRef} onChange={e => set({ mesRef: e.target.value })} style={{ ...inp, width: '100%' }} /></div>
        </div>

        {/* Seções incluídas */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: '#888', alignSelf: 'center' }}>Incluir:</span>
          <Toggle k="entrega" label="Entrega" /><Toggle k="observacoes" label="Destaques" /><Toggle k="desempenho" label="Desempenho" /><Toggle k="topPosts" label="Top posts" />
        </div>

        {/* Entrega */}
        {m.incluir.entrega && (
          <div style={{ marginBottom: 16 }}>
            <p style={secTitle}>Entrega do mês</p>
            {m.entrega.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
                <input value={e.label} onChange={ev => { const a = [...m.entrega]; a[i] = { ...e, label: ev.target.value }; set({ entrega: a }) }} style={{ ...inp, flex: 1 }} />
                <input value={e.valor} onChange={ev => { const a = [...m.entrega]; a[i] = { ...e, valor: ev.target.value }; set({ entrega: a }) }} style={{ ...inp, width: 150 }} />
              </div>
            ))}
          </div>
        )}

        {/* Destaques (texto livre) */}
        {m.incluir.observacoes && (
          <div style={{ marginBottom: 16 }}>
            <p style={secTitle}>Destaques do mês (texto livre)</p>
            <textarea value={m.observacoes} onChange={e => set({ observacoes: e.target.value })} placeholder="Resumo, conquistas, próximos passos…" style={{ ...inp, width: '100%', minHeight: 70, resize: 'vertical' }} />
          </div>
        )}

        {/* Desempenho */}
        {m.incluir.desempenho && (
          <div style={{ marginBottom: 16 }}>
            <p style={secTitle}>Desempenho</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 4, fontSize: 10.5, color: '#aaa', fontWeight: 700 }}><span style={{ flex: 1 }}>Métrica</span><span style={{ width: 110 }}>Mês atual</span><span style={{ width: 90 }}>Variação</span></div>
            {m.metricas.map((mt, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
                <input value={mt.label} onChange={ev => { const a = [...m.metricas]; a[i] = { ...mt, label: ev.target.value }; set({ metricas: a }) }} style={{ ...inp, flex: 1 }} />
                <input value={mt.atual} onChange={ev => { const a = [...m.metricas]; a[i] = { ...mt, atual: ev.target.value }; set({ metricas: a }) }} style={{ ...inp, width: 110 }} />
                <input value={mt.variacao} onChange={ev => { const a = [...m.metricas]; a[i] = { ...mt, variacao: ev.target.value }; set({ metricas: a }) }} style={{ ...inp, width: 90 }} />
              </div>
            ))}
          </div>
        )}

        {/* Top posts */}
        {m.incluir.topPosts && (
          <div style={{ marginBottom: 16 }}>
            <p style={secTitle}>Top posts ({m.topPosts.length})</p>
            <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {m.topPosts.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input value={p.legenda} onChange={ev => { const a = [...m.topPosts]; a[i] = { ...p, legenda: ev.target.value }; set({ topPosts: a }) }} style={{ ...inp, flex: 1 }} placeholder="Legenda" />
                  <span style={{ fontSize: 11, color: '#aaa', width: 70, flexShrink: 0 }}>{p.data}</span>
                  <button onClick={() => set({ topPosts: m.topPosts.filter((_, j) => j !== i) })} title="Remover" style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 15 }}>×</button>
                </div>
              ))}
              {m.topPosts.length === 0 && <span style={{ fontSize: 12, color: '#bbb' }}>Sem posts.</span>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
          <button onClick={baixar} disabled={gerando} style={{ padding: '10px 22px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{gerando ? 'Gerando…' : 'Baixar PDF'}</button>
        </div>
      </div>
    </div>
  )
}

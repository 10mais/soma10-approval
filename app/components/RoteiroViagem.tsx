'use client'
import { useMemo, useRef, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'

// Editor de ROTEIRO (itinerário) de uma viagem — modal dedicado. Monta a linha
// do tempo dia-a-dia entre dataIda e dataVolta; cada parada entra num dia + hora.
// Salva em Viagem.paradas via PUT /api/viagens.

export type Parada = { id: string; data: string; hora?: string; titulo: string; local?: string; tipo?: string; observacoes?: string }

const TIPOS: { key: string; label: string }[] = [
  { key: 'embarque', label: 'Embarque' },
  { key: 'passeio', label: 'Passeio' },
  { key: 'refeicao', label: 'Refeição' },
  { key: 'hospedagem', label: 'Hospedagem' },
  { key: 'translado', label: 'Translado' },
  { key: 'livre', label: 'Tempo livre' },
]

const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const ymd = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
const dataOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
function diasDoIntervalo(ini: string, fim?: string): string[] {
  if (!dataOk(ini)) return []
  const start = new Date(ini + 'T00:00'); const end = fim && dataOk(fim) ? new Date(fim + 'T00:00') : start
  if (end < start) return [ini]
  const dias: string[] = []; const d = new Date(start)
  while (d <= end && dias.length < 90) { dias.push(ymd(d)); d.setDate(d.getDate() + 1) }
  return dias
}
const rotuloDia = (iso: string) => { const d = new Date(iso + 'T00:00'); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} · ${WEEK[d.getDay()]}` }

export default function RoteiroViagem({ viagem, podeEditar = true, onClose, onSaved }: {
  viagem: { id: string; titulo: string; dataIda: string; dataVolta?: string; paradas?: Parada[] }
  podeEditar?: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [paradas, setParadas] = useState<Parada[]>(() => (viagem.paradas || []).map(p => ({ ...p })))
  const [salvando, setSalvando] = useState(false)
  const inicial = useRef(JSON.stringify(viagem.paradas || []))
  const idRef = useRef(0)
  const novoId = () => `p${Date.now()}_${idRef.current++}`

  const dias = useMemo(() => diasDoIntervalo(viagem.dataIda, viagem.dataVolta), [viagem.dataIda, viagem.dataVolta])
  const sujo = JSON.stringify(paradas) !== inicial.current

  const paradasDoDia = (dia: string) => paradas.filter(p => p.data === dia).sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'))
  const addParada = (dia: string) => setParadas(ps => [...ps, { id: novoId(), data: dia, titulo: '', tipo: 'passeio' }])
  const setP = (id: string, patch: Partial<Parada>) => setParadas(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p))
  const rmP = (id: string) => setParadas(ps => ps.filter(p => p.id !== id))

  async function fechar() {
    if (sujo) { const ok = await confirmar('Você tem alterações não salvas no roteiro.', { titulo: 'Alterações não salvas', okLabel: 'Sair sem salvar', cancelLabel: 'Continuar editando', perigo: true }); if (!ok) return }
    onClose()
  }
  async function salvar() {
    if (salvando) return
    setSalvando(true)
    const limpa = paradas.filter(p => p.titulo.trim())
    const r = await fetch('/api/viagens', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: viagem.id, paradas: limpa }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast('Roteiro salvo.', 'sucesso'); onSaved(); onClose() } else toast(r?.error || 'Falha ao salvar o roteiro.', 'erro')
  }

  const inputStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }

  return (
    <div onClick={fechar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 680, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 16.5, color: '#111' }}>Roteiro</h3>
          <span style={{ fontSize: 13, color: '#888' }}>{viagem.titulo}</span>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#999' }}>Monte a linha do tempo do período. Cada parada entra no dia e horário.</p>

        {dias.length === 0 ? (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 16, fontSize: 13, color: '#92400e' }}>Defina a <strong>data de ida</strong> (e volta) da viagem para montar o roteiro.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {dias.map((dia, i) => {
              const doDia = paradasDoDia(dia)
              return (
                <div key={dia} style={{ borderLeft: '2px solid #eee', paddingLeft: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>Dia {i + 1}</span>
                    <span style={{ fontSize: 12, color: '#888' }}>{rotuloDia(dia)}</span>
                    <span style={{ flex: 1 }} />
                    {podeEditar && <button type="button" onClick={() => addParada(dia)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>+ Parada</button>}
                  </div>
                  {doDia.length === 0 ? <p style={{ margin: '0 0 4px', fontSize: 12, color: '#ccc' }}>Sem paradas.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {doDia.map(p => (
                        <div key={p.id} style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 10, padding: 10 }}>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                            <input type="time" value={p.hora || ''} onChange={e => setP(p.id, { hora: e.target.value })} disabled={!podeEditar} style={{ ...inputStyle, width: 96 }} />
                            <input value={p.titulo} onChange={e => setP(p.id, { titulo: e.target.value })} disabled={!podeEditar} placeholder="O que acontece (ex.: City tour)" style={{ ...inputStyle, flex: 2, minWidth: 160 }} />
                            <select value={p.tipo || ''} onChange={e => setP(p.id, { tipo: e.target.value })} disabled={!podeEditar} style={{ ...inputStyle, background: '#fff' }}>
                              {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                            </select>
                            {podeEditar && <button type="button" onClick={() => rmP(p.id)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>}
                          </div>
                          <input value={p.local || ''} onChange={e => setP(p.id, { local: e.target.value })} disabled={!podeEditar} placeholder="Local (opcional)" style={{ ...inputStyle, width: '100%' }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <span style={{ flex: 1 }} />
          <button onClick={fechar} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 9, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
          {podeEditar && <button onClick={salvar} disabled={salvando || !sujo} style={{ padding: '10px 18px', background: sujo ? '#111' : '#ccc', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: salvando || !sujo ? 'default' : 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar roteiro'}</button>}
        </div>
      </div>
    </div>
  )
}

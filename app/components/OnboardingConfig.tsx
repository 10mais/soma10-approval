'use client'
import { useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { configPadrao, DETECTORES, type ConfigOnboarding, type Detector, type EtapaOnb, type FaseOnb } from '@/lib/onboardingConfig'

// Editor das FASES e ETAPAS do onboarding (Configurações → Onboarding).
// Pedido do dono (07/09): "configurar mais etapas do onboarding, subdivididas
// em etapas e fases". Cada etapa é manual (a equipe marca no cliente) ou
// automática (o sistema detecta). O servidor normaliza ids e descarta vazios.
// Remover uma etapa apaga o "feito" dela nos clientes em onboarding.

const campo: React.CSSProperties = { boxSizing: 'border-box', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink)', fontFamily: 'inherit', fontSize: 13.5, minHeight: 38 }
const mini: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, display: 'grid', placeItems: 'center', flexShrink: 0 }

function mover<T>(lista: T[], i: number, delta: number): T[] {
  const j = i + delta
  if (j < 0 || j >= lista.length) return lista
  const c = [...lista]; const [x] = c.splice(i, 1); c.splice(j, 0, x); return c
}

export default function OnboardingConfig() {
  const [cfg, setCfg] = useState<ConfigOnboarding>(configPadrao())
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [aberta, setAberta] = useState(0)

  useEffect(() => {
    fetch('/api/config/onboarding').then(r => r.json()).then(d => { if (d && Array.isArray(d.fases)) setCfg({ fases: d.fases }) }).catch(() => {}).finally(() => setCarregando(false))
  }, [])

  const setFases = (fn: (f: FaseOnb[]) => FaseOnb[]) => setCfg(c => ({ fases: fn(c.fases) }))
  const mudarFase = (i: number, patch: Partial<FaseOnb>) => setFases(fs => fs.map((f, k) => k === i ? { ...f, ...patch } : f))
  const mudarEtapa = (i: number, j: number, patch: Partial<EtapaOnb>) => mudarFase(i, { etapas: cfg.fases[i].etapas.map((e, k) => k === j ? { ...e, ...patch } : e) })
  const addFase = () => { setFases(fs => [...fs, { id: '', nome: '', etapas: [] }]); setAberta(cfg.fases.length) }
  const addEtapa = (i: number) => mudarFase(i, { etapas: [...cfg.fases[i].etapas, { id: '', nome: '' }] })
  const tirarFase = async (i: number) => {
    const f = cfg.fases[i]
    if (f.etapas.length) {
      const ok = await confirmar(`A fase "${f.nome || 'sem nome'}" tem ${f.etapas.length} ${f.etapas.length === 1 ? 'etapa' : 'etapas'}. O que os clientes já marcaram nelas some ao salvar.`, { titulo: 'Remover fase', okLabel: 'Remover', perigo: true })
      if (!ok) return
    }
    setFases(fs => fs.filter((_, k) => k !== i))
  }
  const tirarEtapa = (i: number, j: number) => mudarFase(i, { etapas: cfg.fases[i].etapas.filter((_, k) => k !== j) })

  async function salvar() {
    setSalvando(true)
    const r = await fetch('/api/config/onboarding', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { toast(r?.error || 'Não foi possível salvar.', 'erro'); return }
    setCfg({ fases: r.fases })
    toast('Onboarding salvo. Vale para todos os clientes na fase.', 'sucesso')
  }
  async function restaurarPadrao() {
    const ok = await confirmar('Volta para as 3 fases e 9 etapas padrão. Nada é gravado até você clicar em Salvar.', { titulo: 'Restaurar padrão', okLabel: 'Restaurar' })
    if (ok) setCfg(configPadrao())
  }

  const totalEtapas = cfg.fases.reduce((n, f) => n + f.etapas.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>Fases e etapas do onboarding</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>
          Todo cliente novo passa por aqui antes de <strong style={{ fontWeight: 500, color: 'var(--v2-ink2)' }}>Em produção</strong>. Etapa <strong style={{ fontWeight: 500, color: 'var(--v2-ink2)' }}>manual</strong> a equipe marca no cliente; etapa <strong style={{ fontWeight: 500, color: 'var(--v2-ink2)' }}>automática</strong> o sistema detecta sozinho. A ordem aqui é a ordem da jornada.
        </p>
      </div>

      {carregando ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Carregando…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cfg.fases.map((f, i) => {
            const on = aberta === i
            const feitas = f.etapas.filter(e => e.nome.trim()).length
            return (
              <div key={i} style={{ border: '1px solid var(--v2-rule)', borderRadius: 12, background: 'var(--v2-surface)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 8px 14px' }}>
                  <button type="button" onClick={() => setAberta(on ? -1 : i)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'var(--v2-ink)', padding: '4px 0', minHeight: 32 }}>
                    <span style={{ width: 22, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.12em', color: 'var(--v2-ink3)' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: f.nome.trim() ? 500 : 400, color: f.nome.trim() ? 'var(--v2-ink)' : 'var(--v2-ink3)' }}>{f.nome.trim() || 'Fase sem nome'}</span>
                    <span style={{ fontSize: 12, color: 'var(--v2-ink3)', fontVariantNumeric: 'tabular-nums' }}>{feitas} {feitas === 1 ? 'etapa' : 'etapas'}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--v2-ink3)', transform: on ? 'rotate(90deg)' : 'none', transition: 'transform 160ms' }}><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                  <button type="button" title="Subir fase" onClick={() => setFases(fs => mover(fs, i, -1))} disabled={i === 0} style={{ ...mini, opacity: i === 0 ? 0.35 : 1 }}>↑</button>
                  <button type="button" title="Descer fase" onClick={() => setFases(fs => mover(fs, i, 1))} disabled={i === cfg.fases.length - 1} style={{ ...mini, opacity: i === cfg.fases.length - 1 ? 0.35 : 1 }}>↓</button>
                  <button type="button" title="Remover fase" onClick={() => tirarFase(i)} style={{ ...mini, color: 'var(--v2-hot)' }}>×</button>
                </div>
                {on && (
                  <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--v2-rule)' }}>
                    <label style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>Nome da fase</label>
                    <input value={f.nome} onChange={e => mudarFase(i, { nome: e.target.value })} placeholder="Ex.: Formalização" style={{ ...campo, width: '100%', maxWidth: 420 }} />
                    <label style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v2-ink3)', marginTop: 4 }}>Etapas desta fase</label>
                    {f.etapas.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)' }}>Nenhuma etapa ainda.</p>}
                    {f.etapas.map((e, j) => (
                      <div key={j} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 1.4fr) auto', gap: 8, alignItems: 'center' }}>
                        <input value={e.nome} onChange={ev => mudarEtapa(i, j, { nome: ev.target.value })} placeholder="Etapa (ex.: Acessos recebidos)" style={{ ...campo, minWidth: 0 }} aria-label="Nome da etapa" />
                        <input value={e.dica || ''} onChange={ev => mudarEtapa(i, j, { dica: ev.target.value })} placeholder="Dica (onde resolver)" style={{ ...campo, minWidth: 0 }} aria-label="Dica" />
                        <select value={e.auto || ''} onChange={ev => mudarEtapa(i, j, { auto: (ev.target.value || undefined) as Detector | undefined })} style={{ ...campo, minWidth: 0 }} aria-label="Tipo da etapa">
                          <option value="">Manual (a equipe marca)</option>
                          {DETECTORES.map(d => <option key={d.chave} value={d.chave}>Automática: {d.label}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button type="button" title="Subir" onClick={() => mudarFase(i, { etapas: mover(f.etapas, j, -1) })} disabled={j === 0} style={{ ...mini, opacity: j === 0 ? 0.35 : 1 }}>↑</button>
                          <button type="button" title="Descer" onClick={() => mudarFase(i, { etapas: mover(f.etapas, j, 1) })} disabled={j === f.etapas.length - 1} style={{ ...mini, opacity: j === f.etapas.length - 1 ? 0.35 : 1 }}>↓</button>
                          <button type="button" title="Remover etapa" onClick={() => tirarEtapa(i, j)} style={{ ...mini, color: 'var(--v2-hot)' }}>×</button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => addEtapa(i)} style={{ alignSelf: 'flex-start', padding: '8px 12px', borderRadius: 10, border: '1px dashed var(--v2-rule2)', background: 'none', color: 'var(--v2-ink2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, minHeight: 36 }}>+ Etapa</button>
                  </div>
                )}
              </div>
            )
          })}
          <button type="button" onClick={addFase} style={{ alignSelf: 'flex-start', padding: '9px 14px', borderRadius: 10, border: '1px dashed var(--v2-rule2)', background: 'none', color: 'var(--v2-ink2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, minHeight: 38 }}>+ Fase</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={salvar} disabled={salvando || carregando} className="soma10-no-invert" style={{ padding: '10px 18px', background: 'var(--v2-amber-on)', color: '#17150E', border: 0, borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: salvando ? 'wait' : 'pointer', minHeight: 40 }}>{salvando ? 'Salvando…' : 'Salvar onboarding'}</button>
        <span style={{ fontSize: 12.5, color: 'var(--v2-ink3)' }}>{cfg.fases.length} {cfg.fases.length === 1 ? 'fase' : 'fases'} · {totalEtapas} {totalEtapas === 1 ? 'etapa' : 'etapas'}</span>
        <button type="button" onClick={restaurarPadrao} style={{ marginLeft: 'auto', background: 'none', border: 0, color: 'var(--v2-ink3)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Restaurar padrão</button>
      </div>
    </div>
  )
}

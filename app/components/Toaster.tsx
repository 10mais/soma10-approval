'use client'
import { useEffect, useState } from 'react'

type Toast = { id: string; mensagem: string; tipo: 'sucesso' | 'erro' | 'info'; titulo?: string; saindo?: boolean }
type Confirm = { id: string; mensagem: string; titulo?: string; okLabel?: string; cancelLabel?: string; perigo?: boolean }

const CORES = {
  sucesso: { barra: 'var(--v2-ok)', icone: 'var(--v2-ok)', fundoIcone: 'rgba(22,163,74,0.14)' },
  erro: { barra: 'var(--v2-hot)', icone: 'var(--v2-hot)', fundoIcone: 'rgba(220,38,38,0.14)' },
  info: { barra: 'var(--v2-amber-on)', icone: 'var(--v2-amber-on)', fundoIcone: 'rgba(255,192,15,0.16)' },
}

function IconeTipo({ tipo }: { tipo: Toast['tipo'] }) {
  const cor = CORES[tipo].icone
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      {tipo === 'sucesso' && <path d="M20 6L9 17l-5-5" />}
      {tipo === 'erro' && <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>}
      {tipo === 'info' && <><path d="M12 8h.01" /><path d="M11 12h1v4h1" /><circle cx="12" cy="12" r="9" /></>}
    </svg>
  )
}

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  useEffect(() => {
    const onToast = (e: Event) => {
      const d = (e as CustomEvent).detail || {}
      const id = Math.random().toString(36).slice(2)
      const t: Toast = { id, mensagem: String(d.mensagem || ''), tipo: d.tipo || 'info', titulo: d.titulo }
      setToasts(ts => [...ts, t])
      // Saída ANIMADA: marca `saindo` (anim-toast-out) e o onAnimationEnd remove.
      setTimeout(() => setToasts(ts => ts.map(x => x.id === id ? { ...x, saindo: true } : x)), 4200)
      // Rede de segurança: se a aba perder o frame do animationend, remove mesmo assim.
      setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 4200 + 600)
    }
    const onConfirm = (e: Event) => setConfirm((e as CustomEvent).detail)
    window.addEventListener('soma-toast', onToast)
    window.addEventListener('soma-confirm', onConfirm)
    return () => { window.removeEventListener('soma-toast', onToast); window.removeEventListener('soma-confirm', onConfirm) }
  }, [])

  // O × usa a mesma saída animada do timeout (single place).
  function fecharToast(id: string) { setToasts(ts => ts.map(x => x.id === id ? { ...x, saindo: true } : x)) }
  function removerToast(id: string) { setToasts(ts => ts.filter(x => x.id !== id)) }

  function responder(ok: boolean) {
    if (confirm) window.dispatchEvent(new CustomEvent('soma-confirm-result', { detail: { id: confirm.id, ok } }))
    setConfirm(null)
  }

  return (
    <>
      {/* Pilha de toasts (canto superior direito) — entrada/saída via classes globais (globals.css) */}
      <div className="soma10-no-invert" style={{ position: 'fixed', top: 16, right: 16, zIndex: 6000, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 'min(360px, calc(100vw - 32px))', pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} className={t.saindo ? 'anim-toast-out' : 'anim-toast-in'}
            onAnimationEnd={() => { if (t.saindo) removerToast(t.id) }}
            style={{
              pointerEvents: 'auto', display: 'flex', alignItems: 'flex-start', gap: 11,
              background: 'var(--v2-ink)', color: 'var(--v2-surface)', borderRadius: 13, padding: '13px 14px',
              boxShadow: '0 12px 34px rgba(0,0,0,0.32)', borderLeft: `3px solid ${CORES[t.tipo].barra}`,
            }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: CORES[t.tipo].fundoIcone, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconeTipo tipo={t.tipo} />
            </span>
            <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
              {t.titulo && <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 800 }}>{t.titulo}</p>}
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: 'var(--v2-rule2)', wordBreak: 'break-word' }}>{t.mensagem}</p>
            </div>
            <button onClick={() => fecharToast(t.id)} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
          </div>
        ))}
      </div>

      {/* Modal de confirmacao */}
      {confirm && (
        <div onClick={() => responder(false)} className="anim-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6100 }}>
          <div onClick={e => e.stopPropagation()} className="soma10-no-invert anim-modal" style={{ background: 'var(--v2-surface)', borderRadius: 16, padding: '24px 26px', maxWidth: 400, width: '90%', boxShadow: '0 18px 50px rgba(0,0,0,0.28)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: confirm.titulo ? 12 : 16 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: confirm.perigo ? 'var(--v2-hot-bg)' : 'rgba(255,192,15,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={confirm.perigo ? 'var(--v2-hot)' : 'var(--v2-amber)'} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                {confirm.titulo && <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 800, color: 'var(--v2-ink)' }}>{confirm.titulo}</p>}
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: confirm.titulo ? 500 : 600, color: confirm.titulo ? 'var(--v2-ink2)' : 'var(--v2-ink)', lineHeight: 1.45 }}>{confirm.mensagem}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => responder(false)} style={{ padding: '9px 20px', background: 'var(--v2-surface1)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: 'var(--v2-ink2)', cursor: 'pointer' }}>{confirm.cancelLabel || 'Cancelar'}</button>
              <button onClick={() => responder(true)} style={{ padding: '9px 20px', background: confirm.perigo ? 'var(--v2-hot)' : 'var(--v2-ink)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: 'var(--v2-surface)', cursor: 'pointer' }}>{confirm.okLabel || 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

'use client'
import { useEffect, useState } from 'react'

// TELA DE ABERTURA: "carregando" com a regra inegociável do mês e a frase do
// dia (pedido do dono, 06/09: "sempre que abrir o sistema, mostre carregando e
// junto com o carregamento 5s uma mensagem das regras inegociáveis").
//
// Regras: fica no mínimo 5s quando HÁ regra cadastrada; sem regra, 1,2s (5s
// de tela vazia seria castigo). Uma vez por sessão do navegador — voltar de
// outra aba não reabre. O pai decide quando os dados estão prontos; aqui só
// se garante o tempo mínimo e a leitura da regra.

type Regra = { mes: string; nome: string; frase?: string } | null

export function splashJaVisto(): boolean {
  try { return sessionStorage.getItem('soma10_splash') === '1' } catch { return true }
}

export default function SplashRegra({ pronto, onFim, tema }: { pronto: boolean; onFim: () => void; tema: 'claro' | 'escuro' }) {
  const [regra, setRegra] = useState<Regra | undefined>(undefined) // undefined = ainda não sei
  const [tempoOk, setTempoOk] = useState(false)
  const [saindo, setSaindo] = useState(false)

  useEffect(() => {
    fetch('/api/config/regras').then(r => r.ok ? r.json() : null).then(d => setRegra(d?.hoje || null)).catch(() => setRegra(null))
  }, [])

  // O relógio só começa quando se sabe se há regra: 5s com regra, 1,2s sem.
  useEffect(() => {
    if (regra === undefined) return
    const t = setTimeout(() => setTempoOk(true), regra ? 5000 : 1200)
    return () => clearTimeout(t)
  }, [regra])

  useEffect(() => {
    if (!tempoOk || !pronto || saindo) return
    setSaindo(true)
    try { sessionStorage.setItem('soma10_splash', '1') } catch {}
    const t = setTimeout(onFim, 420)
    return () => clearTimeout(t)
  }, [tempoOk, pronto, saindo, onFim])

  const escuro = tema === 'escuro'
  return (
    <div className="soma10-v2" data-theme={escuro ? 'dark' : 'light'} role="status" aria-live="polite"
      style={{ position: 'fixed', inset: 0, zIndex: 5000, display: 'grid', placeItems: 'center', background: 'var(--v2-ground)', color: 'var(--v2-ink)', fontFamily: 'var(--v2-font)', opacity: saindo ? 0 : 1, transition: 'opacity 400ms ease' }}>
      <style>{`
        @keyframes soma-splash-traca { to { stroke-dashoffset: 0; } }
        @keyframes soma-splash-sobe { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes soma-splash-barra { from { width: 0; } to { width: 100%; } }
        @media (prefers-reduced-motion: reduce) { .soma-splash * { animation-duration: .01ms !important; } }
      `}</style>
      <div className="soma-splash" style={{ maxWidth: 560, padding: '0 28px', textAlign: 'center' }}>
        <svg viewBox="0 0 1024 1024" width="72" height="72" aria-hidden="true" style={{ display: 'block', margin: '0 auto 26px' }}>
          <rect x="232" y="92" width="560" height="156" rx="68" transform="rotate(-8 512 170)" fill="var(--v2-amber-on)" style={{ opacity: 0, animation: 'soma-splash-sobe 400ms ease 900ms forwards' }} />
          <path d="M188,628 a324,324 0 1,0 648,0 a324,324 0 1,0 -648,0 Z" fill="none" stroke="var(--v2-amber-on)" strokeWidth="44" strokeLinecap="round" style={{ strokeDasharray: 2100, strokeDashoffset: 2100, animation: 'soma-splash-traca 1100ms cubic-bezier(.2,.7,.2,1) 100ms forwards' }} />
          <path d="M356,628 a156,156 0 1,0 312,0 a156,156 0 1,0 -312,0 Z" fill="none" stroke="var(--v2-amber-on)" strokeWidth="44" strokeLinecap="round" style={{ strokeDasharray: 1000, strokeDashoffset: 1000, animation: 'soma-splash-traca 900ms cubic-bezier(.2,.7,.2,1) 500ms forwards' }} />
        </svg>

        {regra ? (
          <div style={{ animation: 'soma-splash-sobe 520ms cubic-bezier(.2,.7,.2,1) 700ms both' }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--v2-amber)' }}>Regra de {regra.mes}</p>
            <p style={{ margin: '0 0 14px', fontSize: 'clamp(24px, 3.6vw, 34px)', fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.015em' }}>{regra.nome}</p>
            {regra.frase && <p style={{ margin: 0, fontSize: 17, fontWeight: 300, lineHeight: 1.5, color: 'var(--v2-ink2)' }}>“{regra.frase}”</p>}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--v2-ink3)', animation: 'soma-splash-sobe 400ms ease 300ms both' }}>Carregando…</p>
        )}

        <div style={{ margin: '34px auto 0', width: 160, height: 2, background: 'var(--v2-surface2)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--v2-amber-on)', animation: `soma-splash-barra ${regra ? 5000 : 1200}ms linear forwards` }} />
        </div>
      </div>
    </div>
  )
}

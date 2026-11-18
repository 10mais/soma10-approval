'use client'
// Os combinados (SLAs) do plano de ação, iguais para cliente e equipe (F4, 17/11/2026).
// Fechado por padrão: é consulta, não o assunto da tela.
import { useEffect, useState } from 'react'

type C = { cliente: string[]; equipe: string[] }

export default function CombinadosPlano({ visao }: { visao: 'cliente' | 'equipe' }) {
  const [c, setC] = useState<C | null>(null)
  useEffect(() => { fetch('/api/plano-acao/combinados').then(r => (r.ok ? r.json() : null)).then(d => { if (d?.cliente) setC(d) }).catch(() => {}) }, [])
  if (!c) return null
  const [primeiro, segundo] = visao === 'cliente'
    ? [{ t: 'Da sua parte', l: c.cliente }, { t: 'Da nossa parte', l: c.equipe }]
    : [{ t: 'Da equipe', l: c.equipe }, { t: 'Do cliente', l: c.cliente }]
  return (
    <details style={{ marginTop: 26, padding: '12px 16px', border: '1px solid var(--v2-rule)', borderRadius: 14, background: 'var(--v2-surface)' }}>
      <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: 'var(--v2-ink)' }}>{visao === 'cliente' ? 'Nossos combinados' : 'Combinados com o cliente (SLAs)'}</summary>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 10 }}>
        {[primeiro, segundo].map(g => (
          <div key={g.t}>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{g.t}</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--v2-ink2)', lineHeight: 1.6 }}>{g.l.map(x => <li key={x}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
    </details>
  )
}

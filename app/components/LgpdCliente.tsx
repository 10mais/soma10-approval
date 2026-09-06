'use client'
import { useState } from 'react'
import { toast } from '@/lib/toast'

// Privacidade (LGPD) na ficha do cliente: exportar (portabilidade) e apagar
// todos os dados (direito ao esquecimento, com confirmação pelo nome exato).
export default function LgpdCliente({ clienteId, clienteNome, onApagado }: { clienteId: string; clienteNome: string; onApagado?: () => void }) {
  const [abrindo, setAbrindo] = useState(false)
  const [conf, setConf] = useState('')
  const [apagando, setApagando] = useState(false)
  const nomeBate = conf.trim().toLowerCase() === (clienteNome || '').trim().toLowerCase() && !!conf.trim()

  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 9, fontWeight: 700, fontSize: 12.5, color: 'var(--v2-ink2)', cursor: 'pointer', textDecoration: 'none' }

  async function apagar() {
    if (!nomeBate || apagando) return
    setApagando(true)
    const r = await fetch('/api/clientes/lgpd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: clienteId, confirmar: conf }) }).then(x => x.json()).catch(() => null)
    setApagando(false)
    if (r?.ok) { toast('Todos os dados do cliente foram apagados (LGPD).', 'sucesso'); onApagado?.() }
    else toast(r?.error || 'Não foi possível apagar.', 'erro')
  }

  return (
    <div>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '16px 0 8px', paddingTop: 16, borderTop: '1px dashed var(--v2-rule)' }}>Privacidade (LGPD)</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href={`/api/clientes/lgpd?id=${clienteId}`} style={btn} title="Baixa todos os dados do cliente (portabilidade)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
          Exportar dados
        </a>
        <button onClick={() => setAbrindo(v => !v)} style={{ ...btn, color: 'var(--v2-hot)', borderColor: 'var(--v2-hot-bg)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /></svg>
          Apagar todos os dados
        </button>
      </div>
      {abrindo && (
        <div style={{ marginTop: 10, padding: 12, border: '1.5px solid var(--v2-hot-bg)', borderRadius: 10, background: '#fef7f7' }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#a15656', lineHeight: 1.5 }}>
            Apaga <b>permanentemente</b> o cliente e TODOS os dados dele (posts, planos, tarefas, marcos, briefings, NPS, logs e o acesso de login). Não dá para desfazer. Para confirmar, digite o nome exato: <b style={{ color: '#7a2e2e' }}>{clienteNome}</b>
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={conf} onChange={e => setConf(e.target.value)} placeholder={clienteNome} style={{ flex: 1, minWidth: 180, padding: '8px 11px', borderRadius: 8, border: '1.5px solid #e0c0c0', fontSize: 12.5, fontFamily: 'inherit' }} />
            <button onClick={apagar} disabled={!nomeBate || apagando} style={{ padding: '8px 16px', background: nomeBate ? 'var(--v2-hot)' : 'var(--v2-surface2)', color: nomeBate ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12.5, cursor: nomeBate && !apagando ? 'pointer' : 'not-allowed' }}>{apagando ? 'Apagando…' : 'Apagar definitivamente'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

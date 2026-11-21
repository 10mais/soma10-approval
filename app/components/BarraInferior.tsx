'use client'
// BARRA INFERIOR do celular (Mudança 2, dono 21/11/2026: "navegação inferior fixa com as
// áreas principais"). Uma só, usada pelo painel e pelo hub do cliente — cada um diz quais
// itens entram (respeitando permissão) e o último é sempre o Menu, que abre o menu completo.
// A altura (62px + safe area) está em --barra-inferior (globals.css); quem tem conteúdo por
// baixo reserva esse espaço.

export type ItemBarra = { chave: string; rotulo: string; icone: string; ativo: boolean; badge?: number; onClick: () => void }

export default function BarraInferior({ itens }: { itens: ItemBarra[] }) {
  return (
    <nav aria-label="Navegação principal" className="soma10-no-invert"
      style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 140, background: 'var(--v2-surface)', borderTop: '1px solid var(--v2-rule)', display: 'flex', paddingBottom: 'var(--safe-bottom)', boxShadow: '0 -2px 12px rgba(0,0,0,0.06)' }}>
      {itens.map(it => (
        <button key={it.chave} type="button" onClick={it.onClick} aria-current={it.ativo ? 'page' : undefined}
          style={{ flex: 1, minWidth: 0, height: 'var(--barra-inferior)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: it.ativo ? 'var(--v2-ink)' : 'var(--v2-ink3)', position: 'relative', fontFamily: 'inherit', padding: 0 }}>
          <span style={{ position: 'relative', display: 'inline-flex', padding: '3px 14px', borderRadius: 999, background: it.ativo ? 'var(--v2-amber-bg)' : 'transparent', transition: 'background 160ms' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={it.ativo ? 2.3 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={it.icone} /></svg>
            {!!it.badge && <span style={{ position: 'absolute', top: -2, right: 6, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: 'var(--v2-hot)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{it.badge > 99 ? '99+' : it.badge}</span>}
          </span>
          <span style={{ fontSize: 11, fontWeight: it.ativo ? 700 : 500, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.rotulo}</span>
        </button>
      ))}
    </nav>
  )
}

export const ICONE_MENU = 'M3 6h18M3 12h18M3 18h18'

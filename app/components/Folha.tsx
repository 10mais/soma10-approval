'use client'
// FOLHA (Mudança 2, dono 21/11/2026: "modais de desktop viram bottom sheets ou telas cheias no
// mobile"). No celular sobe de baixo, com alça para arrastar e fechar; no desktop é o modal de
// sempre, no centro. Fecha com Esc, com toque fora e arrastando para baixo; trava a rolagem do
// fundo; respeita a safe area; erro dentro dela não deixa a tela escura (LimiteDeErro).
// A decisão de fechar pelo gesto mora em lib/gestos.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { fecharFora } from '@/lib/fecharModal'
import { useIsMobile } from '@/lib/useIsMobile'
import { deveFecharFolha } from '@/lib/gestos'
import LimiteDeErro from './LimiteDeErro'

type Props = {
  titulo?: string
  onClose: () => void
  children: ReactNode
  rodape?: ReactNode // ações fixas embaixo (no celular, acima da safe area)
  larguraDesktop?: number
  telaCheiaNoCelular?: boolean // para conteúdo grande (editor, calendário)
  zIndex?: number
}

export default function Folha(props: Props) {
  if (typeof document === 'undefined') return null
  return createPortal(<LimiteDeErro onFechar={props.onClose} titulo={props.titulo ? `Não foi possível abrir: ${props.titulo}` : undefined}><Conteudo {...props} /></LimiteDeErro>, document.body)
}

function Conteudo({ titulo, onClose, children, rodape, larguraDesktop = 520, telaCheiaNoCelular = false, zIndex = 1600 }: Props) {
  const mobile = useIsMobile()
  const folhaRef = useRef<HTMLDivElement>(null)
  const arraste = useRef<{ y0: number; t0: number } | null>(null)
  const [dy, setDy] = useState(0)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = antes }
  }, [onClose])

  const inicio = (e: React.PointerEvent) => { if (!mobile || telaCheiaNoCelular) return; arraste.current = { y0: e.clientY, t0: Date.now() }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId) }
  const move = (e: React.PointerEvent) => { if (arraste.current) setDy(Math.max(0, e.clientY - arraste.current.y0)) }
  const fim = () => {
    if (!arraste.current) return
    const alt = folhaRef.current?.offsetHeight || 400
    const fechar = deveFecharFolha(dy, alt, Date.now() - arraste.current.t0)
    arraste.current = null
    if (fechar) onClose(); else setDy(0)
  }

  const cabecalho = (
    <div onPointerDown={inicio} onPointerMove={move} onPointerUp={fim} onPointerCancel={fim}
      style={{ touchAction: mobile && !telaCheiaNoCelular ? 'none' : undefined, padding: mobile ? '8px 16px 4px' : '18px 22px 6px', cursor: mobile && !telaCheiaNoCelular ? 'grab' : undefined }}>
      {mobile && !telaCheiaNoCelular && <div aria-hidden style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--v2-rule2)', margin: '0 auto 10px' }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {titulo && <h3 style={{ flex: 1, margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--v2-ink)' }}>{titulo}</h3>}
        <button type="button" onClick={onClose} aria-label="Fechar" className="toque"
          style={{ marginLeft: 'auto', width: 40, height: 40, borderRadius: 10, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
      </div>
    </div>
  )

  const estiloFolha: React.CSSProperties = mobile
    ? {
        position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--v2-surface)', display: 'flex', flexDirection: 'column',
        maxHeight: telaCheiaNoCelular ? '100%' : '88vh', height: telaCheiaNoCelular ? '100%' : undefined,
        borderRadius: telaCheiaNoCelular ? 0 : '18px 18px 0 0', paddingTop: telaCheiaNoCelular ? 'var(--safe-top)' : 0,
        transform: dy ? `translateY(${dy}px)` : undefined, transition: arraste.current ? 'none' : 'transform 200ms var(--ease-out)',
        boxShadow: '0 -8px 30px rgba(0,0,0,0.18)',
      }
    : { position: 'relative', background: 'var(--v2-surface)', width: '100%', maxWidth: larguraDesktop, maxHeight: '90vh', borderRadius: 16, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }

  return (
    <div onClick={fecharFora(onClose)} className="anim-overlay" style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(0,0,0,0.45)', display: mobile ? 'block' : 'flex', alignItems: 'center', justifyContent: 'center', padding: mobile ? 0 : 20 }}>
      <div ref={folhaRef} role="dialog" aria-modal="true" aria-label={titulo} onClick={e => e.stopPropagation()} className={mobile ? 'anim-folha' : 'anim-modal'} style={estiloFolha}>
        {cabecalho}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: mobile ? '6px 16px 14px' : '8px 22px 18px', overscrollBehavior: 'contain' }}>{children}</div>
        {rodape && <div style={{ padding: mobile ? '10px 16px calc(12px + var(--safe-bottom))' : '12px 22px 18px', borderTop: '1px solid var(--v2-rule)' }}>{rodape}</div>}
        {!rodape && mobile && <div style={{ height: 'var(--safe-bottom)' }} />}
      </div>
    </div>
  )
}

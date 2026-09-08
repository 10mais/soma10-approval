'use client'
import { useEffect, useState } from 'react'
import { atalhoParaOSistema, desfazerUltima, assinarDesfazer, quantasDesfazer } from '@/lib/desfazer'
import { toast } from '@/lib/toast'

// Ctrl+Z global (dono, 08/09/2026). Montado uma vez no layout, ao lado do Toaster.
// A regra de "esse Ctrl+Z é meu ou do campo de texto?" mora em lib/desfazer
// (pura, testada): digitando num input/textarea/editor, o navegador desfaz o texto.
//
// Quando há algo para desfazer, aparece um aviso discreto no canto — clicável, para
// quem não usa atalho (e para o celular, que não tem Ctrl).
export default function Desfazer() {
  const [quantas, setQuantas] = useState(0)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => assinarDesfazer(setQuantas), [])
  useEffect(() => { setQuantas(quantasDesfazer()) }, [])

  async function rodar() {
    if (ocupado) return
    setOcupado(true)
    const r = await desfazerUltima()
    setOcupado(false)
    if (r.vazio) { toast('Não há nada recente para desfazer.', 'info'); return }
    if (r.ok) toast(r.titulo || '', 'sucesso', 'Desfeito')
    else toast(`Não foi possível desfazer: ${r.titulo || 'ação'}.`, 'erro')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'z' && e.key !== 'Z') return
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      const el = document.activeElement as HTMLElement | null
      const alvo = el ? { tag: el.tagName, tipo: (el as HTMLInputElement).type, editavel: el.isContentEditable } : null
      if (!atalhoParaOSistema(alvo)) return
      e.preventDefault()
      void rodar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ocupado])

  if (!quantas) return null
  return (
    <button type="button" onClick={rodar} disabled={ocupado} title="Desfazer a última ação (Ctrl+Z)" aria-label="Desfazer a última ação"
      style={{
        position: 'fixed', left: 16, bottom: 16, zIndex: 90, display: 'flex', alignItems: 'center', gap: 7,
        padding: '8px 13px', borderRadius: 999, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)',
        color: 'var(--v2-ink2)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: ocupado ? 'default' : 'pointer',
        boxShadow: '0 4px 14px rgba(0,0,0,0.12)', opacity: ocupado ? 0.6 : 1,
      }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" />
      </svg>
      Desfazer <span style={{ fontWeight: 500, opacity: 0.7 }}>Ctrl+Z</span>
    </button>
  )
}

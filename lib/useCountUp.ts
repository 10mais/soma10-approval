'use client'
import { useEffect, useRef, useState } from 'react'

// Anima um numero ate `alvo` (requestAnimationFrame, ease-out cubico).
// Respeita prefers-reduced-motion: quem pediu menos movimento ve o valor direto.
// Uso: const n = useCountUp(pautas.length) — exibe n, decide cor pelo valor real.
export function useCountUp(alvo: number, ms = 600): number {
  const [valor, setValor] = useState(alvo)
  const anterior = useRef(alvo)
  useEffect(() => {
    const de = anterior.current
    anterior.current = alvo
    if (de === alvo) return
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValor(alvo)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setValor(Math.round(de + (alvo - de) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [alvo, ms])
  return valor
}

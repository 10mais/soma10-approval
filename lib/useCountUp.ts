'use client'
import { useEffect, useRef, useState } from 'react'

/** Ponto da contagem no instante p (0 a 1), com ease-out cúbico. Puro, testado. */
export function valorNaContagem(de: number, alvo: number, p: number): number {
  const t = Math.min(1, Math.max(0, p))
  return Math.round(de + (alvo - de) * (1 - Math.pow(1 - t, 3)))
}

// Anima um numero ate `alvo` (requestAnimationFrame, ease-out cubico).
// Respeita prefers-reduced-motion: quem pediu menos movimento ve o valor direto.
// Uso: const n = useCountUp(pautas.length) — exibe n, decide cor pelo valor real.
// `desdeZero` (15/11/2026, produção do time): ao aparecer, conta de 0 até o valor.
// A contagem parte sempre do número que está NA TELA, então um valor novo no meio de
// uma contagem continua dela (e o efeito rodando duas vezes em dev não trava em 0).
export function useCountUp(alvo: number, ms = 600, desdeZero = false): number {
  const [valor, setValor] = useState(desdeZero ? 0 : alvo)
  const mostrado = useRef(desdeZero ? 0 : alvo)
  useEffect(() => {
    const de = mostrado.current
    if (de === alvo) return
    const mostrar = (v: number) => { mostrado.current = v; setValor(v) }
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      mostrar(alvo)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      mostrar(valorNaContagem(de, alvo, p))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [alvo, ms])
  return valor
}

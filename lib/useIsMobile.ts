'use client'
import { useEffect, useState } from 'react'

// Retorna true quando a viewport é de celular (<= maxWidth). Usa matchMedia
// e atualiza ao girar/redimensionar. Centraliza o padrão repetido nos componentes.
export function useIsMobile(maxWidth = 768): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const apply = () => setMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [maxWidth])
  return mobile
}

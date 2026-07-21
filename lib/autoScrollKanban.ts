'use client'
import { useRef, useEffect } from 'react'

// Auto-scroll horizontal de kanban durante o arraste: encostar o card na borda
// puxa o quadro para o lado. Sem isso, coluna que está fora da tela é
// inalcançável — o mouse chega no fim do viewport e o arraste morre ali.
//
// Vive aqui, e não dentro de cada tela, porque JÁ SÃO DOIS quadros (funil do CRM
// e esteira de Processos) e viriam mais. Duas cópias divergem: o Processos
// nasceu sem o auto-scroll justamente por ter sido escrito olhando o CRM
// "por fora".

// Direção do scroll pela posição do cursor: 1 = direita, -1 = esquerda, 0 = não
// rola (cursor no meio). Pura e testável — é a única parte com regra de verdade.
export function direcaoScroll(clientX: number, esquerda: number, direita: number, borda: number): -1 | 0 | 1 {
  if (clientX > direita - borda) return 1
  if (clientX < esquerda + borda) return -1
  return 0
}

export function useAutoScrollKanban<T extends HTMLElement = HTMLDivElement>(opts?: { borda?: number; velocidade?: number }) {
  const ref = useRef<T>(null)
  const timer = useRef<any>(null)
  const BORDA = opts?.borda ?? 90
  const VEL = opts?.velocidade ?? 18

  function parar() {
    if (timer.current) { clearInterval(timer.current); timer.current = null }
  }

  function aoArrastar(e: { preventDefault: () => void; clientX: number }) {
    e.preventDefault() // sem isto o navegador recusa o drop
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dir = direcaoScroll(e.clientX, r.left, r.right, BORDA)
    parar() // um timer por vez: sem isso cada dragover empilharia mais um
    if (dir !== 0) timer.current = setInterval(() => { el.scrollLeft += dir * VEL }, 16)
  }

  // Desmontar no meio do arraste (trocar de aba, fechar a tela) deixaria o
  // intervalo rodando sozinho para sempre.
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  return { ref, aoArrastar, parar }
}

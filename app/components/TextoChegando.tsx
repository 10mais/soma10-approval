'use client'
import { useEffect, useRef } from 'react'

// O TEXTO DA IA APARECENDO ENQUANTO É ESCRITO.
//
// Nasceu da mesma queixa do botão Aprovar (17/10): a pessoa manda gerar o
// documento de marca e fica minutos olhando um "Gerando…" parado, sem saber se
// travou. Agora ela vê o texto nascendo — e, de quebra, já começa a ler.
//
// Três telas usam: documento de marca (painel e portal do cliente) e briefing.
// Quem entrega os pedaços é `lerStreamDeTexto` (lib/streamTexto).
//
// É só apresentação: nenhum estado, nenhuma chamada. A tela dona continua dona
// do que fazer quando terminar.
export default function TextoChegando({
  texto,
  rotulo = 'Escrevendo…',
  altura = 260,
}: {
  texto: string
  rotulo?: string
  altura?: number
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const grudado = useRef(true)

  // Acompanha o fim do texto, como um terminal. Se a pessoa rolar para cima
  // para reler um trecho, PARA de arrastar — nada pior que perder a linha que
  // você estava lendo porque o programa decidiu descer.
  useEffect(() => {
    const el = caixa.current
    if (!el || !grudado.current) return
    el.scrollTop = el.scrollHeight
  }, [texto])

  function aoRolar() {
    const el = caixa.current
    if (!el) return
    grudado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <p className="anim-shimmer" style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 700 }}>{rotulo}</p>
      <div
        ref={caixa}
        onScroll={aoRolar}
        aria-live="polite"
        style={{
          maxHeight: altura,
          overflowY: 'auto',
          padding: '12px 14px',
          background: 'var(--v2-surface1)',
          border: '1px solid var(--v2-rule)',
          borderRadius: 10,
          fontSize: 12.5,
          lineHeight: 1.65,
          color: 'var(--v2-ink2)',
          // O texto vem em Markdown cru: `pre-wrap` preserva as quebras sem
          // precisar renderizar nada no meio do caminho.
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <span className="anim-cursor-texto">{texto}</span>
      </div>
    </div>
  )
}

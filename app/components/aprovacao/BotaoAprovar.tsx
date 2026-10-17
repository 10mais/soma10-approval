'use client'
// BOTÃO DE APROVAR com movimento — dono, 17/10: "O cliente clica e a percepção é que nada
// aconteceu, mas logo em seguida acontece." A rota leva um ou dois segundos e o botão ficava
// parado; depois o cartão sumia de uma vez. Agora o botão afunda no toque, CARREGA por dentro
// ("Aprovando..." com a barra enchendo), confirma ("Aprovado" com o check se desenhando) e só
// então o cartão recolhe. No erro, ele treme e volta a "Aprovar".
//
// Quem hospeda controla a FASE com useAprovacaoAnimada (abaixo); o botão só desenha. O toque e
// os keyframes ficam no motion system (app/globals.css, .botao-aprovar).
// Usado no cartão do criativo, na tabela de copies e no "Aprovar todos" do portal.
import { useRef, useState } from 'react'
import { useT } from '@/app/components/Idioma'

export type FaseAprovar = 'ocioso' | 'aprovando' | 'aprovado' | 'erro'

const VERDE = '#16a34a'
const VERDE_FEITO = '#15803d'
const MIN_CARREGANDO = 650   // ms de "Aprovando..." no mínimo: resposta rápida não vira um piscar
const SEGURA_APROVADO = 750  // ms mostrando "Aprovado" antes de o cartão sair

const pausa = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const reduzMovimento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Recolhe o cartão/linha aprovado (altura e opacidade) antes de a tela tirá-lo da lista. */
export function recolher(el: HTMLElement | null): Promise<void> {
  if (!el || typeof el.animate !== 'function' || reduzMovimento()) return Promise.resolve()
  const cs = getComputedStyle(el)
  const altura = el.offsetHeight
  el.style.overflow = 'hidden'
  el.style.boxSizing = 'border-box'
  const anim = el.animate([
    { height: `${altura}px`, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginBottom: cs.marginBottom, opacity: 1 },
    { opacity: 0, offset: 0.55 },
    { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginBottom: '0px', opacity: 0 },
  ], { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' })
  return anim.finished.then(() => undefined, () => undefined)
}

/** As fases do botão, na ordem: comecar → (aprovado → sair) | falhar | voltar. */
export function useAprovacaoAnimada() {
  const [fase, setFase] = useState<FaseAprovar>('ocioso')
  const inicio = useRef(0)
  return {
    fase,
    /** true enquanto o botão está ocupado (carregando ou confirmando). */
    ocupado: fase === 'aprovando' || fase === 'aprovado',
    comecar() { inicio.current = Date.now(); setFase('aprovando') },
    falhar() { setFase('erro') },
    voltar() { setFase('ocioso') },
    /** Segura o "Aprovando..." o mínimo e troca para "Aprovado". */
    async aprovado() {
      const falta = MIN_CARREGANDO - (Date.now() - inicio.current)
      if (falta > 0) await pausa(falta)
      setFase('aprovado')
    },
    /** Deixa o "Aprovado" à vista e recolhe o cartão (sem `el`, só espera). */
    async sair(el: HTMLElement | null) {
      await pausa(SEGURA_APROVADO)
      await recolher(el)
    },
  }
}

export default function BotaoAprovar({ fase, onClick, rotulo, disabled, contorno, compacto, progresso, detalhe, style }: {
  fase: FaseAprovar
  onClick: () => void
  rotulo: React.ReactNode       // o texto em repouso ("Aprovar", "Aprovar assim mesmo"...)
  disabled?: boolean            // outra ação do mesmo cartão em curso
  contorno?: boolean            // versão vazada, borda verde ("Aprovar assim mesmo")
  compacto?: boolean            // tamanho da tabela de copies
  progresso?: number            // 0..1 quando o avanço é real (lote); sem ele, a barra enche sozinha
  detalhe?: string              // ao lado do "Aprovando..." (ex.: "2/5" no lote)
  style?: React.CSSProperties   // encaixe no layout de quem hospeda (flex, largura)
}) {
  const tr = useT()
  const ocupado = fase === 'aprovando' || fase === 'aprovado'
  const feito = fase === 'aprovado'
  // A barra: enche devagar sozinha (desacelerando) ou acompanha o progresso real; no "Aprovado"
  // completa e dá lugar ao verde cheio.
  const barra: React.CSSProperties = fase === 'aprovando'
    ? progresso == null
      ? { transform: 'scaleX(.9)', transition: 'transform 2800ms cubic-bezier(.08,.6,.2,1)' }
      : { transform: `scaleX(${Math.max(0.04, Math.min(1, progresso))})`, transition: 'transform 320ms ease-out' }
    : feito
      ? { transform: 'scaleX(1)', opacity: 0, transition: 'transform 200ms ease-out, opacity 260ms ease 160ms' }
      : { transform: 'scaleX(0)', transition: 'transform 240ms ease-out' }
  // Três camadas no mesmo lugar (o botão não muda de tamanho): a que sai sobe, a que entra vem de baixo.
  const ativa = fase === 'aprovando' ? 1 : feito ? 2 : 0
  const camada = (i: number): React.CSSProperties => ({
    gridArea: '1 / 1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minWidth: 0,
    opacity: i === ativa ? 1 : 0, transform: i === ativa ? 'none' : `translateY(${i < ativa ? -90 : 90}%)`,
  })

  return (
    <button type="button" onClick={onClick} disabled={disabled || ocupado} aria-busy={fase === 'aprovando'}
      className={`botao-aprovar fase-${fase}`}
      style={{
        position: 'relative', overflow: 'hidden',
        padding: compacto ? '9px 10px' : '12px 8px', borderRadius: compacto ? 10 : 12,
        fontWeight: 600, fontSize: compacto ? 12.5 : 13.5, fontFamily: 'inherit',
        background: feito ? VERDE_FEITO : contorno ? 'var(--v2-surface)' : VERDE,
        color: feito || !contorno ? '#fff' : 'var(--v2-ok)',
        border: contorno ? `1.5px solid ${feito ? VERDE_FEITO : 'var(--v2-ok)'}` : 'none',
        cursor: ocupado ? 'progress' : disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}>
      <span aria-hidden className="botao-aprovar-barra" style={{ background: contorno ? 'rgba(22,163,74,.16)' : 'rgba(0,0,0,.16)', ...barra }} />
      <span className="botao-aprovar-camadas">
        <span aria-hidden={ativa !== 0} className="camada" style={camada(0)}>{rotulo}</span>
        <span aria-hidden={ativa !== 1} className="camada" style={camada(1)}>
          <svg className="botao-aprovar-girar" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {tr('aprov.aprovando')}{detalhe ? ` ${detalhe}` : ''}
        </span>
        <span aria-hidden={ativa !== 2} className="camada" style={camada(2)}>
          <svg className="botao-aprovar-check" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {tr('aprov.aprovado')}
        </span>
      </span>
    </button>
  )
}

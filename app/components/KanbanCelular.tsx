'use client'
// KANBAN NO CELULAR (Mudança 2c, dono 21/11/2026: "revisar tarefas do início ao fim pelo celular,
// sem zoom nem rolar para os lados"). Uma coluna por vez, com as colunas em abas no topo;
// deslizar a lista de lado troca de coluna. Mover de status é por toque: deslizar o cartão (na
// revisão, direita aprova e esquerda pede ajuste) ou o botão "Mover", que abre a Folha com os
// status. Puxar a lista para baixo atualiza. O desktop segue com o Kanban de arrastar.
// Regras dos gestos em lib/gestos e lib/kanbanCelular.
import { useEffect, useRef, useState } from 'react'
import Folha from './Folha'
import { eixoDoGesto, acaoDoDeslize, deslocamentoComResistencia, puxadaVisivel, devePuxarAtualizar } from '@/lib/gestos'
import { acoesDoGesto, colunaVizinha, type Coluna, type AcaoGesto } from '@/lib/kanbanCelular'

export type CartaoInfo = { tipo: { label: string; cor: string }; periodo: string; atrasado: boolean; mae?: string; anexos: number }
type T = { id: string; titulo: string; status: string; responsavelNome?: string; clienteNome?: string }

type Props = {
  colunas: Coluna[]
  cartoesDe: (status: string) => T[]
  info: (t: T) => CartaoInfo
  onAbrir: (t: T) => void
  onMover: (id: string, status: string) => void
  onAtualizar: () => Promise<unknown> | void
  modo?: 'colunas' | 'lista' // lista = todas as tarefas filtradas numa coluna só
  todas?: T[]
  rotuloStatus?: (k: string) => string
}

const COR_TOM: Record<AcaoGesto['tom'], string> = { ok: 'var(--v2-ok)', ajuste: 'var(--v2-hot)', neutro: 'var(--v2-info)' }

export default function KanbanCelular({ colunas, cartoesDe, info, onAbrir, onMover, onAtualizar, modo = 'colunas', todas = [], rotuloStatus }: Props) {
  // Abre na revisão quando há o que revisar (é para isso que se abre o quadro no celular).
  // As tarefas chegam depois do primeiro desenho, então a escolha espera a primeira carga.
  const [coluna, setColunaEstado] = useState(colunas[0]?.key)
  const escolheu = useRef(false)
  const setColuna = (v: string | ((c: string) => string)) => { escolheu.current = true; setColunaEstado(v as any) }
  const emRevisao = cartoesDe('em_revisao').length
  useEffect(() => { if (!escolheu.current && emRevisao > 0) { escolheu.current = true; setColunaEstado('em_revisao') } }, [emRevisao])
  const [movendo, setMovendo] = useState<T | null>(null)
  const [puxada, setPuxada] = useState(0)
  const [atualizando, setAtualizando] = useState(false)
  const lista = useRef<HTMLDivElement>(null)
  const gesto = useRef<{ x0: number; y0: number; eixo: 'horizontal' | 'vertical' | null; topo: boolean } | null>(null)

  const cartoes = modo === 'lista' ? todas : cartoesDe(coluna)

  // Lista: puxar para atualizar (no topo) e deslizar de lado para trocar de coluna.
  const toqueInicio = (e: React.TouchEvent) => { const t = e.touches[0]; gesto.current = { x0: t.clientX, y0: t.clientY, eixo: null, topo: (lista.current?.scrollTop || 0) <= 0 && window.scrollY <= 0 } }
  const toqueMove = (e: React.TouchEvent) => {
    const g = gesto.current; if (!g) return
    const t = e.touches[0]; const dx = t.clientX - g.x0, dy = t.clientY - g.y0
    if (!g.eixo) g.eixo = eixoDoGesto(dx, dy)
    if (g.eixo === 'vertical' && g.topo && dy > 0) setPuxada(puxadaVisivel(dy))
  }
  const toqueFim = async (e: React.TouchEvent) => {
    const g = gesto.current; gesto.current = null; if (!g) return
    const t = e.changedTouches[0]; const dx = t.clientX - g.x0, dy = t.clientY - g.y0
    if (g.eixo === 'vertical' && g.topo && devePuxarAtualizar(dy)) {
      setAtualizando(true); setPuxada(56)
      try { await onAtualizar() } finally { setAtualizando(false); setPuxada(0) }
      return
    }
    setPuxada(0)
    if (modo === 'colunas' && g.eixo === 'horizontal' && Math.abs(dx) > 90) setColuna(c => colunaVizinha(c, colunas, dx < 0 ? 'direita' : 'esquerda'))
  }

  return (
    <div>
      {modo === 'colunas' && (
        <div role="tablist" aria-label="Colunas do quadro" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -14px 10px', padding: '2px 14px 6px', position: 'sticky', top: 'var(--folga-superior, 0px)', zIndex: 4, background: 'var(--v2-ground, var(--v2-surface))' }}>
          {colunas.map(c => {
            const n = cartoesDe(c.key).length, on = c.key === coluna
            return (
              <button key={c.key} type="button" role="tab" aria-selected={on} onClick={() => setColuna(c.key)}
                style={{ flexShrink: 0, minHeight: 40, padding: '0 14px', borderRadius: 999, border: on ? '1.5px solid var(--v2-ink)' : '1px solid var(--v2-rule)', background: on ? 'var(--v2-ink)' : 'var(--v2-surface)', color: on ? 'var(--v2-surface)' : 'var(--v2-ink2)', fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
                className="soma10-no-invert">
                {c.label} <span style={{ opacity: 0.7, fontWeight: 600 }}>{n}</span>
              </button>
            )
          })}
        </div>
      )}

      <div ref={lista} onTouchStart={toqueInicio} onTouchMove={toqueMove} onTouchEnd={toqueFim}
        style={{ minHeight: '50vh', transform: puxada ? `translateY(${puxada}px)` : undefined, transition: gesto.current ? 'none' : 'transform 220ms var(--ease-out)' }}>
        {puxada > 0 && (
          <p aria-live="polite" style={{ position: 'absolute', left: 0, right: 0, marginTop: -puxada + 14, textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--v2-ink3)' }}>
            {atualizando ? 'Atualizando…' : devePuxarAtualizar(puxada * 2) ? 'Solte para atualizar' : 'Puxe para atualizar'}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cartoes.map((t, i) => (
            <CartaoDeslizavel key={t.id} t={t} i={i} info={info(t)} acoes={acoesDoGesto(t.status, colunas)} rotuloStatus={modo === 'lista' ? rotuloStatus : undefined}
              onAbrir={() => onAbrir(t)} onMover={s => onMover(t.id, s)} onMenu={() => setMovendo(t)} />
          ))}
          {cartoes.length === 0 && <p style={{ margin: '28px 0', textAlign: 'center', fontSize: 14, color: 'var(--v2-ink3)' }}>Nenhuma tarefa aqui.</p>}
        </div>
      </div>

      {movendo && (
        <Folha titulo="Mover para" onClose={() => setMovendo(null)}>
          <p style={{ margin: '0 0 8px', fontSize: 13.5, color: 'var(--v2-ink2)' }}>{movendo.titulo}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {colunas.map(c => {
              const atual = c.key === movendo.status
              return (
                <button key={c.key} type="button" disabled={atual} onClick={() => { onMover(movendo.id, c.key); setMovendo(null) }}
                  style={{ minHeight: 48, textAlign: 'left', padding: '0 14px', borderRadius: 12, border: atual ? '1.5px solid var(--v2-ink)' : '1px solid var(--v2-rule)', background: atual ? 'var(--v2-surface2)' : 'var(--v2-surface)', color: 'var(--v2-ink)', fontWeight: 700, fontSize: 15, fontFamily: 'inherit', cursor: atual ? 'default' : 'pointer' }}>
                  {c.label}{atual ? ' · atual' : ''}
                </button>
              )
            })}
          </div>
        </Folha>
      )}
    </div>
  )
}

function CartaoDeslizavel({ t, i, info, acoes, rotuloStatus, onAbrir, onMover, onMenu }: {
  t: T; i: number; info: CartaoInfo; acoes: { direita?: AcaoGesto; esquerda?: AcaoGesto }; rotuloStatus?: (k: string) => string
  onAbrir: () => void; onMover: (status: string) => void; onMenu: () => void
}) {
  const [dx, setDx] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const g = useRef<{ x0: number; y0: number; eixo: 'horizontal' | 'vertical' | null } | null>(null)
  const largura = () => ref.current?.offsetWidth || 340

  const inicio = (e: React.TouchEvent) => { const p = e.touches[0]; g.current = { x0: p.clientX, y0: p.clientY, eixo: null } }
  const move = (e: React.TouchEvent) => {
    const s = g.current; if (!s) return
    const p = e.touches[0]; const ddx = p.clientX - s.x0, ddy = p.clientY - s.y0
    if (!s.eixo) s.eixo = eixoDoGesto(ddx, ddy)
    if (s.eixo !== 'horizontal') return
    e.stopPropagation() // o deslize do cartão não troca a coluna
    const permitido = (ddx > 0 && acoes.direita) || (ddx < 0 && acoes.esquerda)
    setDx(permitido ? deslocamentoComResistencia(ddx, largura() * 0.35) : ddx * 0.15)
  }
  const fim = (e: React.TouchEvent) => {
    const s = g.current; g.current = null
    if (!s || s.eixo !== 'horizontal') { setDx(0); return }
    e.stopPropagation()
    const lado = acaoDoDeslize(dx, largura())
    const acao = lado === 'direita' ? acoes.direita : lado === 'esquerda' ? acoes.esquerda : undefined
    setDx(0)
    if (acao) { if (navigator.vibrate) navigator.vibrate(12); onMover(acao.status) }
  }
  const revelada = dx > 0 ? acoes.direita : dx < 0 ? acoes.esquerda : undefined

  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }} className="anim-item">
      {revelada && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: dx > 0 ? 'flex-start' : 'flex-end', padding: '0 18px', background: COR_TOM[revelada.tom], color: '#fff', fontWeight: 800, fontSize: 14 }}>
          {dx > 0 ? `${revelada.rotulo} →` : `← ${revelada.rotulo}`}
        </div>
      )}
      <div ref={ref} onTouchStart={inicio} onTouchMove={move} onTouchEnd={fim} onClick={() => { if (!dx) onAbrir() }}
        style={{ position: 'relative', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderLeft: `4px solid ${info.tipo.cor}`, borderRadius: 14, padding: '12px 12px 12px 14px', transform: dx ? `translateX(${dx}px)` : undefined, transition: g.current ? 'none' : 'transform 200ms var(--ease-out)', touchAction: 'pan-y', ['--i' as any]: i }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: info.tipo.cor, background: `${info.tipo.cor}18`, borderRadius: 6, padding: '2px 7px' }}>{info.tipo.label}</span>
              {rotuloStatus && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-ink2)', background: 'var(--v2-surface2)', borderRadius: 6, padding: '2px 7px' }}>{rotuloStatus(t.status)}</span>}
            </div>
            {info.mae && <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--v2-ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↳ {info.mae}</p>}
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--v2-ink)', lineHeight: 1.3, overflowWrap: 'anywhere' }}>{t.titulo}</p>
            <p style={{ margin: '5px 0 0', fontSize: 12.5, color: 'var(--v2-ink3)' }}>
              {[t.responsavelNome, t.clienteNome].filter(Boolean).join(' · ')}
              {info.periodo && <span style={{ color: info.atrasado ? 'var(--v2-hot)' : undefined, fontWeight: info.atrasado ? 700 : 400 }}>{t.responsavelNome || t.clienteNome ? ' · ' : ''}{info.periodo}</span>}
              {info.anexos > 0 && ` · ${info.anexos} anexo${info.anexos > 1 ? 's' : ''}`}
            </p>
          </div>
          <button type="button" onClick={e => { e.stopPropagation(); onMenu() }} aria-label={`Mover ${t.titulo}`} className="toque"
            style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

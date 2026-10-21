'use client'
// BARRA "PRÓXIMAS TAREFAS" no topo — dono, 20/10/2026: "dentro do perfil de cada usuário precisa
// de uma barra flutuante no topo mostrando as suas próximas tarefas". Fase 1 do plano Estúdio x
// Tarefas (memória proj-estudio-tarefa-unica): antes de a pauta virar subtarefa do designer, a
// pessoa precisa VER o que está com ela — em julho a subtarefa sumiu do quadro e a produção parou.
//
// Mostra as tarefas abertas de quem está logado, a mais urgente primeiro (lib/proximasTarefas, via
// /api/tarefas/proximas): até 3 no topo, conforme o espaço, e a lista das 5 primeiras ao clicar.
// Clicar numa tarefa abre a tarefa (no painel, `onAbrir`; fora dele, /dashboard?tarefa=ID).
// Recarrega ao voltar para a aba, a cada 2 minutos e quando alguém salva uma tarefa
// (avisarTarefasMudaram). Erro aqui nunca derruba a tela: a barra some e o resto segue.
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useT } from '@/app/components/Idioma'
import { fmtDiaDoInstante } from '@/lib/datas'
import type { ItemProximo, ProximasDaPessoa } from '@/lib/proximasTarefas'

const CHAVE_RECOLHIDA = 'soma10-barra-tarefas-recolhida'
const EVENTO_MUDOU = 'soma-tarefas-mudaram'

/** Quem salva/mexe numa tarefa chama isto: a barra recarrega na hora. */
export function avisarTarefasMudaram() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_MUDOU))
}

class SemQuebrar extends React.Component<{ children: React.ReactNode }, { erro: boolean }> {
  state = { erro: false }
  static getDerivedStateFromError() { return { erro: true } }
  componentDidCatch(e: Error) { console.error('[BarraProximasTarefas]', e) }
  render() { return this.state.erro ? null : this.props.children }
}

type Props = {
  onAbrir?: (id: string) => void // no painel: abre o modal da tarefa sem sair da tela
  tema?: 'claro' | 'escuro'       // no painel (tema por tela): escopo .soma10-v2 como o cluster do topo
  estilo?: React.CSSProperties    // posição/largura dada por quem hospeda (faixa do topo ou cabeçalho)
  compacta?: boolean              // dentro de um cabeçalho (Equipe, hub do cliente): 38px, sem sombra
}

export default function BarraProximasTarefas(props: Props) {
  return <SemQuebrar><Barra {...props} /></SemQuebrar>
}

const ICONE = 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'

function Barra({ onAbrir, tema, estilo, compacta }: Props) {
  const tr = useT()
  const router = useRouter()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const email = String(session?.user?.email || '')
  const daEquipe = !!session && !!role && role !== 'cliente'

  const [dados, setDados] = useState<ProximasDaPessoa | null>(null)
  const [aberto, setAberto] = useState(false)
  const [recolhida, setRecolhida] = useState(false)
  const [largura, setLargura] = useState(0)
  const [painel, setPainel] = useState<{ top: number; left: number; width: number } | null>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const pilula = useRef<HTMLDivElement>(null)

  useEffect(() => { try { setRecolhida(localStorage.getItem(CHAVE_RECOLHIDA) === '1') } catch { /* sem storage: aberta */ } }, [])

  const carregar = useCallback(() => {
    fetch('/api/tarefas/proximas').then(r => (r.ok ? r.json() : null)).then(d => { if (d && Array.isArray(d.itens)) setDados(d) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!daEquipe) return
    carregar()
    const intervalo = setInterval(carregar, 120000)
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregar() }
    window.addEventListener('focus', aoVoltar)
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener(EVENTO_MUDOU, carregar)
    return () => {
      clearInterval(intervalo)
      window.removeEventListener('focus', aoVoltar)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener(EVENTO_MUDOU, carregar)
    }
  }, [daEquipe, carregar])

  // Quanto espaço há (a faixa do topo ou o meio do cabeçalho) decide quantas tarefas cabem à vista.
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    setLargura(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setLargura(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [daEquipe, dados])

  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aberto])

  if (!daEquipe || !dados) return null

  const escopo = tema ? { className: 'soma10-v2 soma10-no-invert', 'data-theme': tema === 'escuro' ? 'dark' : 'light' } : {}
  const vazia = dados.total === 0
  const nChips = recolhida || vazia ? 0 : largura >= 820 ? 3 : largura >= 560 ? 2 : largura >= 360 ? 1 : 0
  const comRotulo = !recolhida && largura >= 470
  const restantes = dados.total - nChips

  function alternarRecolhida(e: React.MouseEvent) {
    e.stopPropagation()
    setRecolhida(r => { const novo = !r; try { localStorage.setItem(CHAVE_RECOLHIDA, novo ? '1' : '0') } catch { /* só nesta visita */ } return novo })
  }
  function abrirPainel() {
    const r = pilula.current?.getBoundingClientRect()
    if (r) {
      const width = Math.min(380, window.innerWidth - 24)
      setPainel({ top: r.bottom + 8, left: Math.max(12, Math.min(r.left, window.innerWidth - width - 12)), width })
    }
    setAberto(a => !a)
  }
  function abrir(id: string) {
    setAberto(false)
    if (onAbrir) onAbrir(id)
    else router.push(`/dashboard?tarefa=${encodeURIComponent(id)}`)
  }

  const rotuloQuando = (i: ItemProximo) => i.quando === 'atrasada' ? tr('barra.atrasada')
    : i.quando === 'hoje' ? tr('barra.hoje')
      : i.quando === 'amanha' ? tr('barra.amanha')
        : i.quando === 'sem_prazo' ? tr('barra.sem-prazo')
          : fmtDiaDoInstante(i.prazo, false)
  const corQuando = (i: ItemProximo) => i.quando === 'atrasada' ? { color: 'var(--v2-hot)', background: 'var(--v2-hot-bg)' }
    : i.quando === 'hoje' ? { color: 'var(--v2-amber)', background: 'var(--v2-amber-bg)' }
      : { color: 'var(--v2-ink3)', background: 'var(--v2-surface2)' }
  const contexto = (i: ItemProximo) => [i.clienteNome, i.maeTitulo ? tr('barra.subtarefa-de', { mae: i.maeTitulo }) : ''].filter(Boolean).join(' · ')

  return (
    <div ref={caixa} {...escopo} style={{ display: 'flex', alignItems: 'center', minWidth: 0, pointerEvents: 'none', ...estilo }}>
      <div ref={pilula} role="button" tabIndex={0} onClick={abrirPainel} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirPainel() } }}
        title={tr('barra.proximas')} aria-expanded={aberto}
        style={{
          pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '100%', height: compacta ? 38 : 46, boxSizing: 'border-box',
          padding: compacta ? '4px 6px 4px 12px' : '6px 8px 6px 14px', borderRadius: 999, cursor: 'pointer', userSelect: 'none',
          background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', boxShadow: compacta ? 'none' : '0 6px 20px rgba(0,0,0,0.12)',
          fontFamily: 'var(--v2-font, inherit)',
        }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={dados.atrasadas ? 'var(--v2-hot)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}><path d={ICONE} /></svg>
        {comRotulo && <span style={{ fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 }}>{tr('barra.proximas')}</span>}
        {vazia && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--v2-ink3)', whiteSpace: 'nowrap' }}>{tr('barra.nada')}</span>}
        {dados.itens.slice(0, nChips).map(i => (
          <button key={i.id} type="button" onClick={e => { e.stopPropagation(); abrir(i.id) }} title={[i.titulo, contexto(i)].filter(Boolean).join(' — ')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: 240, padding: '5px 10px 5px 5px', borderRadius: 999, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--v2-ink)' }}>
            <span style={{ ...corQuando(i), flexShrink: 0, fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '2px 7px', whiteSpace: 'nowrap' }}>{rotuloQuando(i)}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{i.titulo}</span>
          </button>
        ))}
        {!vazia && (nChips === 0 || restantes > 0) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 800 }}>
            <span style={{ minWidth: 22, height: 22, padding: '0 6px', boxSizing: 'border-box', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--v2-surface2)', color: 'var(--v2-ink2)' }}>{nChips === 0 ? dados.total : `+${restantes}`}</span>
            {nChips === 0 && dados.atrasadas > 0 && <span style={{ color: 'var(--v2-hot)', background: 'var(--v2-hot-bg)', borderRadius: 999, padding: '3px 8px' }}>{tr('barra.n-atrasadas', { n: dados.atrasadas })}</span>}
          </span>
        )}
        <button type="button" onClick={alternarRecolhida} title={tr(recolhida ? 'barra.expandir' : 'barra.recolher')} aria-label={tr(recolhida ? 'barra.expandir' : 'barra.recolher')}
          style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={recolhida ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
          </svg>
        </button>
      </div>

      {aberto && painel && (
        <>
          <div onClick={() => setAberto(false)} style={{ position: 'fixed', inset: 0, zIndex: 209, pointerEvents: 'auto' }} />
          <div role="dialog" aria-label={tr('barra.proximas')} style={{
            position: 'fixed', top: painel.top, left: painel.left, width: painel.width, maxHeight: 'min(70vh, 460px)', overflowY: 'auto', zIndex: 210,
            pointerEvents: 'auto', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 14,
            boxShadow: '0 12px 36px rgba(0,0,0,0.18)', animation: 'soma-fade-in 140ms ease-out both', fontFamily: 'var(--v2-font, inherit)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '13px 16px', borderBottom: '1px solid var(--v2-rule)', position: 'sticky', top: 0, background: 'var(--v2-surface)' }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{tr('barra.proximas')}</span>
              {!vazia && <span style={{ fontSize: 11.5, color: 'var(--v2-ink3)', fontWeight: 600 }}>{tr('barra.de-total', { n: dados.itens.length, total: dados.total })}</span>}
            </div>
            {vazia
              ? <p style={{ margin: 0, padding: '26px 16px', textAlign: 'center', fontSize: 13, color: 'var(--v2-ink3)' }}>{tr('barra.nada')}</p>
              : dados.itens.map(i => (
                <button key={i.id} type="button" onClick={() => abrir(i.id)}
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', textAlign: 'left', padding: '11px 16px', border: 'none', borderBottom: '1px solid var(--v2-surface1)', background: 'var(--v2-surface)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--v2-ink)' }}>
                  <span style={{ ...corQuando(i), flexShrink: 0, marginTop: 1, fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap', minWidth: 52, textAlign: 'center' }}>{rotuloQuando(i)}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.titulo}</span>
                    {contexto(i) && <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, color: 'var(--v2-ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contexto(i)}</span>}
                  </span>
                </button>
              ))}
            <button type="button" onClick={() => { setAberto(false); router.push(`/equipe/${encodeURIComponent(email)}/tarefas`) }}
              style={{ display: 'block', width: '100%', padding: '11px 16px', border: 'none', background: 'var(--v2-surface)', color: 'var(--v2-info)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
              {tr('barra.ver-todas')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

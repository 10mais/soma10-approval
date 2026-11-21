'use client'
// LINHA DO TEMPO do Plano de entregas (Mudança 3, dono 21/11/2026): a visão padrão. Uma pergunta:
// "o que já foi, o que está sendo e o que vem pela frente?". Período (mês, trimestre, semestre,
// ano), quatro números que filtram a tela, a linha com cada entrega como faixa (etapas como
// pontos, o "hoje" marcado) e embaixo os cartões por status. No celular a linha vira lista
// por mês. Contas em lib/roadmapEntregas. Somente leitura serve ao cliente (portal).
import { useMemo, useState } from 'react'
import { janelaDoPeriodo, moverPeriodo, marcasDaJanela, roadmapDoCliente, faixasPorStatus, faixasPorMes, PERIODOS_ROAD, ROTULO_STATUS, type Periodo, type StatusEntrega, type Faixa, type MarcoRoad } from '@/lib/roadmapEntregas'
import { hojeYmd, fmtDiaMes } from '@/lib/datas'
import { useIsMobile } from '@/lib/useIsMobile'

export const COR_STATUS: Record<StatusEntrega, { forte: string; fundo: string }> = {
  concluido: { forte: 'var(--v2-ok)', fundo: 'var(--v2-ok-bg)' },
  andamento: { forte: 'var(--v2-info)', fundo: 'var(--v2-info-bg)' },
  atrasado: { forte: 'var(--v2-hot)', fundo: 'var(--v2-hot-bg)' },
  a_fazer: { forte: 'var(--v2-ink3)', fundo: 'var(--v2-surface2)' },
}

export function SeletorPeriodo({ periodo, setPeriodo, rotulo, onMover, onHoje }: { periodo: Periodo; setPeriodo: (p: Periodo) => void; rotulo: string; onMover: (d: number) => void; onHoje: () => void }) {
  const btn: React.CSSProperties = { minWidth: 36, height: 36, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 9, cursor: 'pointer', color: 'var(--v2-ink2)', fontSize: 15, fontFamily: 'inherit', padding: '0 10px' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div role="tablist" aria-label="Período" style={{ display: 'flex', background: 'var(--v2-surface2)', borderRadius: 10, padding: 3 }}>
        {PERIODOS_ROAD.map(p => (
          <button key={p.key} type="button" role="tab" aria-selected={periodo === p.key} onClick={() => setPeriodo(p.key)}
            style={{ padding: '7px 12px', minHeight: 34, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', background: periodo === p.key ? 'var(--v2-surface)' : 'transparent', color: periodo === p.key ? 'var(--v2-ink)' : 'var(--v2-ink3)', boxShadow: periodo === p.key ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>{p.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" style={btn} aria-label="Período anterior" onClick={() => onMover(-1)}>&#8249;</button>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--v2-ink)', minWidth: 120, textAlign: 'center' }}>{rotulo}</span>
        <button type="button" style={btn} aria-label="Próximo período" onClick={() => onMover(1)}>&#8250;</button>
        <button type="button" style={{ ...btn, fontSize: 12, fontWeight: 700 }} onClick={onHoje}>Hoje</button>
      </div>
    </div>
  )
}

export function Contadores({ c, filtro, setFiltro }: { c: Record<StatusEntrega, number>; filtro: StatusEntrega | null; setFiltro: (s: StatusEntrega | null) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
      {(['concluido', 'andamento', 'atrasado', 'a_fazer'] as StatusEntrega[]).map(s => {
        const on = filtro === s
        return (
          <button key={s} type="button" onClick={() => setFiltro(on ? null : s)} aria-pressed={on}
            style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 12, border: on ? `2px solid ${COR_STATUS[s].forte}` : '1px solid transparent', background: COR_STATUS[s].fundo, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: COR_STATUS[s].forte }}>{ROTULO_STATUS[s]}</span>
            <span style={{ display: 'block', fontSize: 26, fontWeight: 800, color: COR_STATUS[s].forte, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{c[s]}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function RoadmapEntregas({ marcos, onAbrirMarco, somenteLeitura = false }: { marcos: MarcoRoad[]; onAbrirMarco?: (id: string) => void; somenteLeitura?: boolean }) {
  const mobile = useIsMobile()
  const hoje = hojeYmd()
  const [periodo, setPeriodo] = useState<Periodo>('trimestre')
  const [ref, setRef] = useState(hoje)
  const [filtro, setFiltro] = useState<StatusEntrega | null>(null)
  const j = useMemo(() => janelaDoPeriodo(periodo, ref), [periodo, ref])
  const r = useMemo(() => roadmapDoCliente(marcos, j, hoje), [marcos, j, hoje])
  const visiveis = filtro ? r.faixas.filter(f => f.status === filtro) : r.faixas
  const abrir = (f: Faixa) => { if (f.marcoId && onAbrirMarco) onAbrirMarco(f.marcoId) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SeletorPeriodo periodo={periodo} setPeriodo={setPeriodo} rotulo={j.rotulo} onMover={d => setRef(moverPeriodo(periodo, ref, d))} onHoje={() => setRef(hoje)} />
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 13.5, color: 'var(--v2-ink2)' }}>
          {r.total ? <><strong style={{ color: 'var(--v2-ink)' }}>{r.pctEntregue}% entregue</strong> no período · {r.total} {r.total === 1 ? 'entrega' : 'entregas'}</> : 'Nenhuma entrega neste período.'}
        </p>
        <Contadores c={r.contadores} filtro={filtro} setFiltro={setFiltro} />
      </div>

      {!mobile && visiveis.length > 0 && <Linha j={j} faixas={visiveis} hoje={r.hoje} onAbrir={abrir} clicavel={!!onAbrirMarco} />}

      {mobile
        ? faixasPorMes({ ...r, faixas: visiveis }).map(g => (
            <section key={g.mes}>
              <h4 style={{ margin: '0 0 8px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>{g.rotulo}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{g.faixas.map(f => <Cartao key={f.id} f={f} onAbrir={abrir} clicavel={!!onAbrirMarco && !!f.marcoId} />)}</div>
            </section>
          ))
        : faixasPorStatus({ ...r, faixas: visiveis }).filter(g => g.faixas.length).map(g => (
            <details key={g.status} open={g.status !== 'concluido' || !!filtro}>
              <summary style={{ cursor: 'pointer', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, color: COR_STATUS[g.status].forte, marginBottom: 8 }}>{ROTULO_STATUS[g.status]} ({g.faixas.length})</summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>{g.faixas.map(f => <Cartao key={f.id} f={f} onAbrir={abrir} clicavel={!!onAbrirMarco && !!f.marcoId} />)}</div>
            </details>
          ))}
      {!r.total && !somenteLeitura && <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)' }}>Troque o período ou crie uma entrega pelo "+ Novo marco".</p>}
    </div>
  )
}

function Linha({ j, faixas, hoje, onAbrir, clicavel }: { j: ReturnType<typeof janelaDoPeriodo>; faixas: Faixa[]; hoje: number | null; onAbrir: (f: Faixa) => void; clicavel: boolean }) {
  const marcas = marcasDaJanela(j)
  return (
    <div style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '210px minmax(0, 1fr)', gap: 0 }}>
        <div />
        <div style={{ position: 'relative', height: 22, borderBottom: '1px solid var(--v2-rule)' }}>
          {marcas.map(m => <span key={m.rotulo} style={{ position: 'absolute', left: `${m.esquerda}%`, fontSize: 11.5, fontWeight: 700, color: 'var(--v2-ink3)', textTransform: 'uppercase', paddingLeft: 4, borderLeft: '1px solid var(--v2-rule)', height: 22 }}>{m.rotulo}</span>)}
        </div>
        {faixas.map(f => (
          <Linhazinha key={f.id} f={f} hoje={hoje} onAbrir={onAbrir} clicavel={clicavel && !!f.marcoId} />
        ))}
      </div>
    </div>
  )
}

function Linhazinha({ f, hoje, onAbrir, clicavel }: { f: Faixa; hoje: number | null; onAbrir: (f: Faixa) => void; clicavel: boolean }) {
  const c = COR_STATUS[f.status]
  return (
    <>
      <button type="button" onClick={() => onAbrir(f)} disabled={!clicavel}
        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: '8px 10px 8px 0', minHeight: 46, border: 0, borderBottom: '1px solid var(--v2-surface2)', background: 'none', textAlign: 'left', cursor: clicavel ? 'pointer' : 'default', fontFamily: 'inherit', minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{f.titulo}</span>
        <span style={{ fontSize: 11.5, color: c.forte, fontWeight: 700 }}>{ROTULO_STATUS[f.status]} · {fmtDiaMes(f.inicio)} a {fmtDiaMes(f.fim)}</span>
      </button>
      <div style={{ position: 'relative', minHeight: 46, borderBottom: '1px solid var(--v2-surface2)' }}>
        {hoje !== null && <div aria-hidden style={{ position: 'absolute', left: `${hoje}%`, top: 0, bottom: 0, borderLeft: '2px solid var(--v2-hot)', opacity: 0.6 }} />}
        {f.segmentos
          ? f.segmentos.map(s => (
              <div key={s.id} title={`${s.titulo} · ${ROTULO_STATUS[s.status]}`} className="anim-barra"
                style={{ position: 'absolute', top: 15, height: 16, left: `${s.esquerda}%`, width: `calc(${s.largura}% - 2px)`, borderRadius: 5, background: COR_STATUS[s.status].forte, opacity: s.status === 'a_fazer' ? 0.35 : 0.9 }} />
            ))
          : (
            <div onClick={() => clicavel && onAbrir(f)} title={`${f.titulo} · ${f.pct}%`} className="anim-barra"
              style={{ position: 'absolute', top: 13, height: 20, left: `${f.esquerda}%`, width: `${f.largura}%`, borderRadius: 999, background: c.fundo, border: `1.5px solid ${c.forte}`, overflow: 'hidden', cursor: clicavel ? 'pointer' : 'default', boxSizing: 'border-box' }}>
              <div style={{ width: `${f.pct}%`, height: '100%', background: c.forte, opacity: 0.85 }} />
            </div>
          )}
        {f.etapas.map(p => (
          <span key={p.id} title={`${p.titulo} · ${ROTULO_STATUS[p.status]} · ${fmtDiaMes(p.dia)}`}
            style={{ position: 'absolute', top: 18, left: `calc(${p.pos}% - 5px)`, width: 10, height: 10, transform: 'rotate(45deg)', borderRadius: 2, background: COR_STATUS[p.status].forte, border: '1.5px solid var(--v2-surface)', boxSizing: 'border-box' }} />
        ))}
      </div>
    </>
  )
}

function Cartao({ f, onAbrir, clicavel }: { f: Faixa; onAbrir: (f: Faixa) => void; clicavel: boolean }) {
  const c = COR_STATUS[f.status]
  const proximas = f.etapas.filter(p => p.status !== 'concluido').slice(0, 3)
  return (
    <button type="button" onClick={() => onAbrir(f)} disabled={!clicavel} className="anim-item"
      style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--v2-rule)', borderLeft: `4px solid ${c.forte}`, background: 'var(--v2-surface)', cursor: clicavel ? 'pointer' : 'default', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--v2-ink)', lineHeight: 1.3 }}>{f.titulo}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: c.forte, background: c.fundo, borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }}>{ROTULO_STATUS[f.status]}</span>
      </span>
      <span style={{ fontSize: 12.5, color: 'var(--v2-ink3)' }}>{fmtDiaMes(f.inicio)} a {fmtDiaMes(f.fim)}{f.etapas.length ? ` · ${f.etapas.length} ${f.etapas.length === 1 ? 'etapa' : 'etapas'}` : ''}</span>
      <span style={{ height: 6, borderRadius: 999, background: 'var(--v2-surface2)', overflow: 'hidden' }}><span className="anim-barra" style={{ display: 'block', width: `${f.pct}%`, height: '100%', background: c.forte }} /></span>
      {proximas.length > 0 && (
        <span style={{ fontSize: 12, color: 'var(--v2-ink2)', lineHeight: 1.5 }}>
          {proximas.map(p => <span key={p.id} style={{ display: 'block', color: p.status === 'atrasado' ? 'var(--v2-hot)' : undefined }}>· {p.titulo} ({fmtDiaMes(p.dia)})</span>)}
        </span>
      )}
    </button>
  )
}

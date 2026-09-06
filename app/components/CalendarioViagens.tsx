'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ViagemCal, segmentosDoMes, semanasDoMes, faixasNaSemana,
  listaPorMes, linhasGantt, reguaGantt, marcosDeMes,
} from '@/lib/calendarioViagens'
import { hojeYmd, fmtDataBR, fmtDiaMes, somarDias, diasEntre } from '@/lib/datas'

// CALENDÁRIO DE VIAGENS — mês, lista e gantt.
//
// A viagem ATRAVESSA dias, então ela é BARRA, não ponto: quem fatia por semana,
// empilha as sobrepostas e posiciona no gantt é lib/calendarioViagens (puro,
// testado). Aqui só desenha.
//
// Mês usa CSS Grid: a barra ocupa `grid-column: início / span N`, que é o que
// permite atravessar dias sem virar N quadradinhos soltos.

type Viagem = ViagemCal & { veiculoId?: string; valorPacote?: number; valorFechado?: number; contratante?: string }

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// Mesmas cores de status da tela de Viagens — o dono lê o mesmo significado nas duas.
const STATUS: Record<string, { label: string; cor: string; bg: string; borda: string }> = {
  planejada: { label: 'Planejada', cor: 'var(--v2-amber)', bg: 'var(--v2-amber-bg)', borda: 'var(--v2-amber-bg)' },
  aberta: { label: 'Aberta', cor: 'var(--v2-ok)', bg: 'var(--v2-ok-bg)', borda: 'var(--v2-ok-bg)' },
  realizada: { label: 'Realizada', cor: 'var(--v2-ink2)', bg: 'var(--v2-surface2)', borda: 'var(--v2-rule2)' },
  cancelada: { label: 'Cancelada', cor: 'var(--v2-ink3)', bg: 'var(--v2-surface1)', borda: 'var(--v2-rule)' },
}
const st = (s?: string) => STATUS[s || 'aberta'] || STATUS.aberta

type Vista = 'mes' | 'lista' | 'gantt'
const ALTURA_BARRA = 22
const GAP_BARRA = 3

export default function CalendarioViagens({ onAbrirViagem }: { onAbrirViagem?: (id: string) => void }) {
  const [viagens, setViagens] = useState<Viagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [vista, setVista] = useState<Vista>('mes')
  const [ref, setRef] = useState(() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() } })
  const [verCanceladas, setVerCanceladas] = useState(false)

  const carregar = useCallback(() => {
    setCarregando(true)
    fetch('/api/viagens').then(r => r.json())
      .then(d => { if (Array.isArray(d?.viagens)) setViagens(d.viagens) })
      .catch(() => {}).finally(() => setCarregando(false))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  // Cancelada polui o calendário — só aparece quando o dono pede.
  const visiveis = useMemo(() => viagens.filter(v => verCanceladas || v.status !== 'cancelada'), [viagens, verCanceladas])
  const canceladas = useMemo(() => viagens.filter(v => v.status === 'cancelada').length, [viagens])

  const semanas = useMemo(() => semanasDoMes(ref.ano, ref.mes), [ref])
  const segmentos = useMemo(() => segmentosDoMes(visiveis, ref.ano, ref.mes), [visiveis, ref])
  const grupos = useMemo(() => listaPorMes(visiveis), [visiveis])
  const gantt = useMemo(() => linhasGantt(visiveis), [visiveis])
  const regua = useMemo(() => reguaGantt(visiveis), [visiveis])

  const hoje = hojeYmd()
  const andarMes = (n: number) => setRef(r => {
    const d = new Date(r.ano, r.mes + n, 1)
    return { ano: d.getFullYear(), mes: d.getMonth() }
  })
  const irHoje = () => { const d = new Date(); setRef({ ano: d.getFullYear(), mes: d.getMonth() }) }

  const btnVista = (v: Vista, label: string) => (
    <button key={v} type="button" onClick={() => setVista(v)}
      style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: vista === v ? 'var(--v2-ink)' : 'transparent', color: vista === v ? 'var(--v2-surface)' : 'var(--v2-ink3)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )

  const abrir = (id: string) => onAbrirViagem?.(id)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--v2-ink)' }}>Calendário</h2>
        <span style={{ flex: 1 }} />
        {canceladas > 0 && (
          <button onClick={() => setVerCanceladas(v => !v)}
            style={{ padding: '7px 12px', background: 'transparent', border: '1px solid var(--v2-rule)', borderRadius: 9, color: 'var(--v2-ink3)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {verCanceladas ? 'Ocultar canceladas' : `Ver canceladas (${canceladas})`}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: 'var(--v2-surface1)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
        {btnVista('mes', 'Mês')}
        {btnVista('lista', 'Lista')}
        {btnVista('gantt', 'Gantt')}
      </div>

      {carregando ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Carregando...</p>
        : !viagens.length ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Nenhuma viagem cadastrada ainda.</p>
        : (
          <>
            {/* ── MÊS ─────────────────────────────────────────────────── */}
            {vista === 'mes' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <button onClick={() => andarMes(-1)} style={navBtn}>‹</button>
                  <button onClick={irHoje} style={{ ...navBtn, padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>Hoje</button>
                  <button onClick={() => andarMes(1)} style={navBtn}>›</button>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--v2-ink)', marginLeft: 6 }}>{MESES[ref.mes]} {ref.ano}</span>
                </div>

                <div style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--v2-surface1)', borderBottom: '1px solid var(--v2-rule)' }}>
                    {DIAS_SEMANA.map(d => (
                      <div key={d} style={{ padding: '8px 6px', fontSize: 10.5, fontWeight: 800, color: 'var(--v2-ink3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.04em' }}>{d}</div>
                    ))}
                  </div>

                  {semanas.map((dias, iSemana) => {
                    const nFaixas = faixasNaSemana(segmentos, iSemana)
                    const alturaBarras = nFaixas * (ALTURA_BARRA + GAP_BARRA)
                    return (
                      <div key={iSemana} style={{ position: 'relative', borderBottom: iSemana < semanas.length - 1 ? '1px solid var(--v2-rule)' : 'none' }}>
                        {/* Fundo: os 7 dias */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 34 + alturaBarras + 6 }}>
                          {dias.map(d => {
                            const doMes = Number(d.slice(5, 7)) - 1 === ref.mes
                            const ehHoje = d === hoje
                            return (
                              <div key={d} style={{ borderRight: '1px solid var(--v2-surface1)', padding: '5px 6px', background: ehHoje ? 'var(--v2-amber-bg)' : doMes ? 'var(--v2-surface)' : '#fcfcfc' }}>
                                <span style={{
                                  fontSize: 11, fontWeight: ehHoje ? 800 : 600,
                                  color: ehHoje ? 'var(--v2-amber)' : doMes ? 'var(--v2-ink2)' : 'var(--v2-rule2)',
                                }}>{Number(d.slice(8, 10))}</span>
                              </div>
                            )
                          })}
                        </div>

                        {/* Barras por cima, posicionadas no grid */}
                        <div style={{ position: 'absolute', top: 26, left: 0, right: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', pointerEvents: 'none' }}>
                          {segmentos.filter(s => s.semana === iSemana).map(s => {
                            const c = st(s.viagem.status)
                            return (
                              <button key={`${s.id}-${s.semana}`} type="button"
                                onClick={() => abrir(s.id)}
                                title={`${s.viagem.titulo} · ${fmtDataBR(s.viagem.dataIda)}${s.viagem.dataVolta ? ` → ${fmtDataBR(s.viagem.dataVolta)}` : ''}`}
                                style={{
                                  gridColumn: `${s.col + 1} / span ${s.span}`,
                                  gridRow: s.faixa + 1,
                                  margin: `0 2px ${GAP_BARRA}px`,
                                  height: ALTURA_BARRA,
                                  background: c.bg, color: c.cor,
                                  border: `1px solid ${c.borda}`,
                                  // Ponta reta = continua na semana seguinte; arredondada = começa/termina aqui.
                                  borderRadius: `${s.comecaAqui ? 7 : 0}px ${s.terminaAqui ? 7 : 0}px ${s.terminaAqui ? 7 : 0}px ${s.comecaAqui ? 7 : 0}px`,
                                  borderLeftWidth: s.comecaAqui ? 1 : 0,
                                  borderRightWidth: s.terminaAqui ? 1 : 0,
                                  fontSize: 10.5, fontWeight: 700, textAlign: 'left',
                                  padding: '0 6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                                  cursor: 'pointer', pointerEvents: 'auto',
                                  opacity: s.viagem.status === 'cancelada' ? 0.55 : 1,
                                }}>
                                {s.comecaAqui ? '' : '‹ '}{s.viagem.titulo}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Legenda />
              </div>
            )}

            {/* ── LISTA ───────────────────────────────────────────────── */}
            {vista === 'lista' && (
              <div>
                {grupos.length === 0 && <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Nenhuma viagem com data.</p>}
                {grupos.map(g => {
                  const [ano, mes] = g.mes.split('-')
                  return (
                    <div key={g.mes} style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
                        {MESES[Number(mes) - 1]} {ano} · {g.viagens.length} {g.viagens.length === 1 ? 'saída' : 'saídas'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {g.viagens.map(v => {
                          const c = st(v.status)
                          const passou = diasEntre(hoje, v.dataIda) < 0
                          return (
                            <button key={v.id} type="button" onClick={() => abrir(v.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', textAlign: 'left',
                                background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 10, padding: '10px 12px',
                                cursor: 'pointer', opacity: v.status === 'cancelada' ? 0.6 : 1, width: '100%',
                              }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: passou ? 'var(--v2-ink3)' : 'var(--v2-ink)', minWidth: 96 }}>
                                {fmtDiaMes(v.dataIda)}{v.dataVolta && v.dataVolta !== v.dataIda ? ` → ${fmtDiaMes(v.dataVolta)}` : ''}
                              </span>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--v2-ink)', flex: 1, minWidth: 160 }}>{v.titulo}</span>
                              {v.tipo === 'fretamento' && <span style={selo('var(--v2-info)', 'var(--v2-info-bg)')}>Fretamento</span>}
                              <span style={selo(c.cor, c.bg)}>{c.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── GANTT ───────────────────────────────────────────────── */}
            {vista === 'gantt' && regua && (
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--v2-ink3)' }}>
                  {fmtDataBR(regua.inicio)} → {fmtDataBR(regua.fim)} · {regua.dias} dias · role para o lado
                </p>
                <div style={{ overflowX: 'auto', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 14, padding: 12 }}>
                  <div style={{ minWidth: Math.max(560, regua.dias * 26 + 190) }}>
                    {/* Eixo: um rótulo por mês */}
                    <div style={{ display: 'flex', marginBottom: 6 }}>
                      <span style={{ width: 180, flexShrink: 0 }} />
                      <div style={{ position: 'relative', flex: 1, height: 16 }}>
                        {marcosDeMes(regua.inicio, regua.dias).map(m => (
                          <span key={m.offset} style={{
                            position: 'absolute', left: `${(m.offset / regua.dias) * 100}%`,
                            fontSize: 10, fontWeight: 800, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '.04em',
                            borderLeft: '1px solid var(--v2-rule)', paddingLeft: 4, whiteSpace: 'nowrap',
                          }}>{m.rotulo}</span>
                        ))}
                      </div>
                    </div>

                    {gantt.map(l => {
                      const c = st(l.viagem.status)
                      return (
                        <div key={l.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                          <button type="button" onClick={() => abrir(l.id)}
                            style={{
                              width: 180, flexShrink: 0, textAlign: 'left', background: 'none', border: 'none', padding: '0 8px 0 0',
                              fontSize: 12, fontWeight: 700, color: 'var(--v2-ink)', cursor: 'pointer',
                              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                              opacity: l.viagem.status === 'cancelada' ? 0.6 : 1,
                            }}>{l.viagem.titulo}</button>
                          <div style={{ position: 'relative', flex: 1, height: ALTURA_BARRA, background: 'var(--v2-surface1)', borderRadius: 6 }}>
                            {/* Hoje: a linha que diz onde a operação está */}
                            {diasEntre(regua.inicio, hoje) >= 0 && diasEntre(hoje, regua.fim) >= 0 && (
                              <span style={{ position: 'absolute', left: `${(diasEntre(regua.inicio, hoje) / regua.dias) * 100}%`, top: -2, bottom: -2, width: 2, background: 'var(--v2-amber-on)', borderRadius: 2 }} />
                            )}
                            <button type="button" onClick={() => abrir(l.id)}
                              title={`${fmtDataBR(l.inicio)} → ${fmtDataBR(l.fim)} · ${l.duracao} ${l.duracao === 1 ? 'dia' : 'dias'}`}
                              style={{
                                position: 'absolute',
                                left: `${(l.offset / regua.dias) * 100}%`,
                                width: `${(l.duracao / regua.dias) * 100}%`,
                                top: 0, height: ALTURA_BARRA,
                                minWidth: 8,
                                background: c.bg, border: `1px solid ${c.borda}`, borderRadius: 6,
                                color: c.cor, fontSize: 10, fontWeight: 800,
                                padding: '0 4px', overflow: 'hidden', whiteSpace: 'nowrap',
                                cursor: 'pointer', opacity: l.viagem.status === 'cancelada' ? 0.55 : 1,
                              }}>{l.duracao > 2 ? `${l.duracao}d` : ''}</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <Legenda />
              </div>
            )}
            {vista === 'gantt' && !regua && <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Nenhuma viagem com data para montar o gantt.</p>}
          </>
        )}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  padding: '6px 10px', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 8,
  color: 'var(--v2-ink2)', fontSize: 14, cursor: 'pointer', lineHeight: 1,
}
const selo = (cor: string, bg: string): React.CSSProperties => ({
  fontSize: 10, fontWeight: 800, color: cor, background: bg, borderRadius: 999, padding: '2px 8px',
})

function Legenda() {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
      {Object.entries(STATUS).map(([k, c]) => (
        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--v2-ink3)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: c.bg, border: `1px solid ${c.borda}` }} />
          {c.label}
        </span>
      ))}
    </div>
  )
}

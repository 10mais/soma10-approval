'use client'
// SELETOR DE DATA DO AGENDAMENTO (Mudança 1, dono 21/11/2026): ao agendar, o mês do cliente
// com o que já está programado em cada dia. Clicar num dia mostra os horários já usados e
// deixa escolher a hora; passar o mouse (ou tocar) num post mostra o resumo dele. Nada
// bloqueia: mesmo dia e mesmo horário são permitidos, só há um aviso.
//
// O campo datetime-local de antes continua onde estava (a pessoa já usa); este modal abre ao
// lado dele. As contas moram em lib/calendarioPosts; a miniatura do post é a mesma do
// Calendário do Programador (PostMiniCalendario).
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { gradeDoMes, postsPorDia, horariosDoDia, horariosSugeridos, postsNoHorario, valorLocal, lerValorLocal, diaPassado, instantePassado, horaDe, STATUS_ROTULO } from '@/lib/calendarioPosts'
import { apareceNoPlanner } from '@/lib/plannerFiltro'
import { MiniPost, capaDoPost, ehVideo, type PostMini } from '@/app/components/PostMiniCalendario'
import { fecharFora } from '@/lib/fecharModal'
import { useIsMobile } from '@/lib/useIsMobile'
import { useIdioma } from '@/app/components/Idioma'
import LimiteDeErro from './LimiteDeErro'

type Props = {
  clienteId: string
  valor?: string // "2026-11-18T10:00" (o mesmo formato do datetime-local)
  ignorarPostId?: string // o próprio post, quando é remarcação
  onEscolher: (valor: string) => void
  onClose: () => void
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const SEMANA_LONGA = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.']

// Posts do cliente por 60 s: abrir e fechar o seletor não repete a busca.
const cache = new Map<string, { em: number; posts: PostMini[] }>()

export default function SeletorDataAgenda(props: Props) {
  if (typeof document === 'undefined') return null
  return createPortal(<LimiteDeErro onFechar={props.onClose} titulo="Não foi possível abrir o calendário"><Tela {...props} /></LimiteDeErro>, document.body)
}

function Tela({ clienteId, valor, ignorarPostId, onEscolher, onClose }: Props) {
  const mobile = useIsMobile()
  const { idioma } = useIdioma()
  const inicial = lerValorLocal(valor)
  const hoje = new Date()
  const [ref, setRef] = useState({ ano: inicial?.ano ?? hoje.getFullYear(), mes: inicial?.mes ?? hoje.getMonth() })
  const [dia, setDia] = useState<{ ano: number; mes: number; dia: number } | null>(inicial ? { ano: inicial.ano, mes: inicial.mes, dia: inicial.dia } : null)
  const [hora, setHora] = useState(inicial?.hora || '')
  const [posts, setPosts] = useState<PostMini[] | null>(null)
  const [erro, setErro] = useState(false)
  const [resumo, setResumo] = useState<PostMini | null>(null)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden' // o fundo não rola atrás do modal
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = antes }
  }, [onClose])

  useEffect(() => {
    if (!clienteId) { setPosts([]); return }
    const c = cache.get(clienteId)
    if (c && Date.now() - c.em < 60_000) { setPosts(c.posts); return }
    setPosts(null); setErro(false)
    fetch(`/api/posts?clienteId=${encodeURIComponent(clienteId)}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => {
        const lista = (Array.isArray(d) ? d : []).filter((p: any) => !p.excluidoEm && apareceNoPlanner(p)) as PostMini[]
        cache.set(clienteId, { em: Date.now(), posts: lista })
        setPosts(lista)
      })
      .catch(() => { setErro(true); setPosts([]) })
  }, [clienteId])

  const visiveis = useMemo(() => (posts || []).filter(p => p.id !== ignorarPostId), [posts, ignorarPostId])
  const porDia = useMemo(() => postsPorDia(visiveis, ref.ano, ref.mes), [visiveis, ref])
  const sugeridos = useMemo(() => horariosSugeridos(visiveis), [visiveis])
  const grade = gradeDoMes(ref.ano, ref.mes)
  const doDia = dia && dia.ano === ref.ano && dia.mes === ref.mes ? porDia.get(dia.dia) || [] : dia ? postsPorDia(visiveis, dia.ano, dia.mes).get(dia.dia) || [] : []
  const usados = horariosDoDia(doDia)
  const horaEf = hora || sugeridos[0] || '09:00'
  const escolhido = dia ? valorLocal(dia.ano, dia.mes, dia.dia, horaEf) : ''
  const jaPassou = escolhido ? instantePassado(escolhido) : false
  const noMesmoHorario = dia ? postsNoHorario(doDia, horaEf) : 0
  const ehHoje = (d: number) => hoje.getFullYear() === ref.ano && hoje.getMonth() === ref.mes && hoje.getDate() === d
  const mudarMes = (delta: number) => setRef(r => { const d = new Date(r.ano, r.mes + delta, 1); return { ano: d.getFullYear(), mes: d.getMonth() } })
  const totalMes = Array.from(porDia.values()).reduce((n, l) => n + l.length, 0)

  const btn: React.CSSProperties = { minWidth: 36, height: 36, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 9, cursor: 'pointer', color: 'var(--v2-ink2)', fontSize: 15, fontFamily: 'inherit', padding: '0 10px' }
  const rotuloDia = dia ? `${SEMANA_LONGA[new Date(dia.ano, dia.mes, dia.dia).getDay()]}, ${String(dia.dia).padStart(2, '0')}/${String(dia.mes + 1).padStart(2, '0')}` : ''

  const mes = (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--v2-ink)' }}>{MESES[ref.mes]} {ref.ano}</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>{posts === null ? 'Carregando o que já está programado…' : totalMes ? `${totalMes} ${totalMes === 1 ? 'post programado' : 'posts programados'} neste mês` : 'Nenhum post programado neste mês'}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={btn} aria-label="Mês anterior" onClick={() => mudarMes(-1)}>&#8249;</button>
          <button type="button" style={{ ...btn, fontSize: 12, fontWeight: 700 }} onClick={() => setRef({ ano: hoje.getFullYear(), mes: hoje.getMonth() })}>Hoje</button>
          <button type="button" style={btn} aria-label="Próximo mês" onClick={() => mudarMes(1)}>&#8250;</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: mobile ? 3 : 5 }}>
        {SEMANA.map(s => <div key={s} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', textTransform: 'uppercase', padding: '2px 0 4px' }}>{s}</div>)}
        {grade.map((d, i) => {
          if (!d) return <div key={i} />
          const lista = porDia.get(d) || []
          const sel = !!dia && dia.ano === ref.ano && dia.mes === ref.mes && dia.dia === d
          const passado = diaPassado(ref.ano, ref.mes, d)
          const max = mobile ? 0 : 2
          return (
            <button key={i} type="button" onClick={() => { setDia({ ano: ref.ano, mes: ref.mes, dia: d }); setResumo(null) }}
              aria-label={`${d} de ${MESES[ref.mes]}${lista.length ? `, ${lista.length} ${lista.length === 1 ? 'post' : 'posts'}` : ', livre'}`} aria-pressed={sel}
              style={{
                textAlign: 'left', minHeight: mobile ? 50 : 84, padding: mobile ? 4 : 6, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                border: sel ? '2px solid var(--v2-ink)' : '1px solid var(--v2-rule)',
                background: posts === null ? 'var(--v2-surface1)' : lista.length ? 'var(--v2-surface2)' : 'var(--v2-surface)',
                opacity: passado ? 0.55 : 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0,
              }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink)', background: ehHoje(d) ? 'var(--v2-amber-on)' : 'transparent' }}>{d}</span>
                {lista.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--v2-ink2)' }}>{lista.length}</span>}
              </span>
              {posts === null && <span className="anim-shimmer" style={{ height: 10, borderRadius: 5, background: 'var(--v2-surface2)' }} />}
              {mobile && lista.length > 0 && (
                <span style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>{lista.slice(0, 3).map(p => <span key={p.id} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--v2-ink2)' }} />)}</span>
              )}
              {lista.slice(0, max).map(p => <MiniPost key={p.id} post={p} idioma={idioma} compacto mostrarCliente={false} onMouseEnter={() => setResumo(p)} />)}
              {!mobile && lista.length > max && <span style={{ fontSize: 10, color: 'var(--v2-ink3)' }}>+{lista.length - max} mais</span>}
            </button>
          )
        })}
      </div>
      {erro && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--v2-hot)' }}>Não deu para carregar os posts do cliente. Dá para agendar mesmo assim.</p>}
    </div>
  )

  const painel = (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!dia && <p style={{ margin: 0, fontSize: 14, color: 'var(--v2-ink2)' }}>Escolha um dia no calendário. Dias com fundo já têm post programado.</p>}
      {dia && (<>
        <div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--v2-ink)' }}>{rotuloDia}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--v2-ink3)' }}>{doDia.length ? `${doDia.length} ${doDia.length === 1 ? 'post já programado' : 'posts já programados'}` : 'Dia livre'}</p>
        </div>
        {doDia.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: mobile ? 150 : 210, overflowY: 'auto' }}>
            {doDia.map(p => <MiniPost key={p.id} post={p} idioma={idioma} mostrarCliente={false} selecionado={resumo?.id === p.id} onClick={() => setResumo(r => (r?.id === p.id ? null : p))} onMouseEnter={() => setResumo(p)} />)}
          </div>
        )}
        <div>
          <label htmlFor="seletor-hora" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', marginBottom: 6 }}>Horário</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {Array.from(new Set([...sugeridos, ...usados.map(u => u.hora)])).sort().map(h => {
              const uso = usados.find(u => u.hora === h)
              const ativo = horaEf === h
              return (
                <button key={h} type="button" onClick={() => setHora(h)}
                  style={{ padding: '7px 11px', borderRadius: 999, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', minHeight: 36,
                    border: ativo ? '2px solid var(--v2-ink)' : '1px solid var(--v2-rule)', background: uso ? 'var(--v2-surface2)' : 'var(--v2-surface)', color: 'var(--v2-ink)' }}>
                  {h}{uso ? ` · ${uso.total === 1 ? 'já tem 1' : `já tem ${uso.total}`}` : ''}
                </button>
              )
            })}
          </div>
          <input id="seletor-hora" type="time" value={horaEf} onChange={e => setHora(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 16, fontFamily: 'inherit', background: 'var(--v2-surface)', color: 'var(--v2-ink)' }} />
          {noMesmoHorario > 0 && <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--v2-amber)' }}>Já {noMesmoHorario === 1 ? 'existe 1 post' : `existem ${noMesmoHorario} posts`} às {horaEf} neste dia. Pode agendar mesmo assim.</p>}
          {jaPassou && <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--v2-hot)' }}>Esse horário já passou. Escolha outro dia ou horário.</p>}
        </div>
        <div style={mobile ? { position: 'sticky', bottom: 'calc(-16px - env(safe-area-inset-bottom))', background: 'var(--v2-surface)', padding: '10px 0 calc(16px + env(safe-area-inset-bottom))', margin: '0 0 calc(-16px - env(safe-area-inset-bottom))' } : undefined}>
        <button type="button" disabled={jaPassou} onClick={() => { onEscolher(escolhido); onClose() }}
          style={{ width: '100%', padding: '13px 16px', borderRadius: 11, border: 0, background: 'var(--v2-ink)', color: 'var(--v2-surface)', fontWeight: 800, fontSize: 14.5, fontFamily: 'inherit', cursor: jaPassou ? 'default' : 'pointer', opacity: jaPassou ? 0.45 : 1 }}
          className="soma10-no-invert">
          Usar {rotuloDia.split(', ')[1]} às {horaEf}
        </button>
        </div>
      </>)}
      {resumo && <Resumo post={resumo} idioma={idioma} />}
    </div>
  )

  return (
    <div onClick={fecharFora(onClose)} className="anim-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1700, display: 'flex', alignItems: mobile ? 'stretch' : 'center', justifyContent: 'center', padding: mobile ? 0 : 20 }}>
      <div role="dialog" aria-modal="true" aria-label="Escolher data e horário" onClick={e => e.stopPropagation()} className="anim-modal"
        style={{
          background: 'var(--v2-surface)', width: '100%', maxWidth: mobile ? '100%' : 1080, maxHeight: mobile ? '100%' : '92vh', overflowY: 'auto', boxSizing: 'border-box',
          borderRadius: mobile ? 0 : 18, padding: mobile ? 'calc(12px + env(safe-area-inset-top)) 14px calc(16px + env(safe-area-inset-bottom))' : 22,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--v2-ink3)' }}>Escolher data e horário</p>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ ...btn, width: 40, height: 40, fontSize: 18 }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.75fr) minmax(280px, 1fr)', gap: mobile ? 16 : 22 }}>
          {mes}
          <div style={mobile ? { borderTop: '1px solid var(--v2-rule)', paddingTop: 14 } : { borderLeft: '1px solid var(--v2-rule)', paddingLeft: 22 }}>{painel}</div>
        </div>
      </div>
    </div>
  )
}

function Resumo({ post: p, idioma }: { post: PostMini; idioma: string }) {
  const capa = capaDoPost(p)
  const legenda = (p.legenda || '').replace(/\s+/g, ' ').trim()
  return (
    <div className="anim-in" style={{ display: 'flex', gap: 10, padding: 10, border: '1px solid var(--v2-rule)', borderRadius: 12, background: 'var(--v2-surface1)' }}>
      <div style={{ width: 64, height: 80, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--v2-surface2)' }}>
        {capa && (ehVideo(capa) ? <video src={capa} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={capa} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: 'var(--v2-ink)' }}>{horaDe(p.dataAgendada)} · {STATUS_ROTULO[p.status] || p.status}{p.suspenso ? ' · suspenso' : ''}</p>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--v2-ink2)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{legenda || 'Sem legenda'}</p>
      </div>
    </div>
  )
}

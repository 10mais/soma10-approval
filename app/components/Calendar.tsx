'use client'
import { useState } from 'react'

type Post = {
  id: string; clienteNome: string; status: string; dataAgendada?: string; legenda: string; imagens: string[]
  formato?: 'feed' | 'reel' | 'story'
  redes?: ('instagram' | 'facebook')[]
  capasVideo?: Record<string, string>
  thumbnail?: string
}

const FORMATO_LABEL: Record<string, string> = { feed: 'Feed', reel: 'Reel', story: 'Story' }

const ehVideo = (u: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(u || '')

function capaDoPost(p: Post): string {
  if (p.thumbnail) return p.thumbnail
  const caps = p.capasVideo || {}
  for (const url of (p.imagens || [])) { if (caps[url]) return caps[url] }
  const img = (p.imagens || []).find(u => !ehVideo(u))
  if (img) return img
  const anyCap = Object.values(caps)[0]
  if (anyCap) return anyCap
  return (p.imagens || [])[0] || ''
}

function fmtHora(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function RedeIcon({ rede, size = 12 }: { rede: 'instagram' | 'facebook'; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={rede === 'facebook' ? '#1877f2' : '#d6249f'} style={{ flexShrink: 0 }}>{rede === 'facebook'
      ? <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      : <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z" />}</svg>
  )
}

const STATUS_COLOR: Record<string, string> = {
  rascunho: 'var(--v2-surface2)',
  agendado: 'var(--v2-amber-bg)',
  aguardando_aprovacao: 'var(--v2-amber-bg)',
  aprovado: 'var(--v2-ok-bg)',
  corrigir: '#fff3cd',
  reprovado: 'var(--v2-hot-bg)',
  publicado: 'var(--v2-ok-bg)',
  falha_publicacao: '#fde2e2',
}

const STATUS_DOT: Record<string, string> = {
  rascunho: 'var(--v2-ink3)',
  agendado: 'var(--v2-amber)',
  aguardando_aprovacao: 'var(--v2-amber-on)',
  aprovado: 'var(--v2-ok)',
  corrigir: 'var(--v2-amber)',
  reprovado: 'var(--v2-hot)',
  publicado: 'var(--v2-ok)',
  falha_publicacao: 'var(--v2-hot)',
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Calendar({ posts, onSelectPost, onAddPost, onMovePost }: {
  posts: Post[]
  onSelectPost?: (post: Post) => void
  onAddPost?: (date: Date) => void
  onMovePost?: (post: Post, date: Date) => void
}) {
  const [refDate, setRefDate] = useState(new Date())
  const [hoverDay, setHoverDay] = useState<number | null>(null)
  const [dragOverDay, setDragOverDay] = useState<number | null>(null)

  const year = refDate.getFullYear()
  const month = refDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const startWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function postsForDay(day: number) {
    return posts.filter(p => {
      if (!p.dataAgendada) return false
      const d = new Date(p.dataAgendada)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  const today = new Date()
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
  const inicioHoje = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const ehPassado = (day: number) => new Date(year, month, day) < inicioHoje

  return (
    <div style={{ background: 'var(--v2-surface)', borderRadius: 14, border: '1px solid var(--v2-rule)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--v2-rule)' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--v2-ink)' }}>{MESES[month]} {year}</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setRefDate(new Date(year, month - 1, 1))}
            style={{ width: 32, height: 32, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 8, cursor: 'pointer', color: 'var(--v2-ink2)', fontSize: 14 }}>
            ‹
          </button>
          <button onClick={() => setRefDate(new Date())}
            style={{ padding: '0 14px', height: 32, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 8, cursor: 'pointer', color: 'var(--v2-ink2)', fontSize: 12, fontWeight: 600 }}>
            Hoje
          </button>
          <button onClick={() => setRefDate(new Date(year, month + 1, 1))}
            style={{ width: 32, height: 32, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 8, cursor: 'pointer', color: 'var(--v2-ink2)', fontSize: 14 }}>
            ›
          </button>
        </div>
      </div>

      {/* Dias da semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--v2-rule)' }}>
        {DIAS_SEMANA.map(d => (
          <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((day, i) => {
          const dayPosts = day ? postsForDay(day) : []
          return (
            <div key={i}
              onMouseEnter={() => day && setHoverDay(day)}
              onMouseLeave={() => setHoverDay(h => (h === day ? null : h))}
              onDragOver={day && onMovePost && !ehPassado(day) ? (e) => { e.preventDefault(); setDragOverDay(day) } : undefined}
              onDragLeave={() => setDragOverDay(d => (d === day ? null : d))}
              onDrop={day && onMovePost && !ehPassado(day) ? (e) => {
                e.preventDefault(); setDragOverDay(null)
                const id = e.dataTransfer.getData('postId')
                const post = posts.find(p => p.id === id)
                if (post) onMovePost(post, new Date(year, month, day, 9, 0))
              } : undefined}
              style={{
                position: 'relative', minHeight: 92, padding: 8, borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--v2-surface1)' : 'none',
                borderBottom: '1px solid var(--v2-surface1)',
                background: dragOverDay === day ? 'var(--v2-amber-bg)' : (day ? 'var(--v2-surface)' : 'var(--v2-surface1)'),
                outline: dragOverDay === day ? '2px dashed var(--v2-amber-on)' : 'none', outlineOffset: -2,
              }}>
              {day && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 22, height: 22, borderRadius: '50%', fontSize: 12, fontWeight: 600,
                      color: isToday(day) ? 'var(--v2-ink)' : 'var(--v2-ink3)',
                      background: isToday(day) ? 'var(--v2-amber-on)' : 'transparent', marginBottom: 4,
                    }}>
                      {day}
                    </div>
                    {onAddPost && hoverDay === day && !ehPassado(day) && (
                      <button onClick={() => onAddPost(new Date(year, month, day, 9, 0))} title="Criar post neste dia"
                        style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'var(--v2-ink)', color: 'var(--v2-amber-on)', fontSize: 14, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        +
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {dayPosts.slice(0, 3).map(p => {
                      const capa = capaDoPost(p)
                      const mostrarImg = capa && !ehVideo(capa)
                      const redes = (p.redes && p.redes.length ? p.redes : []) as ('instagram' | 'facebook')[]
                      return (
                      <div key={p.id}
                        draggable={!!onMovePost}
                        onDragStart={(e) => e.dataTransfer.setData('postId', p.id)}
                        onClick={() => onSelectPost?.(p)} title={p.legenda} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: 4, borderRadius: 6,
                        background: STATUS_COLOR[p.status] || 'var(--v2-surface2)', cursor: onMovePost ? 'grab' : (onSelectPost ? 'pointer' : 'default'),
                        overflow: 'hidden',
                      }}>
                        <div style={{ width: 28, height: 28, borderRadius: 5, overflow: 'hidden', flexShrink: 0, background: 'var(--v2-surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {mostrarImg
                            ? <img src={capa} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : capa
                              ? <video src={capa} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v2-ink3)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L5 21" /></svg>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--v2-ink)' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[p.status] || 'var(--v2-ink3)', flexShrink: 0 }} />
                            {fmtHora(p.dataAgendada) && <span>{fmtHora(p.dataAgendada)}</span>}
                            {p.formato && <span style={{ color: 'var(--v2-ink3)' }}>· {FORMATO_LABEL[p.formato] || p.formato}</span>}
                            {redes.map(r => <RedeIcon key={r} rede={r} size={11} />)}
                          </div>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--v2-ink2)', fontSize: 10 }}>
                            {p.clienteNome}
                          </span>
                        </div>
                      </div>
                    )})}
                    {dayPosts.length > 3 && (
                      <span style={{ fontSize: 10, color: 'var(--v2-ink3)', paddingLeft: 6 }}>+{dayPosts.length - 3} mais</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '12px 20px', borderTop: '1px solid var(--v2-rule)', background: 'var(--v2-surface1)' }}>
        {Object.entries(STATUS_DOT).map(([status, color]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 11, color: 'var(--v2-ink3)', textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

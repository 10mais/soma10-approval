'use client'
import { useIdioma } from '@/app/components/Idioma'
import { useState } from 'react'
import { gradeDoMes } from '@/lib/calendarioPosts'
import { MiniPost, STATUS_DOT } from '@/app/components/PostMiniCalendario'

type Post = {
  id: string; clienteNome: string; status: string; dataAgendada?: string; legenda: string; imagens: string[]
  formato?: 'feed' | 'reel' | 'story'
  redes?: ('instagram' | 'facebook')[]
  capasVideo?: Record<string, string>
  thumbnail?: string
  suspenso?: { em: string; por: string; statusAnterior: string } // lib/suspenderPost
}


const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Calendar({ posts, onSelectPost, onAddPost, onMovePost }: {
  posts: Post[]
  onSelectPost?: (post: Post) => void
  onAddPost?: (date: Date) => void
  onMovePost?: (post: Post, date: Date) => void
}) {
  const { idioma } = useIdioma()
  const [refDate, setRefDate] = useState(new Date())
  const [hoverDay, setHoverDay] = useState<number | null>(null)
  const [dragOverDay, setDragOverDay] = useState<number | null>(null)

  const year = refDate.getFullYear()
  const month = refDate.getMonth()

  const cells = gradeDoMes(year, month)

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
                    {dayPosts.slice(0, 3).map(p => (
                      <MiniPost key={p.id} post={p} idioma={idioma}
                        draggable={!!onMovePost} onDragStart={(e) => e.dataTransfer.setData('postId', p.id)}
                        onClick={onSelectPost ? () => onSelectPost(p) : undefined} cursor={onMovePost ? 'grab' : undefined} />
                    ))}
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

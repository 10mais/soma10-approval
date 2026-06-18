'use client'
import { useState } from 'react'

type Post = { id: string; clienteNome: string; status: string; dataAgendada?: string; legenda: string; imagens: string[] }

const STATUS_COLOR: Record<string, string> = {
  rascunho: '#eeeeee',
  agendado: '#fef9c3',
  aguardando_aprovacao: '#fef3c7',
  aprovado: '#dcfce7',
  corrigir: '#fff3cd',
  reprovado: '#fee2e2',
  publicado: '#dcfce7',
  falha_publicacao: '#fde2e2',
}

const STATUS_DOT: Record<string, string> = {
  rascunho: '#aaa',
  agendado: '#a16207',
  aguardando_aprovacao: '#f59e0b',
  aprovado: '#16a34a',
  corrigir: '#d97706',
  reprovado: '#dc2626',
  publicado: '#16a34a',
  falha_publicacao: '#991b1b',
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

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e8e8', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111' }}>{MESES[month]} {year}</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setRefDate(new Date(year, month - 1, 1))}
            style={{ width: 32, height: 32, border: '1px solid #e0e0e0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#666', fontSize: 14 }}>
            ‹
          </button>
          <button onClick={() => setRefDate(new Date())}
            style={{ padding: '0 14px', height: 32, border: '1px solid #e0e0e0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#666', fontSize: 12, fontWeight: 600 }}>
            Hoje
          </button>
          <button onClick={() => setRefDate(new Date(year, month + 1, 1))}
            style={{ width: 32, height: 32, border: '1px solid #e0e0e0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#666', fontSize: 14 }}>
            ›
          </button>
        </div>
      </div>

      {/* Dias da semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f0f0f0' }}>
        {DIAS_SEMANA.map(d => (
          <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
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
              onDragOver={day && onMovePost ? (e) => { e.preventDefault(); setDragOverDay(day) } : undefined}
              onDragLeave={() => setDragOverDay(d => (d === day ? null : d))}
              onDrop={day && onMovePost ? (e) => {
                e.preventDefault(); setDragOverDay(null)
                const id = e.dataTransfer.getData('postId')
                const post = posts.find(p => p.id === id)
                if (post) onMovePost(post, new Date(year, month, day, 9, 0))
              } : undefined}
              style={{
                position: 'relative', minHeight: 92, padding: 8, borderRight: (i + 1) % 7 !== 0 ? '1px solid #f5f5f5' : 'none',
                borderBottom: '1px solid #f5f5f5',
                background: dragOverDay === day ? '#fffbeb' : (day ? '#fff' : '#fafafa'),
                outline: dragOverDay === day ? '2px dashed #ffc00f' : 'none', outlineOffset: -2,
              }}>
              {day && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 22, height: 22, borderRadius: '50%', fontSize: 12, fontWeight: 600,
                      color: isToday(day) ? '#111' : '#888',
                      background: isToday(day) ? '#ffc00f' : 'transparent', marginBottom: 4,
                    }}>
                      {day}
                    </div>
                    {onAddPost && hoverDay === day && (
                      <button onClick={() => onAddPost(new Date(year, month, day, 9, 0))} title="Criar post neste dia"
                        style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#111', color: '#ffc00f', fontSize: 14, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        +
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {dayPosts.slice(0, 3).map(p => (
                      <div key={p.id}
                        draggable={!!onMovePost}
                        onDragStart={(e) => e.dataTransfer.setData('postId', p.id)}
                        onClick={() => onSelectPost?.(p)} title={p.legenda} style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '3px 6px', borderRadius: 5,
                        background: STATUS_COLOR[p.status] || '#f0f0f0', cursor: onMovePost ? 'grab' : (onSelectPost ? 'pointer' : 'default'),
                        fontSize: 11, overflow: 'hidden',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[p.status] || '#999', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#333', fontWeight: 500 }}>
                          {p.clienteNome}
                        </span>
                      </div>
                    ))}
                    {dayPosts.length > 3 && (
                      <span style={{ fontSize: 10, color: '#aaa', paddingLeft: 6 }}>+{dayPosts.length - 3} mais</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '12px 20px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
        {Object.entries(STATUS_DOT).map(([status, color]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 11, color: '#888', textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

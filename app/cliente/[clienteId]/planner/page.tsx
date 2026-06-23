'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Calendar from '@/app/components/Calendar'

export default function PlannerPage() {
  const { clienteId } = useParams()
  const [posts, setPosts] = useState<any[]>([])
  const [view, setView] = useState<'lista' | 'calendario'>('calendario')

  useEffect(() => {
    fetch(`/api/posts?clienteId=${clienteId}`).then(r => r.json()).then(d => setPosts(Array.isArray(d) ? d : [])).catch(() => {})
  }, [clienteId])

  const agendados = posts.filter(p => p.status === 'agendado' || p.status === 'publicado')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Planner</h2>
        <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 10, padding: 3 }}>
          {(['lista', 'calendario'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '7px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: view === v ? '#fff' : 'transparent', color: view === v ? '#111' : '#888',
            }}>{v === 'lista' ? 'Lista' : 'Calendario'}</button>
          ))}
        </div>
      </div>
      {view === 'calendario' && <Calendar posts={agendados as any} />}
      {view === 'lista' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {agendados.length === 0 && <p style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Nenhum post agendado ou publicado.</p>}
          {agendados.sort((a, b) => new Date(b.dataAgendada || b.criadoEm).getTime() - new Date(a.dataAgendada || a.criadoEm).getTime()).map(p => (
            <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#111' }}>{p.legenda?.slice(0, 80) || 'Sem legenda'}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>{p.dataAgendada ? new Date(p.dataAgendada).toLocaleString('pt-BR') : ''}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '3px 10px', background: p.status === 'publicado' ? '#dcfce7' : '#fef9c3', color: p.status === 'publicado' ? '#16a34a' : '#92400e' }}>{p.status === 'publicado' ? 'Publicado' : 'Agendado'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'
import { useEffect, useMemo, useState } from 'react'

type Usuario = { email: string; nome: string; role?: string; foto?: string }

function fmtH(min: number) { return `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}` }
function diaISO(d: Date) { return d.toISOString().slice(0, 10) }

export default function CargaEquipe({ usuarios }: { usuarios: Usuario[] }) {
  const [tarefas, setTarefas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  useEffect(() => { fetch('/api/tarefas').then(r => r.json()).then(d => { setTarefas(Array.isArray(d) ? d : []); setCarregando(false) }).catch(() => setCarregando(false)) }, [])

  const equipe = usuarios.filter(u => u.role !== 'cliente')
  const hoje = diaISO(new Date())
  const seteDiasAtras = Date.now() - 7 * 24 * 60 * 60 * 1000

  const linhas = useMemo(() => equipe.map(u => {
    const minhas = tarefas.filter(t => t.responsavelEmail === u.email && t.status !== 'concluido')
    const atrasadas = minhas.filter(t => t.prazo && diaISO(new Date(t.prazo)) < hoje).length
    let minSemana = 0
    for (const t of tarefas) for (const a of (t.apontamentos || [])) {
      if (a.usuarioEmail === u.email && new Date(a.data).getTime() >= seteDiasAtras) minSemana += Number(a.minutos) || 0
    }
    return { u, abertas: minhas.length, atrasadas, minSemana }
  }).sort((a, b) => b.abertas - a.abertas), [equipe, tarefas])

  const maxAbertas = Math.max(1, ...linhas.map(l => l.abertas))
  // Sobrecarga: muitas tarefas abertas OU atrasadas acumuladas
  const sobrecarregado = (l: { abertas: number; atrasadas: number }) => l.abertas >= 10 || l.atrasadas >= 3

  const card: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Carga da equipe</h2>
      <p style={{ margin: '4px 0 18px', fontSize: 13, color: '#999' }}>Tarefas abertas, atrasadas e horas dos últimos 7 dias por pessoa. Quem está sobrecarregado aparece destacado.</p>

      {carregando ? <p style={{ color: '#aaa' }}>Carregando...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {linhas.map(l => {
            const alerta = sobrecarregado(l)
            return (
              <div key={l.u.email} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, border: alerta ? '1.5px solid #fecaca' : '1px solid transparent' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', background: '#f0f0f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#aaa' }}>
                  {l.u.foto ? <img src={l.u.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (l.u.nome?.[0]?.toUpperCase() || '?')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111' }}>{l.u.nome}</p>
                    {alerta && <span style={{ fontSize: 9.5, fontWeight: 800, color: '#b91c1c', background: '#fee2e2', borderRadius: 999, padding: '2px 8px', textTransform: 'uppercase' }}>Sobrecarregado</span>}
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: '#eee', overflow: 'hidden', margin: '6px 0 0', maxWidth: 320 }}>
                    <div style={{ width: `${Math.round((l.abertas / maxAbertas) * 100)}%`, height: '100%', background: alerta ? '#dc2626' : '#1d4ed8', borderRadius: 999 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 18, flexShrink: 0, textAlign: 'center' }}>
                  <div><p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111' }}>{l.abertas}</p><p style={{ margin: 0, fontSize: 10.5, color: '#999' }}>abertas</p></div>
                  <div><p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: l.atrasadas > 0 ? '#dc2626' : '#111' }}>{l.atrasadas}</p><p style={{ margin: 0, fontSize: 10.5, color: '#999' }}>atrasadas</p></div>
                  <div><p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111' }}>{fmtH(l.minSemana)}</p><p style={{ margin: 0, fontSize: 10.5, color: '#999' }}>na semana</p></div>
                </div>
              </div>
            )
          })}
          {linhas.length === 0 && <p style={{ color: '#bbb', fontSize: 13 }}>Sem colaboradores.</p>}
        </div>
      )}
    </div>
  )
}

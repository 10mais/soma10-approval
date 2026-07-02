'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type Status = {
  cliente: { nome: string; logo: string; corPrimaria: string }
  pendentes: number; emProducao: number; publicadosMes: number; meta: number
  proximos: { titulo: string; data: string }[]
  ultimos: { titulo: string; data: string }[]
}

function fmt(iso?: string) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '' }

export default function StatusPublico() {
  const { token } = useParams()
  const [s, setS] = useState<Status | null>(null)
  const [erro, setErro] = useState(false)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    fetch(`/api/status?token=${token}`).then(r => r.json()).then(d => { if (d && !d.error) setS(d); else setErro(true); setCarregando(false) }).catch(() => { setErro(true); setCarregando(false) })
  }, [token])

  if (carregando) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontFamily: 'Inter, system-ui, sans-serif' }}>Carregando...</div>
  if (erro || !s) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontFamily: 'Inter, system-ui, sans-serif' }}>Link inválido ou expirado.</div>

  const cor = '#111' // layout padrao da agencia: acento neutro, igual para todos os clientes
  const pctMeta = s.meta > 0 ? Math.min(100, Math.round((s.publicadosMes / s.meta) * 100)) : 0
  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f5', fontFamily: 'Inter, system-ui, sans-serif', padding: '32px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          {s.cliente.logo
            ? <img src={s.cliente.logo} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${cor}` }} />
            : <div style={{ width: 48, height: 48, borderRadius: '50%', background: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff' }}>{s.cliente.nome[0]}</div>}
          <div>
            <h1 style={{ margin: 0, fontSize: 20, color: '#111' }}>{s.cliente.nome}</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>Status do seu projeto — atualizado em tempo real</p>
          </div>
        </div>

        {/* Pendência do cliente */}
        {s.pendentes > 0 && (
          <div style={{ ...card, background: '#fef2f2', border: '1.5px solid #fecaca', marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: '#b91c1c' }}>⏳ {s.pendentes} {s.pendentes === 1 ? 'item aguardando' : 'itens aguardando'} a sua aprovação.</p>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#b91c1c', opacity: .85 }}>Entre no portal para aprovar e mantermos o ritmo.</p>
          </div>
        )}

        {/* Números */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
          <div style={card}><p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: cor }}>{s.publicadosMes}{s.meta > 0 ? <span style={{ fontSize: 15, color: '#bbb' }}>/{s.meta}</span> : ''}</p><p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>Publicados no mês</p></div>
          <div style={card}><p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#111' }}>{s.emProducao}</p><p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>Em produção</p></div>
          <div style={card}><p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#111' }}>{s.proximos.length}</p><p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>Próximos agendados</p></div>
        </div>

        {s.meta > 0 && (
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Meta do mês</span><span style={{ fontSize: 13, fontWeight: 800, color: cor }}>{pctMeta}%</span></div>
            <div style={{ height: 10, borderRadius: 999, background: '#eee', overflow: 'hidden' }}><div style={{ width: `${pctMeta}%`, height: '100%', background: cor, borderRadius: 999 }} /></div>
          </div>
        )}

        {/* Próximas publicações */}
        {s.proximos.length > 0 && (
          <div style={{ ...card, marginBottom: 14 }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#111' }}>📅 Próximas publicações</p>
            {s.proximos.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: i ? '1px solid #f5f5f5' : 'none' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: cor, minWidth: 52 }}>{fmt(p.data)}</span>
                <span style={{ fontSize: 13, color: '#444', flex: 1 }}>{p.titulo}</span>
              </div>
            ))}
          </div>
        )}

        {/* Últimos publicados */}
        {s.ultimos.length > 0 && (
          <div style={card}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#111' }}>✅ Publicados recentemente</p>
            {s.ultimos.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: i ? '1px solid #f5f5f5' : 'none' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', minWidth: 52 }}>{fmt(p.data)}</span>
                <span style={{ fontSize: 13, color: '#444', flex: 1 }}>{p.titulo}</span>
              </div>
            ))}
          </div>
        )}

        <p style={{ textAlign: 'center', margin: '22px 0 0', fontSize: 11, color: '#bbb' }}>Soma10 Approval · Grupo 10+</p>
      </div>
    </div>
  )
}

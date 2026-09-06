'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AnalyticsPage() {
  const { clienteId } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [desde, setDesde] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })
  const [ate, setAte] = useState(() => new Date().toISOString().split('T')[0])

  function buscar() {
    setLoading(true)
    fetch(`/api/analytics?clienteId=${clienteId}&desde=${desde}&ate=${ate}`).then(r => r.json()).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { buscar() }, [clienteId])

  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--v2-ink)' }}>Analytics</h2>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--v2-ink3)' }}>Os números reais das suas redes (Instagram e Facebook) no período escolhido.</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '14px 0 18px' }}>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12 }} />
        <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12 }} />
        <button onClick={buscar} disabled={loading} style={{ padding: '8px 16px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{loading ? 'Buscando...' : 'Buscar'}</button>
      </div>
      {loading && <p style={{ textAlign: 'center', padding: 40, color: 'var(--v2-ink3)' }}>Carregando...</p>}
      {!loading && data && !data.conectado && <p style={{ background: 'var(--v2-amber-bg)', borderRadius: 12, padding: 20, color: 'var(--v2-amber)', fontSize: 14 }}>Ainda não há métricas para exibir. Assim que suas redes estiverem conectadas, seus números aparecem aqui.</p>}
      {!loading && data?.conectado && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14, marginBottom: 20 }}>
            {[
              { l: 'Posts', v: data.totais?.posts },
              { l: 'Curtidas', v: data.totais?.curtidas },
              { l: 'Comentarios', v: data.totais?.comentarios },
              { l: 'Alcance', v: data.totais?.alcance },
              { l: 'Impressoes', v: data.totais?.impressoes },
            ].map(k => (
              <div key={k.l} style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', textTransform: 'uppercase' }}>{k.l}</p>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--v2-ink)' }}>{(k.v ?? 0).toLocaleString('pt-BR')}</p>
              </div>
            ))}
          </div>
          {(data.posts || []).length > 0 && (
            <div style={{ background: 'var(--v2-surface)', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <p style={{ margin: 0, padding: '16px 20px', fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)', borderBottom: '1px solid var(--v2-rule)' }}>Posts por relevancia ({data.posts.length})</p>
              {data.posts.map((p: any) => (
                <div key={p.id} style={{ padding: '12px 20px', borderBottom: '1px solid #f8f8f8', display: 'flex', alignItems: 'center', gap: 14 }}>
                  {p.midiaUrl && <img src={p.midiaUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.legenda?.slice(0, 80) || '--'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>{p.curtidas} curtidas · {p.comentarios} comentarios · {p.alcance} alcance</p>
                  </div>
                  {p.link && <a href={p.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--v2-info)' }}>Ver</a>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ListeningPage() {
  const { clienteId } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  function carregar() {
    setLoading(true)
    fetch(`/api/social-listening?clienteId=${clienteId}`).then(r => r.json()).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { carregar() }, [clienteId])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Social Listening</h2>
        <button onClick={carregar} disabled={loading} style={{ padding: '8px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Buscando...' : 'Atualizar'}
        </button>
      </div>
      {loading && <p style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Buscando tendencias...</p>}
      {!loading && data?.semNicho && <p style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 20, color: '#92400e', fontSize: 14 }}>{data.mensagem}</p>}
      {!loading && data && !data.semNicho && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>Termos: <strong style={{ color: '#666' }}>{(data.termos || []).join(', ')}</strong></p>
          {(data.youtube || []).length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#111' }}>YouTube Shorts (5k+ views)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.youtube.map((v: any) => (
                  <a key={v.id} href={v.url} target="_blank" rel="noreferrer" style={{ display: 'flex', gap: 12, textDecoration: 'none', color: 'inherit' }}>
                    <img src={v.thumb} alt="" style={{ width: 100, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111' }}>{v.titulo}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>{v.views?.toLocaleString('pt-BR')} views</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
          {(data.tiktok || []).length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#111' }}>TikTok — hashtags em alta</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {data.tiktok.map((h: any, i: number) => (
                  <a key={i} href={h.url} target="_blank" rel="noreferrer" style={{ padding: '7px 12px', borderRadius: 20, textDecoration: 'none', background: h.relevante ? '#dcfce7' : '#f4f4f5', border: h.relevante ? '1px solid #86efac' : '1px solid #eee' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: h.relevante ? '#15803d' : '#333' }}>#{h.nome}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

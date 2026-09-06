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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--v2-ink)' }}>Social Listening</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--v2-ink3)' }}>O que está em alta no seu nicho agora — ideias e referências para o seu conteúdo.</p>
        </div>
        <button onClick={carregar} disabled={loading} style={{ flexShrink: 0, padding: '8px 16px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Buscando...' : 'Atualizar'}
        </button>
      </div>
      {loading && <p style={{ textAlign: 'center', padding: 40, color: 'var(--v2-ink3)' }}>Buscando tendencias...</p>}
      {!loading && data?.semNicho && <p style={{ background: 'var(--v2-amber-bg)', border: '1px solid var(--v2-amber-bg)', borderRadius: 12, padding: 20, color: 'var(--v2-amber)', fontSize: 14 }}>{data.mensagem}</p>}
      {!loading && data && !data.semNicho && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)' }}>Termos: <strong style={{ color: 'var(--v2-ink2)' }}>{(data.termos || []).join(', ')}</strong></p>
          {(data.youtube || []).length > 0 && (
            <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, color: 'var(--v2-ink)' }}>YouTube Shorts (5k+ views)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.youtube.map((v: any) => (
                  <a key={v.id} href={v.url} target="_blank" rel="noreferrer" style={{ display: 'flex', gap: 12, textDecoration: 'none', color: 'inherit' }}>
                    <img src={v.thumb} alt="" style={{ width: 100, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--v2-ink)' }}>{v.titulo}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>{v.views?.toLocaleString('pt-BR')} views</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
          {(data.tiktok || []).length > 0 && (
            <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, color: 'var(--v2-ink)' }}>TikTok — hashtags em alta</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {data.tiktok.map((h: any, i: number) => (
                  <a key={i} href={h.url} target="_blank" rel="noreferrer" style={{ padding: '7px 12px', borderRadius: 20, textDecoration: 'none', background: h.relevante ? 'var(--v2-ok-bg)' : 'var(--v2-surface1)', border: h.relevante ? '1px solid var(--v2-ok-bg)' : '1px solid var(--v2-surface2)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: h.relevante ? 'var(--v2-ok)' : 'var(--v2-ink)' }}>#{h.nome}</span>
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

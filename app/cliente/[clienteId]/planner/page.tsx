'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Calendar from '@/app/components/Calendar'

function capaDoPost(post: any): string {
  const ehVideo = (u: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(u || '')
  if (post?.thumbnail) return post.thumbnail
  const caps = post?.capasVideo || {}
  for (const url of (post?.imagens || [])) { if (caps[url]) return caps[url] }
  const img = (post?.imagens || []).find((u: string) => !ehVideo(u))
  if (img) return img
  return Object.values(caps)[0] as string || (post?.imagens || [])[0] || ''
}

function ImagemComFallback({ src }: { src: string }) {
  const [erro, setErro] = useState(false)
  if (erro) return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 11 }}>Sem imagem</div>
  if (/\.(mp4|mov|m4v)(\?|$)/i.test(src || '')) return <video src={src} muted playsInline preload="metadata" onError={() => setErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  return <img src={src} alt="" onError={() => setErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
}

const STATUS_COLOR: Record<string, string> = { rascunho: '#f0f0f0', agendado: '#fef9c3', publicado: '#dcfce7', falha_publicacao: '#fee2e2' }
const STATUS_LABEL: Record<string, string> = { rascunho: 'Rascunho', agendado: 'Agendado', publicado: 'Publicado', falha_publicacao: 'Falha' }

export default function PlannerPage() {
  const { clienteId } = useParams()
  const [posts, setPosts] = useState<any[]>([])
  const [view, setView] = useState<'lista' | 'calendario'>('lista')
  const [preview, setPreview] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/posts?clienteId=${clienteId}`).then(r => r.json()).then(d => setPosts(Array.isArray(d) ? d : [])).catch(() => {})
  }, [clienteId])

  const filtrados = posts.filter(p => !(p as any).etapa || (p as any).etapa === 'pronto')
    .sort((a, b) => new Date(b.dataAgendada || b.criadoEm).getTime() - new Date(a.dataAgendada || a.criadoEm).getTime())

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Planner</h2>
        <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 10, padding: 3 }}>
          {(['lista', 'calendario'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '7px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: view === v ? '#fff' : 'transparent', color: view === v ? '#111' : '#888',
              boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}>{v === 'lista' ? 'Lista' : 'Calendario'}</button>
          ))}
        </div>
      </div>

      {view === 'calendario' && <Calendar posts={filtrados as any} onSelectPost={(p: any) => setPreview(p)} />}

      {view === 'lista' && (
        <>
          {filtrados.length === 0 && <p style={{ textAlign: 'center', padding: 60, color: '#aaa', background: '#fff', borderRadius: 14, border: '1px solid #eee' }}>Nenhum post ainda.</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {filtrados.map(post => {
              const capa = capaDoPost(post)
              const dataMostrar = post.status === 'agendado' ? (post.dataAgendada || post.criadoEm) : (post.atualizadoEm || post.criadoEm)
              return (
                <div key={post.id} onClick={() => setPreview(post)} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: '1px solid #eee' }}>
                  <div style={{ width: '100%', aspectRatio: '1', background: '#f4f4f4', position: 'relative' }}>
                    {capa ? <ImagemComFallback src={capa} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 11 }}>Sem imagem</div>}
                  </div>
                  <div style={{ padding: 9 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.clienteNome}</span>
                      <span style={{ background: STATUS_COLOR[post.status] || '#eee', borderRadius: 999, padding: '2px 8px', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                        {STATUS_LABEL[post.status] || post.status}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 5px', fontSize: 10, color: '#aaa' }}>{dataMostrar ? new Date(dataMostrar).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#888', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.legenda}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modal de preview */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {preview.imagens?.[0] && (
              <div style={{ width: '100%', aspectRatio: '1', background: '#000', overflow: 'auto', display: 'flex', gap: 2 }}>
                {preview.imagens.map((m: string, i: number) => {
                  const estilo = { width: preview.imagens.length > 1 ? '90%' : '100%', height: '100%', objectFit: 'cover' as const, flexShrink: 0 }
                  return /\.(mp4|mov|m4v)(\?|$)/i.test(m)
                    ? <video key={i} src={m} poster={(preview.capasVideo || {})[m]} controls playsInline muted style={estilo} />
                    : <img key={i} src={m} alt="" style={estilo} />
                })}
              </div>
            )}
            <div style={{ padding: 16, overflowY: 'auto' }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{preview.legenda}</p>
              {preview.dataAgendada && <p style={{ margin: '0 0 10px', fontSize: 12, color: '#aaa' }}>{new Date(preview.dataAgendada).toLocaleString('pt-BR')}</p>}
              <button onClick={() => setPreview(null)} style={{ width: '100%', padding: '10px 0', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

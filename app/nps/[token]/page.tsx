'use client'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'

export default function NpsPage() {
  const { token } = useParams()
  const periodo = useSearchParams().get('p') === 'trimestral' ? 'trimestral' : 'mensal'
  const [dados, setDados] = useState<{ clienteNome: string; logo: string } | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch(`/api/nps?token=${token}`).then(r => r.json()).then(d => { if (d?.error) setErro(d.error); else setDados(d) }).catch(() => setErro('Falha ao carregar.'))
  }, [token])

  async function enviar() {
    if (score === null) return
    setEnviando(true); setErro('')
    const r = await fetch('/api/nps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, score, comentario, periodo }) }).then(x => x.json()).catch(() => null)
    setEnviando(false)
    if (!r || r.error) { setErro(r?.error || 'Falha ao enviar.'); return }
    setEnviado(true)
  }

  const cor = (n: number) => n <= 6 ? '#e24b4a' : n <= 8 ? '#efa927' : '#1d9e75'

  return (
    <div style={{ minHeight: '100vh', background: '#f6f6f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 20, maxWidth: 520, width: '100%', padding: 30, boxShadow: '0 20px 60px -30px rgba(0,0,0,0.3)' }}>
        {erro && !dados ? (
          <p style={{ color: '#b91c1c', textAlign: 'center', fontSize: 14 }}>{erro}</p>
        ) : !dados ? (
          <p style={{ color: '#aaa', textAlign: 'center' }}>Carregando…</p>
        ) : enviado ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h2 style={{ margin: 0, fontSize: 20, color: '#111' }}>Obrigado pelo seu feedback!</h2>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#888' }}>Sua opinião ajuda a melhorar nosso trabalho.</p>
          </div>
        ) : (
          <>
            {dados.logo && <img src={dados.logo} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'contain', marginBottom: 16 }} />}
            <h2 style={{ margin: '0 0 6px', fontSize: 20, color: '#111' }}>Como está sua experiência com a {dados.clienteNome}?</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#888' }}>De 0 a 10, o quanto você recomendaria nosso trabalho?</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 6, marginBottom: 8 }}>
              {Array.from({ length: 11 }).map((_, n) => (
                <button key={n} onClick={() => setScore(n)} style={{ aspectRatio: '1/1', borderRadius: 10, border: score === n ? `2px solid ${cor(n)}` : '1px solid #e6e6e6', background: score === n ? cor(n) : '#fff', color: score === n ? '#fff' : '#555', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{n}</button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa', marginBottom: 18 }}>
              <span>Nada provável</span><span>Muito provável</span>
            </div>
            <textarea lang="pt-BR" value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Quer deixar um comentário? (opcional)" rows={3}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 12, border: '1.5px solid #e6e6e6', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', marginBottom: 16 }} />
            {erro && <p style={{ color: '#b91c1c', fontSize: 13, margin: '0 0 12px' }}>{erro}</p>}
            <button onClick={enviar} disabled={score === null || enviando}
              style={{ width: '100%', padding: '14px 0', background: score === null ? '#f0f0f0' : '#111', color: score === null ? '#aaa' : '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: score === null || enviando ? 'default' : 'pointer' }}>
              {enviando ? 'Enviando…' : 'Enviar avaliação'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

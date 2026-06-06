'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'

type Annotation = { x: number; y: number; text: string; id: number }
type Brief = {
  id: string
  cliente: string
  imagens: string[]
  legenda: string
  status: string
}

export default function ApprovalPage() {
  const { id } = useParams()
  const [brief, setBrief] = useState<Brief | null>(null)
  const [currentImg, setCurrentImg] = useState(0)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null)
  const [pinText, setPinText] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [step, setStep] = useState<'view' | 'reject' | 'done'>('view')
  const [decision, setDecision] = useState<'approved' | 'corrected' | 'rejected' | null>(null)

  useEffect(() => {
    fetch(`/api/brief/${id}`).then(r => r.json()).then(setBrief)
  }, [id])

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPendingPin({ x, y })
    setPinText('')
  }

  function confirmPin() {
    if (!pinText.trim()) return
    setAnnotations(prev => [...prev, { x: pendingPin!.x, y: pendingPin!.y, text: pinText, id: Date.now() }])
    setPendingPin(null)
    setPinText('')
  }

  async function submitDecision(type: 'approved' | 'corrected' | 'rejected') {
    setDecision(type)
    await fetch('/api/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type, annotations, rejectReason, imageIndex: currentImg }),
    })
    setStep('done')
  }

  if (!brief) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fff' }}>
      <div style={{ width: 40, height: 40, border: '4px solid #ffc00f', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#999', marginTop: 16, fontSize: 14 }}>Carregando criativo...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (step === 'done') return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#ffc00f', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Logo />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Aprovação de Criativos</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
        <div style={{ fontSize: 72 }}>
          {decision === 'approved' ? '✅' : decision === 'corrected' ? '✏️' : '❌'}
        </div>
        <h2 style={{ margin: 0, color: '#111', fontSize: 22, textAlign: 'center' }}>
          {decision === 'approved' ? 'Aprovado com sucesso!' : decision === 'corrected' ? 'Correções enviadas!' : 'Criativo reprovado.'}
        </h2>
        <p style={{ color: '#777', margin: 0, fontSize: 15, textAlign: 'center', maxWidth: 380 }}>
          {decision === 'approved'
            ? 'O post será publicado automaticamente no Instagram. Obrigado!'
            : decision === 'corrected'
            ? 'Nossa equipe vai ajustar e enviar um novo link em breve.'
            : 'Recebemos seu feedback. Nossa equipe entrará em contato.'}
        </p>
        <div style={{ marginTop: 8, padding: '10px 20px', background: '#f5f5f5', borderRadius: 20 }}>
          <span style={{ fontSize: 13, color: '#999' }}>Você pode fechar esta página</span>
        </div>
      </div>

      <Footer />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f8', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: '#ffc00f', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#111', lineHeight: 1.2 }}>Aprovação de Criativos</div>
            <div style={{ fontSize: 12, color: '#333', opacity: 0.7 }}>Grupo 10+</div>
          </div>
        </div>
        <div style={{ background: '#111', color: '#ffc00f', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>
          {brief.cliente}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', padding: '24px 16px 40px' }}>

        {/* Instrução */}
        <div style={{ background: '#fff8e1', border: '1.5px solid #ffc00f', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18 }}>💡</span>
          <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.5 }}>
            Analise o criativo abaixo. Se precisar solicitar correções, <strong>clique diretamente na imagem</strong> para marcar o ponto e descrever o ajuste.
          </p>
        </div>

        {/* Navegação de slides */}
        {brief.imagens.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
            {brief.imagens.map((_, i) => (
              <button key={i} onClick={() => setCurrentImg(i)} style={{
                padding: '6px 16px', borderRadius: 20, border: '2px solid',
                borderColor: i === currentImg ? '#ffc00f' : '#e0e0e0',
                background: i === currentImg ? '#ffc00f' : '#fff',
                color: i === currentImg ? '#111' : '#888',
                fontWeight: i === currentImg ? 700 : 400,
                cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}>
                Slide {i + 1}
              </button>
            ))}
          </div>
        )}

        {/* Imagem com anotações */}
        <div onClick={handleImageClick} style={{
          position: 'relative', cursor: 'crosshair', borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)', border: '2px solid #f0f0f0', background: '#fff',
        }}>
          <img src={brief.imagens[currentImg]} alt="Criativo" style={{ width: '100%', display: 'block' }} />

          {/* Pins */}
          {annotations.map((ann, i) => (
            <div key={ann.id} style={{ position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`, transform: 'translate(-50%, -50%)', zIndex: 5 }}>
              <div title={ann.text} style={{
                background: '#ffc00f', color: '#111', borderRadius: '50%', width: 26, height: 26,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.25)', border: '2px solid #111',
                cursor: 'default',
              }}>
                {i + 1}
              </div>
            </div>
          ))}

          {/* Pin pendente */}
          {pendingPin && (
            <div style={{ position: 'absolute', left: `${pendingPin.x}%`, top: `${pendingPin.y}%`, transform: 'translate(-50%, -110%)', zIndex: 10 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', minWidth: 240, border: '2px solid #ffc00f' }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#111' }}>O que precisa ajustar aqui?</p>
                <textarea
                  autoFocus
                  value={pinText}
                  onChange={e => setPinText(e.target.value)}
                  placeholder="Ex: Mudar a cor do texto para preto..."
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 13, resize: 'vertical', minHeight: 70, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={confirmPin} style={{ flex: 1, padding: '8px 0', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                    Confirmar
                  </button>
                  <button onClick={() => setPendingPin(null)} style={{ flex: 1, padding: '8px 0', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                    Cancelar
                  </button>
                </div>
              </div>
              {/* Seta */}
              <div style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid #ffc00f', margin: '0 auto' }} />
            </div>
          )}
        </div>

        {/* Lista de anotações */}
        {annotations.length > 0 && (
          <div style={{ marginTop: 16, background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1.5px solid #f0f0f0' }}>
            <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 13, color: '#111', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ background: '#ffc00f', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#111' }}>{annotations.length}</span>
              {annotations.length === 1 ? 'anotação adicionada' : 'anotações adicionadas'}
            </p>
            {annotations.map((ann, i) => (
              <div key={ann.id} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start', paddingBottom: 10, borderBottom: i < annotations.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                <span style={{ background: '#ffc00f', color: '#111', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1, border: '1.5px solid #111' }}>
                  {i + 1}
                </span>
                <p style={{ margin: 0, fontSize: 13, color: '#444', lineHeight: 1.5, flex: 1 }}>{ann.text}</p>
                <button onClick={() => setAnnotations(prev => prev.filter(a => a.id !== ann.id))}
                  style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18, flexShrink: 0, padding: 0, lineHeight: 1 }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Legenda */}
        {brief.legenda && (
          <div style={{ marginTop: 16, background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1.5px solid #f0f0f0' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 11, color: '#aaa', letterSpacing: 1, textTransform: 'uppercase' }}>Legenda do post</p>
            <p style={{ margin: 0, fontSize: 14, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{brief.legenda}</p>
          </div>
        )}

        {/* Botões de decisão */}
        {step === 'view' && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <button onClick={() => submitDecision('approved')} style={{
                padding: '16px 8px', background: '#22c55e', color: '#fff', border: 'none',
                borderRadius: 14, cursor: 'pointer', fontWeight: 800, fontSize: 14,
                boxShadow: '0 4px 12px rgba(34,197,94,0.3)', transition: 'transform 0.1s',
              }}>
                ✅<br /><span style={{ fontSize: 12, fontWeight: 600 }}>Aprovar</span>
              </button>

              <button onClick={() => {
                if (annotations.length === 0) { alert('Clique na imagem para marcar o que precisa ser corrigido antes de solicitar correção.'); return; }
                submitDecision('corrected')
              }} style={{
                padding: '16px 8px', background: '#ffc00f', color: '#111', border: 'none',
                borderRadius: 14, cursor: 'pointer', fontWeight: 800, fontSize: 14,
                boxShadow: '0 4px 12px rgba(255,192,15,0.3)', transition: 'transform 0.1s',
              }}>
                ✏️<br /><span style={{ fontSize: 12, fontWeight: 600 }}>Corrigir</span>
              </button>

              <button onClick={() => setStep('reject')} style={{
                padding: '16px 8px', background: '#fff', color: '#ef4444', border: '2px solid #ef4444',
                borderRadius: 14, cursor: 'pointer', fontWeight: 800, fontSize: 14,
                transition: 'transform 0.1s',
              }}>
                ❌<br /><span style={{ fontSize: 12, fontWeight: 600 }}>Reprovar</span>
              </button>
            </div>

            <p style={{ textAlign: 'center', color: '#bbb', fontSize: 12, margin: '14px 0 0' }}>
              Ao aprovar, o post será publicado automaticamente no Instagram
            </p>
          </div>
        )}

        {/* Tela de reprovação */}
        {step === 'reject' && (
          <div style={{ marginTop: 20, background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #ef4444' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 800, color: '#111', fontSize: 15 }}>Por que está reprovando?</p>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#888' }}>Descreva o motivo para nossa equipe entender e criar uma nova versão.</p>
            <textarea
              autoFocus
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Ex: O tema não está alinhado com o que conversamos, prefiro uma abordagem mais..."
              style={{ width: '100%', padding: 14, borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, resize: 'vertical', minHeight: 110, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => setStep('view')} style={{ flex: 1, padding: '13px 0', background: '#f5f5f5', color: '#555', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                ← Voltar
              </button>
              <button onClick={() => {
                if (!rejectReason.trim()) { alert('Por favor, descreva o motivo da reprovação.'); return; }
                submitDecision('rejected')
              }} style={{ flex: 2, padding: '13px 0', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 14, boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>
                Confirmar reprovação
              </button>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#111" />
      <text x="16" y="22" textAnchor="middle" fill="#ffc00f" fontSize="14" fontWeight="900" fontFamily="Arial">10+</text>
    </svg>
  )
}

function Footer() {
  return (
    <div style={{ background: '#111', padding: '16px 24px', textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
        Sistema de Aprovação · <span style={{ color: '#ffc00f', fontWeight: 700 }}>Grupo 10+</span>
      </p>
    </div>
  )
}

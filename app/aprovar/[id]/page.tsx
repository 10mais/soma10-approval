'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from '@/lib/toast'

type Annotation = { x: number; y: number; text: string; id: number }
type Brief = { id: string; cliente: string; clienteNome?: string; imagens: string[]; legenda: string; status: string; formato?: string; dataAgendada?: string; capasVideo?: Record<string, string> }

const ehVideoUrl = (u: string) => /\.(mp4|mov|m4v|webm)(\?|$)/i.test(u || '')

export default function ApprovalPage() {
  const { id } = useParams()
  const [codigo, setCodigo] = useState('')
  useEffect(() => { const p = new URLSearchParams(window.location.search); setCodigo(p.get('c') || p.get('codigo') || '') }, [])
  const [brief, setBrief] = useState<Brief | null>(null)
  const [currentImg, setCurrentImg] = useState(0)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null)
  const [pinText, setPinText] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [ajusteTexto, setAjusteTexto] = useState('')
  const [step, setStep] = useState<'view' | 'corrigir' | 'reject' | 'done'>('view')
  const [decision, setDecision] = useState<'approved' | 'corrected' | 'rejected' | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
    setSubmitting(true)
    setDecision(type)
    const motivo = type === 'rejected' ? rejectReason : type === 'corrected' ? ajusteTexto : ''
    await fetch('/api/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type, annotations, rejectReason: motivo, codigo, imageIndex: currentImg }),
    })
    setSubmitting(false)
    setStep('done')
  }

  if (!brief) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fff' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #ffc00f', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const clienteName = brief.clienteNome || brief.cliente
  const midiaAtual = brief.imagens[currentImg]
  const ehVideo = ehVideoUrl(midiaAtual)
  const formatoLabel = brief.formato === 'story' ? 'Story' : brief.formato === 'reel' ? 'Reel' : brief.formato === 'feed' ? 'Feed' : ''

  if (step === 'done') return (
    <div style={{ minHeight: '100vh', background: '#fafafa', display: 'flex', flexDirection: 'column' }}>
      <Header clienteName={clienteName} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          background: decision === 'approved' ? '#dcfce7' : decision === 'corrected' ? '#fef9ec' : '#fee2e2',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={decision === 'approved' ? '#16a34a' : decision === 'corrected' ? '#b45309' : '#dc2626'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {decision === 'approved' && <polyline points="20 6 9 17 4 12" />}
            {decision === 'corrected' && <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>}
            {decision === 'rejected' && <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
          </svg>
        </div>
        <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: '#111', textAlign: 'center' }}>
          {decision === 'approved' ? 'Criativo aprovado' : decision === 'corrected' ? 'Correções enviadas' : 'Criativo reprovado'}
        </h2>
        <p style={{ margin: '0 0 32px', fontSize: 15, color: '#777', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
          {decision === 'approved'
            ? 'Sua resposta foi registrada. A equipe dará continuidade ao processo.'
            : decision === 'corrected'
            ? 'Suas observações foram enviadas. Nossa equipe entrará em contato em breve.'
            : 'Seu feedback foi recebido. Nossa equipe elaborará uma nova proposta.'}
        </p>
        <p style={{ fontSize: 13, color: '#bbb' }}>Você pode fechar esta página.</p>
      </div>
      <Footer />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Header clienteName={clienteName} />

      <div style={{ maxWidth: 700, margin: '0 auto', width: '100%', padding: '28px 16px 60px' }}>

        {/* Instrução */}
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef9ec', border: '1px solid #ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.6 }}>
            Analise o material abaixo. Para indicar pontos de correção, <strong>clique diretamente sobre a imagem</strong> para adicionar uma marcação.
          </p>
        </div>

        {/* Navegação de slides */}
        {brief.imagens.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
            {brief.imagens.map((_, i) => (
              <button key={i} onClick={() => setCurrentImg(i)} style={{
                padding: '6px 18px', borderRadius: 6, border: '1px solid',
                borderColor: i === currentImg ? '#111' : '#e0e0e0',
                background: i === currentImg ? '#111' : '#fff',
                color: i === currentImg ? '#fff' : '#888',
                fontWeight: i === currentImg ? 600 : 400,
                cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
              }}>
                {i + 1} / {brief.imagens.length}
              </button>
            ))}
          </div>
        )}

        {/* Mídia — imagem clicável (marcações) ou vídeo */}
        <div onClick={ehVideo ? undefined : handleImageClick} style={{
          position: 'relative', cursor: ehVideo ? 'default' : 'crosshair', borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 2px 16px rgba(0,0,0,0.08)', border: '1px solid #e8e8e8', background: ehVideo ? '#000' : '#fff',
        }}>
          {ehVideo
            ? <video src={midiaAtual} controls playsInline poster={brief.capasVideo?.[midiaAtual]} style={{ width: '100%', display: 'block', maxHeight: '72vh' }} />
            : <img src={midiaAtual} alt="Criativo" style={{ width: '100%', display: 'block' }} />}

          {!ehVideo && annotations.map((ann, i) => (
            <div key={ann.id} style={{ position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`, transform: 'translate(-50%, -50%)', zIndex: 5 }}>
              <div title={ann.text} style={{
                background: '#ffc00f', color: '#111', borderRadius: '50%', width: 24, height: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.20)', border: '2px solid #fff',
              }}>
                {i + 1}
              </div>
            </div>
          ))}

          {!ehVideo && pendingPin && (
            <div style={{ position: 'absolute', left: `${pendingPin.x}%`, top: `${pendingPin.y}%`, transform: 'translate(-50%, -110%)', zIndex: 10 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', minWidth: 260, border: '1px solid #e0e0e0' }}>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#111' }}>Descreva o ajuste necessário</p>
                <textarea
                  autoFocus
                  value={pinText}
                  onChange={e => setPinText(e.target.value)}
                  placeholder="Ex: Alterar a cor do texto para preto..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, resize: 'vertical', minHeight: 72, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={confirmPin} style={{ flex: 1, padding: '9px 0', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                    Confirmar
                  </button>
                  <button onClick={() => setPendingPin(null)} style={{ flex: 1, padding: '9px 0', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                    Cancelar
                  </button>
                </div>
              </div>
              <div style={{ width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '7px solid #e0e0e0', margin: '0 auto' }} />
            </div>
          )}
        </div>

        {/* Lista de anotações */}
        {annotations.length > 0 && (
          <div style={{ marginTop: 14, background: '#fff', borderRadius: 10, padding: '16px 18px', border: '1px solid #e8e8e8' }}>
            <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 13, color: '#555' }}>
              {annotations.length} {annotations.length === 1 ? 'marcação adicionada' : 'marcações adicionadas'}
            </p>
            {annotations.map((ann, i) => (
              <div key={ann.id} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start', paddingBottom: 10, borderBottom: i < annotations.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                <span style={{ background: '#ffc00f', color: '#111', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>
                  {i + 1}
                </span>
                <p style={{ margin: 0, fontSize: 13, color: '#444', lineHeight: 1.5, flex: 1 }}>{ann.text}</p>
                <button onClick={() => setAnnotations(prev => prev.filter(a => a.id !== ann.id))}
                  style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16, flexShrink: 0, padding: 0, lineHeight: 1, fontWeight: 300 }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Legenda */}
        {brief.legenda && (
          <div style={{ marginTop: 14, background: '#fff', borderRadius: 10, padding: '16px 18px', border: '1px solid #e8e8e8' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 11, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Legenda do post</p>
            <p style={{ margin: 0, fontSize: 14, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{brief.legenda}</p>
          </div>
        )}

        {/* Formato e data/horário de publicação */}
        {(formatoLabel || brief.dataAgendada) && (
          <div style={{ marginTop: 14, background: '#fff', borderRadius: 10, padding: '14px 18px', border: '1px solid #e8e8e8', display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {formatoLabel && (
              <div>
                <p style={{ margin: '0 0 3px', fontWeight: 600, fontSize: 11, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Formato</p>
                <p style={{ margin: 0, fontSize: 14, color: '#333', fontWeight: 600 }}>{formatoLabel}</p>
              </div>
            )}
            {brief.dataAgendada && (
              <div>
                <p style={{ margin: '0 0 3px', fontWeight: 600, fontSize: 11, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Publicação prevista</p>
                <p style={{ margin: 0, fontSize: 14, color: '#333', fontWeight: 600 }}>{new Date(brief.dataAgendada).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            )}
          </div>
        )}

        {/* Botões de decisão */}
        {step === 'view' && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>

              <button onClick={() => submitDecision('approved')} disabled={submitting} style={{
                padding: '16px 8px', background: '#16a34a', color: '#fff', border: 'none',
                borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                letterSpacing: '0.01em',
              }}>
                Aprovar
              </button>

              <button onClick={() => setStep('corrigir')} disabled={submitting} style={{
                padding: '16px 8px', background: '#ffc00f', color: '#111', border: 'none',
                borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
              }}>
                Sugerir ajustes
              </button>

              <button onClick={() => setStep('reject')} disabled={submitting} style={{
                padding: '16px 8px', background: '#fff', color: '#dc2626',
                border: '1.5px solid #dc2626', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
              }}>
                Reprovar
              </button>
            </div>

            <p style={{ textAlign: 'center', color: '#ccc', fontSize: 12, margin: '14px 0 0', letterSpacing: '0.01em' }}>
              Ao aprovar, o post será encaminhado para publicação
            </p>
          </div>
        )}

        {/* Tela de sugerir ajustes (funciona para imagem, carrossel, vídeo e story) */}
        {step === 'corrigir' && (
          <div style={{ marginTop: 20, background: '#fff', borderRadius: 10, padding: 22, border: '1px solid #ffe08a' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#111', fontSize: 15 }}>Sugerir ajustes</p>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#888', lineHeight: 1.5 }}>
              Descreva os ajustes desejados{annotations.length > 0 ? ` (suas ${annotations.length} marcação(ões) na imagem serão enviadas junto)` : ''}. Em imagens, você também pode clicar sobre elas para marcar pontos antes de enviar.
            </p>
            <textarea autoFocus value={ajusteTexto} onChange={e => setAjusteTexto(e.target.value)} placeholder="Ex: trocar a cor do título, ajustar a legenda no 2º slide..."
              style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14, resize: 'vertical', minHeight: 100, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6 }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => setStep('view')} style={{ flex: 1, padding: '13px 0', background: '#f5f5f5', color: '#555', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Voltar</button>
              <button onClick={() => {
                if (annotations.length === 0 && !ajusteTexto.trim()) { toast('Descreva o ajuste ou marque um ponto na imagem.', 'erro'); return }
                submitDecision('corrected')
              }} disabled={submitting} style={{ flex: 2, padding: '13px 0', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Enviar ajustes</button>
            </div>
          </div>
        )}

        {/* Tela de reprovação */}
        {step === 'reject' && (
          <div style={{ marginTop: 20, background: '#fff', borderRadius: 10, padding: 22, border: '1px solid #fca5a5' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#111', fontSize: 15 }}>Motivo da reprovação</p>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#888', lineHeight: 1.5 }}>Descreva o que não atendeu às expectativas para que possamos elaborar uma nova proposta.</p>
            <textarea
              autoFocus
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Descreva o motivo..."
              style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14, resize: 'vertical', minHeight: 110, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => setStep('view')} style={{ flex: 1, padding: '13px 0', background: '#f5f5f5', color: '#555', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                Voltar
              </button>
              <button onClick={() => {
                if (!rejectReason.trim()) { toast('Por favor, descreva o motivo da reprovação.', 'erro'); return; }
                submitDecision('rejected')
              }} disabled={submitting} style={{ flex: 2, padding: '13px 0', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
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

function Header({ clienteName }: { clienteName: string }) {
  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ background: '#111', borderRadius: 7, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#ffc00f', fontWeight: 900, fontSize: 10 }}>10+</span>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111', lineHeight: 1.2 }}>Soma10 Approval</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>Aprovação de Criativos</div>
        </div>
      </div>
      <div style={{ background: '#f5f5f5', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, color: '#555' }}>
        {clienteName}
      </div>
    </div>
  )
}

function Footer() {
  return (
    <div style={{ borderTop: '1px solid #e8e8e8', padding: '16px 24px', textAlign: 'center', background: '#fff' }}>
      <p style={{ margin: 0, fontSize: 11, color: '#ccc', letterSpacing: '0.03em' }}>
        SOMA10APPROVAL · GRUPO 10+
      </p>
    </div>
  )
}

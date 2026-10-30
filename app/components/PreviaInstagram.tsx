'use client'
// PRÉVIA DO POST no jeito do Instagram — dono, 29/10/2026 (subida em massa): "Preciso poder abrir
// a prévia dos criativos quando subirmos em massa. Não tá abrindo."
//
// Abre por cima de tudo (z 1700, abaixo só dos avisos e do "tem certeza?"): cabeçalho com o @ do
// cliente e os colabs, a arte inteira (sem corte) no formato do post, carrossel com setas e
// pontinhos, vídeo tocando com a capa, e a legenda como sai. Navega entre os posts do lote:
// as setas do teclado passam as lâminas e, no fim do carrossel, vão para o próximo post.
// Esc, X ou clique fora fecham. Genérico: recebe só o que mostra.
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import LimiteDeErro from '@/app/components/LimiteDeErro'
import AvatarCliente from '@/app/components/AvatarCliente'
import { fecharFora } from '@/lib/fecharModal'

export type MidiaPrevia = { src: string; tipo: 'imagem' | 'video'; capa?: string }
type Props = {
  handle: string; nome?: string; logo?: string; clienteId?: string
  midias: MidiaPrevia[]
  formato: 'feed' | 'reel' | 'story'
  legenda?: string
  colaboradores?: string[]
  quando?: string        // texto pronto: "seg., 03/11, 18:00"
  inicio?: number        // lâmina que abre
  titulo?: string        // "Post 2 de 12"
  onAnterior?: () => void
  onProximo?: () => void
  onFechar: () => void
}

const seta = (d: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>

// #hashtag e @menção destacados como no Instagram.
function LegendaFormatada({ texto }: { texto: string }) {
  const partes = texto.split(/(#[^\s#]+|@[A-Za-z0-9._]+)/g)
  return <>{partes.map((p, i) => (/^[#@]/.test(p) ? <span key={i} style={{ color: 'var(--v2-info)' }}>{p}</span> : <React.Fragment key={i}>{p}</React.Fragment>))}</>
}

export default function PreviaInstagram(props: Props) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <LimiteDeErro onFechar={props.onFechar} titulo="Não foi possível abrir a prévia">
      <Previa {...props} />
    </LimiteDeErro>,
    document.body,
  )
}

function Previa({ handle, nome, logo, clienteId, midias, formato, legenda, colaboradores = [], quando, inicio = 0, titulo, onAnterior, onProximo, onFechar }: Props) {
  // Trocar de post ou de lâmina inicial remonta a prévia (key de quem abre): aqui só o estado local.
  const [cur, setCur] = useState(Math.min(Math.max(0, inicio), Math.max(0, midias.length - 1)))
  const total = midias.length
  const m = midias[cur]
  const vertical = formato === 'reel' || formato === 'story'
  const story = formato === 'story'

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onFechar() }
      else if (e.key === 'ArrowRight') { if (cur < total - 1) setCur(cur + 1); else onProximo?.() }
      else if (e.key === 'ArrowLeft') { if (cur > 0) setCur(cur - 1); else onAnterior?.() }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [cur, total, onFechar, onProximo, onAnterior])

  const botaoRedondo: React.CSSProperties = { width: 34, height: 34, borderRadius: '50%', border: 0, background: 'rgba(255,255,255,0.92)', color: '#17150E', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }
  const botaoTopo: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 11px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div className="anim-overlay" onClick={fecharFora(onFechar)}
      style={{ position: 'fixed', inset: 0, zIndex: 1700, background: 'rgba(10,9,6,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 12px max(12px, env(safe-area-inset-bottom))', fontFamily: 'var(--v2-font)' }}>
      {/* Navegação entre os posts do lote */}
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#fff' }}>
        {onAnterior && <button onClick={onAnterior} style={botaoTopo} aria-label="Post anterior">{seta('M15 18l-6-6 6-6')}Anterior</button>}
        <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{titulo || 'Prévia'}</span>
        {onProximo && <button onClick={onProximo} style={botaoTopo} aria-label="Próximo post">Próximo{seta('M9 18l6-6-6-6')}</button>}
        <button onClick={onFechar} style={{ ...botaoTopo, padding: 7 }} aria-label="Fechar a prévia">{seta('M18 6 6 18M6 6l12 12')}</button>
      </div>

      <div className="anim-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={titulo || 'Prévia do post'}
        style={{ width: '100%', maxWidth: 440, maxHeight: 'calc(100dvh - 90px)', overflowY: 'auto', background: 'var(--v2-surface)', color: 'var(--v2-ink)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}>
        {/* Cabeçalho: @ do cliente e colabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
          <span style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--v2-surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
            <AvatarCliente logo={logo} nome={nome || handle} clienteId={clienteId} />
          </span>
          <div style={{ minWidth: 0, flex: 1, lineHeight: 1.25 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {handle}{!story && colaboradores.length > 0 && <span style={{ fontWeight: 600 }}> e {colaboradores.length === 1 ? colaboradores[0] : `${colaboradores.length} outras contas`}</span>}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--v2-ink3)' }}>{story ? 'Story' : formato === 'reel' ? 'Reels' : total > 1 ? `Carrossel · ${total} lâminas` : 'Feed'}</div>
          </div>
        </div>

        {/* Mídia inteira, sem cortar, no formato do post */}
        <div style={{ position: 'relative', background: '#000', aspectRatio: vertical ? '9 / 16' : '4 / 5', maxHeight: vertical ? '62dvh' : undefined, margin: vertical ? '0 auto' : undefined }}>
          {!m ? null : m.tipo === 'video' ? (
            <video key={m.src} src={m.src} poster={m.capa} controls playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          ) : (
            <img key={m.src} src={m.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          )}
          {total > 1 && (
            <>
              <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 999, padding: '3px 9px', fontSize: 11.5, fontWeight: 700 }}>{cur + 1}/{total}</span>
              {cur > 0 && <button onClick={() => setCur(cur - 1)} aria-label="Lâmina anterior" style={{ ...botaoRedondo, position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}>{seta('M15 18l-6-6 6-6')}</button>}
              {cur < total - 1 && <button onClick={() => setCur(cur + 1)} aria-label="Próxima lâmina" style={{ ...botaoRedondo, position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>{seta('M9 18l6-6-6-6')}</button>}
            </>
          )}
        </div>
        {total > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '8px 0 0' }}>
            {midias.map((_, i) => <button key={i} onClick={() => setCur(i)} aria-label={`Lâmina ${i + 1}`} style={{ width: 6, height: 6, padding: 0, borderRadius: '50%', border: 0, cursor: 'pointer', background: i === cur ? 'var(--v2-info)' : 'var(--v2-rule2)' }} />)}
          </div>
        )}

        {/* Legenda como sai */}
        <div style={{ padding: '10px 14px 14px', fontSize: 13.5, lineHeight: 1.5 }}>
          {story ? (
            <span style={{ color: 'var(--v2-ink3)', fontSize: 12.5 }}>Story sai sem legenda.</span>
          ) : legenda?.trim() ? (
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><strong>{handle}</strong> <LegendaFormatada texto={legenda} /></div>
          ) : (
            <span style={{ color: 'var(--v2-hot)', fontSize: 12.5, fontWeight: 600 }}>Sem legenda ainda.</span>
          )}
          {!story && colaboradores.length > 0 && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--v2-ink3)' }}>Colab: {colaboradores.map(c => `@${c}`).join(', ')}</div>}
          <div style={{ marginTop: 8, fontSize: 12, color: quando ? 'var(--v2-ink3)' : 'var(--v2-hot)', fontWeight: quando ? 500 : 600 }}>{quando ? `Dia e horário: ${quando}` : 'Sem dia e horário ainda.'}</div>
        </div>
      </div>
    </div>
  )
}

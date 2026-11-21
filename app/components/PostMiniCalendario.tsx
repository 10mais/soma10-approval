'use client'
// O post em miniatura do calendário: capa, bolinha e fundo do status, hora (riscada se
// suspenso), formato, redes e cliente. Saiu de dentro do Calendar.tsx (21/11/2026) para o
// Calendário do Programador e o seletor de data do agendamento ficarem iguais.
import type React from 'react'
import { labelFormato } from '@/lib/formatoPost'
import { horaDe } from '@/lib/calendarioPosts'

export type PostMini = {
  id: string; clienteNome?: string; status: string; dataAgendada?: string; legenda?: string; imagens?: string[]
  formato?: string
  redes?: string[]
  capasVideo?: Record<string, string>
  thumbnail?: string
  suspenso?: { em: string; por: string; statusAnterior: string } // lib/suspenderPost
}

export const ehVideo = (u: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(u || '')

export function capaDoPost(p: PostMini): string {
  if (p.thumbnail) return p.thumbnail
  const caps = p.capasVideo || {}
  for (const url of (p.imagens || [])) { if (caps[url]) return caps[url] }
  const img = (p.imagens || []).find(u => !ehVideo(u))
  if (img) return img
  const anyCap = Object.values(caps)[0]
  if (anyCap) return anyCap
  return (p.imagens || [])[0] || ''
}

export const fmtHora = horaDe

export function RedeIcon({ rede, size = 12 }: { rede: 'instagram' | 'facebook'; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={rede === 'facebook' ? '#1877f2' : '#d6249f'} style={{ flexShrink: 0 }}>{rede === 'facebook'
      ? <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      : <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z" />}</svg>
  )
}

export const STATUS_COLOR: Record<string, string> = {
  rascunho: 'var(--v2-surface2)',
  agendado: 'var(--v2-amber-bg)',
  aguardando_aprovacao: 'var(--v2-amber-bg)',
  aprovado: 'var(--v2-ok-bg)',
  corrigir: '#fff3cd',
  reprovado: 'var(--v2-hot-bg)',
  publicado: 'var(--v2-ok-bg)',
  falha_publicacao: '#fde2e2',
}

export const STATUS_DOT: Record<string, string> = {
  rascunho: 'var(--v2-ink3)',
  agendado: 'var(--v2-amber)',
  aguardando_aprovacao: 'var(--v2-amber-on)',
  aprovado: 'var(--v2-ok)',
  corrigir: 'var(--v2-amber)',
  reprovado: 'var(--v2-hot)',
  publicado: 'var(--v2-ok)',
  falha_publicacao: 'var(--v2-hot)',
}


/** Miniatura de um post. `compacto` = só capa e hora (célula pequena, celular). */
export function MiniPost({ post: p, idioma = 'pt', compacto = false, mostrarCliente = true, draggable, onDragStart, onClick, onMouseEnter, cursor, selecionado }: {
  post: PostMini; idioma?: string; compacto?: boolean; mostrarCliente?: boolean
  draggable?: boolean; onDragStart?: (e: React.DragEvent) => void; onClick?: () => void; onMouseEnter?: () => void
  cursor?: string; selecionado?: boolean
}) {
  const capa = capaDoPost(p)
  const mostrarImg = capa && !ehVideo(capa)
  const redes = (p.redes && p.redes.length ? p.redes : []).filter(r => r === 'instagram' || r === 'facebook') as ('instagram' | 'facebook')[]
  const lado = compacto ? 20 : 28
  return (
    <div draggable={draggable} onDragStart={onDragStart} onClick={onClick} onMouseEnter={onMouseEnter} title={p.legenda}
      style={{
        display: 'flex', alignItems: 'center', gap: compacto ? 4 : 6, padding: compacto ? 2 : 4, borderRadius: 6,
        background: STATUS_COLOR[p.status] || 'var(--v2-surface2)', cursor: cursor || (onClick ? 'pointer' : 'default'),
        overflow: 'hidden', outline: selecionado ? '2px solid var(--v2-ink)' : 'none', outlineOffset: -2,
      }}>
      <div style={{ width: lado, height: lado, borderRadius: 5, overflow: 'hidden', flexShrink: 0, background: 'var(--v2-surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {mostrarImg
          ? <img src={capa} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : capa
            ? <video src={capa} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v2-ink3)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L5 21" /></svg>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--v2-ink)', overflow: 'hidden' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[p.status] || 'var(--v2-ink3)', flexShrink: 0 }} />
          {fmtHora(p.dataAgendada) && <span style={p.suspenso ? { textDecoration: 'line-through', color: 'var(--v2-ink3)' } : undefined}>{fmtHora(p.dataAgendada)}</span>}
          {!compacto && p.suspenso && <span title={idioma === 'en' ? 'Suspended' : idioma === 'es' ? 'Suspendido' : 'Suspenso'} style={{ display: 'inline-flex', color: 'var(--v2-amber)' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg></span>}
          {!compacto && p.formato && <span style={{ color: 'var(--v2-ink3)' }}>· {labelFormato(p.formato as any, idioma as any)}</span>}
          {!compacto && redes.map(r => <RedeIcon key={r} rede={r} size={11} />)}
        </div>
        {!compacto && mostrarCliente && (
          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--v2-ink2)', fontSize: 10 }}>{p.clienteNome}</span>
        )}
      </div>
    </div>
  )
}

'use client'
// Suspender / reativar um post — inteiro ou uma rede só (regras em lib/suspenderPost, rota em
// /api/posts/suspender). Um componente só, usado no preview do dashboard e no Planner do
// cliente, para as duas telas não divergirem.
import { useState } from 'react'
import { useT } from '@/app/components/Idioma'
import { confirmar, toast } from '@/lib/toast'
import { minimoDatetimeLocal } from '@/lib/composerPendencias'
import { motivoNaoSuspende, redesDoPost, redePublicada, youtubeEsperandoNoYouTube, NOME_REDE, type Rede } from '@/lib/suspenderPost'

type Props = {
  post: any
  onAtualizado: (post: any) => void
}

const btnBase: React.CSSProperties = { borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }

export default function SuspensaoPost({ post, onAtualizado }: Props) {
  const tr = useT()
  const [ocupado, setOcupado] = useState(false)
  // Pedido de data: reativar um agendado cuja data passou, ou liberar o vídeo do YouTube.
  const [pedeData, setPedeData] = useState<null | { acao: 'reativar' | 'reativar-rede'; rede?: Rede }>(null)
  const [data, setData] = useState('')

  async function chamar(acao: string, extra: Record<string, any> = {}) {
    setOcupado(true)
    try {
      const r = await fetch('/api/posts/suspender', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, acao, ...extra }),
      }).then(x => x.json()).catch(() => ({ error: tr('susp.falha-conexao') }))
      if (!r?.ok) {
        // Data vencida: abre o campo de data em vez de só dar erro.
        if (r?.motivo === 'precisa-data' || r?.motivo === 'precisa-data-youtube') {
          setData(''); setPedeData({ acao: acao as any, rede: extra.rede })
          toast(r.error, 'erro')
          return null
        }
        toast(r?.reconectar ? `${r.error} ${tr('susp.reconectar')}` : (r?.error || tr('susp.falha')), 'erro')
        return null
      }
      onAtualizado(r.post)
      setPedeData(null)
      return r.post
    } finally {
      setOcupado(false)
    }
  }

  async function suspenderTudo() {
    const ok = await confirmar(tr('susp.confirmar-texto'), { titulo: tr('susp.confirmar-titulo'), okLabel: tr('susp.ok') })
    if (!ok) return
    if (await chamar('suspender')) toast(tr('susp.feito'), 'sucesso')
  }

  async function redeAcao(acao: 'suspender-rede' | 'reativar-rede', rede: Rede) {
    const nome = NOME_REDE[rede]
    if (acao === 'suspender-rede') {
      const ok = await confirmar(tr('susp.confirmar-rede', { rede: nome }), { titulo: tr('susp.suspender-rede', { rede: nome }), okLabel: tr('susp.ok') })
      if (!ok) return
    }
    if (await chamar(acao, { rede })) toast(tr(acao === 'suspender-rede' ? 'susp.rede-feita' : 'susp.rede-devolvida', { rede: nome }), 'sucesso')
  }

  const suspenso = post.suspenso as { em: string; por: string; statusAnterior: string } | undefined
  const podeTudo = !motivoNaoSuspende(post)
  const redes = redesDoPost(post)
  const ytEsperando = youtubeEsperandoNoYouTube(post)
  const ytSegurado = !!post.youtubeAgendaSuspensa && redePublicada(post, 'youtube')

  // Botões por rede: só redes que ainda não saíram, e nunca a última (isso é o post inteiro).
  const redesSuspendiveis = !suspenso && post.status !== 'publicado' && post.status !== 'publicando' && redes.length > 1
    ? redes.filter(r => !redePublicada(post, r)) : []
  const redesSuspensas: Rede[] = post.status === 'publicado' || post.midiaRemovida ? [] : (post.redesSuspensas || [])
  const temPorRede = redesSuspendiveis.length > 0 || redesSuspensas.length > 0 || ytEsperando || ytSegurado

  if (!suspenso && !podeTudo && !temPorRede) return null

  const fmt = (iso?: string) => iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div style={{ margin: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {suspenso && (
        <div style={{ background: 'var(--v2-amber-bg)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: 'var(--v2-amber)', lineHeight: 1.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            {tr('susp.selo')}
          </div>
          <div>{tr('susp.suspenso-por', { por: suspenso.por, data: fmt(suspenso.em) })}</div>
          <div>{tr('susp.antes', { status: tr(`susp.st-${suspenso.statusAnterior}`) })}{post.dataAgendada ? ` · ${fmt(post.dataAgendada)}` : ''}</div>
          <button type="button" disabled={ocupado} onClick={async () => { if (await chamar('reativar')) toast(tr('susp.reativado'), 'sucesso') }}
            style={{ ...btnBase, marginTop: 8, width: '100%', padding: '9px 0', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', opacity: ocupado ? 0.6 : 1 }}>
            {tr('susp.reativar')}
          </button>
        </div>
      )}

      {pedeData && (
        <div style={{ background: 'var(--v2-surface1)', border: '1px solid var(--v2-rule2)', borderRadius: 10, padding: '10px 12px' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--v2-ink2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
            {pedeData.rede === 'youtube' ? tr('susp.nova-data-yt') : tr('susp.nova-data')}
          </label>
          <input type="datetime-local" value={data} min={minimoDatetimeLocal()} onChange={e => setData(e.target.value)} autoFocus
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 9, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" disabled={!data || ocupado}
              onClick={async () => {
                const extra = { novaData: new Date(data).toISOString(), ...(pedeData.rede ? { rede: pedeData.rede } : {}) }
                if (await chamar(pedeData.acao, extra)) toast(tr('susp.reativado'), 'sucesso')
              }}
              style={{ ...btnBase, flex: 1, padding: '9px 0', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', opacity: !data || ocupado ? 0.5 : 1, cursor: !data || ocupado ? 'not-allowed' : 'pointer' }}>
              {tr('susp.confirmar-reativar')}
            </button>
            <button type="button" onClick={() => setPedeData(null)}
              style={{ ...btnBase, padding: '9px 16px', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', border: '1px solid var(--v2-rule)' }}>
              {tr('susp.cancelar')}
            </button>
          </div>
        </div>
      )}

      {!suspenso && podeTudo && (
        <button type="button" disabled={ocupado} onClick={suspenderTudo} title={tr('susp.suspender-ajuda')}
          style={{ ...btnBase, width: '100%', padding: '10px 0', background: 'var(--v2-surface)', color: 'var(--v2-amber)', border: '1.5px solid var(--v2-amber-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: ocupado ? 0.6 : 1 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
          {tr('susp.suspender')}
        </button>
      )}

      {temPorRede && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: 'var(--v2-ink3)', fontWeight: 600 }}>{tr('susp.por-rede')}</span>
          {redesSuspendiveis.map(r => (
            <button key={`s-${r}`} type="button" disabled={ocupado} onClick={() => redeAcao('suspender-rede', r)}
              style={{ ...btnBase, padding: '6px 11px', fontSize: 12, background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: '1px solid var(--v2-rule)' }}>
              {tr('susp.suspender-rede', { rede: NOME_REDE[r] })}
            </button>
          ))}
          {redesSuspensas.map(r => (
            <button key={`r-${r}`} type="button" disabled={ocupado} onClick={() => redeAcao('reativar-rede', r)}
              style={{ ...btnBase, padding: '6px 11px', fontSize: 12, background: 'var(--v2-info-bg)', color: 'var(--v2-info)', border: 'none' }}>
              {tr('susp.reativar-rede', { rede: NOME_REDE[r] })}
            </button>
          ))}
          {ytEsperando && (
            <button type="button" disabled={ocupado} onClick={async () => {
              const ok = await confirmar(tr('susp.yt-confirmar', { data: fmt(post.youtubePublicarEm) }), { titulo: tr('susp.yt-segurar'), okLabel: tr('susp.ok') })
              if (ok && await chamar('suspender-rede', { rede: 'youtube' })) toast(tr('susp.yt-segurado'), 'sucesso')
            }}
              style={{ ...btnBase, padding: '6px 11px', fontSize: 12, background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: '1px solid var(--v2-rule)' }}>
              {tr('susp.yt-segurar')}
            </button>
          )}
          {ytSegurado && !suspenso && (
            <button type="button" disabled={ocupado} onClick={async () => { if (await chamar('reativar-rede', { rede: 'youtube' })) toast(tr('susp.reativado'), 'sucesso') }}
              style={{ ...btnBase, padding: '6px 11px', fontSize: 12, background: 'var(--v2-info-bg)', color: 'var(--v2-info)', border: 'none' }}>
              {tr('susp.yt-liberar')}
            </button>
          )}
        </div>
      )}
      {ytSegurado && <p style={{ margin: 0, fontSize: 11.5, color: 'var(--v2-ink3)' }}>{tr('susp.yt-segurado')}</p>}
    </div>
  )
}

'use client'
// PLANO DE AÇÃO — visão do CLIENTE (F3, 17/11/2026). Uma pergunta só: "como está meu projeto
// e o que depende de mim?". Semana, foco, andamento real, o que ele precisa fazer (com o botão
// "Já fiz") e o que a equipe entrega, pelo primeiro nome. A conta mora em
// lib/planoAcao.visaoDoCliente; aqui é só a tela.
import { useMemo, useState } from 'react'
import { visaoDoCliente, textoRelogio, type EntregaCliente, type MarcoSemana } from '@/lib/planoAcao'
import { hojeYmd, fmtDiaMes } from '@/lib/datas'
import { toast } from '@/lib/toast'
import CombinadosPlano from './CombinadosPlano'

type Props = { marcos: MarcoSemana[]; corMarca?: string; corMarcaTexto?: string; onMudou: () => void }

const SITUACAO: Record<EntregaCliente['situacao'], { rotulo: (e: EntregaCliente) => string; cor: string; fundo: string }> = {
  entregue: { rotulo: () => 'Entregue', cor: 'var(--v2-ok)', fundo: 'var(--v2-ok-bg, rgba(20,102,79,.12))' },
  em_andamento: { rotulo: () => 'Em andamento', cor: 'var(--v2-info)', fundo: 'var(--v2-info-bg, rgba(29,78,216,.10))' },
  previsto: { rotulo: e => (e.prazo ? `Previsto ${fmtDiaMes(e.prazo)}` : 'Previsto'), cor: 'var(--v2-ink2)', fundo: 'var(--v2-surface2)' },
  atrasado: { rotulo: () => 'Em atraso', cor: 'var(--v2-hot)', fundo: 'var(--v2-hot-bg, rgba(163,44,34,.12))' },
}

const titulo: React.CSSProperties = { margin: '0 0 8px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--v2-ink3)', fontWeight: 700 }
const linha: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid var(--v2-rule)' }

export default function PlanoCliente({ marcos, corMarca = 'var(--v2-ink)', corMarcaTexto = 'var(--v2-surface)', onMudou }: Props) {
  const hoje = hojeYmd()
  const [numero, setNumero] = useState<number | undefined>(undefined)
  const [enviando, setEnviando] = useState('')
  const v = useMemo(() => visaoDoCliente(marcos, hoje, numero), [marcos, hoje, numero])
  const atual = useMemo(() => visaoDoCliente(marcos, hoje)?.numero, [marcos, hoje])
  if (!v) return null

  async function jaFiz(e: EntregaCliente) {
    if (enviando) return
    setEnviando(e.id)
    const ok = await fetch('/api/plano-acao/entrega-cliente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marcoId: e.marcoId, entregaId: e.id, feito: true }) }).then(r => r.ok).catch(() => false)
    setEnviando('')
    if (!ok) { toast('Não foi possível registrar. Tente de novo.', 'erro'); return }
    toast('Obrigado! A equipe foi avisada.', 'sucesso')
    onMudou()
  }

  const nav: React.CSSProperties = { width: 34, height: 34, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 9, cursor: 'pointer', color: 'var(--v2-ink2)', fontSize: 16, fontFamily: 'inherit' }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)', fontWeight: 600 }}>Semana {v.numero} de {v.total} · {fmtDiaMes(v.segunda)} a {fmtDiaMes(v.domingo)}{v.recesso ? ' · recesso' : ''}</p>
          <h3 style={{ margin: '4px 0 0', fontSize: 24, lineHeight: 1.25, color: 'var(--v2-ink)', fontWeight: 800 }}>{v.foco}</h3>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={nav} aria-label="Semana anterior" disabled={v.numero <= 1} onClick={() => setNumero(Math.max(1, v.numero - 1))}>&#8249;</button>
          {v.numero !== atual && <button type="button" onClick={() => setNumero(undefined)} style={{ ...nav, width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 700 }}>Esta semana</button>}
          <button type="button" style={nav} aria-label="Próxima semana" disabled={v.numero >= v.total} onClick={() => setNumero(v.numero + 1)}>&#8250;</button>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--v2-ink)', fontVariantNumeric: 'tabular-nums' }}>{v.pct}%</span>
          <span style={{ fontSize: 13.5, color: 'var(--v2-ink2)' }}>do plano feito · {v.concluidas} de {v.previstas} entregas{v.pctNoPrazo !== null ? ` · ${v.pctNoPrazo}% no prazo` : ''}</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--v2-surface2)', overflow: 'hidden', marginTop: 8 }}>
          <div className="anim-barra" style={{ width: `${v.pct}%`, height: '100%', borderRadius: 999, background: 'var(--v2-ok)' }} />
        </div>
      </div>

      <section style={{ marginTop: 26, padding: '16px 18px', borderRadius: 14, border: `1.5px solid ${v.dependeDeVoce.length ? 'var(--v2-amber-on, #F8B311)' : 'var(--v2-rule)'}`, background: 'var(--v2-surface)' }}>
        <h4 style={{ ...titulo, color: v.dependeDeVoce.length ? 'var(--v2-ink)' : 'var(--v2-ink3)' }}>Depende de você{v.dependeDeVoce.length ? ` (${v.dependeDeVoce.length})` : ''}</h4>
        {!v.dependeDeVoce.length && <p style={{ margin: 0, fontSize: 14, color: 'var(--v2-ink2)' }}>Nada depende de você agora.</p>}
        {v.dependeDeVoce.map((e, i) => (
          <div key={`${e.marcoId}-${e.id}`} className="anim-item" style={{ ...linha, ['--i' as any]: i, ...(i === 0 ? { borderTop: 0, paddingTop: 2 } : {}) }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14.5, color: 'var(--v2-ink)', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{e.titulo}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: e.situacao === 'atrasado' ? 'var(--v2-hot)' : 'var(--v2-ink3)', fontWeight: e.situacao === 'atrasado' ? 700 : 400 }}>
                {e.prazo ? `Até ${fmtDiaMes(e.prazo)}` : 'Sem data'}{e.situacao === 'atrasado' || e.relogio.estado === 'vence_hoje' ? ` · ${textoRelogio(e.relogio)}` : ''}
              </p>
            </div>
            <button type="button" disabled={!!enviando} onClick={() => jaFiz(e)} style={{ padding: '9px 16px', border: 0, borderRadius: 10, background: corMarca, color: corMarcaTexto, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: enviando && enviando !== e.id ? 0.5 : 1 }}>
              {enviando === e.id ? 'Enviando…' : 'Já fiz'}
            </button>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 26 }}>
        <h4 style={titulo}>{v.numero === atual ? 'Nesta semana a equipe entrega' : `Na semana ${v.numero} a equipe entrega`}</h4>
        {!v.nestaSemana.length && <p style={{ margin: 0, fontSize: 14, color: 'var(--v2-ink3)' }}>{v.recesso ? 'Semana de recesso: o conteúdo já está agendado.' : 'Nenhuma entrega da equipe nesta semana.'}</p>}
        {v.nestaSemana.map((e, i) => {
          const s = SITUACAO[e.situacao]
          return (
            <div key={e.id} className="anim-item" style={{ ...linha, ['--i' as any]: i }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: s.cor, background: s.fundo, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', minWidth: 92, textAlign: 'center' }}>{s.rotulo(e)}</span>
              <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 14.5, color: e.situacao === 'entregue' ? 'var(--v2-ink3)' : 'var(--v2-ink)', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{e.titulo}</p>
              <span style={{ fontSize: 12.5, color: 'var(--v2-ink3)', whiteSpace: 'nowrap' }}>{e.quem}</span>
            </div>
          )
        })}
      </section>

      {v.semanaPassada.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <h4 style={titulo}>Entregue na semana passada</h4>
          {v.semanaPassada.map(e => (
            <div key={e.id} style={linha}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v2-ok)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>
              <p style={{ flex: 1, margin: 0, fontSize: 14, color: 'var(--v2-ink2)', overflowWrap: 'anywhere' }}>{e.titulo}</p>
            </div>
          ))}
        </section>
      )}

      {v.proxima && (
        <button type="button" onClick={() => setNumero(v.proxima!.numero)} style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 26, padding: '14px 16px', border: '1px solid var(--v2-rule)', borderRadius: 14, background: 'var(--v2-surface)', cursor: 'pointer', fontFamily: 'inherit' }}>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--v2-ink3)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>Na próxima semana</span>
          <span style={{ display: 'block', marginTop: 4, fontSize: 15, color: 'var(--v2-ink)', fontWeight: 700 }}>{v.proxima.foco}</span>
          {v.proxima.entregas.length > 0 && <span style={{ display: 'block', marginTop: 4, fontSize: 13, color: 'var(--v2-ink3)' }}>{v.proxima.entregas.slice(0, 4).join(' · ')}{v.proxima.entregas.length > 4 ? ` e mais ${v.proxima.entregas.length - 4}` : ''}</span>}
        </button>
      )}
      <CombinadosPlano visao="cliente" />
    </div>
  )
}

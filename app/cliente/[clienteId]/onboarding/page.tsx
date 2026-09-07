'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { ItemOnboarding, FaseCliente } from '@/lib/faseCliente'

// ONBOARDING — o momento exclusivo por que TODO cliente passa antes de "Em
// produção" (pedido do dono, 07/09/2026). A tela só mostra e pede: o checklist
// e a regra de transição vivem em lib/faseCliente e são avaliados no servidor
// (/api/clientes/fase). Itens manuais a equipe marca aqui (PUT /api/clientes);
// os automáticos vêm dos dados e cada um aponta para a tela que resolve.

type Estado = {
  fase: FaseCliente; rotulo: string; faseDesde?: string; onboardingConcluidoEm?: string | null
  itens: ItemOnboarding[]; feitos: number; total: number; podeConcluir: boolean; ehAdmin: boolean; handoffVendas?: string
}

const DESTINO: Record<string, string> = { marca: '/marca', playbook: '/playbook', primeiro: '/planner' }

export default function OnboardingCliente() {
  const { clienteId } = useParams() as { clienteId: string }
  const router = useRouter()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const ehEquipe = role === 'admin' || role === 'gerente'
  const base = `/cliente/${clienteId}`

  const [e, setE] = useState<Estado | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(() => {
    setErro('')
    return fetch(`/api/clientes/fase?clienteId=${encodeURIComponent(clienteId)}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error || 'Falha ao carregar'); return d as Estado })
      .then(setE)
      .catch(err => setErro(err.message || 'Não foi possível carregar o onboarding.'))
  }, [clienteId])
  useEffect(() => { if (ehEquipe) carregar() }, [carregar, ehEquipe])

  // Marca/desmarca item MANUAL: otimista, com volta se o servidor recusar.
  async function alternar(item: ItemOnboarding) {
    if (!e || !item.manual || salvando) return
    const anterior = e
    const itens = e.itens.map(i => i.chave === item.chave ? { ...i, ok: !i.ok } : i)
    const feitos = itens.filter(i => i.ok).length
    setE({ ...e, itens, feitos, podeConcluir: feitos === itens.length })
    setSalvando(item.chave)
    const checklist: Record<string, boolean> = {}
    for (const i of itens) if (i.manual && i.ok) checklist[i.chave] = true
    try {
      const r = await fetch('/api/clientes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: clienteId, onboardingChecklist: checklist }) })
      if (!r.ok) throw new Error()
    } catch {
      setE(anterior)
      setAviso('Não deu para salvar. Verifique a conexão e tente de novo.')
    } finally { setSalvando(null) }
  }

  async function mudarFase(para: FaseCliente, forcar = false) {
    if (!e || salvando) return
    let motivo = ''
    if (forcar) {
      if (!window.confirm(`Concluir o onboarding com ${e.total - e.feitos} pendência(s)? Isso fica registrado na auditoria.`)) return
      motivo = window.prompt('Motivo (opcional):') || ''
    } else if (para === 'onboarding' && !window.confirm('Reabrir o onboarding deste cliente?')) return
    setSalvando('fase'); setAviso('')
    try {
      const r = await fetch('/api/clientes/fase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId, fase: para, forcar, motivo }) })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setAviso(d?.error || 'A mudança de fase foi recusada.'); return }
      await carregar()
      if (para === 'producao') router.push(base)
    } catch { setAviso('Sem conexão. Tente de novo.') }
    finally { setSalvando(null) }
  }

  if (!ehEquipe) return <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>O onboarding é uma tela da equipe.</p>
  if (erro) return <div style={{ background: 'var(--v2-hot-bg)', color: 'var(--v2-hot)', borderRadius: 12, padding: '14px 16px', fontSize: 13.5, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>{erro}<button type="button" onClick={carregar} style={{ font: 'inherit', fontWeight: 600, background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 999, padding: '7px 14px', cursor: 'pointer' }}>Tentar de novo</button></div>
  if (!e) return (
    <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 820 }}>
      {[92, 180, 260].map((h, i) => <div key={i} style={{ height: h, borderRadius: 16, background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)' }} />)}
    </div>
  )

  const emOnboarding = e.fase === 'onboarding'
  const pct = e.total ? Math.round((e.feitos / e.total) * 100) : 0
  const manuais = e.itens.filter(i => i.manual)
  const automaticos = e.itens.filter(i => !i.manual)
  const data = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : ''

  const Item = ({ i }: { i: ItemOnboarding }) => (
    <div role={i.manual ? 'checkbox' : undefined} aria-checked={i.manual ? i.ok : undefined} tabIndex={i.manual ? 0 : -1}
      onClick={() => alternar(i)} onKeyDown={ev => { if (i.manual && (ev.key === ' ' || ev.key === 'Enter')) { ev.preventDefault(); alternar(i) } }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 4px', borderBottom: '1px solid var(--v2-surface1)', cursor: i.manual && emOnboarding ? 'pointer' : 'default', opacity: salvando === i.chave ? 0.6 : 1, minHeight: 44 }}>
      {i.ok
        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v2-ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 6L9 17l-5-5" /></svg>
        : <span style={{ width: 20, height: 20, borderRadius: i.manual ? 6 : '50%', border: '2px solid var(--v2-rule2)', flexShrink: 0, boxSizing: 'border-box' }} />}
      <span style={{ flex: 1, fontSize: 14, color: i.ok ? 'var(--v2-ink3)' : 'var(--v2-ink)', textDecoration: i.ok ? 'line-through' : 'none' }}>{i.label}</span>
      {!i.ok && (DESTINO[i.chave]
        ? <button type="button" onClick={ev => { ev.stopPropagation(); router.push(`${base}${DESTINO[i.chave]}`) }} style={{ font: 'inherit', fontSize: 12.5, fontWeight: 500, color: 'var(--v2-info)', background: 'var(--v2-info-bg)', border: 0, borderRadius: 999, padding: '5px 10px', cursor: 'pointer' }}>{i.dica}</button>
        : <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>{i.dica}</span>)}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: emOnboarding ? 'var(--v2-info)' : 'var(--v2-ok)' }}>{e.rotulo}{emOnboarding && e.faseDesde ? ` · desde ${data(e.faseDesde)}` : ''}{!emOnboarding && e.onboardingConcluidoEm ? ` · onboarding concluído em ${data(e.onboardingConcluidoEm)}` : ''}</p>
          <h1 style={{ margin: '4px 0 0', fontSize: 'clamp(24px, 3vw, 30px)', fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.1 }}>Onboarding</h1>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--v2-ink2)' }}>Todo cliente passa por aqui antes de entrar em produção. {e.feitos} de {e.total} itens prontos.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {emOnboarding && e.podeConcluir && <button type="button" disabled={!!salvando} onClick={() => mudarFase('producao')} style={{ padding: '11px 18px', background: 'var(--v2-amber-on)', color: '#17150E', border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>Concluir onboarding → Em produção</button>}
          {emOnboarding && !e.podeConcluir && <button type="button" disabled title={`Faltam ${e.total - e.feitos} itens`} style={{ padding: '11px 18px', background: 'var(--v2-surface2)', color: 'var(--v2-ink3)', border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 600, cursor: 'not-allowed', minHeight: 44 }}>Concluir onboarding · faltam {e.total - e.feitos}</button>}
          {emOnboarding && !e.podeConcluir && e.ehAdmin && <button type="button" disabled={!!salvando} onClick={() => mudarFase('producao', true)} style={{ padding: '11px 14px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer', minHeight: 44 }}>Forçar conclusão</button>}
          {!emOnboarding && e.ehAdmin && <button type="button" disabled={!!salvando} onClick={() => mudarFase('onboarding')} style={{ padding: '11px 14px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer', minHeight: 44 }}>Reabrir onboarding</button>}
        </div>
      </div>

      {aviso && <div role="alert" style={{ background: 'var(--v2-hot-bg)', color: 'var(--v2-hot)', borderRadius: 12, padding: '12px 16px', fontSize: 13.5 }}>{aviso}</div>}

      <div style={{ height: 6, background: 'var(--v2-surface2)', borderRadius: 999, overflow: 'hidden' }} aria-label={`${pct}% do onboarding`}>
        <div style={{ width: `${pct}%`, height: '100%', background: emOnboarding ? 'var(--v2-info)' : 'var(--v2-ok)', transition: 'width 300ms ease' }} />
      </div>

      <section style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 16, padding: '16px 18px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>A equipe marca</h2>
        <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>Toque para marcar como feito.</p>
        {manuais.map(i => <Item key={i.chave} i={i} />)}
      </section>

      <section style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 16, padding: '16px 18px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>O sistema detecta</h2>
        <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>Fica pronto sozinho quando a etapa acontece no sistema.</p>
        {automaticos.map(i => <Item key={i.chave} i={i} />)}
      </section>

      {e.handoffVendas && (
        <section style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 16, padding: '16px 18px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>Passagem de bastão (vendas → onboarding)</h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--v2-ink)', whiteSpace: 'pre-wrap' }}>{e.handoffVendas}</p>
        </section>
      )}
    </div>
  )
}

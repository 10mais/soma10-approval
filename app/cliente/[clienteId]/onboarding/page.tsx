'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { confirmar } from '@/lib/toast'
import type { ItemOnboarding, FaseCliente, FaseChecklist } from '@/lib/faseCliente'

// ONBOARDING — o momento exclusivo por que TODO cliente passa antes de "Em
// produção" (pedido do dono, 07/09/2026). A tela só mostra e pede: o checklist
// (fases > etapas, configurável em Configurações → Onboarding) e a regra de
// transição vivem em lib/faseCliente e são avaliados no servidor
// (/api/clientes/fase). Etapas manuais a equipe marca aqui (PUT /api/clientes);
// as automáticas vêm dos dados e cada uma aponta para a tela que resolve.

type Estado = {
  fase: FaseCliente; rotulo: string; faseDesde?: string; onboardingConcluidoEm?: string | null
  itens: ItemOnboarding[]; fases: FaseChecklist[]; feitos: number; total: number; podeConcluir: boolean; ehAdmin: boolean; handoffVendas?: string
}

// Atalho por DETECTOR (etapa automática): onde a etapa se resolve dentro do hub.
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
  // Forçar conclusão (admin): painel inline com o motivo — nada de prompt nativo.
  const [forcando, setForcando] = useState(false)
  const [motivo, setMotivo] = useState('')

  const carregar = useCallback(() => {
    setErro('')
    return fetch(`/api/clientes/fase?clienteId=${encodeURIComponent(clienteId)}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error || 'Falha ao carregar'); return d as Estado })
      .then(setE)
      .catch(err => setErro(err.message || 'Não foi possível carregar o onboarding.'))
  }, [clienteId])
  useEffect(() => { if (ehEquipe) carregar() }, [carregar, ehEquipe])

  function recalcular(itens: ItemOnboarding[], base: Estado): Estado {
    const fases = base.fases.map(f => { const meus = itens.filter(i => i.faseId === f.id); return { ...f, itens: meus, feitos: meus.filter(i => i.ok).length, total: meus.length } })
    const feitos = itens.filter(i => i.ok).length
    return { ...base, itens, fases, feitos, podeConcluir: feitos === itens.length }
  }

  // Marca/desmarca etapa MANUAL: otimista, com volta se o servidor recusar.
  async function alternar(item: ItemOnboarding) {
    if (!e || !item.manual || salvando) return
    const anterior = e
    const itens = e.itens.map(i => i.chave === item.chave ? { ...i, ok: !i.ok } : i)
    setE(recalcular(itens, e))
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
    if (para === 'onboarding') {
      const ok = await confirmar('O cliente volta para a fase de onboarding e o checklist fica editável de novo.', { titulo: 'Reabrir onboarding', okLabel: 'Reabrir' })
      if (!ok) return
    }
    setSalvando('fase'); setAviso('')
    try {
      const r = await fetch('/api/clientes/fase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId, fase: para, forcar, motivo: forcar ? motivo.trim() : '' }) })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setAviso(d?.error || 'A mudança de fase foi recusada.'); return }
      setForcando(false); setMotivo('')
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
  const data = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : ''
  const fases = e.fases && e.fases.length ? e.fases : [{ id: 'tudo', nome: 'Checklist', itens: e.itens, feitos: e.feitos, total: e.total }]

  const Item = ({ i }: { i: ItemOnboarding }) => (
    <div role={i.manual ? 'checkbox' : undefined} aria-checked={i.manual ? i.ok : undefined} tabIndex={i.manual ? 0 : -1}
      onClick={() => alternar(i)} onKeyDown={ev => { if (i.manual && (ev.key === ' ' || ev.key === 'Enter')) { ev.preventDefault(); alternar(i) } }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 4px', borderBottom: '1px solid var(--v2-surface1)', cursor: i.manual && emOnboarding ? 'pointer' : 'default', opacity: salvando === i.chave ? 0.6 : 1, minHeight: 44 }}>
      {i.ok
        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v2-ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 6L9 17l-5-5" /></svg>
        : <span style={{ width: 20, height: 20, borderRadius: i.manual ? 6 : '50%', border: '2px solid var(--v2-rule2)', flexShrink: 0, boxSizing: 'border-box' }} />}
      <span style={{ flex: 1, fontSize: 14, color: i.ok ? 'var(--v2-ink3)' : 'var(--v2-ink)', textDecoration: i.ok ? 'line-through' : 'none' }}>{i.label}</span>
      {!i.manual && <span style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--v2-ink3)', background: 'var(--v2-surface2)', padding: '3px 7px', borderRadius: 999 }}>automática</span>}
      {!i.ok && (i.auto && DESTINO[i.auto]
        ? <button type="button" onClick={ev => { ev.stopPropagation(); router.push(`${base}${DESTINO[i.auto!]}`) }} style={{ font: 'inherit', fontSize: 12.5, fontWeight: 500, color: 'var(--v2-info)', background: 'var(--v2-info-bg)', border: 0, borderRadius: 999, padding: '5px 10px', cursor: 'pointer' }}>{i.dica || 'Abrir'}</button>
        : i.dica ? <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>{i.dica}</span> : null)}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: emOnboarding ? 'var(--v2-info)' : 'var(--v2-ok)' }}>{e.rotulo}{emOnboarding && e.faseDesde ? ` · desde ${data(e.faseDesde)}` : ''}{!emOnboarding && e.onboardingConcluidoEm ? ` · onboarding concluído em ${data(e.onboardingConcluidoEm)}` : ''}</p>
          <h1 style={{ margin: '4px 0 0', fontSize: 'clamp(24px, 3vw, 30px)', fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.1 }}>Onboarding</h1>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--v2-ink2)' }}>Todo cliente passa por aqui antes de entrar em produção. {e.feitos} de {e.total} etapas prontas, em {fases.length} {fases.length === 1 ? 'fase' : 'fases'}.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {emOnboarding && e.podeConcluir && <button type="button" disabled={!!salvando} onClick={() => mudarFase('producao')} style={{ padding: '11px 18px', background: 'var(--v2-amber-on)', color: '#17150E', border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>Concluir onboarding → Em produção</button>}
          {emOnboarding && !e.podeConcluir && <button type="button" disabled title={`Faltam ${e.total - e.feitos} etapas`} style={{ padding: '11px 18px', background: 'var(--v2-surface2)', color: 'var(--v2-ink3)', border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 600, cursor: 'not-allowed', minHeight: 44 }}>Concluir onboarding · faltam {e.total - e.feitos}</button>}
          {emOnboarding && !e.podeConcluir && e.ehAdmin && <button type="button" disabled={!!salvando} onClick={() => setForcando(v => !v)} style={{ padding: '11px 14px', background: forcando ? 'var(--v2-surface2)' : 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer', minHeight: 44 }}>Forçar conclusão</button>}
          {!emOnboarding && e.ehAdmin && <button type="button" disabled={!!salvando} onClick={() => mudarFase('onboarding')} style={{ padding: '11px 14px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer', minHeight: 44 }}>Reabrir onboarding</button>}
        </div>
      </div>

      {aviso && <div role="alert" style={{ background: 'var(--v2-hot-bg)', color: 'var(--v2-hot)', borderRadius: 12, padding: '12px 16px', fontSize: 13.5 }}>{aviso}</div>}

      {forcando && emOnboarding && (
        <section style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-amber-on)', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Concluir com {e.total - e.feitos} {e.total - e.feitos === 1 ? 'pendência' : 'pendências'}?</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--v2-ink2)', lineHeight: 1.6 }}>{e.itens.filter(i => !i.ok).map(i => <li key={i.chave}>{i.label}</li>)}</ul>
          <label style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>Motivo (fica na auditoria)</label>
          <textarea value={motivo} onChange={ev => setMotivo(ev.target.value)} rows={2} placeholder="Ex.: cliente pediu para começar antes do kickoff" style={{ boxSizing: 'border-box', width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink)', fontFamily: 'inherit', fontSize: 13.5, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={!!salvando} onClick={() => mudarFase('producao', true)} style={{ padding: '10px 16px', background: 'var(--v2-amber-on)', color: '#17150E', border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', minHeight: 42 }}>Concluir mesmo assim</button>
            <button type="button" onClick={() => { setForcando(false); setMotivo('') }} style={{ padding: '10px 14px', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', border: '1px solid var(--v2-rule)', borderRadius: 12, fontSize: 13, cursor: 'pointer', minHeight: 42 }}>Cancelar</button>
          </div>
        </section>
      )}

      <div style={{ height: 6, background: 'var(--v2-surface2)', borderRadius: 999, overflow: 'hidden' }} aria-label={`${pct}% do onboarding`}>
        <div style={{ width: `${pct}%`, height: '100%', background: emOnboarding ? 'var(--v2-info)' : 'var(--v2-ok)', transition: 'width 300ms ease' }} />
      </div>

      {/* As FASES e ETAPAS se editam em Configurações → Onboarding (valem para todos os clientes). */}
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>Fases e etapas valem para todos os clientes.</span>
        {e.ehAdmin
          ? <button type="button" onClick={() => { try { sessionStorage.setItem('soma10_aba', 'config'); sessionStorage.setItem('soma10_abaConfig', 'onboarding') } catch {} router.push('/dashboard') }} style={{ background: 'none', border: 0, padding: 0, color: 'var(--v2-amber)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', minHeight: 24 }}>Editar fases e etapas →</button>
          : <span>Um administrador edita em Configurações → Onboarding.</span>}
      </p>

      {/* Uma seção por FASE, na ordem configurada; a primeira fase incompleta é a "atual". */}
      {fases.map((f, idx) => {
        const completa = f.total > 0 && f.feitos === f.total
        const atual = emOnboarding && !completa && fases.slice(0, idx).every(x => x.feitos === x.total)
        return (
          <section key={f.id} style={{ background: 'var(--v2-surface)', border: `1px solid ${atual ? 'var(--v2-info)' : 'var(--v2-rule)'}`, borderRadius: 16, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '0.12em', color: 'var(--v2-ink3)' }}>FASE {idx + 1}</span>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--v2-ink)', flex: 1 }}>{f.nome}</h2>
              {atual && <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--v2-info)', background: 'var(--v2-info-bg)', padding: '3px 8px', borderRadius: 999 }}>Atual</span>}
              <span style={{ fontSize: 12.5, color: completa ? 'var(--v2-ok)' : 'var(--v2-ink3)', fontVariantNumeric: 'tabular-nums' }}>{f.feitos} de {f.total}</span>
            </div>
            {f.itens.map(i => <Item key={i.chave} i={i} />)}
          </section>
        )
      })}

      {e.handoffVendas && (
        <section style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 16, padding: '16px 18px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>Passagem de bastão (vendas → onboarding)</h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--v2-ink)', whiteSpace: 'pre-wrap' }}>{e.handoffVendas}</p>
        </section>
      )}
    </div>
  )
}

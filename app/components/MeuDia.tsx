'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { confirmar } from '@/lib/toast'
import { TarefaModal } from './GestaoTarefas'

const PRIO_COR: Record<string, string> = { urgente: 'var(--v2-hot)', alta: '#ea580c', media: 'var(--v2-amber)', baixa: 'var(--v2-ink3)' }
const PRIO_PESO: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 }

function fmtMin(min: number) { return `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}` }
function fmtRelogio(ms: number) { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60; const mm = String(m).padStart(2, '0'), ss = String(seg).padStart(2, '0'); return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}` }
function diaISO(d: Date) { return d.toISOString().slice(0, 10) }

export default function MeuDia({ onAbrirTarefas, clientes = [], usuarios = [] }: { onAbrirTarefas?: () => void; clientes?: any[]; usuarios?: any[] }) {
  const { data: session } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const [tarefas, setTarefas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [tarefaAberta, setTarefaAberta] = useState<any | null>(null)
  const [, setTick] = useState(0)

  function carregar() { fetch('/api/tarefas').then(r => r.json()).then(d => { setTarefas(Array.isArray(d) ? d : []); setCarregando(false) }).catch(() => setCarregando(false)) }
  useEffect(() => { carregar() }, [])
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t) }, [])

  const minhas = tarefas
    .filter(t => t.responsavelEmail === email && t.status !== 'concluido')
    .sort((a, b) => {
      const pa = a.prazo ? new Date(a.prazo).getTime() : Infinity
      const pb = b.prazo ? new Date(b.prazo).getTime() : Infinity
      if (pa !== pb) return pa - pb
      return (PRIO_PESO[a.prioridade] ?? 2) - (PRIO_PESO[b.prioridade] ?? 2)
    })

  const hoje = diaISO(new Date())
  const grupos = {
    atrasadas: minhas.filter(t => t.prazo && diaISO(new Date(t.prazo)) < hoje),
    hoje: minhas.filter(t => t.prazo && diaISO(new Date(t.prazo)) === hoje),
    proximas: minhas.filter(t => !t.prazo || diaISO(new Date(t.prazo)) > hoje),
  }

  async function timer(t: any) {
    const key = `apont:${t.id}`
    const ini = localStorage.getItem(key)
    if (ini) {
      const min = Math.max(1, Math.round((Date.now() - Number(ini)) / 60000))
      localStorage.removeItem(key)
      await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, apontarHoras: { minutos: min, descricao: 'Timer (Meu dia)', data: new Date().toISOString() } }) }).catch(() => {})
      carregar()
    } else {
      localStorage.setItem(key, String(Date.now()))
      setTick(x => x + 1)
    }
  }
  async function concluir(t: any) {
    await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, status: 'concluido' }) }).catch(() => {})
    carregar()
  }

  function Linha({ t }: { t: any }) {
    const ini = typeof window !== 'undefined' ? localStorage.getItem(`apont:${t.id}`) : null
    const rodando = !!ini
    const elapsed = ini ? Date.now() - Number(ini) : 0
    const total = (t.apontamentos || []).reduce((s: number, a: any) => s + (Number(a.minutos) || 0), 0)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--v2-surface)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIO_COR[t.prioridade] || 'var(--v2-rule)', flexShrink: 0 }} title={t.prioridade} />
        <div onClick={() => setTarefaAberta(t)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} title="Abrir tarefa">
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>
            {t.clienteNome || 'Interno'}{t.prazo ? ` · prazo ${new Date(t.prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''}{total > 0 ? ` · ${fmtMin(total)} apontado` : ''}
          </p>
        </div>
        <button onClick={() => timer(t)} title={rodando ? 'Parar timer' : 'Iniciar timer'}
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: rodando ? 'var(--v2-hot)' : 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          {rodando
            ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> Parar {fmtRelogio(elapsed)}</>
            : <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> Timer</>}
        </button>
        <button onClick={() => concluir(t)} title="Concluir" style={{ flexShrink: 0, padding: '7px 12px', background: 'var(--v2-surface)', color: 'var(--v2-ok)', border: '1.5px solid var(--v2-ok-bg)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Concluir</button>
      </div>
    )
  }

  function Secao({ titulo, itens, cor }: { titulo: string; itens: any[]; cor: string }) {
    if (itens.length === 0) return null
    return (
      <div style={{ marginBottom: 18 }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: cor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{titulo} · {itens.length}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{itens.map(t => <Linha key={t.id} t={t} />)}</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--v2-ink)' }}>Meu dia</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--v2-ink3)' }}>Suas tarefas em ordem de prazo e prioridade. Inicie o timer e marque como concluída.</p>
        </div>
        {onAbrirTarefas && <button onClick={onAbrirTarefas} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Ver quadro de Tarefas →</button>}
      </div>

      {carregando ? <p style={{ color: 'var(--v2-ink3)' }}>Carregando...</p> : minhas.length === 0 ? (
        <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: '40px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--v2-ink3)' }}>Nada pendente atribuído a você. 🎉</p>
        </div>
      ) : (
        <>
          <Secao titulo="Atrasadas" itens={grupos.atrasadas} cor="var(--v2-hot)" />
          <Secao titulo="Para hoje" itens={grupos.hoje} cor="var(--v2-amber)" />
          <Secao titulo="Próximas" itens={grupos.proximas} cor="var(--v2-ink3)" />
        </>
      )}

      {/* Abre a tarefa no MESMO modal de Tarefas, sem sair de "Meu dia" */}
      {tarefaAberta && (
        <TarefaModal
          key={tarefaAberta.id}
          tarefa={tarefaAberta}
          clientes={clientes}
          usuarios={usuarios}
          onClose={() => setTarefaAberta(null)}
          onSalvo={() => { setTarefaAberta(null); carregar() }}
          onRecarregar={(t: any) => { setTarefaAberta(t); carregar() }}
          onExcluir={async () => { if (await confirmar('Excluir esta tarefa?', { titulo: 'Excluir tarefa', okLabel: 'Excluir', perigo: true })) { await fetch(`/api/tarefas?id=${tarefaAberta.id}`, { method: 'DELETE' }).catch(() => {}); setTarefaAberta(null); carregar() } }}
        />
      )}
    </div>
  )
}

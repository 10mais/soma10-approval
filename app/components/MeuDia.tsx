'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

const PRIO_COR: Record<string, string> = { urgente: '#dc2626', alta: '#ea580c', media: '#ca8a04', baixa: '#9ca3af' }
const PRIO_PESO: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 }

function fmtMin(min: number) { return `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}` }
function diaISO(d: Date) { return d.toISOString().slice(0, 10) }

export default function MeuDia({ onAbrirTarefas }: { onAbrirTarefas?: () => void }) {
  const { data: session } = useSession()
  const email = (session?.user as any)?.email as string | undefined
  const [tarefas, setTarefas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [, setTick] = useState(0)

  function carregar() { fetch('/api/tarefas').then(r => r.json()).then(d => { setTarefas(Array.isArray(d) ? d : []); setCarregando(false) }).catch(() => setCarregando(false)) }
  useEffect(() => { carregar() }, [])
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(t) }, [])

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
    const rodando = typeof window !== 'undefined' && !!localStorage.getItem(`apont:${t.id}`)
    const total = (t.apontamentos || []).reduce((s: number, a: any) => s + (Number(a.minutos) || 0), 0)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIO_COR[t.prioridade] || '#ccc', flexShrink: 0 }} title={t.prioridade} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#999' }}>
            {t.clienteNome || 'Interno'}{t.prazo ? ` · prazo ${new Date(t.prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''}{total > 0 ? ` · ${fmtMin(total)} apontado` : ''}
          </p>
        </div>
        <button onClick={() => timer(t)} title={rodando ? 'Parar timer' : 'Iniciar timer'}
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: rodando ? '#dc2626' : '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          {rodando
            ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> Parar</>
            : <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> Timer</>}
        </button>
        <button onClick={() => concluir(t)} title="Concluir" style={{ flexShrink: 0, padding: '7px 12px', background: '#fff', color: '#16a34a', border: '1.5px solid #bbf7d0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Concluir</button>
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
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Meu dia</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Suas tarefas em ordem de prazo e prioridade. Inicie o timer e marque como concluída.</p>
        </div>
        {onAbrirTarefas && <button onClick={onAbrirTarefas} style={{ background: 'none', border: 'none', color: '#1d4ed8', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Ver quadro de Tarefas →</button>}
      </div>

      {carregando ? <p style={{ color: '#aaa' }}>Carregando...</p> : minhas.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '40px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#888' }}>Nada pendente atribuído a você. 🎉</p>
        </div>
      ) : (
        <>
          <Secao titulo="Atrasadas" itens={grupos.atrasadas} cor="#dc2626" />
          <Secao titulo="Para hoje" itens={grupos.hoje} cor="#ca8a04" />
          <Secao titulo="Próximas" itens={grupos.proximas} cor="#888" />
        </>
      )}
    </div>
  )
}

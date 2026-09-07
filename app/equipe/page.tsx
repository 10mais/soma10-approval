'use client'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'
import AvatarPessoa from '@/app/components/AvatarPessoa'
import { resumoDaPessoa, fmtMinutos } from '@/lib/hubPessoa'

// TODOS OS CARDS (só admin): a equipe inteira, um card por pessoa, com o que
// está assinalado para cada um. Quem não é admin cai no próprio card.

type Pessoa = { email: string; nome: string; cargo?: string; foto?: string; role?: string; atribuicoes?: string[]; clientesResponsavel?: string[] }
const PAPEL: Record<string, string> = { admin: 'Admin', gerente: 'Gestão', usuario: 'Equipe', vendas: 'Comercial' }

export default function EquipeCards() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const role = (session?.user as any)?.role
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [tarefas, setTarefas] = useState<any[]>([])
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([])
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    if (role !== 'admin') { router.replace('/equipe/me'); return }
    const j = (u: string) => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null)
    Promise.all([j('/api/equipe'), j('/api/tarefas'), j('/api/clientes')]).then(([p, t, c]) => {
      setPessoas(Array.isArray(p) ? p : [])
      setTarefas(Array.isArray(t) ? t : [])
      setClientes(Array.isArray(c) ? c.map((x: any) => ({ id: x.id, nome: x.nome })) : [])
      setCarregado(true)
    })
  }, [status, role, router])

  const cards = useMemo(() => pessoas.map(p => ({ p, r: resumoDaPessoa({ email: p.email, tarefas, clientesResponsavel: p.clientesResponsavel }) })), [pessoas, tarefas])
  const nomeCliente = (id: string) => clientes.find(c => c.id === id)?.nome || ''
  const totalAbertas = cards.reduce((s, c) => s + c.r.abertas, 0)
  const totalAtrasadas = cards.reduce((s, c) => s + c.r.atrasadas.length, 0)

  if (role !== 'admin') return null
  if (!carregado) return <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Carregando…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1240 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>Equipe</p>
          <h1 style={{ margin: '4px 0 0', fontSize: 'clamp(26px, 3vw, 34px)', fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.1 }}>{pessoas.length} pessoa{pessoas.length === 1 ? '' : 's'}, {totalAbertas} tarefa{totalAbertas === 1 ? '' : 's'} aberta{totalAbertas === 1 ? '' : 's'}{totalAtrasadas ? `, ${totalAtrasadas} atrasada${totalAtrasadas > 1 ? 's' : ''}` : ''}</h1>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--v2-ink2)' }}>Clique num perfil para ver atribuições, responsabilidades e tudo o que está assinalado para a pessoa.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
        {cards.map(({ p, r }) => {
          const sobrecarga = r.abertas >= 10 || r.atrasadas.length >= 3
          return (
            <button key={p.email} className="eq-card" onClick={() => router.push(`/equipe/${encodeURIComponent(p.email)}`)}
              style={{ textAlign: 'left', background: 'var(--v2-surface)', border: `1px solid ${r.atrasadas.length ? 'var(--v2-hot)' : 'var(--v2-rule)'}`, borderRadius: 16, padding: '18px 18px 16px', cursor: 'pointer', color: 'var(--v2-ink)', display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color 120ms, transform 120ms' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <AvatarPessoa p={p} tam={46} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 15.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--v2-ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.cargo || PAPEL[p.role || ''] || 'Equipe'}</p>
                </div>
                {sobrecarga && <span style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--v2-hot)', background: 'var(--v2-hot-bg)', padding: '3px 8px', borderRadius: 999 }}>Sobrecarga</span>}
              </div>

              {(p.atribuicoes?.length || 0) > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {p.atribuicoes!.slice(0, 5).map(a => <span key={a} style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 999, background: 'var(--v2-amber-bg)', color: 'var(--v2-amber)' }}>{a}</span>)}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {[
                  { n: r.abertas, l: 'abertas' },
                  { n: r.atrasadas.length, l: 'atrasadas', hot: r.atrasadas.length > 0 },
                  { n: r.hoje.length, l: 'hoje' },
                  { n: fmtMinutos(r.minutos7d), l: '7 dias' },
                ].map(k => (
                  <div key={k.l} style={{ background: 'var(--v2-surface1)', border: '1px solid var(--v2-rule)', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 500, lineHeight: 1, color: k.hot ? 'var(--v2-hot)' : 'var(--v2-ink)', fontVariantNumeric: 'tabular-nums' }}>{k.n}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--v2-ink3)' }}>{k.l}</p>
                  </div>
                ))}
              </div>

              <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.clientes.length ? `Clientes: ${r.clientes.map(nomeCliente).filter(Boolean).slice(0, 4).join(', ')}${r.clientes.length > 4 ? ` +${r.clientes.length - 4}` : ''}` : 'Sem cliente atribuído'}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

'use client'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'
import AvatarPessoa from '@/app/components/AvatarPessoa'
import { TarefaModal } from '@/app/components/GestaoTarefas'
import { resumoDaPessoa, fmtMinutos, type TarefaPessoa } from '@/lib/hubPessoa'
import { toast, confirmar } from '@/lib/toast'

// CARD DO COLABORADOR: quem é (cargo, atribuições, responsabilidades), em quais
// clientes atua e TUDO o que está assinalado para a pessoa — tarefas por urgência
// com timer e "concluir" (o que o antigo "Meu dia" fazia), o que fechou e apontou
// nos últimos 7 dias. Admin edita atribuições/responsabilidades/clientes aqui mesmo.

type Pessoa = { email: string; nome: string; cargo?: string; foto?: string; role?: string; telefone?: string; bio?: string; atribuicoes: string[]; responsabilidades: string[]; clientesResponsavel: string[] }
const PAPEL: Record<string, string> = { admin: 'Admin', gerente: 'Gestão', usuario: 'Equipe', vendas: 'Comercial' }
const PRIO_COR: Record<string, string> = { urgente: 'var(--v2-hot)', alta: '#ea580c', media: 'var(--v2-amber)', baixa: 'var(--v2-ink3)' }

function fmtRelogio(ms: number) { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60; return `${h}:${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}` }
function fmtDia(iso?: string) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '' }

function Cartao({ titulo, acao, onAcao, children, destaque }: { titulo: string; acao?: string; onAcao?: () => void; children: React.ReactNode; destaque?: boolean }) {
  return (
    <section style={{ background: 'var(--v2-surface)', border: `1px solid ${destaque ? 'var(--v2-amber-on)' : 'var(--v2-rule)'}`, borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>{titulo}</h3>
        {acao && <button onClick={onAcao} style={{ background: 'none', border: 0, padding: 0, color: 'var(--v2-amber)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>{acao}</button>}
      </header>
      {children}
    </section>
  )
}
function Numero({ n, rotulo, tom }: { n: number | string; rotulo: string; tom?: 'hot' | 'ok' | 'amber' }) {
  const cor = tom === 'hot' ? 'var(--v2-hot)' : tom === 'ok' ? 'var(--v2-ok)' : tom === 'amber' ? 'var(--v2-amber)' : 'var(--v2-ink)'
  return (
    <div style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 14, padding: '14px 16px' }}>
      <p style={{ margin: 0, fontSize: 30, fontWeight: 500, lineHeight: 1, color: cor, fontVariantNumeric: 'tabular-nums' }}>{n}</p>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>{rotulo}</p>
    </div>
  )
}
function Vazio({ texto }: { texto: string }) { return <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)' }}>{texto}</p> }

export default function CardPessoa() {
  const params = useParams() as { email: string }
  const router = useRouter()
  const { data: session, status } = useSession()
  const role = (session?.user as any)?.role
  const meuEmail = String((session?.user as any)?.email || '').toLowerCase()
  const ehAdmin = role === 'admin'
  const seg = decodeURIComponent(params.email || '').toLowerCase()
  const email = seg === 'me' ? meuEmail : seg
  const ehMeu = email === meuEmail

  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [tarefas, setTarefas] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [carregado, setCarregado] = useState(false)
  const [erro, setErro] = useState('')
  const [tarefaAberta, setTarefaAberta] = useState<any | null>(null)
  const [, setTick] = useState(0)

  // Quem não é admin só vê o próprio card.
  useEffect(() => {
    if (status !== 'authenticated' || !email) return
    if (!ehAdmin && !ehMeu) { router.replace('/equipe/me'); return }
    if (seg === 'me') { router.replace(`/equipe/${encodeURIComponent(meuEmail)}`); return }
  }, [status, email, ehAdmin, ehMeu, seg, meuEmail, router])

  function carregarTarefas() { fetch('/api/tarefas').then(r => r.ok ? r.json() : []).then(d => setTarefas(Array.isArray(d) ? d : [])).catch(() => {}) }
  useEffect(() => {
    if (status !== 'authenticated' || !email || seg === 'me' || (!ehAdmin && !ehMeu)) return
    const j = (u: string) => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null)
    Promise.all([j(`/api/equipe?email=${encodeURIComponent(email)}`), j('/api/tarefas'), j('/api/clientes'), j('/api/equipe')]).then(([p, t, c, u]) => {
      if (!p || p.error) setErro('Colaborador não encontrado.')
      setPessoa(p && !p.error ? p : null)
      setTarefas(Array.isArray(t) ? t : [])
      setClientes(Array.isArray(c) ? c : [])
      setUsuarios(Array.isArray(u) ? u : [])
      setCarregado(true)
    })
  }, [status, email, seg, ehAdmin, ehMeu])
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t) }, [])

  const r = useMemo(() => resumoDaPessoa({ email, tarefas, clientesResponsavel: pessoa?.clientesResponsavel }), [email, tarefas, pessoa])
  const nomeCliente = (id: string) => clientes.find(c => c.id === id)?.nome || ''

  // ---- edição (admin)
  const [editando, setEditando] = useState(false)
  const [fCargo, setFCargo] = useState('')
  const [fAtrib, setFAtrib] = useState('')
  const [fResp, setFResp] = useState('')
  const [fClientes, setFClientes] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  function abrirEdicao() {
    if (!pessoa) return
    setFCargo(pessoa.cargo || ''); setFAtrib(pessoa.atribuicoes.join(', ')); setFResp(pessoa.responsabilidades.join('\n')); setFClientes(pessoa.clientesResponsavel || [])
    setEditando(true)
  }
  async function salvar() {
    if (!pessoa) return
    setSalvando(true)
    const body = { email: pessoa.email, cargo: fCargo, atribuicoes: fAtrib.split(/[,\n;]/).map(s => s.trim()).filter(Boolean), responsabilidades: fResp.split('\n').map(s => s.trim()).filter(Boolean), clientesResponsavel: fClientes }
    const ok = await fetch('/api/equipe', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.ok).catch(() => false)
    setSalvando(false)
    if (!ok) { toast('Não foi possível salvar.', 'erro'); return }
    setPessoa({ ...pessoa, cargo: body.cargo, atribuicoes: body.atribuicoes, responsabilidades: body.responsabilidades, clientesResponsavel: body.clientesResponsavel })
    setEditando(false)
    toast('Card atualizado.', 'sucesso')
  }

  // ---- ações nas tarefas (timer + concluir), como no antigo Meu dia
  async function timer(t: TarefaPessoa) {
    const key = `apont:${t.id}`
    const ini = localStorage.getItem(key)
    if (ini) {
      const min = Math.max(1, Math.round((Date.now() - Number(ini)) / 60000))
      localStorage.removeItem(key)
      await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, apontarHoras: { minutos: min, descricao: 'Timer (card)', data: new Date().toISOString() } }) }).catch(() => {})
      carregarTarefas()
    } else { localStorage.setItem(key, String(Date.now())); setTick(x => x + 1) }
  }
  async function concluir(t: TarefaPessoa) {
    await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, status: 'concluido' }) }).catch(() => {})
    carregarTarefas()
  }

  function Linha({ t }: { t: TarefaPessoa }) {
    const ini = typeof window !== 'undefined' ? localStorage.getItem(`apont:${t.id}`) : null
    const rodando = !!ini
    const total = (t.apontamentos || []).reduce((s, a) => s + (Number(a.minutos) || 0), 0)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--v2-rule)' }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: PRIO_COR[t.prioridade || ''] || 'var(--v2-rule2)', flexShrink: 0 }} title={t.prioridade} />
        <div onClick={() => setTarefaAberta(tarefas.find(x => x.id === t.id) || t)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} title="Abrir tarefa">
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--v2-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.titulo}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>{t.clienteNome || 'Interno'}{t.prazo ? ` · prazo ${fmtDia(t.prazo)}` : ''}{total > 0 ? ` · ${fmtMinutos(total)} apontado` : ''}</p>
        </div>
        {(ehMeu || ehAdmin) && (
          <>
            <button onClick={() => timer(t)} title={rodando ? 'Parar timer' : 'Iniciar timer'} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: rodando ? 'var(--v2-hot)' : 'var(--v2-surface2)', color: rodando ? '#fff' : 'var(--v2-ink)', border: 0, borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}>
              {rodando ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> {fmtRelogio(Date.now() - Number(ini))}</> : <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> Timer</>}
            </button>
            <button onClick={() => concluir(t)} title="Concluir" style={{ flexShrink: 0, padding: '6px 10px', background: 'var(--v2-ok-bg)', color: 'var(--v2-ok)', border: 0, borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Concluir</button>
          </>
        )}
      </div>
    )
  }
  function Grupo({ titulo, itens, tom }: { titulo: string; itens: TarefaPessoa[]; tom?: 'hot' | 'amber' }) {
    if (!itens.length) return null
    return (
      <div>
        <p style={{ margin: '4px 0 2px', fontSize: 12, fontWeight: 500, color: tom === 'hot' ? 'var(--v2-hot)' : tom === 'amber' ? 'var(--v2-amber)' : 'var(--v2-ink3)' }}>{titulo} · {itens.length}</p>
        {itens.map(t => <Linha key={t.id} t={t} />)}
      </div>
    )
  }

  if (status === 'loading' || !email) return <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Carregando…</p>
  if (erro) return <p style={{ color: 'var(--v2-hot)', fontSize: 13 }}>{erro}</p>
  if (!carregado || !pessoa) return <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Carregando…</p>

  const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink)', fontSize: 13.5 }
  const rotulo: React.CSSProperties = { fontSize: 10.5, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1240 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <AvatarPessoa p={pessoa} tam={64} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>{pessoa.cargo || PAPEL[pessoa.role || ''] || 'Equipe'}{pessoa.cargo && pessoa.role ? ` · ${PAPEL[pessoa.role] || pessoa.role}` : ''}</p>
            <h1 style={{ margin: '4px 0 0', fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.1 }}>{pessoa.nome}{ehMeu ? <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--v2-ink3)', marginLeft: 10 }}>você</span> : ''}</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--v2-ink3)' }}>{pessoa.email}{pessoa.telefone ? ` · ${pessoa.telefone}` : ''}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => router.push(`/equipe/${encodeURIComponent(pessoa.email)}/tarefas`)} style={{ padding: '11px 18px', background: 'var(--v2-amber-on)', color: '#17150E', border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Quadro de tarefas</button>
          {ehAdmin && !editando && <button onClick={abrirEdicao} style={{ padding: '11px 16px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 12, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>Editar card</button>}
        </div>
      </div>

      {/* Números */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Numero n={r.atrasadas.length} rotulo="atrasadas" tom={r.atrasadas.length ? 'hot' : undefined} />
        <Numero n={r.hoje.length} rotulo="para hoje" tom={r.hoje.length ? 'amber' : undefined} />
        <Numero n={r.abertas} rotulo="tarefas abertas" />
        <Numero n={r.concluidas7d.length} rotulo="concluídas em 7 dias" tom="ok" />
        <Numero n={fmtMinutos(r.minutos7d)} rotulo="apontadas em 7 dias" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        {/* Quem é */}
        <Cartao titulo="Atribuições e responsabilidades" acao={ehAdmin && !editando ? 'Editar' : undefined} onAcao={abrirEdicao}>
          {editando ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={rotulo}>Cargo</label>
              <input value={fCargo} onChange={e => setFCargo(e.target.value)} placeholder="Ex.: Designer" style={campo} />
              <label style={rotulo}>Atribuições (separe por vírgula)</label>
              <input value={fAtrib} onChange={e => setFAtrib(e.target.value)} placeholder="Ex.: Design, Criativos, Reels" style={campo} />
              <label style={rotulo}>Responsabilidades (uma por linha)</label>
              <textarea value={fResp} onChange={e => setFResp(e.target.value)} rows={5} placeholder={'Entregar os criativos do mês até o dia 25\nRevisar as artes antes de ir ao cliente'} style={{ ...campo, resize: 'vertical', lineHeight: 1.5 }} />
              <label style={rotulo}>Clientes sob responsabilidade</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {clientes.filter(c => !c.arquivado).map(c => {
                  const on = fClientes.includes(c.id)
                  return <button key={c.id} type="button" onClick={() => setFClientes(l => on ? l.filter(x => x !== c.id) : [...l, c.id])} style={{ fontSize: 12, padding: '5px 11px', borderRadius: 999, border: `1px solid ${on ? 'var(--v2-amber-on)' : 'var(--v2-rule)'}`, background: on ? 'var(--v2-amber-bg)' : 'var(--v2-surface)', color: on ? 'var(--v2-amber)' : 'var(--v2-ink2)', cursor: 'pointer' }}>{c.nome}</button>
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={salvar} disabled={salvando} style={{ padding: '9px 16px', background: 'var(--v2-amber-on)', color: '#17150E', border: 0, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: salvando ? 'wait' : 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
                <button onClick={() => setEditando(false)} style={{ padding: '9px 14px', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', border: '1px solid var(--v2-rule)', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              {pessoa.atribuicoes.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {pessoa.atribuicoes.map(a => <span key={a} style={{ fontSize: 12.5, padding: '4px 11px', borderRadius: 999, background: 'var(--v2-amber-bg)', color: 'var(--v2-amber)' }}>{a}</span>)}
                </div>
              ) : <Vazio texto={ehAdmin ? 'Sem atribuições. Clique em Editar para definir.' : 'Atribuições ainda não definidas.'} />}
              {pessoa.responsabilidades.length > 0 && (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pessoa.responsabilidades.map((x, i) => <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13.5, lineHeight: 1.45 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--v2-amber-on)', marginTop: 7, flexShrink: 0 }} /><span>{x}</span></li>)}
                </ul>
              )}
              {pessoa.bio && <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink2)', lineHeight: 1.5 }}>{pessoa.bio}</p>}
            </>
          )}
        </Cartao>

        {/* Clientes */}
        <Cartao titulo="Clientes em que atua">
          {r.clientes.length === 0 ? <Vazio texto="Nenhum cliente atribuído." /> : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {r.clientes.map(id => {
                const nome = nomeCliente(id); if (!nome) return null
                const ab = r.porCliente.find(c => c.clienteId === id)?.abertas || 0
                const explicito = (pessoa.clientesResponsavel || []).includes(id)
                return (
                  <div key={id} onClick={() => router.push(`/cliente/${id}`)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--v2-rule)', cursor: 'pointer' }}>
                    <span style={{ flex: 1, fontSize: 13.5 }}>{nome}</span>
                    {explicito && <span style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--v2-amber)' }}>responsável</span>}
                    <span style={{ fontSize: 12, color: 'var(--v2-ink3)', fontVariantNumeric: 'tabular-nums' }}>{ab ? `${ab} aberta${ab > 1 ? 's' : ''}` : ''}</span>
                  </div>
                )
              })}
              {r.porCliente.some(c => !c.clienteId) && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--v2-ink3)' }}>+ {r.porCliente.find(c => !c.clienteId)!.abertas} tarefa(s) interna(s), sem cliente</p>}
            </div>
          )}
        </Cartao>

        {/* Tarefas */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Cartao titulo="Assinalado para esta pessoa" acao="Abrir quadro" onAcao={() => router.push(`/equipe/${encodeURIComponent(pessoa.email)}/tarefas`)} destaque={r.atrasadas.length > 0}>
            {r.abertas === 0 ? <Vazio texto="Nada pendente. Tudo em dia." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Grupo titulo="Atrasadas" itens={r.atrasadas} tom="hot" />
                <Grupo titulo="Para hoje" itens={r.hoje} tom="amber" />
                <Grupo titulo="Esta semana" itens={r.semana} />
                <Grupo titulo="Depois" itens={r.depois} />
                <Grupo titulo="Sem prazo" itens={r.semPrazo} />
              </div>
            )}
          </Cartao>
        </div>

        <Cartao titulo="Concluídas nos últimos 7 dias">
          {r.concluidas7d.length === 0 ? <Vazio texto="Nenhuma tarefa concluída nos últimos 7 dias." /> : r.concluidas7d.slice(0, 8).map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--v2-rule)' }}>
              <span style={{ flex: 1, fontSize: 13.5, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.titulo}<span style={{ color: 'var(--v2-ink3)' }}> · {t.clienteNome || 'Interno'}</span></span>
              <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>{fmtDia(t.concluidoEm || t.atualizadoEm)}</span>
            </div>
          ))}
        </Cartao>

        <Cartao titulo="Carga por cliente">
          {r.porCliente.length === 0 ? <Vazio texto="Sem tarefas abertas." /> : r.porCliente.map(c => (
            <div key={c.clienteId || 'interno'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <span style={{ flex: 1, fontSize: 13.5 }}>{c.clienteNome}</span>
              <div style={{ width: 120, height: 6, borderRadius: 999, background: 'var(--v2-surface2)', overflow: 'hidden' }}><div style={{ width: `${Math.round((c.abertas / Math.max(1, r.abertas)) * 100)}%`, height: '100%', background: 'var(--v2-amber-on)' }} /></div>
              <span style={{ width: 24, textAlign: 'right', fontSize: 12.5, color: 'var(--v2-ink3)', fontVariantNumeric: 'tabular-nums' }}>{c.abertas}</span>
            </div>
          ))}
        </Cartao>
      </div>

      {tarefaAberta && (
        <TarefaModal
          key={tarefaAberta.id}
          tarefa={tarefaAberta}
          clientes={clientes}
          usuarios={usuarios}
          onClose={() => setTarefaAberta(null)}
          onSalvo={() => { setTarefaAberta(null); carregarTarefas() }}
          onRecarregar={(t: any) => { setTarefaAberta(t); carregarTarefas() }}
          onExcluir={ehAdmin ? async () => { if (await confirmar('Excluir esta tarefa?', { titulo: 'Excluir tarefa', okLabel: 'Excluir', perigo: true })) { await fetch(`/api/tarefas?id=${tarefaAberta.id}`, { method: 'DELETE' }); setTarefaAberta(null); carregarTarefas() } } : undefined}
        />
      )}
    </div>
  )
}

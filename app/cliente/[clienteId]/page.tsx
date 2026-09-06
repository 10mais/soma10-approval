'use client'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'
import { resumoDoCliente, type ResumoCliente } from '@/lib/hubCliente'
import { fraseDaBola, type BolaDaVez } from '@/lib/bolaDaVez'

// INÍCIO DO HUB: tudo o que está atribuído ao cliente, numa tela — bola da vez,
// aprovações paradas, próximas publicações, tarefas abertas, pautas do mês,
// etapas do Playbook — e o botão de criar o relatório da semana.

const ETAPA_LABEL: Record<string, string> = { briefing: 'Briefing', copy: 'Copy', aprovacao_copy: 'Copy em aprovação', criativo: 'Criativo', aprovacao_criativo: 'Criativo em aprovação', pronto: 'Prontas', sem_etapa: 'Sem etapa' }
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function fmtDia(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function diasDesde(iso?: string) { if (!iso) return null; return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) }

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

function Linha({ titulo, detalhe, direita, onClick }: { titulo: string; detalhe?: string; direita?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--v2-rule)', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--v2-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</p>
        {detalhe && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>{detalhe}</p>}
      </div>
      {direita && <span style={{ fontSize: 12, color: 'var(--v2-ink3)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{direita}</span>}
    </div>
  )
}

function Vazio({ texto }: { texto: string }) { return <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)' }}>{texto}</p> }

function Numero({ n, rotulo, tom }: { n: number; rotulo: string; tom?: 'hot' | 'ok' | 'amber' }) {
  const cor = tom === 'hot' ? 'var(--v2-hot)' : tom === 'ok' ? 'var(--v2-ok)' : tom === 'amber' ? 'var(--v2-amber)' : 'var(--v2-ink)'
  return (
    <div style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 14, padding: '14px 16px' }}>
      <p style={{ margin: 0, fontSize: 30, fontWeight: 500, lineHeight: 1, color: cor, fontVariantNumeric: 'tabular-nums' }}>{n}</p>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>{rotulo}</p>
    </div>
  )
}

export default function HubCliente() {
  const { clienteId } = useParams() as { clienteId: string }
  const router = useRouter()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const ehEquipe = role === 'admin' || role === 'gerente'
  const base = `/cliente/${clienteId}`

  const [cliente, setCliente] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [tarefas, setTarefas] = useState<any[]>([])
  const [marcos, setMarcos] = useState<any[]>([])
  const [planos, setPlanos] = useState<any[]>([])
  const [bola, setBola] = useState<BolaDaVez | null>(null)
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    const j = (u: string) => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null)
    Promise.all([
      j(`/api/clientes?id=${clienteId}`),
      j(`/api/posts?clienteId=${clienteId}`),
      ehEquipe ? j('/api/tarefas') : Promise.resolve([]),
      j(`/api/playbook?clienteId=${clienteId}`),
      j(`/api/planos?clienteId=${clienteId}`),
      j(`/api/playbook/bola?clienteId=${clienteId}`),
    ]).then(([c, p, t, m, pl, b]) => {
      setCliente(Array.isArray(c) ? c.find((x: any) => x.id === clienteId) : c)
      setPosts(Array.isArray(p) ? p : [])
      setTarefas(Array.isArray(t) ? t.filter((x: any) => x.clienteId === clienteId) : [])
      setMarcos(Array.isArray(m) ? m : [])
      setPlanos(Array.isArray(pl) ? pl : [])
      setBola(b && !b.error ? b : null)
      setCarregado(true)
    })
  }, [clienteId, ehEquipe])

  const r: ResumoCliente = useMemo(() => resumoDoCliente({ posts, tarefas, marcos, planos }), [posts, tarefas, marcos, planos])
  const hoje = new Date()

  if (!carregado) return <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Carregando…</p>
  if (!cliente) return <p style={{ color: 'var(--v2-hot)', fontSize: 13 }}>Cliente não encontrado.</p>

  // Papel cliente: visão simples de antes (o hub é ferramenta da equipe).
  if (!ehEquipe) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500 }}>Bem-vindo, {cliente.nome}</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <Numero n={r.posts.publicadosMes} rotulo="publicações neste mês" tom="ok" />
          <Numero n={r.posts.aguardandoCliente} rotulo="aguardando a sua aprovação" tom={r.posts.aguardandoCliente ? 'hot' : undefined} />
          <Numero n={posts.length} rotulo="conteúdos no total" />
        </div>
      </div>
    )
  }

  const bolaTom = bola?.lado === 'cliente' ? 'hot' : bola?.lado === 'agencia' ? 'amber' : 'ok'
  const bolaCor = bolaTom === 'hot' ? 'var(--v2-hot)' : bolaTom === 'amber' ? 'var(--v2-amber)' : 'var(--v2-ok)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1240 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>{cliente.segmento || (cliente.tipo === 'interno' ? 'Projeto interno' : 'Cliente')}</p>
          <h1 style={{ margin: '4px 0 0', fontSize: 'clamp(26px, 3vw, 34px)', fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.1 }}>{cliente.nome}</h1>
          {bola && (
            <p style={{ margin: '10px 0 0', fontSize: 14, color: bolaCor, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: bolaCor, display: 'inline-block' }} />
              {fraseDaBola(bola, false)}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => router.push(`${base}/relatorio`)} style={{ padding: '11px 18px', background: 'var(--v2-amber-on)', color: '#17150E', border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Criar relatório da semana</button>
          <button onClick={() => router.push(`${base}/playbook`)} style={{ padding: '11px 16px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 12, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>Abrir Playbook</button>
        </div>
      </div>

      {/* Números */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Numero n={r.posts.aguardandoCliente} rotulo="aguardando o cliente" tom={r.posts.aguardandoCliente ? 'hot' : undefined} />
        <Numero n={r.posts.emProducao} rotulo="em produção" tom="amber" />
        <Numero n={r.posts.prontos} rotulo="prontas para publicar" />
        <Numero n={r.posts.publicadosMes} rotulo={`publicadas em ${MESES[hoje.getMonth()]}`} tom="ok" />
        <Numero n={r.tarefas.abertas} rotulo={r.tarefas.atrasadas ? `tarefas abertas · ${r.tarefas.atrasadas} atrasada${r.tarefas.atrasadas > 1 ? 's' : ''}` : 'tarefas abertas'} tom={r.tarefas.atrasadas ? 'hot' : undefined} />
      </div>

      {/* Painéis */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Cartao titulo="Aguardando aprovação" acao="Aprovações" onAcao={() => router.push(`${base}/aprovacoes`)} destaque={r.posts.aguardandoCliente > 0}>
          {r.posts.aguardando.length === 0 ? <Vazio texto="Nada parado com o cliente." /> : r.posts.aguardando.slice(0, 5).map(i => {
            const d = diasDesde(i.quando)
            return <Linha key={i.id} titulo={i.titulo} detalhe={i.detalhe} direita={d === null ? '' : d === 0 ? 'hoje' : `${d} dia${d > 1 ? 's' : ''}`} onClick={() => router.push(`${base}/aprovacoes`)} />
          })}
        </Cartao>

        <Cartao titulo="Próximas publicações" acao="Planner" onAcao={() => router.push(`${base}/planner`)}>
          {r.posts.proximasPublicacoes.length === 0 ? <Vazio texto="Nada programado para os próximos 7 dias." /> : r.posts.proximasPublicacoes.slice(0, 6).map(i => (
            <Linha key={i.id} titulo={i.titulo} detalhe={i.detalhe} direita={fmtDia(i.quando)} onClick={() => router.push(`${base}/planner`)} />
          ))}
        </Cartao>

        <Cartao titulo="Tarefas abertas" acao="Tarefas" onAcao={() => router.push(`${base}/tarefas`)} destaque={r.tarefas.atrasadas > 0}>
          {r.tarefas.lista.length === 0 ? <Vazio texto="Nenhuma tarefa aberta para este cliente." /> : r.tarefas.lista.slice(0, 6).map(i => (
            <Linha key={i.id} titulo={i.titulo} detalhe={i.detalhe} direita={i.quando ? new Date(i.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'sem prazo'} onClick={() => router.push(`${base}/tarefas?abrir=${i.id}`)} />
          ))}
        </Cartao>

        <Cartao titulo={`Pautas de ${MESES[hoje.getMonth()]}`} acao="Studio" onAcao={() => router.push(`${base}/studio`)}>
          {!r.studio.planoDoMes ? <Vazio texto="Ainda não há plano do mês. Crie no Studio." /> : (
            <>
              <p style={{ margin: 0, fontSize: 13.5 }}>{r.studio.pautasDoMes} pauta{r.studio.pautasDoMes === 1 ? '' : 's'}{r.studio.planoDoMes.titulo ? ` · ${r.studio.planoDoMes.titulo}` : ''}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(r.studio.porEtapa).map(([e, n]) => (
                  <span key={e} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: e === 'pronto' ? 'var(--v2-ok-bg)' : e.startsWith('aprovacao') ? 'var(--v2-hot-bg)' : 'var(--v2-surface2)', color: e === 'pronto' ? 'var(--v2-ok)' : e.startsWith('aprovacao') ? 'var(--v2-hot)' : 'var(--v2-ink2)' }}>{n} · {ETAPA_LABEL[e] || e}</span>
                ))}
              </div>
            </>
          )}
        </Cartao>

        <Cartao titulo="Playbook" acao="Ver etapas" onAcao={() => router.push(`${base}/playbook`)}>
          {r.playbook.total === 0 ? <Vazio texto="Sem etapas cadastradas." /> : (
            <>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--v2-surface2)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.round((r.playbook.concluidas / r.playbook.total) * 100)}%`, height: '100%', background: 'var(--v2-amber-on)' }} />
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>{r.playbook.concluidas} de {r.playbook.total} etapas concluídas{r.playbook.atrasadas ? ` · ${r.playbook.atrasadas} atrasada${r.playbook.atrasadas > 1 ? 's' : ''}` : ''}</p>
              {r.playbook.emAndamento.slice(0, 4).map(m => <Linha key={m.id} titulo={m.titulo} detalhe={m.categoria} direita={m.dataFim ? `até ${new Date(m.dataFim).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''} onClick={() => router.push(`${base}/playbook`)} />)}
            </>
          )}
        </Cartao>

        <Cartao titulo="Sobre o projeto" acao="Marca" onAcao={() => router.push(`${base}/marca`)}>
          {cliente.descricao || cliente.publicoAlvo || cliente.entregaveis?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--v2-ink2)', lineHeight: 1.5 }}>
              {cliente.descricao && <p style={{ margin: 0 }}>{cliente.descricao}</p>}
              {cliente.publicoAlvo && <p style={{ margin: 0 }}><span style={{ color: 'var(--v2-ink3)' }}>Público: </span>{cliente.publicoAlvo}</p>}
              {cliente.entregaveis?.length > 0 && <p style={{ margin: 0 }}><span style={{ color: 'var(--v2-ink3)' }}>Entregáveis: </span>{cliente.entregaveis.join(', ').replace(/_/g, ' ')}</p>}
              {cliente.postsMensais > 0 && <p style={{ margin: 0 }}><span style={{ color: 'var(--v2-ink3)' }}>Contrato: </span>{cliente.postsMensais} posts/mês</p>}
            </div>
          ) : <Vazio texto="Sem descrição. Preencha em Configurações → Clientes." />}
        </Cartao>
      </div>
    </div>
  )
}

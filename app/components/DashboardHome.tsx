'use client'
import { useEffect, useMemo, useState } from 'react'
import AvatarCliente from './AvatarCliente'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string; corSecundaria?: string; tipo?: string; entregaveis?: string[]; postsMensais?: number }
type Post = { id: string; clienteId: string; clienteNome: string; status: string; dataAgendada?: string; criadoEm: string; atualizadoEm?: string; etapa?: string; erroPublicacao?: string; imagens: string[] }
type Marco = { id: string; clienteId: string; clienteNome?: string; titulo: string; categoria?: string; status: string; dataInicio?: string; dataFim?: string }
type Tarefa = { id: string; titulo: string; status: string; prazo?: string; responsavelNome?: string; clienteNome?: string }

const META_MIN = 12
const META_BOA = 15
const META_EXC = 18

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function faixaStatus(qtd: number): { label: string; cor: string; bg: string } {
  if (qtd >= META_EXC) return { label: 'Destaque', cor: '#92400e', bg: '#fef3c7' }
  if (qtd >= META_BOA) return { label: 'Excelente', cor: '#166534', bg: '#dcfce7' }
  if (qtd >= META_MIN) return { label: 'Saudavel', cor: '#16a34a', bg: '#f0fdf4' }
  if (qtd >= 8) return { label: 'Atencao', cor: '#a16207', bg: '#fffbeb' }
  return { label: 'Critico', cor: '#b91c1c', bg: '#fef2f2' }
}

function barPct(qtd: number): number { return Math.min(100, Math.round((qtd / META_EXC) * 100)) }
function barCor(qtd: number): string {
  if (qtd >= META_EXC) return '#ffc00f'
  if (qtd >= META_BOA) return '#16a34a'
  if (qtd >= META_MIN) return '#22c55e'
  if (qtd >= 8) return '#f59e0b'
  return '#ef4444'
}

function temSocialMedia(c: Cliente): boolean {
  return (c.entregaveis || []).includes('social_media')
}

export default function DashboardHome({ clientes, posts, onVerCliente, onIr }: {
  clientes: Cliente[]
  posts: Post[]
  onVerCliente: (id: string) => void
  onIr?: (aba: string) => void
}) {
  const agora = new Date()
  const mesAtual = agora.getMonth()
  const anoAtual = agora.getFullYear()
  const [alertasAberto, setAlertasAberto] = useState(true)

  // Playbook (marcos) e Tarefas — buscados aqui (o Painel é client, ssr:false).
  const [marcos, setMarcos] = useState<Marco[]>([])
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  useEffect(() => {
    fetch('/api/playbook').then(r => r.json()).then(d => { if (Array.isArray(d)) setMarcos(d) }).catch(() => {})
    fetch('/api/tarefas').then(r => r.json()).then(d => { if (Array.isArray(d)) setTarefas(d) }).catch(() => {})
  }, [])

  const emDias = (iso?: string) => iso ? (new Date(iso).getTime() - agora.getTime()) / 86400000 : Infinity
  const dataCurta = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }

  // Ações da semana: tarefas e marcos vencendo em até 7 dias (inclui atrasados) + posts no cliente.
  const tarefasSemana = useMemo(() => tarefas
    .filter(t => t.status !== 'concluido' && t.prazo && emDias(t.prazo) <= 7)
    .sort((a, b) => new Date(a.prazo!).getTime() - new Date(b.prazo!).getTime())
    .slice(0, 8), [tarefas])
  const marcosSemana = useMemo(() => marcos
    .filter(m => m.status !== 'concluido' && m.status !== 'cancelado' && m.dataFim && emDias(m.dataFim) <= 7)
    .sort((a, b) => new Date(a.dataFim!).getTime() - new Date(b.dataFim!).getTime())
    .slice(0, 6), [marcos])
  const postsNoCliente = useMemo(() => posts.filter(p => p.status === 'aguardando_aprovacao'), [posts])
  const temSemana = tarefasSemana.length > 0 || marcosSemana.length > 0 || postsNoCliente.length > 0

  // Andamento do Playbook: progresso geral dos marcos ativos.
  const pbTotal = useMemo(() => marcos.filter(m => m.status !== 'cancelado').length, [marcos])
  const pbConcluidos = useMemo(() => marcos.filter(m => m.status === 'concluido').length, [marcos])
  const pbAtrasados = useMemo(() => marcos.filter(m => (m.status === 'atrasado') || (m.status !== 'concluido' && m.status !== 'cancelado' && m.dataFim && emDias(m.dataFim) < 0)).length, [marcos])
  const pbAndamento = useMemo(() => marcos.filter(m => m.status === 'em_andamento').slice(0, 5), [marcos])
  const pbPct = pbTotal ? Math.round((pbConcluidos / pbTotal) * 100) : 0

  // Atalhos rápidos para as abas principais.
  const atalhos: { aba: string; label: string }[] = [
    { aba: 'studio', label: 'Studio' }, { aba: 'tarefas', label: 'Tarefas' }, { aba: 'playbook', label: 'Playbook' },
    { aba: 'planner', label: 'Planner' }, { aba: 'crm', label: 'CRM' }, { aba: 'conversao', label: 'Conversão & Retenção' },
  ]

  // Apenas clientes externos com social media
  const clientesSM = useMemo(() => clientes.filter(c => c.tipo !== 'interno' && temSocialMedia(c)), [clientes])

  const postsMes = useMemo(() => posts.filter(p => {
    if (p.etapa && p.etapa !== 'pronto') return false
    const ehDoMes = (iso: string | undefined) => {
      if (!iso) return false
      const d = new Date(iso)
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual
    }
    if (p.status === 'publicado') return ehDoMes(p.atualizadoEm || p.criadoEm)
    if (p.status === 'agendado') return ehDoMes(p.dataAgendada)
    return false
  }), [posts, mesAtual, anoAtual])

  const contagemPorCliente = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const c of clientesSM) mapa[c.id] = 0
    for (const p of postsMes) { if (mapa[p.clienteId] !== undefined) mapa[p.clienteId]++ }
    return mapa
  }, [clientesSM, postsMes])

  const pautasEsteira = posts.filter(p => p.etapa && p.etapa !== 'pronto').length
  const falhasPendentes = posts.filter(p => p.status === 'falha_publicacao').length
  const clientesSemBrandLista = clientes.filter(c => c.tipo !== 'interno' && !(c as any).segmento && !(c as any).palavrasChave && !(c as any).descricao && !(c as any).documentoMarca)
  const clientesSemBrand = clientesSemBrandLista.length
  const clientesSemEntregaveis = clientes.filter(c => c.tipo !== 'interno' && !(c.entregaveis || []).length).length

  const clientesOrdenados = useMemo(() =>
    [...clientesSM].sort((a, b) => (contagemPorCliente[a.id] || 0) - (contagemPorCliente[b.id] || 0))
  , [clientesSM, contagemPorCliente])

  // Risco de atraso: meta do mês (postsMensais) ainda não coberta por publicado+agendado
  const clientesEmRisco = useMemo(() => agora.getDate() < 5 ? [] : clientesSM.filter(c => {
    const meta = Number(c.postsMensais) || META_MIN
    return (contagemPorCliente[c.id] || 0) < meta && (contagemPorCliente[c.id] || 0) >= 8
  }), [clientesSM, contagemPorCliente])
  const temAlertas = falhasPendentes > 0 || clientesSemBrand > 0 || clientesSemEntregaveis > 0 || clientesEmRisco.length > 0 || clientesOrdenados.some(c => (contagemPorCliente[c.id] || 0) < 8)

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, color: '#111' }}>Painel — {MESES[mesAtual]} {anoAtual}</h2>

      {/* Atalhos rápidos */}
      {onIr && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {atalhos.map(a => (
            <button key={a.aba} onClick={() => onIr(a.aba)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', color: '#333', border: '1px solid #ececec', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {a.label}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
            </button>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Clientes ativos', valor: clientes.filter(c => c.tipo !== 'interno').length, cor: '#111' },
          { label: 'Posts no mes', valor: postsMes.length, cor: '#16a34a' },
          { label: 'Pautas na esteira', valor: pautasEsteira, cor: '#1d4ed8' },
          { label: 'Falhas pendentes', valor: falhasPendentes, cor: falhasPendentes > 0 ? '#b91c1c' : '#16a34a' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#888' }}>{kpi.label}</p>
            <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, color: kpi.cor }}>{kpi.valor}</p>
          </div>
        ))}
      </div>

      {/* Ações da semana + Andamento do Playbook */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* Ações da semana */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#111' }}>Ações da semana</h3>
          {!temSemana && <p style={{ margin: 0, fontSize: 12.5, color: '#aaa' }}>Nada vencendo nos próximos 7 dias. Tudo em dia.</p>}
          {postsNoCliente.length > 0 && (
            <button onClick={() => onIr?.('planner')} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 6, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 9, cursor: onIr ? 'pointer' : 'default' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#92400e' }}>{postsNoCliente.length} post(s) aguardando aprovação do cliente</span>
            </button>
          )}
          {tarefasSemana.map(t => { const atras = emDias(t.prazo) < 0; return (
            <div key={t.id} onClick={() => onIr?.('tarefas')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid #f4f4f4', cursor: onIr ? 'pointer' : 'default' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: atras ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12.5, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}{t.clienteNome ? ` · ${t.clienteNome}` : ''}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: atras ? '#b91c1c' : '#a16207', flexShrink: 0 }}>{atras ? 'atrasada' : dataCurta(t.prazo)}</span>
            </div>
          ) })}
          {marcosSemana.map(m => { const atras = emDias(m.dataFim) < 0; return (
            <div key={m.id} onClick={() => onIr?.('playbook')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid #f4f4f4', cursor: onIr ? 'pointer' : 'default' }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#6d28d9', background: '#ede9fe', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>MARCO</span>
              <span style={{ flex: 1, fontSize: 12.5, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titulo}{m.clienteNome ? ` · ${m.clienteNome}` : ''}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: atras ? '#b91c1c' : '#a16207', flexShrink: 0 }}>{atras ? 'atrasado' : dataCurta(m.dataFim)}</span>
            </div>
          ) })}
        </div>

        {/* Andamento do Playbook */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#111' }}>Andamento do Playbook</h3>
            {onIr && <button onClick={() => onIr('playbook')} style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Abrir</button>}
          </div>
          {pbTotal === 0 && <p style={{ margin: 0, fontSize: 12.5, color: '#aaa' }}>Nenhum marco cadastrado ainda.</p>}
          {pbTotal > 0 && <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#111' }}>{pbPct}%</span>
              <span style={{ fontSize: 12, color: '#888' }}>{pbConcluidos} de {pbTotal} marcos concluídos{pbAtrasados > 0 ? ` · ${pbAtrasados} atrasado(s)` : ''}</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: '#f0f0f0', overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ height: '100%', width: `${pbPct}%`, background: '#16a34a', borderRadius: 999, transition: 'width .3s' }} />
            </div>
            {pbAndamento.length > 0 && <>
              <p style={{ margin: '0 0 6px', fontSize: 10.5, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Em andamento</p>
              {pbAndamento.map(m => (
                <div key={m.id} onClick={() => m.clienteId ? onVerCliente(m.clienteId) : onIr?.('playbook')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid #f4f4f4', cursor: 'pointer' }}>
                  <span style={{ flex: 1, fontSize: 12.5, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titulo}</span>
                  <span style={{ fontSize: 11, color: '#999', flexShrink: 0 }}>{m.clienteNome || ''}</span>
                </div>
              ))}
            </>}
          </>}
        </div>
      </div>

      {/* Grafico de metas — TOPO */}
      {clientesOrdenados.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#111' }}>Meta de postagens — {MESES[mesAtual]}</h3>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#888' }}>
              <span>Min: {META_MIN}</span><span>|</span><span>Bom: {META_BOA}</span><span>|</span><span>Exc: {META_EXC}+</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clientesOrdenados.map(c => {
              const qtd = contagemPorCliente[c.id] || 0
              const fx = faixaStatus(qtd)
              return (
                <div key={c.id} onClick={() => onVerCliente(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', background: c.corPrimaria || '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, color: c.corSecundaria || '#111', flexShrink: 0 }}>
                    <AvatarCliente logo={c.logo} nome={c.nome} />
                  </div>
                  <span style={{ width: 110, fontSize: 12, fontWeight: 600, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{c.nome}</span>
                  <div style={{ flex: 1, position: 'relative', height: 18, borderRadius: 999, background: '#f0f0f0', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${barPct(qtd)}%`, background: barCor(qtd), borderRadius: 999, transition: 'width .3s' }} />
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(META_MIN / META_EXC) * 100}%`, width: 1.5, background: 'rgba(0,0,0,0.15)' }} />
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(META_BOA / META_EXC) * 100}%`, width: 1.5, background: 'rgba(0,0,0,0.12)' }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: fx.cor, width: 28, textAlign: 'right', flexShrink: 0 }}>{qtd}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: fx.cor, background: fx.bg, borderRadius: 999, padding: '2px 8px', flexShrink: 0, minWidth: 60, textAlign: 'center' }}>{fx.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Alertas — colapsivel */}
      {temAlertas && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, marginBottom: 20, overflow: 'hidden' }}>
          <button onClick={() => setAlertasAberto(v => !v)} style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#991b1b' }}>Precisa de atencao</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#991b1b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: alertasAberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {alertasAberto && (
            <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {falhasPendentes > 0 && <p style={{ margin: 0, fontSize: 12.5, color: '#b91c1c' }}>{falhasPendentes} post(s) com falha de publicacao pendente.</p>}
              {clientesOrdenados.filter(c => (contagemPorCliente[c.id] || 0) < 8).map(c => (
                <p key={c.id} style={{ margin: 0, fontSize: 12.5, color: '#b91c1c' }}><strong>{c.nome}</strong> esta em nivel critico ({contagemPorCliente[c.id] || 0} posts no mes).</p>
              ))}
              {clientesEmRisco.map(c => { const meta = Number(c.postsMensais) || META_MIN; return (
                <p key={'r' + c.id} style={{ margin: 0, fontSize: 12.5, color: '#a16207' }}>⚠ <strong>{c.nome}</strong> abaixo da meta do mês: {contagemPorCliente[c.id] || 0} de {meta} (publicado + agendado). Faltam {meta - (contagemPorCliente[c.id] || 0)} a planejar.</p>
              ) })}
              {clientesSemBrand > 0 && <p style={{ margin: 0, fontSize: 12.5, color: '#92400e' }}>{clientesSemBrand} cliente(s) sem Brand Board preenchido: {clientesSemBrandLista.map(c => c.nome).join(', ')}.</p>}
              {clientesSemEntregaveis > 0 && <p style={{ margin: 0, fontSize: 12.5, color: '#92400e' }}>{clientesSemEntregaveis} cliente(s) sem entregaveis definidos (configure em Clientes).</p>}
            </div>
          )}
        </div>
      )}

    </div>
  )
}

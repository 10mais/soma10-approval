'use client'
import { useMemo } from 'react'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string; corSecundaria?: string; segmento?: string; metaConectado?: boolean; instagramConectado?: boolean }
type Post = { id: string; clienteId: string; clienteNome: string; status: string; dataAgendada?: string; criadoEm: string; atualizadoEm?: string; etapa?: string; erroPublicacao?: string; imagens: string[] }

const META_MIN = 12
const META_BOA = 15
const META_EXC = 18

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function faixaStatus(qtd: number): { label: string; cor: string; bg: string } {
  if (qtd >= META_EXC) return { label: 'Destaque', cor: '#92400e', bg: '#fef3c7' }
  if (qtd >= META_BOA) return { label: 'Excelente', cor: '#166534', bg: '#dcfce7' }
  if (qtd >= META_MIN) return { label: 'Saudavel', cor: '#16a34a', bg: '#f0fdf4' }
  if (qtd >= 8) return { label: 'Atencao', cor: '#a16207', bg: '#fffbeb' }
  return { label: 'Critico', cor: '#b91c1c', bg: '#fef2f2' }
}

function barPct(qtd: number): number {
  return Math.min(100, Math.round((qtd / META_EXC) * 100))
}

function barCor(qtd: number): string {
  if (qtd >= META_EXC) return '#ffc00f'
  if (qtd >= META_BOA) return '#16a34a'
  if (qtd >= META_MIN) return '#22c55e'
  if (qtd >= 8) return '#f59e0b'
  return '#ef4444'
}

export default function DashboardHome({ clientes, posts, onVerCliente }: {
  clientes: Cliente[]
  posts: Post[]
  onVerCliente: (id: string) => void
}) {
  const agora = new Date()
  const mesAtual = agora.getMonth()
  const anoAtual = agora.getFullYear()

  // Posts do mes atual (publicados + agendados), excluindo pautas da esteira que nao chegaram a "pronto"
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

  // Contagem por cliente
  const contagemPorCliente = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const c of clientes) mapa[c.id] = 0
    for (const p of postsMes) mapa[p.clienteId] = (mapa[p.clienteId] || 0) + 1
    return mapa
  }, [clientes, postsMes])

  // Pautas na esteira (todas as etapas exceto pronto)
  const pautasEsteira = posts.filter(p => p.etapa && p.etapa !== 'pronto').length
  const falhasPendentes = posts.filter(p => p.status === 'falha_publicacao').length
  const clientesSemBrand = clientes.filter(c => !(c as any).segmento && !(c as any).palavrasChave).length

  // Ordenar clientes: criticos primeiro, depois por quantidade crescente
  const clientesOrdenados = useMemo(() =>
    [...clientes].sort((a, b) => (contagemPorCliente[a.id] || 0) - (contagemPorCliente[b.id] || 0))
  , [clientes, contagemPorCliente])

  // Mini-calendario
  const primeiroDia = new Date(anoAtual, mesAtual, 1).getDay()
  const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate()
  const celulas: (number | null)[] = []
  for (let i = 0; i < primeiroDia; i++) celulas.push(null)
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d)
  while (celulas.length % 7 !== 0) celulas.push(null)

  const postsPorDia = useMemo(() => {
    const mapa: Record<number, Post[]> = {}
    for (const p of postsMes) {
      const iso = p.status === 'agendado' ? p.dataAgendada : (p.atualizadoEm || p.criadoEm)
      if (!iso) continue
      const d = new Date(iso)
      if (d.getMonth() === mesAtual && d.getFullYear() === anoAtual) {
        const dia = d.getDate()
        if (!mapa[dia]) mapa[dia] = []
        mapa[dia].push(p)
      }
    }
    return mapa
  }, [postsMes, mesAtual, anoAtual])

  const hoje = agora.getDate()

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 20, color: '#111' }}>Painel — {MESES[mesAtual]} {anoAtual}</h2>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Clientes ativos', valor: clientes.length, cor: '#111' },
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

      {/* Alertas */}
      {(falhasPendentes > 0 || clientesSemBrand > 0 || clientesOrdenados.some(c => (contagemPorCliente[c.id] || 0) < 8)) && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '14px 18px', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#991b1b' }}>Precisa de atencao</p>
          {falhasPendentes > 0 && <p style={{ margin: 0, fontSize: 12.5, color: '#b91c1c' }}>{falhasPendentes} post(s) com falha de publicacao pendente.</p>}
          {clientesOrdenados.filter(c => (contagemPorCliente[c.id] || 0) < 8).map(c => (
            <p key={c.id} style={{ margin: 0, fontSize: 12.5, color: '#b91c1c' }}><strong>{c.nome}</strong> esta em nivel critico ({contagemPorCliente[c.id] || 0} posts no mes).</p>
          ))}
          {clientesSemBrand > 0 && <p style={{ margin: 0, fontSize: 12.5, color: '#92400e' }}>{clientesSemBrand} cliente(s) sem Brand Board preenchido.</p>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(280px, 1fr)', gap: 20, alignItems: 'start' }}>
        {/* Saude dos clientes + Grafico de metas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Grid de saude */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, color: '#111' }}>Saude dos clientes</h3>
              <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#888' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} />Critico</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} />Atencao</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#22c55e' }} />Saudavel</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#16a34a' }} />Excelente</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#ffc00f' }} />Destaque</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {clientesOrdenados.map(c => {
                const qtd = contagemPorCliente[c.id] || 0
                const fx = faixaStatus(qtd)
                return (
                  <div key={c.id} onClick={() => onVerCliente(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fafafa', borderRadius: 10, cursor: 'pointer' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: c.corPrimaria || '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: c.corSecundaria || '#111', flexShrink: 0 }}>
                      {c.logo ? <img src={c.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.nome[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: fx.cor }}>{qtd}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: fx.cor, background: fx.bg, borderRadius: 999, padding: '2px 8px' }}>{fx.label}</span>
                        </div>
                      </div>
                      <div style={{ position: 'relative', height: 6, borderRadius: 999, background: '#eee', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${barPct(qtd)}%`, background: barCor(qtd), borderRadius: 999, transition: 'width .3s' }} />
                        {/* Linhas de referencia */}
                        <div style={{ position: 'absolute', top: -1, bottom: -1, left: `${(META_MIN / META_EXC) * 100}%`, width: 1, background: '#aaa' }} title={`Minimo (${META_MIN})`} />
                        <div style={{ position: 'absolute', top: -1, bottom: -1, left: `${(META_BOA / META_EXC) * 100}%`, width: 1, background: '#16a34a' }} title={`Bom (${META_BOA})`} />
                        <div style={{ position: 'absolute', top: -1, bottom: -1, left: '100%', width: 1, background: '#ffc00f' }} title={`Excelente (${META_EXC})`} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Grafico de metas — barras horizontais */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#111' }}>Meta de postagens — {MESES[mesAtual]}</h3>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, fontSize: 10, color: '#888' }}>
              <span>Minimo: {META_MIN}</span>
              <span>|</span>
              <span>Bom: {META_BOA}</span>
              <span>|</span>
              <span>Excelente: {META_EXC}+</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clientesOrdenados.map(c => {
                const qtd = contagemPorCliente[c.id] || 0
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 100, fontSize: 11, fontWeight: 600, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{c.nome}</span>
                    <div style={{ flex: 1, position: 'relative', height: 16, borderRadius: 999, background: '#f0f0f0', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${barPct(qtd)}%`, background: barCor(qtd), borderRadius: 999, transition: 'width .3s' }} />
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(META_MIN / META_EXC) * 100}%`, width: 1.5, background: 'rgba(0,0,0,0.2)' }} />
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(META_BOA / META_EXC) * 100}%`, width: 1.5, background: 'rgba(0,0,0,0.15)' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: barCor(qtd), width: 28, textAlign: 'right', flexShrink: 0 }}>{qtd}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Mini-calendario */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#111' }}>{MESES[mesAtual]} {anoAtual}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {DIAS_SEMANA.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#aaa', padding: '4px 0' }}>{d}</div>
            ))}
            {celulas.map((dia, i) => {
              const dayPosts = dia ? (postsPorDia[dia] || []) : []
              const ehHoje = dia === hoje
              return (
                <div key={i} style={{
                  textAlign: 'center', padding: '6px 2px', fontSize: 11, fontWeight: ehHoje ? 800 : 500,
                  color: dia ? (ehHoje ? '#111' : '#666') : 'transparent',
                  background: ehHoje ? '#ffc00f' : (dayPosts.length > 0 ? '#f0fdf4' : 'transparent'),
                  borderRadius: 6, position: 'relative',
                }}>
                  {dia || ''}
                  {dayPosts.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 2 }}>
                      {dayPosts.slice(0, 4).map((p, j) => {
                        const cli = clientes.find(c => c.id === p.clienteId)
                        return <span key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: cli?.corPrimaria || '#16a34a' }} title={p.clienteNome} />
                      })}
                      {dayPosts.length > 4 && <span style={{ fontSize: 8, color: '#aaa' }}>+</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {clientes.slice(0, 10).map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.corPrimaria || '#16a34a' }} />
                <span style={{ fontSize: 10, color: '#888' }}>{c.nome}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

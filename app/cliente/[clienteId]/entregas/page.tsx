'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import EntregasMarco, { Entregas } from '@/app/components/EntregasMarco'
import { toast } from '@/lib/toast'

type Marco = { id: string; titulo: string; descricao?: string; categoria: string; status: string; dataInicio: string; dataFim?: string; atualizadoEm?: string }

// Prometido x realizado: compara a entrega com a data prometida (dataFim)
function prazoMarco(m: Marco): { texto: string; cor: string } | null {
  if (!m.dataFim) return null
  const prazo = new Date(m.dataFim).getTime()
  if (m.status === 'concluido') {
    const real = new Date(m.atualizadoEm || m.dataFim).getTime()
    const diasAtraso = Math.round((real - prazo) / 86400000)
    return diasAtraso <= 0 ? { texto: 'Entregue no prazo', cor: '#16a34a' } : { texto: `Entregue com ${diasAtraso}d de atraso`, cor: '#dc2626' }
  }
  if (m.status !== 'cancelado' && prazo < Date.now()) {
    const dias = Math.round((Date.now() - prazo) / 86400000)
    return { texto: `Atrasada ${dias}d`, cor: '#dc2626' }
  }
  return null
}

const STATUS_LABEL: Record<string, string> = { planejado: 'Planejado', em_andamento: 'Em andamento', concluido: 'Concluído', atrasado: 'Atrasado', cancelado: 'Cancelado' }
const STATUS_COR: Record<string, string> = { planejado: '#9ca3af', em_andamento: '#ca8a04', concluido: '#16a34a', atrasado: '#dc2626', cancelado: '#aaa' }
const ENTREGAVEIS_LABEL: Record<string, string> = {
  social_media: 'Social Media', trafego_meta: 'Tráfego Meta Ads', trafego_google: 'Tráfego Google Ads',
  landing_page: 'Landing Page', branding: 'Branding', email_marketing: 'E-mail marketing',
  consultoria: 'Consultoria', crm: 'CRM', google_meu_negocio: 'Google Meu Negócio', hospedagem: 'Hospedagem / servidor',
}

function fmt(iso?: string) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '' }

export default function EntregasPage() {
  const { clienteId } = useParams()
  const { data: session } = useSession()
  const ehEquipe = (session?.user as any)?.role && (session?.user as any).role !== 'cliente'
  const [marcos, setMarcos] = useState<Marco[]>([])
  const [entregas, setEntregas] = useState<Entregas>({ tarefas: [], posts: [], briefings: [] })
  const [cliente, setCliente] = useState<any>(null)
  const [postsCliente, setPostsCliente] = useState<any[]>([])
  const [cor, setCor] = useState('#16a34a')
  const [carregando, setCarregando] = useState(true)
  // Edicao da meta de posts do mes (so equipe)
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [metaInput, setMetaInput] = useState('')
  const [salvandoMeta, setSalvandoMeta] = useState(false)
  async function salvarMeta() {
    const n = Math.max(0, parseInt(metaInput, 10) || 0)
    setSalvandoMeta(true)
    const r = await fetch('/api/clientes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: clienteId, postsMensais: n }) }).then(x => x.json()).catch(() => ({ error: 'falha de conexão' }))
    setSalvandoMeta(false)
    if (r?.error) { toast('Não foi possível salvar a meta: ' + r.error, 'erro'); return }
    setCliente((c: any) => ({ ...c, postsMensais: n }))
    setEditandoMeta(false)
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/playbook?clienteId=${clienteId}`).then(r => r.json()).catch(() => []),
      fetch(`/api/playbook/entregas?clienteId=${clienteId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/clientes?id=${clienteId}`).then(r => r.json()).catch(() => null),
      fetch(`/api/posts?clienteId=${clienteId}`).then(r => r.json()).catch(() => []),
    ]).then(([m, e, c, p]) => {
      setMarcos(Array.isArray(m) ? m : [])
      setEntregas(e && !e.error ? e : { tarefas: [], posts: [], briefings: [] })
      if (c && !c.error) { setCliente(c) } // layout padrao: mantem o verde padrao (sem cor por cliente)
      setPostsCliente(Array.isArray(p) ? p : [])
      setCarregando(false)
    })
  }, [clienteId])

  // Escopo do mês: contratado (postsMensais) x publicado neste mês
  const agora = new Date()
  const postsPublicadosMes = postsCliente.filter(p => {
    if (p.status !== 'publicado') return false
    const d = new Date(p.dataAgendada || p.atualizadoEm || p.criadoEm || 0)
    return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear()
  }).length
  const postsContratados = Number(cliente?.postsMensais) || 0
  const entregaveis: string[] = cliente?.entregaveis || []
  const pctMes = postsContratados > 0 ? Math.min(100, Math.round((postsPublicadosMes / postsContratados) * 100)) : 0
  // Risco de atraso (preditivo): projeta o fechamento do mês no ritmo atual
  const diaDoMes = agora.getDate()
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
  const projetado = diaDoMes > 0 ? Math.round((postsPublicadosMes / diaDoMes) * diasNoMes) : postsPublicadosMes
  const emRisco = postsContratados > 0 && postsPublicadosMes < postsContratados && projetado < postsContratados

  // Onboarding (início da jornada) — detectado automaticamente a partir dos dados
  const onboarding = [
    { ok: !!(cliente?.segmento || cliente?.descricao || (cliente?.palavrasChave)), label: 'Brand Board preenchido', dica: 'Aba Marca' },
    { ok: !!(cliente?.metaConectado || cliente?.instagramConectado), label: 'Redes sociais conectadas', dica: 'Conectar Instagram/Facebook' },
    { ok: entregaveis.length > 0 || postsContratados > 0, label: 'Escopo do contrato definido', dica: 'Editar cliente' },
    { ok: marcos.length > 0, label: 'Playbook (etapas) criado', dica: 'Aba Playbook' },
    { ok: postsCliente.some(p => p.status === 'publicado'), label: 'Primeiro conteúdo publicado', dica: 'Planner' },
  ]
  const onboardingFeitos = onboarding.filter(o => o.ok).length
  const onboardingCompleto = onboardingFeitos === onboarding.length

  const ordenados = [...marcos].sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime())

  // Progresso geral do cliente
  const totalItens = entregas.tarefas.length + entregas.posts.length
  const feitos = entregas.tarefas.filter(t => t.status === 'concluido').length + entregas.posts.filter(p => p.status === 'publicado').length
  const pctGeral = totalItens > 0 ? Math.round((feitos / totalItens) * 100) : 0

  if (carregando) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Carregando...</div>

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#111' }}>Entregas</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#999' }}>Acompanhe a evolução do seu projeto — o que foi contratado, o que já foi entregue e cada etapa da jornada.</p>

      {/* Onboarding — só para a equipe (início da jornada do cliente). Some quando completo. */}
      {ehEquipe && !onboardingCompleto && (
        <div style={{ background: '#fff', border: '1.5px solid #fde68a', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Onboarding do cliente <span style={{ color: '#aaa', fontWeight: 600 }}>(visível só para a equipe)</span></span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#ca8a04' }}>{onboardingFeitos}/{onboarding.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {onboarding.map((o, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {o.ok ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 6L9 17l-5-5" /></svg>
                ) : (
                  <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #e0e0e0', flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 13, color: o.ok ? '#999' : '#333', textDecoration: o.ok ? 'line-through' : 'none', flex: 1 }}>{o.label}</span>
                {!o.ok && <span style={{ fontSize: 11, color: '#bbb' }}>{o.dica}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Escopo do contrato — o que está contratado x entregue no mês */}
      {(entregaveis.length > 0 || postsContratados > 0 || ehEquipe) && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 18 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Escopo do contrato</span>
          {entregaveis.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 0' }}>
              {entregaveis.map(e => (
                <span key={e} style={{ fontSize: 11.5, fontWeight: 700, color: cor, background: `${cor}1a`, borderRadius: 999, padding: '4px 11px' }}>{ENTREGAVEIS_LABEL[e] || e}</span>
              ))}
            </div>
          )}
          {(postsContratados > 0 || ehEquipe) && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                <span style={{ fontSize: 12.5, color: '#555', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  Meta de posts do mês
                  {ehEquipe && !editandoMeta && (
                    <button onClick={() => { setMetaInput(String(postsContratados)); setEditandoMeta(true) }} title="Editar meta do mês" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8', fontSize: 11, fontWeight: 700, padding: 0 }}>editar</button>
                  )}
                </span>
                {!editandoMeta && <span style={{ fontSize: 13, fontWeight: 800, color: cor }}>{postsPublicadosMes} de {postsContratados || '—'}</span>}
              </div>
              {editandoMeta ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                  <input type="number" min="0" autoFocus value={metaInput} onChange={e => setMetaInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') salvarMeta() }}
                    style={{ width: 90, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                  <span style={{ fontSize: 12, color: '#888' }}>posts/mês</span>
                  <button onClick={salvarMeta} disabled={salvandoMeta} style={{ padding: '8px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{salvandoMeta ? '...' : 'Salvar'}</button>
                  <button onClick={() => setEditandoMeta(false)} style={{ padding: '8px 10px', background: '#fff', color: '#666', border: '1.5px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                </div>
              ) : postsContratados > 0 ? (
                <>
                  <div style={{ height: 8, borderRadius: 999, background: '#eee', overflow: 'hidden' }}>
                    <div style={{ width: `${pctMes}%`, height: '100%', background: cor, borderRadius: 999, transition: 'width .3s' }} />
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#999' }}>{postsPublicadosMes >= postsContratados ? 'Meta do mês atingida!' : `Faltam ${postsContratados - postsPublicadosMes} post(s) para o combinado do mês.`}</p>
                  {postsPublicadosMes < postsContratados && diaDoMes >= 3 && (
                    emRisco ? (
                      <p style={{ margin: '6px 0 0', fontSize: 11.5, fontWeight: 700, color: '#b91c1c', background: '#fef2f2', borderRadius: 8, padding: '6px 10px' }}>
                        ⚠ No ritmo atual, o mês fecha com ~{projetado} de {postsContratados} (faltariam {Math.max(0, postsContratados - projetado)}). Precisamos acelerar.
                      </p>
                    ) : (
                      <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#16a34a' }}>No ritmo certo para bater a meta do mês.</p>
                    )
                  )}
                </>
              ) : (
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#bbb' }}>Defina a meta mensal de posts deste cliente (clique em “editar”).</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resumo geral */}
      {totalItens > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Progresso geral</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: cor }}>{pctGeral}%</span>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: '#eee', overflow: 'hidden' }}>
            <div style={{ width: `${pctGeral}%`, height: '100%', background: cor, borderRadius: 999, transition: 'width .3s' }} />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#888' }}>{feitos} de {totalItens} entregas concluídas · {marcos.length} etapa(s)</p>
          {(() => {
            const comPrazo = marcos.filter(m => m.status === 'concluido' && m.dataFim)
            if (comPrazo.length === 0) return null
            const noPrazo = comPrazo.filter(m => new Date(m.atualizadoEm || m.dataFim!).getTime() <= new Date(m.dataFim!).getTime()).length
            return <p style={{ margin: '4px 0 0', fontSize: 12, color: noPrazo === comPrazo.length ? '#16a34a' : '#a16207' }}>SLA de entrega: {noPrazo} de {comPrazo.length} etapa(s) no prazo.</p>
          })()}
        </div>
      )}

      {ordenados.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '50px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#888' }}>Ainda não há etapas cadastradas.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {ordenados.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', gap: 14 }}>
              {/* Linha do tempo */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: STATUS_COR[m.status] || '#ccc', border: '2px solid #fff', boxShadow: '0 0 0 2px #eee', marginTop: 22 }} />
                {i < ordenados.length - 1 && <div style={{ flex: 1, width: 2, background: '#eee', marginTop: 4 }} />}
              </div>
              {/* Card da etapa */}
              <div style={{ flex: 1, background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{m.titulo}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COR[m.status] || '#888', background: `${STATUS_COR[m.status] || '#888'}1a`, borderRadius: 999, padding: '3px 10px' }}>{STATUS_LABEL[m.status] || m.status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '0 0 12px' }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>{fmt(m.dataInicio)}{m.dataFim ? ` — prometido ${fmt(m.dataFim)}` : ''}</p>
                  {(() => { const pz = prazoMarco(m); return pz ? <span style={{ fontSize: 10.5, fontWeight: 700, color: pz.cor, background: `${pz.cor}15`, borderRadius: 999, padding: '2px 8px' }}>{pz.texto}</span> : null })()}
                </div>
                {m.descricao && <p style={{ margin: '0 0 12px', fontSize: 13, color: '#555', lineHeight: 1.5 }}>{m.descricao}</p>}
                <EntregasMarco marcoId={m.id} entregas={entregas} cor={cor} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

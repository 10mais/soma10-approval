'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'
import { toast, confirmar } from '@/lib/toast'
import { fecharFora } from '@/lib/fecharModal'
import { registrarDesfazer } from '@/lib/desfazer'
import {
  CANAIS, labelCanal, corCanal, LABEL_PUBLICO, TIPOS_GOOGLE, CORRESPONDENCIAS,
  objetivosDoCanal, objetivoDe, somar, derivados, resultadoDoObjetivo, variacao, variacaoBoa,
  noPeriodo, fmtDinheiro, fmtNumero, fmtPct,
  type CanalAds, type Correspondencia,
} from '@/lib/metricasAds'

// MÉTRICAS (mídia paga) — dono, 09/09/2026. O gestor de tráfego cadastra conta, campanha,
// público e anúncio, e LANÇA os números; o dashboard sai daí. O cliente vê tudo, inclusive
// o investimento (decisão do dono). Toda métrica derivada vem de lib/metricasAds.

type Conta = { id: string; clienteId: string; canal: string; nome: string; identificador?: string; moeda?: string; observacao?: string }
type Anuncio = { id: string; titulo: string; descricao?: string; textoPrincipal?: string; cta?: string; urlDestino?: string; criativoUrl?: string; criativoTipo?: string; status?: 'ativo' | 'pausado' }
type Publico = { id: string; titulo: string; descricao?: string; palavrasChave?: { termo: string; correspondencia: Correspondencia }[]; anuncios?: Anuncio[] }
type Campanha = {
  id: string; clienteId: string; clienteNome?: string; contaId: string; canal: string; nome: string; objetivo: string
  tipoGoogle?: string; status: string; dataInicio?: string; dataFim?: string; orcamento?: number; orcamentoTipo?: string
  marcoId?: string; publicos?: Publico[]
}
type Metrica = {
  id: string; clienteId: string; campanhaId: string; nivel: string; refId: string; data: string; ate?: string
  investimento?: number; impressoes?: number; alcance?: number; cliques?: number; resultados?: number; receita?: number; observacao?: string
}
type MarcoLeve = { id: string; titulo: string }

const STATUS_CAMPANHA: Record<string, { label: string; cor: string; bg: string }> = {
  planejada: { label: 'Planejada', cor: 'var(--v2-ink3)', bg: 'var(--v2-surface1)' },
  ativa: { label: 'Ativa', cor: 'var(--v2-ok)', bg: 'var(--v2-ok-bg)' },
  pausada: { label: 'Pausada', cor: 'var(--v2-amber)', bg: 'var(--v2-amber-bg)' },
  encerrada: { label: 'Encerrada', cor: 'var(--v2-ink3)', bg: 'var(--v2-surface1)' },
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function periodoDoMes(ref: Date): { de: string; ate: string; rotulo: string } {
  const ini = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
  const mes = ini.toLocaleDateString('pt-BR', { month: 'long' })
  return { de: ymd(ini), ate: ymd(fim), rotulo: `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${ini.getFullYear()}` }
}
function periodoAnterior(de: string, ate: string): { de: string; ate: string } {
  const a = new Date(de + 'T00:00:00'), b = new Date(ate + 'T00:00:00')
  const dias = Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1)
  const fimAnt = new Date(a.getTime() - 86400000)
  const iniAnt = new Date(fimAnt.getTime() - (dias - 1) * 86400000)
  return { de: ymd(iniAnt), ate: ymd(fimAnt) }
}
const fmtDia = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '')

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)', color: 'var(--v2-ink)', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }
const cardStyle: React.CSSProperties = { background: 'var(--v2-surface)', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: 16 }

function Variacao({ pct, campo }: { pct: number | null; campo: 'custo' | 'resultado' }) {
  if (pct === null) return null
  const boa = variacaoBoa(campo, pct)
  const cor = boa === null ? 'var(--v2-ink3)' : boa ? 'var(--v2-ok)' : 'var(--v2-hot)'
  return (
    <span title="Comparado com o período anterior de mesmo tamanho" style={{ fontSize: 11, fontWeight: 700, color: cor, whiteSpace: 'nowrap' }}>
      {pct > 0 ? '+' : ''}{fmtPct(pct, 0)}
    </span>
  )
}

export default function MetricasAds({ clienteId, clienteNome, podeEditar = true, compacto = false, onAbrirTudo }: {
  clienteId: string
  clienteNome?: string
  podeEditar?: boolean
  compacto?: boolean // modo BLOCO no card do cliente
  onAbrirTudo?: () => void
}) {
  const [contas, setContas] = useState<Conta[]>([])
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [metricas, setMetricas] = useState<Metrica[]>([])
  const [marcos, setMarcos] = useState<MarcoLeve[]>([])
  const [carregando, setCarregando] = useState(true)
  const [refMes, setRefMes] = useState(() => new Date())
  const [campanhaAberta, setCampanhaAberta] = useState<Campanha | null>(null)
  const [novaCampanha, setNovaCampanha] = useState(false)
  const [contasAbertas, setContasAbertas] = useState(false)
  const [lancarPara, setLancarPara] = useState<Campanha | null>(null)

  const periodo = useMemo(() => periodoDoMes(refMes), [refMes])
  const anterior = useMemo(() => periodoAnterior(periodo.de, periodo.ate), [periodo])

  function carregar() {
    if (!clienteId) return
    setCarregando(true)
    Promise.all([
      fetch(`/api/ads/contas?clienteId=${clienteId}`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/ads/campanhas?clienteId=${clienteId}`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/ads/metricas?clienteId=${clienteId}`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/playbook?clienteId=${clienteId}`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([c, cp, m, mc]) => {
      setContas(Array.isArray(c) ? c : [])
      setCampanhas(Array.isArray(cp) ? cp : [])
      setMetricas(Array.isArray(m) ? m : [])
      setMarcos(Array.isArray(mc) ? mc.map((x: any) => ({ id: x.id, titulo: x.titulo })) : [])
    }).finally(() => setCarregando(false))
  }
  useEffect(carregar, [clienteId])

  // Números do período e do período anterior (mesmo tamanho), por campanha e no total.
  const doPeriodo = useMemo(() => noPeriodo(metricas, periodo.de, periodo.ate), [metricas, periodo])
  const doAnterior = useMemo(() => noPeriodo(metricas, anterior.de, anterior.ate), [metricas, anterior])
  // Só o nível 'campanha' entra na soma: somar campanha + público + anúncio contaria 3x.
  const soCampanha = (l: Metrica[]) => l.filter(m => m.nivel === 'campanha')
  const total = useMemo(() => somar(soCampanha(doPeriodo)), [doPeriodo])
  const totalAnt = useMemo(() => somar(soCampanha(doAnterior)), [doAnterior])
  const der = derivados(total)
  const derAnt = derivados(totalAnt)

  const daCampanha = (id: string, lista: Metrica[]) => somar(lista.filter(m => m.campanhaId === id && m.nivel === 'campanha'))

  // Resultado por OBJETIVO: não se soma mensagem com visita ao perfil (dono, 09/09).
  const porObjetivo = useMemo(() => {
    const mapa = new Map<string, { objetivo: string; atual: ReturnType<typeof somar>; ant: ReturnType<typeof somar>; campanhas: number }>()
    for (const c of campanhas) {
      const at = daCampanha(c.id, doPeriodo), an = daCampanha(c.id, doAnterior)
      if (!at.investimento && !at.resultados && !at.alcance) continue
      const e = mapa.get(c.objetivo) || { objetivo: c.objetivo, atual: somar([]), ant: somar([]), campanhas: 0 }
      mapa.set(c.objetivo, {
        objetivo: c.objetivo,
        atual: somar([e.atual, at]),
        ant: somar([e.ant, an]),
        campanhas: e.campanhas + 1,
      })
    }
    return Array.from(mapa.values()).sort((a, b) => b.atual.investimento - a.atual.investimento)
  }, [campanhas, doPeriodo, doAnterior])

  const ativas = campanhas.filter(c => c.status === 'ativa')

  // ------------------------------------------------------------ BLOCO (card do cliente)
  if (compacto) {
    const semNada = !campanhas.length
    return (
      <div>
        {carregando ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)' }}>Carregando…</p>
        ) : semNada ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)' }}>Nenhuma campanha cadastrada. {podeEditar ? 'Cadastre em Métricas.' : ''}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22, fontWeight: 300, color: 'var(--v2-ink)' }}>{fmtDinheiro(total.investimento)}</span>
              <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>investidos em {periodo.rotulo.toLowerCase()}</span>
              <Variacao pct={variacao(total.investimento, totalAnt.investimento)} campo="resultado" />
            </div>
            {porObjetivo.slice(0, 3).map(o => {
              const r = resultadoDoObjetivo(o.objetivo, o.atual)
              const rAnt = resultadoDoObjetivo(o.objetivo, o.ant)
              return (
                <div key={o.objetivo} style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', fontSize: 13 }}>
                  <strong style={{ color: 'var(--v2-ink)' }}>{fmtNumero(r.valor)}</strong>
                  <span style={{ color: 'var(--v2-ink2)' }}>{r.rotulo}</span>
                  <span style={{ color: 'var(--v2-ink3)' }}>· {r.custoLabel.toLowerCase()} {fmtDinheiro(r.custo)}</span>
                  <Variacao pct={variacao(r.custo || 0, rAnt.custo || 0)} campo="custo" />
                </div>
              )
            })}
            {!porObjetivo.length && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Sem números lançados neste mês.</p>}
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--v2-ink3)' }}>{ativas.length} campanha{ativas.length === 1 ? '' : 's'} ativa{ativas.length === 1 ? '' : 's'} · {campanhas.length} no total</p>
          </div>
        )}
      </div>
    )
  }

  // ------------------------------------------------------------ TELA COMPLETA
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--v2-ink)' }}>Métricas</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setRefMes(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} aria-label="Mês anterior" style={{ width: 30, height: 30, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 8, cursor: 'pointer', color: 'var(--v2-ink2)' }}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)', minWidth: 130, textAlign: 'center' }}>{periodo.rotulo}</span>
          <button onClick={() => setRefMes(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} aria-label="Próximo mês" style={{ width: 30, height: 30, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 8, cursor: 'pointer', color: 'var(--v2-ink2)' }}>›</button>
        </div>
        {podeEditar && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setContasAbertas(true)} style={{ padding: '9px 16px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Contas de anúncio {contas.length ? `(${contas.length})` : ''}
            </button>
            <button onClick={() => setNovaCampanha(true)} style={{ padding: '9px 16px', background: 'var(--v2-amber-on)', color: '#17150E', border: 0, borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Nova campanha</button>
          </div>
        )}
      </div>

      {carregando ? (
        <p style={{ fontSize: 13, color: 'var(--v2-ink3)' }}>Carregando…</p>
      ) : !campanhas.length ? (
        <div style={{ ...cardStyle, padding: '44px 20px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--v2-ink3)' }}>Nenhuma campanha cadastrada para {clienteNome || 'este cliente'}.</p>
          {podeEditar && (
            <p style={{ margin: '6px 0 14px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>Cadastre a conta de anúncio, depois a campanha, e lance os números do período.</p>
          )}
          {podeEditar && <button onClick={() => setNovaCampanha(true)} style={{ padding: '10px 18px', background: 'var(--v2-amber-on)', color: '#17150E', border: 0, borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Nova campanha</button>}
        </div>
      ) : (
        <>
          {/* Números do período */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
            {[
              { rotulo: 'Investimento', valor: fmtDinheiro(total.investimento), pct: variacao(total.investimento, totalAnt.investimento), campo: 'resultado' as const },
              { rotulo: 'Impressões', valor: fmtNumero(total.impressoes), pct: variacao(total.impressoes, totalAnt.impressoes), campo: 'resultado' as const },
              { rotulo: 'Alcance', valor: fmtNumero(total.alcance), pct: variacao(total.alcance, totalAnt.alcance), campo: 'resultado' as const },
              { rotulo: 'Cliques', valor: fmtNumero(total.cliques), pct: variacao(total.cliques, totalAnt.cliques), campo: 'resultado' as const },
              { rotulo: 'CTR', valor: fmtPct(der.ctr), pct: variacao(der.ctr || 0, derAnt.ctr || 0), campo: 'resultado' as const },
              { rotulo: 'Custo por clique', valor: fmtDinheiro(der.cpc), pct: variacao(der.cpc || 0, derAnt.cpc || 0), campo: 'custo' as const },
            ].map(k => (
              <div key={k.rotulo} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 22, fontWeight: 300, color: 'var(--v2-ink)' }}>{k.valor}</span>
                  <Variacao pct={k.pct} campo={k.campo} />
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>{k.rotulo}</p>
              </div>
            ))}
          </div>

          {/* Resultado POR OBJETIVO — cada objetivo com o nome certo do seu resultado */}
          {porObjetivo.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 14 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>Resultado por objetivo</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {porObjetivo.map(o => {
                  const def = objetivoDe(o.objetivo)
                  const r = resultadoDoObjetivo(o.objetivo, o.atual)
                  const rAnt = resultadoDoObjetivo(o.objetivo, o.ant)
                  const d = derivados(o.atual)
                  return (
                    <div key={o.objetivo} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingBottom: 10, borderBottom: '1px solid var(--v2-rule)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', minWidth: 150 }}>{def.label}</span>
                      <span style={{ fontSize: 15, color: 'var(--v2-ink)' }}><strong>{fmtNumero(r.valor)}</strong> <span style={{ fontSize: 12.5, color: 'var(--v2-ink2)' }}>{r.rotulo}</span></span>
                      <Variacao pct={variacao(r.valor, rAnt.valor)} campo="resultado" />
                      <span style={{ fontSize: 12.5, color: 'var(--v2-ink2)', marginLeft: 'auto' }}>{r.custoLabel}: <strong style={{ color: 'var(--v2-ink)' }}>{fmtDinheiro(r.custo)}</strong></span>
                      <Variacao pct={variacao(r.custo || 0, rAnt.custo || 0)} campo="custo" />
                      {def.receita && o.atual.receita > 0 && (
                        <span style={{ fontSize: 12.5, color: 'var(--v2-ok)', fontWeight: 700 }}>ROAS {d.roas?.toFixed(2).replace('.', ',')}x</span>
                      )}
                    </div>
                  )
                })}
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>Resultados de objetivos diferentes não se somam: mensagem e visita ao perfil não são a mesma entrega.</p>
            </div>
          )}

          {/* Campanhas */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>Campanhas</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {campanhas.map(c => {
                const at = daCampanha(c.id, doPeriodo), an = daCampanha(c.id, doAnterior)
                const r = resultadoDoObjetivo(c.objetivo, at)
                const rAnt = resultadoDoObjetivo(c.objetivo, an)
                const st = STATUS_CAMPANHA[c.status] || STATUS_CAMPANHA.ativa
                const marco = marcos.find(m => m.id === c.marcoId)
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--v2-rule)', flexWrap: 'wrap' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: corCanal(c.canal), flexShrink: 0 }} title={labelCanal(c.canal)} />
                    <button onClick={() => setCampanhaAberta(c)} style={{ flex: 1, minWidth: 180, textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--v2-ink)' }}>{c.nome}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--v2-ink3)' }}>
                        {labelCanal(c.canal)} · {objetivoDe(c.objetivo).label}
                        {c.dataInicio ? ` · ${fmtDia(c.dataInicio)}${c.dataFim ? ' a ' + fmtDia(c.dataFim) : ''}` : ''}
                        {marco ? ` · Playbook: ${marco.titulo}` : ''}
                      </span>
                    </button>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: st.cor, background: st.bg, padding: '3px 9px', borderRadius: 999 }}>{st.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--v2-ink)', minWidth: 90, textAlign: 'right' }}>{fmtDinheiro(at.investimento)}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--v2-ink2)', minWidth: 150, textAlign: 'right' }}>
                      <strong>{fmtNumero(r.valor)}</strong> {r.rotulo}
                    </span>
                    <span style={{ fontSize: 12.5, color: 'var(--v2-ink2)', minWidth: 110, textAlign: 'right' }}>{fmtDinheiro(r.custo)}</span>
                    <Variacao pct={variacao(r.custo || 0, rAnt.custo || 0)} campo="custo" />
                    {podeEditar && (
                      <button onClick={() => setLancarPara(c)} title="Lançar os números do período" style={{ padding: '6px 12px', background: 'var(--v2-surface)', color: 'var(--v2-info)', border: '1px solid var(--v2-info-bg)', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Lançar</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {(novaCampanha || campanhaAberta) && (
        <CampanhaModal
          campanha={campanhaAberta} clienteId={clienteId} clienteNome={clienteNome} contas={contas} marcos={marcos}
          metricas={metricas.filter(m => m.campanhaId === (campanhaAberta?.id || ''))}
          podeEditar={podeEditar}
          onClose={() => { setNovaCampanha(false); setCampanhaAberta(null) }}
          onSalvo={() => { setNovaCampanha(false); setCampanhaAberta(null); carregar() }}
          onLancar={c => { setCampanhaAberta(null); setLancarPara(c) }}
        />
      )}
      {lancarPara && (
        <LancamentoModal campanha={lancarPara} clienteId={clienteId} periodo={periodo}
          metricas={metricas.filter(m => m.campanhaId === lancarPara.id)}
          onClose={() => setLancarPara(null)} onSalvo={() => { setLancarPara(null); carregar() }} />
      )}
      {contasAbertas && (
        <ContasModal contas={contas} clienteId={clienteId} clienteNome={clienteNome} onClose={() => setContasAbertas(false)} onSalvo={carregar} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- contas de anúncio
function ContasModal({ contas, clienteId, clienteNome, onClose, onSalvo }: {
  contas: Conta[]; clienteId: string; clienteNome?: string; onClose: () => void; onSalvo: () => void
}) {
  const [nome, setNome] = useState('')
  const [canal, setCanal] = useState<CanalAds>('meta')
  const [identificador, setIdentificador] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function criar() {
    if (!nome.trim() || salvando) return
    setSalvando(true)
    const r = await fetch('/api/ads/contas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId, clienteNome, canal, nome, identificador }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { toast('Não foi possível criar a conta.', 'erro'); return }
    setNome(''); setIdentificador('')
    onSalvo()
    toast('Conta de anúncio cadastrada.', 'sucesso')
  }

  async function excluir(c: Conta) {
    if (!(await confirmar(`Excluir a conta "${c.nome}"?`, { titulo: 'Excluir conta', okLabel: 'Excluir', perigo: true }))) return
    await fetch(`/api/ads/contas?id=${c.id}`, { method: 'DELETE' }).catch(() => null)
    registrarDesfazer(`Exclusão da conta "${c.nome}"`, async () => {
      const r = await fetch('/api/ads/contas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, restaurar: true }) }).catch(() => null)
      onSalvo()
      return !!r?.ok
    })
    onSalvo()
  }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--v2-ink)' }}>Contas de anúncio</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>De onde sai o investimento. O identificador ajuda quando a integração automática entrar.</p>

        {contas.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '1px solid var(--v2-rule)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: corCanal(c.canal), flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--v2-ink)' }}>{c.nome}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--v2-ink3)' }}>{labelCanal(c.canal)}{c.identificador ? ` · ${c.identificador}` : ''}</span>
            </div>
            <button onClick={() => excluir(c)} title="Excluir" style={{ background: 'none', border: 0, color: 'var(--v2-hot)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        ))}
        {!contas.length && <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--v2-ink3)' }}>Nenhuma conta cadastrada ainda.</p>}

        <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'var(--v2-surface1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Canal</label>
              <select value={canal} onChange={e => setCanal(e.target.value as CanalAds)} style={inputStyle}>
                {CANAIS.map(c => <option key={c.chave} value={c.chave}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{canal === 'google' ? 'ID do cliente (123-456-7890)' : 'ID da conta (act_…)'}</label>
              <input value={identificador} onChange={e => setIdentificador(e.target.value)} placeholder="opcional" style={inputStyle} />
            </div>
          </div>
          <label style={labelStyle}>Nome da conta *</label>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Anjo Santo — Meta Ads" style={inputStyle} />
          <button onClick={criar} disabled={!nome.trim() || salvando} style={{ marginTop: 10, padding: '9px 16px', background: nome.trim() ? 'var(--v2-ink)' : 'var(--v2-surface2)', color: nome.trim() ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 0, borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: nome.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {salvando ? 'Salvando…' : '+ Cadastrar conta'}
          </button>
        </div>

        <button onClick={onClose} style={{ marginTop: 18, width: '100%', padding: '11px 0', background: 'var(--v2-surface2)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Fechar</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- campanha (estrutura)
function CampanhaModal({ campanha, clienteId, clienteNome, contas, marcos, metricas, podeEditar, onClose, onSalvo, onLancar }: {
  campanha: Campanha | null; clienteId: string; clienteNome?: string; contas: Conta[]; marcos: MarcoLeve[]
  metricas: Metrica[]; podeEditar: boolean; onClose: () => void; onSalvo: () => void; onLancar: (c: Campanha) => void
}) {
  const [form, setForm] = useState({
    nome: campanha?.nome || '',
    canal: (campanha?.canal || contas[0]?.canal || 'meta') as string,
    contaId: campanha?.contaId || contas[0]?.id || '',
    objetivo: campanha?.objetivo || '',
    tipoGoogle: campanha?.tipoGoogle || 'pesquisa',
    status: campanha?.status || 'ativa',
    dataInicio: (campanha?.dataInicio || '').slice(0, 10),
    dataFim: (campanha?.dataFim || '').slice(0, 10),
    orcamento: campanha?.orcamento ?? ('' as any),
    orcamentoTipo: campanha?.orcamentoTipo || 'diario',
    marcoId: campanha?.marcoId || '',
  })
  const [publicos, setPublicos] = useState<Publico[]>(campanha?.publicos || [])
  const [salvando, setSalvando] = useState(false)
  const objetivos = objetivosDoCanal(form.canal)
  const objetivoOk = objetivos.some(o => o.chave === form.objetivo) ? form.objetivo : (objetivos[0]?.chave || 'trafego')
  const rotuloPub = LABEL_PUBLICO[form.canal] || LABEL_PUBLICO.meta
  const tipoG = TIPOS_GOOGLE.find(t => t.chave === form.tipoGoogle)
  const mostraPalavras = form.canal === 'google' && !!tipoG?.temPalavraChave
  const contasDoCanal = contas.filter(c => c.canal === form.canal)

  const setPub = (id: string, patch: Partial<Publico>) => setPublicos(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p))
  const addPub = () => setPublicos(ps => [...ps, { id: uuid().slice(0, 8), titulo: '', anuncios: [] }])
  const rmPub = (id: string) => setPublicos(ps => ps.filter(p => p.id !== id))
  const addAnuncio = (pid: string) => setPub(pid, { anuncios: [...(publicos.find(p => p.id === pid)?.anuncios || []), { id: uuid().slice(0, 8), titulo: '' }] })
  const setAnuncio = (pid: string, aid: string, patch: Partial<Anuncio>) => {
    const p = publicos.find(x => x.id === pid); if (!p) return
    setPub(pid, { anuncios: (p.anuncios || []).map(a => a.id === aid ? { ...a, ...patch } : a) })
  }
  const rmAnuncio = (pid: string, aid: string) => {
    const p = publicos.find(x => x.id === pid); if (!p) return
    setPub(pid, { anuncios: (p.anuncios || []).filter(a => a.id !== aid) })
  }

  const [enviando, setEnviando] = useState('')
  async function enviarCriativo(pid: string, aid: string, arquivo: File) {
    setEnviando(aid)
    try {
      const ext = arquivo.name.split('.').pop() || 'bin'
      const blob = await upload(`ads/${uuid()}.${ext}`, arquivo, { access: 'public', handleUploadUrl: '/api/upload', contentType: arquivo.type, clientPayload: arquivo.type })
      setAnuncio(pid, aid, { criativoUrl: blob.url, criativoTipo: arquivo.type })
    } catch { toast('Não foi possível enviar o criativo.', 'erro') }
    setEnviando('')
  }

  const retrato = useRef(JSON.stringify({ form, publicos }))
  const alterado = () => JSON.stringify({ form, publicos }) !== retrato.current

  async function salvar() {
    if (!form.nome.trim() || salvando) { toast('Dê um nome à campanha.', 'erro'); return }
    setSalvando(true)
    const corpo = {
      ...form, objetivo: objetivoOk, clienteId, clienteNome,
      orcamento: form.orcamento === '' ? undefined : form.orcamento,
      publicos: publicos.filter(p => p.titulo.trim()),
      ...(form.canal === 'google' ? {} : { tipoGoogle: '' }),
    }
    const r = campanha
      ? await fetch('/api/ads/campanhas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: campanha.id, ...corpo }) }).then(x => x.json()).catch(() => null)
      : await fetch('/api/ads/campanhas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { toast('Não foi possível salvar a campanha.', 'erro'); return }
    onSalvo()
  }
  async function fecharSalvando() {
    if (!podeEditar || !alterado()) { onClose(); return }
    if (!form.nome.trim()) { onClose(); return }
    await salvar()
  }

  async function excluir() {
    if (!campanha) return
    if (!(await confirmar(`Excluir a campanha "${campanha.nome}"? Os números lançados continuam guardados.`, { titulo: 'Excluir campanha', okLabel: 'Excluir', perigo: true }))) return
    await fetch(`/api/ads/campanhas?id=${campanha.id}`, { method: 'DELETE' }).catch(() => null)
    registrarDesfazer(`Exclusão da campanha "${campanha.nome}"`, async () => {
      const r = await fetch('/api/ads/campanhas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: campanha.id, restaurar: true }) }).catch(() => null)
      onSalvo()
      return !!r?.ok
    })
    onSalvo()
  }

  const soma = somar(metricas.filter(m => m.nivel === 'campanha'))
  const res = resultadoDoObjetivo(objetivoOk, soma)

  return (
    <div onClick={fecharFora(fecharSalvando)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 760, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--v2-ink)' }}>{campanha ? 'Campanha' : 'Nova campanha'}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Canal *</label>
            <select disabled={!podeEditar} value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value, objetivo: '', contaId: '' }))} style={inputStyle}>
              {CANAIS.map(c => <option key={c.chave} value={c.chave}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Conta de anúncio</label>
            <select disabled={!podeEditar} value={form.contaId} onChange={e => setForm(f => ({ ...f, contaId: e.target.value }))} style={inputStyle}>
              <option value="">{contasDoCanal.length ? 'Selecione…' : 'Nenhuma conta deste canal'}</option>
              {contasDoCanal.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        <label style={labelStyle}>Nome da campanha *</label>
        <input disabled={!podeEditar} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Setembro — mensagens no WhatsApp" style={{ ...inputStyle, marginBottom: 10 }} />

        <div style={{ display: 'grid', gridTemplateColumns: form.canal === 'google' ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Objetivo * <span style={{ fontWeight: 400 }}>(decide o resultado que a tela mostra)</span></label>
            <select disabled={!podeEditar} value={objetivoOk} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} style={inputStyle}>
              {objetivos.map(o => <option key={o.chave} value={o.chave}>{o.label}</option>)}
            </select>
            <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--v2-info)' }}>Mede: {objetivoDe(objetivoOk).resultado.plural} · {objetivoDe(objetivoOk).custoLabel.toLowerCase()}</p>
          </div>
          {form.canal === 'google' && (
            <div>
              <label style={labelStyle}>Tipo de campanha</label>
              <select disabled={!podeEditar} value={form.tipoGoogle} onChange={e => setForm(f => ({ ...f, tipoGoogle: e.target.value }))} style={inputStyle}>
                {TIPOS_GOOGLE.map(t => <option key={t.chave} value={t.chave}>{t.label}</option>)}
              </select>
              <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>{tipoG?.temPalavraChave ? 'Tem palavras-chave e negativas.' : 'Sem palavras-chave: usa sinais de público.'}</p>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Status</label>
            <select disabled={!podeEditar} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
              {Object.entries(STATUS_CAMPANHA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Início</label>
            <input disabled={!podeEditar} type="date" value={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Fim (opcional)</label>
            <input disabled={!podeEditar} type="date" value={form.dataFim} onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Orçamento</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input disabled={!podeEditar} type="number" min={0} step="0.01" value={form.orcamento} onChange={e => setForm(f => ({ ...f, orcamento: e.target.value as any }))} placeholder="0,00" style={inputStyle} />
              <select disabled={!podeEditar} value={form.orcamentoTipo} onChange={e => setForm(f => ({ ...f, orcamentoTipo: e.target.value }))} style={{ ...inputStyle, width: 110 }}>
                <option value="diario">por dia</option>
                <option value="total">total</option>
              </select>
            </div>
          </div>
        </div>

        <label style={labelStyle}>Etapa do Playbook <span style={{ fontWeight: 400 }}>(liga a campanha ao plano do cliente)</span></label>
        <select disabled={!podeEditar} value={form.marcoId} onChange={e => setForm(f => ({ ...f, marcoId: e.target.value }))} style={{ ...inputStyle, marginBottom: 16 }}>
          <option value="">Nenhuma</option>
          {marcos.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
        </select>

        {/* Públicos / grupos de anúncios, com os anúncios dentro */}
        <div style={{ borderTop: '1px solid var(--v2-rule)', paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--v2-ink)' }}>{rotuloPub.plural} desta campanha</h4>
            {podeEditar && <button onClick={addPub} style={{ marginLeft: 'auto', padding: '5px 11px', borderRadius: 999, border: '1px dashed var(--v2-rule2)', background: 'var(--v2-surface)', color: 'var(--v2-ink)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ {rotuloPub.singular}</button>}
          </div>

          {publicos.map(p => (
            <div key={p.id} style={{ padding: 12, borderRadius: 12, border: '1px solid var(--v2-rule)', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <input disabled={!podeEditar} value={p.titulo} onChange={e => setPub(p.id, { titulo: e.target.value })} placeholder={`Título do ${rotuloPub.singular.toLowerCase()} (ex.: Mulheres 25-45 · Santo Ângelo)`} style={inputStyle} />
                  <textarea disabled={!podeEditar} value={p.descricao || ''} onChange={e => setPub(p.id, { descricao: e.target.value })} rows={2} placeholder="Descrição: interesses, comportamento, região…" style={{ ...inputStyle, marginTop: 8, resize: 'vertical' }} />
                </div>
                {podeEditar && <button onClick={() => rmPub(p.id)} title="Remover" style={{ background: 'none', border: 0, color: 'var(--v2-hot)', cursor: 'pointer', fontSize: 16 }}>×</button>}
              </div>

              {mostraPalavras && (
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>Palavras-chave</label>
                  {(p.palavrasChave || []).map((k, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input disabled={!podeEditar} value={k.termo} onChange={e => setPub(p.id, { palavrasChave: (p.palavrasChave || []).map((x, j) => j === i ? { ...x, termo: e.target.value } : x) })} placeholder="termo" style={inputStyle} />
                      <select disabled={!podeEditar} value={k.correspondencia} onChange={e => setPub(p.id, { palavrasChave: (p.palavrasChave || []).map((x, j) => j === i ? { ...x, correspondencia: e.target.value as Correspondencia } : x) })} style={{ ...inputStyle, width: 130 }}>
                        {CORRESPONDENCIAS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {podeEditar && <button onClick={() => setPub(p.id, { palavrasChave: (p.palavrasChave || []).filter((_, j) => j !== i) })} style={{ background: 'none', border: 0, color: 'var(--v2-hot)', cursor: 'pointer' }}>×</button>}
                    </div>
                  ))}
                  {podeEditar && <button onClick={() => setPub(p.id, { palavrasChave: [...(p.palavrasChave || []), { termo: '', correspondencia: 'ampla' as Correspondencia }] })} style={{ background: 'none', border: 0, color: 'var(--v2-info)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>+ palavra-chave</button>}
                </div>
              )}

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--v2-rule)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--v2-ink3)' }}>Anúncios</span>
                  {podeEditar && <button onClick={() => addAnuncio(p.id)} style={{ marginLeft: 'auto', background: 'none', border: 0, color: 'var(--v2-info)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>+ anúncio</button>}
                </div>
                {(p.anuncios || []).map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--v2-rule)' }}>
                    <div style={{ width: 76, flexShrink: 0 }}>
                      {a.criativoUrl ? (
                        <button type="button" onClick={() => window.open(a.criativoUrl, '_blank', 'noopener')} title="Abrir o criativo" style={{ padding: 0, border: '1px solid var(--v2-rule)', borderRadius: 8, overflow: 'hidden', background: 'var(--v2-surface)', cursor: 'zoom-in', lineHeight: 0, width: 76 }}>
                          {(a.criativoTipo || '').startsWith('video')
                            ? <video src={a.criativoUrl} style={{ width: 76, height: 76, objectFit: 'cover' }} muted />
                            : <img src={a.criativoUrl} alt="" style={{ width: 76, height: 76, objectFit: 'cover' }} />}
                        </button>
                      ) : (
                        <div style={{ width: 76, height: 76, borderRadius: 8, border: '1px dashed var(--v2-rule2)', display: 'grid', placeItems: 'center', color: 'var(--v2-ink3)', fontSize: 10, textAlign: 'center', padding: 4 }}>sem print</div>
                      )}
                      {podeEditar && (
                        <label style={{ display: 'block', marginTop: 5, fontSize: 10.5, color: 'var(--v2-info)', fontWeight: 700, cursor: enviando === a.id ? 'wait' : 'pointer', textAlign: 'center' }}>
                          {enviando === a.id ? 'enviando…' : a.criativoUrl ? 'trocar' : '+ print'}
                          <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) enviarCriativo(p.id, a.id, f); e.target.value = '' }} />
                        </label>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input disabled={!podeEditar} value={a.titulo} onChange={e => setAnuncio(p.id, a.id, { titulo: e.target.value })} placeholder="Título do anúncio" style={inputStyle} />
                      <input disabled={!podeEditar} value={a.descricao || ''} onChange={e => setAnuncio(p.id, a.id, { descricao: e.target.value })} placeholder="Descrição" style={inputStyle} />
                      <textarea disabled={!podeEditar} value={a.textoPrincipal || ''} onChange={e => setAnuncio(p.id, a.id, { textoPrincipal: e.target.value })} rows={2} placeholder="Texto principal" style={{ ...inputStyle, resize: 'vertical' }} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input disabled={!podeEditar} value={a.cta || ''} onChange={e => setAnuncio(p.id, a.id, { cta: e.target.value })} placeholder="CTA (ex.: Enviar mensagem)" style={inputStyle} />
                        <input disabled={!podeEditar} value={a.urlDestino || ''} onChange={e => setAnuncio(p.id, a.id, { urlDestino: e.target.value })} placeholder="URL de destino" style={inputStyle} />
                      </div>
                    </div>
                    {podeEditar && <button onClick={() => rmAnuncio(p.id, a.id)} title="Remover anúncio" style={{ background: 'none', border: 0, color: 'var(--v2-hot)', cursor: 'pointer', fontSize: 15 }}>×</button>}
                  </div>
                ))}
                {!(p.anuncios || []).length && <p style={{ margin: 0, fontSize: 11.5, color: 'var(--v2-ink3)' }}>Nenhum anúncio cadastrado.</p>}
              </div>
            </div>
          ))}
          {!publicos.length && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Nenhum {rotuloPub.singular.toLowerCase()} cadastrado ainda.</p>}
        </div>

        {campanha && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'var(--v2-surface1)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)' }}>Acumulado da campanha</span>
              <span style={{ fontSize: 13, color: 'var(--v2-ink)' }}>{fmtDinheiro(soma.investimento)}</span>
              <span style={{ fontSize: 13, color: 'var(--v2-ink2)' }}><strong>{fmtNumero(res.valor)}</strong> {res.rotulo}</span>
              <span style={{ fontSize: 13, color: 'var(--v2-ink2)' }}>{res.custoLabel}: {fmtDinheiro(res.custo)}</span>
              {podeEditar && <button onClick={() => onLancar(campanha)} style={{ marginLeft: 'auto', padding: '6px 12px', background: 'var(--v2-surface)', color: 'var(--v2-info)', border: '1px solid var(--v2-info-bg)', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Lançar números</button>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          {podeEditar && (
            <button onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ flex: 1, padding: '11px 0', background: form.nome.trim() ? 'var(--v2-amber-on)' : 'var(--v2-surface2)', color: form.nome.trim() ? '#17150E' : 'var(--v2-ink3)', border: 0, borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: form.nome.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
              {salvando ? 'Salvando…' : campanha ? 'Salvar' : 'Criar campanha'}
            </button>
          )}
          <button onClick={fecharSalvando} style={{ padding: '11px 16px', background: 'var(--v2-surface2)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Fechar</button>
          {campanha && podeEditar && (
            <button onClick={excluir} style={{ padding: '11px 16px', background: 'var(--v2-surface)', color: 'var(--v2-hot)', border: '1px solid var(--v2-hot-bg)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Excluir</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- lançamento de números
function LancamentoModal({ campanha, clienteId, periodo, metricas, onClose, onSalvo }: {
  campanha: Campanha; clienteId: string; periodo: { de: string; ate: string; rotulo: string }
  metricas: Metrica[]; onClose: () => void; onSalvo: () => void
}) {
  const obj = objetivoDe(campanha.objetivo)
  const hoje = new Date()
  const [form, setForm] = useState({
    data: periodo.de <= ymd(hoje) && ymd(hoje) <= periodo.ate ? ymd(hoje) : periodo.de,
    ate: '',
    investimento: '' as any, impressoes: '' as any, alcance: '' as any, cliques: '' as any, resultados: '' as any, receita: '' as any,
    observacao: '',
  })
  const [salvando, setSalvando] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function salvar() {
    if (salvando) return
    if (!form.data) { toast('Informe a data do lançamento.', 'erro'); return }
    setSalvando(true)
    const r = await fetch('/api/ads/metricas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, clienteId, campanhaId: campanha.id, nivel: 'campanha', refId: campanha.id }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { toast('Não foi possível lançar os números.', 'erro'); return }
    const idNovo = r.metrica?.id
    if (idNovo) registrarDesfazer(`Lançamento de ${fmtDia(form.data)} em "${campanha.nome}"`, async () => {
      const x = await fetch(`/api/ads/metricas?id=${idNovo}`, { method: 'DELETE' }).catch(() => null)
      onSalvo()
      return !!x?.ok
    })
    toast('Números lançados.', 'sucesso')
    onSalvo()
  }

  async function excluir(m: Metrica) {
    if (!(await confirmar(`Excluir o lançamento de ${fmtDia(m.data)}?`, { titulo: 'Excluir lançamento', okLabel: 'Excluir', perigo: true }))) return
    await fetch(`/api/ads/metricas?id=${m.id}`, { method: 'DELETE' }).catch(() => null)
    registrarDesfazer(`Exclusão do lançamento de ${fmtDia(m.data)}`, async () => {
      const r = await fetch('/api/ads/metricas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, restaurar: true }) }).catch(() => null)
      onSalvo()
      return !!r?.ok
    })
    onSalvo()
  }

  const campos: { k: string; label: string; dica?: string }[] = [
    { k: 'investimento', label: 'Investimento (R$)' },
    { k: 'resultados', label: obj.resultado.plural.charAt(0).toUpperCase() + obj.resultado.plural.slice(1), dica: obj.semResultado ? 'Este objetivo mede alcance: preencha o alcance abaixo.' : undefined },
    { k: 'impressoes', label: 'Impressões' },
    { k: 'alcance', label: 'Alcance' },
    { k: 'cliques', label: 'Cliques' },
    ...(obj.receita ? [{ k: 'receita', label: 'Receita (R$)' }] : []),
  ]

  return (
    <div onClick={fecharFora(onClose, { perguntar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 3px', fontSize: 16, color: 'var(--v2-ink)' }}>Lançar números</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>{campanha.nome} · {labelCanal(campanha.canal)} · {obj.label}. CTR, CPC e {obj.custoLabel.toLowerCase()} são calculados sozinhos.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Data *</label>
            <input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Até (se cobrir um período)</label>
            <input type="date" value={form.ate} onChange={e => set('ate', e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          {campos.map(c => (
            <div key={c.k}>
              <label style={labelStyle}>{c.label}</label>
              <input type="number" min={0} step="0.01" value={(form as any)[c.k]} onChange={e => set(c.k, e.target.value)} placeholder="0" style={inputStyle} />
              {c.dica && <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--v2-ink3)' }}>{c.dica}</p>}
            </div>
          ))}
        </div>

        <label style={{ ...labelStyle, marginTop: 10 }}>Observação</label>
        <input value={form.observacao} onChange={e => set('observacao', e.target.value)} placeholder="Ex.: subimos o orçamento no dia 12" style={inputStyle} />

        <button onClick={salvar} disabled={salvando} style={{ marginTop: 14, width: '100%', padding: '11px 0', background: 'var(--v2-amber-on)', color: '#17150E', border: 0, borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          {salvando ? 'Lançando…' : 'Lançar'}
        </button>

        {metricas.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>Lançamentos desta campanha</h4>
            {metricas.slice(0, 20).map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--v2-rule)', fontSize: 12.5, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--v2-ink2)', minWidth: 90 }}>{fmtDia(m.data)}{m.ate ? ` a ${fmtDia(m.ate)}` : ''}</span>
                <span style={{ color: 'var(--v2-ink)' }}>{fmtDinheiro(m.investimento || 0)}</span>
                <span style={{ color: 'var(--v2-ink2)' }}>{fmtNumero(m.resultados || 0)} {obj.resultado.plural}</span>
                <span style={{ color: 'var(--v2-ink3)' }}>{fmtNumero(m.cliques || 0)} cliques</span>
                <button onClick={() => excluir(m)} title="Excluir lançamento" style={{ marginLeft: 'auto', background: 'none', border: 0, color: 'var(--v2-hot)', cursor: 'pointer', fontSize: 15 }}>×</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} style={{ marginTop: 16, width: '100%', padding: '11px 0', background: 'var(--v2-surface2)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Fechar</button>
      </div>
    </div>
  )
}

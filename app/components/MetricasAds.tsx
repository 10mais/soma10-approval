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
  noPeriodo, serieDoPeriodo, fmtDinheiro, fmtNumero, fmtPct, fmtRoas,
  funilDeVendas, camposDoLancamento, formatarEntradaInteiro, campoParaNumero,
  numeroParaCampo, rotuloIntervalo, CAMPOS_NUMERICOS, lancamentosDoFunil, periodoDeComparacao, rotulosObjetivo,
  type CanalAds, type Correspondencia, type CampoLancamento,
} from '@/lib/metricasAds'
import { formatarEntradaMoeda, parseMoeda, moedaParaCampo } from '@/lib/moeda'
import { useT, useIdioma, useArea } from '@/app/components/Idioma'

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
  visualizacoesPagina?: number; adicoesCarrinho?: number; checkouts?: number; compras?: number
}
type MarcoLeve = { id: string; titulo: string }

const STATUS_CAMPANHA: Record<string, { label: string; cor: string; bg: string }> = {
  planejada: { label: 'Planejada', cor: 'var(--v2-ink3)', bg: 'var(--v2-surface1)' },
  ativa: { label: 'Ativa', cor: 'var(--v2-ok)', bg: 'var(--v2-ok-bg)' },
  pausada: { label: 'Pausada', cor: 'var(--v2-amber)', bg: 'var(--v2-amber-bg)' },
  encerrada: { label: 'Encerrada', cor: 'var(--v2-ink3)', bg: 'var(--v2-surface1)' },
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function periodoDoMes(ref: Date): { de: string; ate: string; rotulo: string; chave: string } {
  const ini = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
  const mes = ini.toLocaleDateString('pt-BR', { month: 'long' })
  return { de: ymd(ini), ate: ymd(fim), rotulo: `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${ini.getFullYear()}`, chave: ymd(ini).slice(0, 7) }
}
const fmtDia = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '')

// CAMPO NUMÉRICO do lançamento (dono, 16/09: "não aceita a vírgula para os centavos"). O
// <input type="number"> do navegador recusa "12,50" em vários sistemas. Aqui é texto com
// máscara: dinheiro em Real (R$ + ponto de milhar + vírgula de centavo) e contagem com ponto
// de milhar. O número só nasce na hora de gravar (campoParaNumero).
function CampoValor({ campo, valor, onChange, disabled }: { campo: CampoLancamento; valor: string; onChange: (v: string) => void; disabled?: boolean }) {
  const moeda = campo.tipo === 'moeda'
  return (
    <div>
      <label style={{ ...labelStyle, marginBottom: 3 }}>{campo.label}</label>
      <div style={{ position: 'relative' }}>
        {moeda && <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12.5, color: 'var(--v2-ink3)', pointerEvents: 'none' }}>R$</span>}
        <input type="text" inputMode={moeda ? 'decimal' : 'numeric'} disabled={disabled} value={valor}
          onChange={e => onChange(moeda ? formatarEntradaMoeda(e.target.value) : formatarEntradaInteiro(e.target.value))}
          placeholder={moeda ? '0,00' : '0'} aria-label={campo.label}
          style={{ ...inputStyle, ...(moeda ? { paddingLeft: 34 } : {}) }} />
      </div>
    </div>
  )
}

// Lançamento gravado -> textos dos campos, para editar.
function camposDaMetrica(m: Metrica, objetivo: string, idioma: any = 'pt'): Record<string, string> {
  const { principais, funil } = camposDoLancamento(objetivo, idioma)
  const out: Record<string, string> = {}
  for (const c of [...principais, ...funil]) out[c.k] = numeroParaCampo(c.tipo, (m as any)[c.k])
  return out
}
// Textos dos campos -> números. `vazioComoNull` na edição: apagar o campo apaga o número.
function numerosDosCampos(textos: Record<string, string>, objetivo: string, vazioComoNull: boolean, idioma: any = 'pt'): Record<string, number | null> {
  const { principais, funil } = camposDoLancamento(objetivo, idioma)
  const out: Record<string, number | null> = {}
  for (const c of [...principais, ...funil]) {
    if (!(c.k in textos)) continue
    const v = campoParaNumero(c.tipo, textos[c.k])
    if (v !== null || vazioComoNull) out[c.k] = v
  }
  return out
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)', color: 'var(--v2-ink)', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }
const cardStyle: React.CSSProperties = { background: 'var(--v2-surface)', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: 16 }

function Variacao({ pct, campo }: { pct: number | null; campo: 'custo' | 'resultado' }) {
  const tr = useT()
  if (pct === null) return null
  const boa = variacaoBoa(campo, pct)
  const cor = boa === null ? 'var(--v2-ink3)' : boa ? 'var(--v2-ok)' : 'var(--v2-hot)'
  return (
    <span title={tr('met.comparado-dica')} style={{ fontSize: 11, fontWeight: 700, color: cor, whiteSpace: 'nowrap' }}>
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
  const area = useArea()
  const { idioma } = useIdioma()
  const tr = useT()
  const [contas, setContas] = useState<Conta[]>([])
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [metricas, setMetricas] = useState<Metrica[]>([])
  const [marcos, setMarcos] = useState<MarcoLeve[]>([])
  const [carregando, setCarregando] = useState(true)
  const [refMes, setRefMes] = useState(() => new Date())
  const [campanhaAberta, setCampanhaAberta] = useState<Campanha | null>(null)
  const [novaCampanha, setNovaCampanha] = useState(false)
  const [contasAbertas, setContasAbertas] = useState(false)
  const [gradeAberta, setGradeAberta] = useState(false)
  // Grade aberta A PARTIR de uma campanha: mostra só ela e o "Voltar" devolve à campanha.
  const [gradeDaCampanha, setGradeDaCampanha] = useState<Campanha | null>(null)
  // LEITURA DO PERÍODO: o texto do gestor, por cliente e mês. É o que transforma número em
  // conversa, e vai junto no PDF que o cliente recebe depois.
  const [leitura, setLeitura] = useState('')
  // Período PERSONALIZADO (semana, quinzena, trimestre). Ausente = o mês de `refMes`.
  const [intervalo, setIntervalo] = useState<{ de: string; ate: string } | null>(null)
  const [editandoPeriodo, setEditandoPeriodo] = useState(false)

  const periodo = useMemo(() => {
    const mes = periodoDoMes(refMes)
    if (!intervalo) return mes
    // A leitura do período fica guardada no mês de início do intervalo.
    return { de: intervalo.de, ate: intervalo.ate, rotulo: rotuloIntervalo(intervalo.de, intervalo.ate), chave: intervalo.de.slice(0, 7) }
  }, [refMes, intervalo])
  const anterior = useMemo(() => periodoDeComparacao(periodo.de, periodo.ate, !intervalo), [periodo, intervalo])

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
  useEffect(() => {
    if (!clienteId) return
    let vivo = true
    fetch(`/api/ads/leitura?clienteId=${clienteId}&periodo=${periodo.chave}`).then(r => r.ok ? r.json() : null)
      .then(d => { if (vivo) setLeitura(d?.texto || '') }).catch(() => { if (vivo) setLeitura('') })
    return () => { vivo = false }
  }, [clienteId, periodo.chave])
  async function salvarLeitura() {
    await fetch('/api/ads/leitura', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId, periodo: periodo.chave, texto: leitura }),
    }).catch(() => null)
  }

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

  // FUNIL DE VENDAS do período (e do anterior, para a variação). Em campanha de vendas a
  // compra é o próprio resultado — lancamentosDoFunil faz essa ponte antes de somar.
  const objetivoDaCampanha = (id: string) => campanhas.find(c => c.id === id)?.objetivo
  // Só as campanhas que TÊM funil entram: gasto de campanha de mensagens não vira custo por venda.
  const funil = useMemo(() => funilDeVendas(somar(lancamentosDoFunil(soCampanha(doPeriodo), objetivoDaCampanha)), idioma), [doPeriodo, campanhas])
  const funilAnt = useMemo(() => funilDeVendas(somar(lancamentosDoFunil(soCampanha(doAnterior), objetivoDaCampanha)), idioma), [doAnterior, campanhas])

  // ------------------------------------------------------------ BLOCO (card do cliente)
  if (compacto) {
    const semNada = !campanhas.length
    return (
      <div>
        {carregando ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)' }}>{tr('cfg.carregando')}</p>
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
              const r = resultadoDoObjetivo(o.objetivo, o.atual, idioma)
              const rAnt = resultadoDoObjetivo(o.objetivo, o.ant, idioma)
              return (
                <div key={o.objetivo} style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', fontSize: 13 }}>
                  <strong style={{ color: 'var(--v2-ink)' }}>{fmtNumero(r.valor)}</strong>
                  <span style={{ color: 'var(--v2-ink2)' }}>{r.rotulo}</span>
                  <span style={{ color: 'var(--v2-ink3)' }}>· {r.custoLabel.toLowerCase()} {fmtDinheiro(r.custo)}</span>
                  <Variacao pct={variacao(r.custo || 0, rAnt.custo || 0)} campo="custo" />
                </div>
              )
            })}
            {!porObjetivo.length && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>{tr('met.sem-numeros-mes')}</p>}
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--v2-ink3)' }}>{ativas.length} campanha{ativas.length === 1 ? '' : 's'} ativa{ativas.length === 1 ? '' : 's'} · {campanhas.length} no total</p>
          </div>
        )}
      </div>
    )
  }

  // ------------------------------------------------------------ TELA COMPLETA
  // Esta tela É o material de reunião (dono, 09/09: "substituir os PPTs; mostramos a tela
  // do sistema para o cliente perceber o que estamos fazendo"). Por isso: número grande,
  // evolução visível, criativos que rodaram e uma leitura escrita. Os controles de edição
  // ficam discretos e somem no PDF (@media print em globals.css, classe .metricas-oculto).
  const serie = useMemo(() => serieDoPeriodo(soCampanha(doPeriodo) as any, periodo.de, periodo.ate), [doPeriodo, periodo])
  const anunciosNoAr = useMemo(() => {
    const out: { campanha: Campanha; publico: Publico; anuncio: Anuncio }[] = []
    for (const c of campanhas) {
      if (c.status === 'encerrada') continue
      for (const pb of c.publicos || []) for (const an of pb.anuncios || []) out.push({ campanha: c, publico: pb, anuncio: an })
    }
    return out
  }, [campanhas])

  return (
    <div className="metricas-tela">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: 'var(--v2-ink)' }}>{area('metricas')}{clienteNome ? ` · ${clienteNome}` : ''}</h2>
          {/* PERÍODO DE ANÁLISE escrito por extenso (dono, 16/09): quem olha a tela ou o PDF
              precisa saber de que datas são os números e com o que estão sendo comparados. */}
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--v2-ink2)' }}>
            {tr('met.midia-paga')} · <strong style={{ color: 'var(--v2-ink)' }}>{tr('met.periodo-analise')}: {rotuloIntervalo(periodo.de, periodo.ate, idioma)}</strong>
          </p>
          <p style={{ margin: '1px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>{tr('met.comparado')} {rotuloIntervalo(anterior.de, anterior.ate, idioma)}</p>
        </div>
        <div className="metricas-oculto" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { setIntervalo(null); setEditandoPeriodo(false); setRefMes(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }} aria-label={tr('met.mes-anterior')} style={{ width: 30, height: 30, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 8, cursor: 'pointer', color: 'var(--v2-ink2)' }}>‹</button>
          <button onClick={() => { setIntervalo(null); setEditandoPeriodo(false); setRefMes(new Date()) }} style={{ padding: '0 12px', height: 30, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--v2-ink2)' }}>{tr('met.mes-atual')}</button>
          <button onClick={() => { setIntervalo(null); setEditandoPeriodo(false); setRefMes(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }} aria-label={tr('met.proximo-mes')} style={{ width: 30, height: 30, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 8, cursor: 'pointer', color: 'var(--v2-ink2)' }}>›</button>
          <button onClick={() => setEditandoPeriodo(v => !v)} aria-expanded={editandoPeriodo} style={{ padding: '0 12px', height: 30, border: `1px solid ${intervalo ? 'var(--v2-info)' : 'var(--v2-rule)'}`, background: 'var(--v2-surface)', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: intervalo ? 'var(--v2-info)' : 'var(--v2-ink2)' }}>{tr('met.personalizar')}</button>
          {editandoPeriodo && (
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" aria-label={tr('met.inicio-periodo')} value={periodo.de} max={periodo.ate}
                onChange={e => e.target.value && setIntervalo({ de: e.target.value, ate: e.target.value > periodo.ate ? e.target.value : periodo.ate })}
                style={{ ...inputStyle, width: 150, padding: '5px 8px', height: 30 }} />
              <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>a</span>
              <input type="date" aria-label={tr('met.fim-periodo')} value={periodo.ate} min={periodo.de}
                onChange={e => e.target.value && setIntervalo({ de: e.target.value < periodo.de ? e.target.value : periodo.de, ate: e.target.value })}
                style={{ ...inputStyle, width: 150, padding: '5px 8px', height: 30 }} />
            </span>
          )}
        </div>
        <div className="metricas-oculto" style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => window.print()} title={tr('met.exportar-dica')} style={{ padding: '9px 16px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('met.exportar-pdf')}</button>
          {podeEditar && <>
            <button onClick={() => setContasAbertas(true)} style={{ padding: '9px 16px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              {tr('met.contas')} {contas.length ? `(${contas.length})` : ''}
            </button>
            <button onClick={() => setNovaCampanha(true)} style={{ padding: '9px 16px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('met.campanha')}</button>
            <button onClick={() => setGradeAberta(true)} disabled={!campanhas.length} style={{ padding: '9px 16px', background: campanhas.length ? 'var(--v2-amber-on)' : 'var(--v2-surface2)', color: campanhas.length ? '#17150E' : 'var(--v2-ink3)', border: 0, borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: campanhas.length ? 'pointer' : 'default', fontFamily: 'inherit' }}>{tr('met.lancar-editar')}</button>
          </>}
        </div>
      </div>

      {carregando ? (
        <p style={{ fontSize: 13, color: 'var(--v2-ink3)' }}>{tr('cfg.carregando')}</p>
      ) : !campanhas.length ? (
        <div style={{ ...cardStyle, padding: '44px 20px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--v2-ink3)' }}>Nenhuma campanha cadastrada para {clienteNome || 'este cliente'}.</p>
          {podeEditar && (
            <p style={{ margin: '6px 0 14px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>{tr('met.cadastre-primeiro')}</p>
          )}
          {podeEditar && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setContasAbertas(true)} style={{ padding: '10px 18px', background: contas.length ? 'var(--v2-surface)' : 'var(--v2-ink)', color: contas.length ? 'var(--v2-ink)' : 'var(--v2-surface)', border: contas.length ? '1px solid var(--v2-rule)' : 0, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {contas.length ? 'Contas de anúncio' : '1. Cadastrar conta de anúncio'}
              </button>
              <button onClick={() => setNovaCampanha(true)} style={{ padding: '10px 18px', background: contas.length ? 'var(--v2-amber-on)' : 'var(--v2-surface)', color: contas.length ? '#17150E' : 'var(--v2-ink2)', border: contas.length ? 0 : '1px solid var(--v2-rule)', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {contas.length ? '+ Nova campanha' : '2. Nova campanha'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* O NÚMERO QUE ABRE A CONVERSA: investimento e o resultado de cada objetivo */}
          <div style={{ ...cardStyle, marginBottom: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 34, fontWeight: 300, color: 'var(--v2-ink)', letterSpacing: '-0.02em' }}>{fmtDinheiro(total.investimento)}</span>
                <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--v2-ink3)' }}>{tr('met.investidos')}</span>
                <Variacao pct={variacao(total.investimento, totalAnt.investimento)} campo="resultado" />
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                {porObjetivo.map(o => {
                  const r = resultadoDoObjetivo(o.objetivo, o.atual, idioma)
                  const rAnt = resultadoDoObjetivo(o.objetivo, o.ant, idioma)
                  return (
                    <div key={o.objetivo}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 28, fontWeight: 300, color: 'var(--v2-ink)' }}>{fmtNumero(r.valor)}</span>
                        <Variacao pct={variacao(r.valor, rAnt.valor)} campo="resultado" />
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink2)' }}>{r.rotulo}</p>
                      <p style={{ margin: '1px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>
                        {r.custoLabel.toLowerCase()} {fmtDinheiro(r.custo)} <Variacao pct={variacao(r.custo || 0, rAnt.custo || 0)} campo="custo" />
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
            {!porObjetivo.length && <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--v2-ink3)' }}>Sem números lançados neste período.{podeEditar ? ' Use "Lançar números".' : ''}</p>}
          </div>

          {/* EVOLUÇÃO — a leitura visual do período */}
          {serie.length > 1 && (
            <div style={{ ...cardStyle, marginBottom: 12 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>{tr('met.evolucao')}</h3>
              {/* Resultado só entra na curva quando há UM objetivo no período: somar
                  mensagem com visita ao perfil seria a mesma mentira que a tela evita em cima. */}
              <Evolucao serie={serie} objetivoUnico={porObjetivo.length === 1 ? rotulosObjetivo(porObjetivo[0].objetivo, idioma).plural : ''} />
            </div>
          )}

          {/* Entrega detalhada: cliques, alcance e o custo do clique */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 12 }}>
            {[
              { rotulo: tr('kpi.impressoes'), valor: fmtNumero(total.impressoes), pct: variacao(total.impressoes, totalAnt.impressoes), campo: 'resultado' as const },
              { rotulo: tr('kpi.alcance'), valor: fmtNumero(total.alcance), pct: variacao(total.alcance, totalAnt.alcance), campo: 'resultado' as const },
              { rotulo: tr('kpi.cliques'), valor: fmtNumero(total.cliques), pct: variacao(total.cliques, totalAnt.cliques), campo: 'resultado' as const },
              { rotulo: tr('kpi.ctr'), valor: fmtPct(der.ctr), pct: variacao(der.ctr || 0, derAnt.ctr || 0), campo: 'resultado' as const },
              { rotulo: tr('kpi.cpc'), valor: fmtDinheiro(der.cpc), pct: variacao(der.cpc || 0, derAnt.cpc || 0), campo: 'custo' as const },
              { rotulo: tr('kpi.cpm'), valor: fmtDinheiro(der.cpm), pct: variacao(der.cpm || 0, derAnt.cpm || 0), campo: 'custo' as const },
              { rotulo: tr('kpi.frequencia'), valor: der.frequencia === null ? '—' : der.frequencia.toFixed(2).replace('.', ','), pct: null, campo: 'resultado' as const },
            ].map(k => (
              <div key={k.rotulo} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 20, fontWeight: 300, color: 'var(--v2-ink)' }}>{k.valor}</span>
                  <Variacao pct={k.pct} campo={k.campo} />
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>{k.rotulo}</p>
              </div>
            ))}
          </div>

          {/* FUNIL DE VENDAS (dono, 16/09): do produto visto à compra, com a taxa de passagem
              de cada etapa, custo por venda, ticket médio e ROAS. Só aparece quando há número
              lançado — cliente sem e-commerce não vê um funil vazio. */}
          {funil.temDados && (
            <div style={{ ...cardStyle, marginBottom: 12 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>{tr('met.funil')}</h3>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {funil.etapas.filter(e => e.valor > 0).map((e, i) => {
                  const ant = funilAnt.etapas.find(x => x.chave === e.chave)
                  return (
                    <div key={e.chave} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 150px' }}>
                      {i > 0 && (
                        <span title={tr('met.taxa-passagem')} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--v2-info)', whiteSpace: 'nowrap' }}>
                          → {fmtPct(e.taxaDaAnterior)}
                        </span>
                      )}
                      <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'var(--v2-surface1)' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 20, fontWeight: 300, color: 'var(--v2-ink)' }}>{fmtNumero(e.valor)}</span>
                          <Variacao pct={variacao(e.valor, ant?.valor || 0)} campo="resultado" />
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>{e.label}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                {[
                  { rotulo: tr('kpi.receita'), valor: fmtDinheiro(funil.receita), pct: variacao(funil.receita, funilAnt.receita), campo: 'resultado' as const },
                  { rotulo: tr('kpi.roas'), valor: fmtRoas(funil.roas), pct: variacao(funil.roas || 0, funilAnt.roas || 0), campo: 'resultado' as const },
                  { rotulo: tr('kpi.custo-venda'), valor: fmtDinheiro(funil.custoPorVenda), pct: variacao(funil.custoPorVenda || 0, funilAnt.custoPorVenda || 0), campo: 'custo' as const },
                  { rotulo: tr('kpi.ticket'), valor: fmtDinheiro(funil.ticketMedio), pct: variacao(funil.ticketMedio || 0, funilAnt.ticketMedio || 0), campo: 'resultado' as const },
                  { rotulo: tr('kpi.custo-carrinho'), valor: fmtDinheiro(funil.custoPorCarrinho), pct: variacao(funil.custoPorCarrinho || 0, funilAnt.custoPorCarrinho || 0), campo: 'custo' as const },
                  { rotulo: tr('kpi.carrinho-checkout'), valor: fmtPct(funil.taxaCarrinhoCheckout), pct: null, campo: 'resultado' as const },
                  { rotulo: tr('kpi.checkout-compra'), valor: fmtPct(funil.taxaCheckoutCompra), pct: null, campo: 'resultado' as const },
                  { rotulo: tr('kpi.carrinho-compra'), valor: fmtPct(funil.taxaCarrinhoCompra), pct: null, campo: 'resultado' as const },
                  { rotulo: tr('kpi.clique-compra'), valor: fmtPct(funil.taxaCliqueCompra, 2), pct: null, campo: 'resultado' as const },
                ].filter(k => k.valor !== '—').map(k => (
                  <div key={k.rotulo} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 17, fontWeight: 400, color: 'var(--v2-ink)' }}>{k.valor}</span>
                      <Variacao pct={k.pct} campo={k.campo} />
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>{k.rotulo}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Campanha a campanha */}
          <div style={{ ...cardStyle, marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>{tr('met.campanhas')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {campanhas.map(c => {
                const at = daCampanha(c.id, doPeriodo), an = daCampanha(c.id, doAnterior)
                const r = resultadoDoObjetivo(c.objetivo, at, idioma)
                const rAnt = resultadoDoObjetivo(c.objetivo, an, idioma)
                const st = STATUS_CAMPANHA[c.status] || STATUS_CAMPANHA.ativa
                const marco = marcos.find(m => m.id === c.marcoId)
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--v2-rule)', flexWrap: 'wrap' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: corCanal(c.canal), flexShrink: 0 }} title={labelCanal(c.canal)} />
                    <button onClick={() => podeEditar && setCampanhaAberta(c)} style={{ flex: 1, minWidth: 180, textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: podeEditar ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--v2-ink)' }}>{c.nome}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--v2-ink3)' }}>
                        {labelCanal(c.canal)} · {rotulosObjetivo(c.objetivo, idioma).label}
                        {c.dataInicio ? ` · ${tr('met.desde')} ${fmtDia(c.dataInicio)}` : ''}
                        {marco ? ` · ${marco.titulo}` : ''}
                      </span>
                    </button>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: st.cor, background: st.bg, padding: '3px 9px', borderRadius: 999 }}>{st.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--v2-ink)', minWidth: 90, textAlign: 'right' }}>{fmtDinheiro(at.investimento)}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--v2-ink2)', minWidth: 150, textAlign: 'right' }}>
                      <strong>{fmtNumero(r.valor)}</strong> {r.rotulo}
                    </span>
                    <span style={{ fontSize: 12.5, color: 'var(--v2-ink2)', minWidth: 110, textAlign: 'right' }}>{fmtDinheiro(r.custo)}</span>
                    <Variacao pct={variacao(r.custo || 0, rAnt.custo || 0)} campo="custo" />
                  </div>
                )
              })}
            </div>
          </div>

          {/* CRIATIVOS que rodaram — o slide que o cliente mais olha, agora é uma seção */}
          {anunciosNoAr.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 12 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>{tr('met.criativos-no-ar')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12 }}>
                {anunciosNoAr.map(({ campanha, publico, anuncio }) => (
                  <div key={`${campanha.id}-${anuncio.id}`}>
                    {anuncio.criativoUrl ? (
                      <button type="button" onClick={() => window.open(anuncio.criativoUrl, '_blank', 'noopener')} title={tr('met.abrir-criativo')} style={{ padding: 0, border: '1px solid var(--v2-rule)', borderRadius: 10, overflow: 'hidden', background: 'var(--v2-surface)', cursor: 'zoom-in', lineHeight: 0, width: '100%' }}>
                        {(anuncio.criativoTipo || '').startsWith('video')
                          ? <video src={anuncio.criativoUrl} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} muted />
                          : <img src={anuncio.criativoUrl} alt={anuncio.titulo} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />}
                      </button>
                    ) : (
                      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 10, border: '1px dashed var(--v2-rule2)', display: 'grid', placeItems: 'center', color: 'var(--v2-ink3)', fontSize: 11 }}>{tr('met.sem-print')}</div>
                    )}
                    <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 600, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{anuncio.titulo}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--v2-ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{publico.titulo} · {campanha.nome}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LEITURA DO PERÍODO: o que o número não conta. Vai junto no PDF. */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>{tr('met.leitura')}</h3>
            {podeEditar ? (
              <textarea value={leitura} onChange={e => setLeitura(e.target.value)} onBlur={salvarLeitura} rows={4}
                placeholder={tr('met.leitura-placeholder')}
                style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13.5, fontFamily: 'inherit', background: 'var(--v2-surface)', color: 'var(--v2-ink)', resize: 'vertical', lineHeight: 1.55, boxSizing: 'border-box' }} />
            ) : (
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--v2-ink2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{leitura || 'Sem observações neste período.'}</p>
            )}
            {podeEditar && <p className="metricas-oculto" style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>{tr('met.leitura-salva')}</p>}
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
          onLancar={c => { setCampanhaAberta(null); setGradeDaCampanha(c); setGradeAberta(true) }}
        />
      )}
      {gradeAberta && (
        <GradeLancamento campanhas={campanhas} clienteId={clienteId} periodo={periodo} metricas={metricas}
          campanhaInicial={gradeDaCampanha}
          onClose={() => { setGradeAberta(false); setGradeDaCampanha(null) }}
          onRecarregar={carregar}
          onVoltarCampanha={gradeDaCampanha ? () => { const c = campanhas.find(x => x.id === gradeDaCampanha.id) || gradeDaCampanha; setGradeAberta(false); setGradeDaCampanha(null); setCampanhaAberta(c) } : undefined} />
      )}
      {contasAbertas && (
        <ContasModal contas={contas} clienteId={clienteId} clienteNome={clienteNome} onClose={() => setContasAbertas(false)} onSalvo={carregar} />
      )}
    </div>
  )
}

// Gráfico de evolução: barras de investimento com a linha de resultado por cima.
// SVG na mão — o sistema não carrega biblioteca de gráfico para desenhar cinco barras.
function Evolucao({ serie, objetivoUnico }: { serie: { rotulo: string; investimento: number; resultados: number }[]; objetivoUnico?: string }) {
  const tr = useT()
  const maxInv = Math.max(...serie.map(b => b.investimento), 1)
  const maxRes = Math.max(...serie.map(b => b.resultados), 1)
  const L = 40, A = 150, GAP = 10
  const larguraBarra = 46
  const total = serie.length * (larguraBarra + GAP)
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={Math.max(total, 240)} height={A + 46} role="img" aria-label={tr('met.evolucao-aria')}>
        {serie.map((b, i) => {
          const x = i * (larguraBarra + GAP)
          const h = Math.max(2, (b.investimento / maxInv) * (A - L))
          const y = A - h
          const yRes = A - Math.max(2, (b.resultados / maxRes) * (A - L))
          return (
            <g key={i}>
              <rect x={x} y={y} width={larguraBarra} height={h} rx={5} fill="var(--v2-amber-on)" opacity={0.85} />
              <text x={x + larguraBarra / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--v2-ink2)">{fmtDinheiro(b.investimento)}</text>
              {objetivoUnico && <circle cx={x + larguraBarra / 2} cy={yRes} r={4} fill="var(--v2-ink)" />}
              {objetivoUnico && <text x={x + larguraBarra / 2} y={yRes - 9} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--v2-ink)">{fmtNumero(b.resultados)}</text>}
              <text x={x + larguraBarra / 2} y={A + 16} textAnchor="middle" fontSize="10" fill="var(--v2-ink3)">{b.rotulo}</text>
            </g>
          )
        })}
        <line x1={0} y1={A} x2={Math.max(total, 240)} y2={A} stroke="var(--v2-rule)" strokeWidth="1" />
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, color: 'var(--v2-ink3)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--v2-amber-on)' }} />{tr('met.investimento')}</span>
        {objetivoUnico
          ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--v2-ink)' }} />{objetivoUnico}</span>
          : <span>{tr('met.sem-soma-objetivos')}</span>}
      </div>
    </div>
  )
}

// GRADE DE LANÇAMENTO: todas as campanhas numa tela só (dono, 09/09: "não consegui usar de
// forma prática" — era um modal por campanha). Preenche o que tiver, salva de uma vez.
//
// Dono, 16/09, quatro ajustes nesta tela:
// - "não conseguimos editar o valor lançado": cada campanha lista os lançamentos do período,
//   com Editar (e Excluir) — a edição abre dentro da própria grade;
// - "não aceita a vírgula dos centavos": campos com máscara de Real (CampoValor);
// - "lançar métricas mais completas": funil de vendas (carrinho, checkout, compras, receita);
// - "falta VOLTAR para não fechar o modal": barra fixa no topo com Voltar — da edição para a
//   lista, da lista para a campanha de onde veio (ou para o painel).
// Sair por qualquer caminho SALVA o que foi digitado (regra do sistema, lib/fecharModal).
function GradeLancamento({ campanhas, clienteId, periodo, metricas, campanhaInicial, onClose, onRecarregar, onVoltarCampanha }: {
  campanhas: Campanha[]; clienteId: string; periodo: { de: string; ate: string; rotulo: string }
  metricas: Metrica[]; campanhaInicial?: Campanha | null
  onClose: () => void; onRecarregar: () => void; onVoltarCampanha?: () => void
}) {
  const { idioma } = useIdioma()
  const tr = useT()
  const [de, setDe] = useState(periodo.de)
  const [ate, setAte] = useState(periodo.ate)
  const [linhas, setLinhas] = useState<Record<string, Record<string, string>>>({})
  const [funilAberto, setFunilAberto] = useState<Record<string, boolean>>({})
  const [soUma, setSoUma] = useState(campanhaInicial?.id || '')
  const [edicao, setEdicao] = useState<{ metrica: Metrica; de: string; ate: string; campos: Record<string, string>; original: string } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const set = (id: string, campo: string, v: string) => setLinhas(l => ({ ...l, [id]: { ...(l[id] || {}), [campo]: v } }))

  // Lançamento que TOCA o intervalo da grade (não só o que começa dentro dele): um mês
  // lançado inteiro aparece mesmo quando a grade está numa semana do meio.
  const lancamentosDe = (id: string) => metricas
    .filter(m => m.campanhaId === id && m.nivel === 'campanha' && m.data <= ate && (m.ate || m.data) >= de)
    .sort((a, b) => b.data.localeCompare(a.data))
  const jaLancado = (id: string) => somar(noPeriodo(metricas.filter(m => m.campanhaId === id && m.nivel === 'campanha'), de, ate))
  const disponiveis = campanhas.filter(c => c.status !== 'encerrada' || c.id === soUma || lancamentosDe(c.id).length > 0)
  const visiveis = soUma ? disponiveis.filter(c => c.id === soUma) : disponiveis
  const preenchidas = disponiveis.filter(c => Object.values(linhas[c.id] || {}).some(v => String(v).trim() !== ''))
  const periodoOk = !!de && !!ate && de <= ate

  async function lancar(): Promise<boolean> {
    if (!preenchidas.length) return true
    if (salvando) return false
    if (!periodoOk) { toast(tr('met.data-invalida'), 'erro'); return false }
    setSalvando(true)
    const criados: string[] = []
    for (const c of preenchidas) {
      const numeros = numerosDosCampos(linhas[c.id] || {}, c.objetivo, false, idioma)
      if (!Object.keys(numeros).length) continue
      const r = await fetch('/api/ads/metricas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId, campanhaId: c.id, nivel: 'campanha', refId: c.id, data: de, ate, ...numeros }),
      }).then(x => x.json()).catch(() => null)
      if (r?.metrica?.id) criados.push(r.metrica.id)
    }
    setSalvando(false)
    if (!criados.length) { toast(tr('met.erro-lancar'), 'erro'); return false }
    registrarDesfazer(tr('met.desfazer-lancamento', { n: criados.length }), async () => {
      const rs = await Promise.all(criados.map(id => fetch(`/api/ads/metricas?id=${id}`, { method: 'DELETE' }).then(x => x.ok).catch(() => false)))
      onRecarregar()
      return rs.every(Boolean)
    })
    toast(tr('met.lancadas', { n: criados.length }), 'sucesso')
    setLinhas({})
    onRecarregar()
    return true
  }

  const campanhaDe = (m: Metrica) => campanhas.find(c => c.id === m.campanhaId)
  function abrirEdicao(m: Metrica) {
    const campos = camposDaMetrica(m, campanhaDe(m)?.objetivo || '', idioma)
    const fim = m.ate || m.data
    setEdicao({ metrica: m, de: m.data, ate: fim, campos, original: JSON.stringify({ de: m.data, ate: fim, campos }) })
  }

  async function salvarEdicao(): Promise<boolean> {
    if (!edicao) return true
    if (JSON.stringify({ de: edicao.de, ate: edicao.ate, campos: edicao.campos }) === edicao.original) return true
    if (!edicao.de || !edicao.ate || edicao.de > edicao.ate) { toast(tr('met.data-invalida'), 'erro'); return false }
    if (salvando) return false
    const m = edicao.metrica
    const numeros = numerosDosCampos(edicao.campos, campanhaDe(m)?.objetivo || '', true, idioma)
    setSalvando(true)
    const r = await fetch('/api/ads/metricas', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, data: edicao.de, ate: edicao.ate, ...numeros }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { toast(tr('met.erro-salvar'), 'erro'); return false }
    const antes: Record<string, unknown> = { id: m.id, data: m.data, ate: m.ate || '' }
    for (const c of CAMPOS_NUMERICOS) antes[c] = (m as any)[c] ?? null
    registrarDesfazer('Edição do lançamento', async () => {
      const x = await fetch('/api/ads/metricas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(antes) }).catch(() => null)
      onRecarregar()
      return !!x?.ok
    })
    toast(tr('met.lancamento-atualizado'), 'sucesso')
    onRecarregar()
    return true
  }

  async function excluirLancamento(m: Metrica) {
    if (!(await confirmar(tr('met.dlg-excluir-lancamento', { periodo: rotuloIntervalo(m.data, m.ate || m.data, idioma) }), { titulo: tr('met.excluir-lancamento'), okLabel: tr('comum.excluir'), perigo: true }))) return
    const r = await fetch(`/api/ads/metricas?id=${m.id}`, { method: 'DELETE' }).catch(() => null)
    if (!r?.ok) { toast('Não foi possível excluir o lançamento.', 'erro'); return }
    registrarDesfazer('Exclusão do lançamento', async () => {
      const x = await fetch('/api/ads/metricas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, restaurar: true }) }).catch(() => null)
      onRecarregar()
      return !!x?.ok
    })
    setEdicao(null)
    onRecarregar()
  }

  const sair = () => (onVoltarCampanha ? onVoltarCampanha() : onClose())
  async function voltar() {
    if (edicao) { if (await salvarEdicao()) setEdicao(null); return }
    if (await lancar()) sair()
  }
  async function fecharTudo() {
    if (edicao && !(await salvarEdicao())) return
    if (await lancar()) onClose()
  }

  const rotuloVoltar = tr(edicao ? 'met.voltar-lancamentos' : onVoltarCampanha ? 'met.voltar-campanha' : 'met.voltar-painel')
  const resumo = (m: Metrica) => {
    const c = campanhaDe(m)
    const r = resultadoDoObjetivo(c?.objetivo, somar([m]), idioma)
    return `${fmtDinheiro(m.investimento ?? 0)} · ${fmtNumero(r.valor)} ${r.rotulo}${m.receita ? ` · receita ${fmtDinheiro(m.receita)}` : ''}`
  }
  const botaoLink: React.CSSProperties = { background: 'none', border: 0, padding: 0, color: 'var(--v2-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div onClick={fecharFora(() => { void fecharTudo() })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 900, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '0 22px 22px' }}>
        {/* Barra fixa: Voltar sempre à mão, mesmo com a lista rolada até o fim. */}
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--v2-surface)', margin: '0 -22px 14px', padding: '14px 22px 12px', borderBottom: '1px solid var(--v2-rule)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={voltar} disabled={salvando} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px 7px 9px', background: 'var(--v2-surface1)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: salvando ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>‹</span> {rotuloVoltar}
          </button>
          <h3 style={{ margin: 0, fontSize: 15, color: 'var(--v2-ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tr(edicao ? 'met.editar-lancamento' : 'met.lancar-titulo')}
          </h3>
          <button onClick={fecharTudo} aria-label={tr('comum.fechar')} title={tr('comum.fechar')} style={{ width: 32, height: 32, background: 'none', border: 0, color: 'var(--v2-ink3)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {edicao ? (() => {
          const c = campanhaDe(edicao.metrica)
          const { principais, funil } = camposDoLancamento(c?.objetivo, idioma)
          const setCampo = (k: string, v: string) => setEdicao(e => e && ({ ...e, campos: { ...e.campos, [k]: v } }))
          return (
            <div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--v2-ink2)' }}>
                <strong style={{ color: 'var(--v2-ink)' }}>{c?.nome || 'Campanha'}</strong> · {rotulosObjetivo(c?.objetivo, idioma).label}
              </p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <div>
                  <label style={labelStyle}>{tr('met.de')}</label>
                  <input type="date" value={edicao.de} onChange={e => setEdicao(x => x && ({ ...x, de: e.target.value }))} style={{ ...inputStyle, width: 160 }} />
                </div>
                <div>
                  <label style={labelStyle}>{tr('met.ate')}</label>
                  <input type="date" value={edicao.ate} onChange={e => setEdicao(x => x && ({ ...x, ate: e.target.value }))} style={{ ...inputStyle, width: 160 }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
                {principais.map(col => <CampoValor key={col.k} campo={col} valor={edicao.campos[col.k] || ''} onChange={v => setCampo(col.k, v)} />)}
              </div>
              <h4 style={{ margin: '16px 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)' }}>{tr('met.funil')}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
                {funil.map(col => <CampoValor key={col.k} campo={col} valor={edicao.campos[col.k] || ''} onChange={v => setCampo(col.k, v)} />)}
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>{tr('met.apagar-campo')}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                <button onClick={voltar} disabled={salvando} style={{ flex: 1, padding: '12px 0', background: 'var(--v2-amber-on)', color: '#17150E', border: 0, borderRadius: 10, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {salvando ? 'Salvando…' : 'Salvar e voltar'}
                </button>
                <button onClick={() => excluirLancamento(edicao.metrica)} style={{ padding: '12px 16px', background: 'var(--v2-surface)', color: 'var(--v2-hot)', border: '1px solid var(--v2-hot-bg)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('met.excluir-lancamento')}</button>
              </div>
            </div>
          )
        })() : (
          <>
            <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>{tr('met.lancar-ajuda')}</p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>{tr('met.de')}</label>
                <input type="date" value={de} onChange={e => setDe(e.target.value)} style={{ ...inputStyle, width: 160 }} />
              </div>
              <div>
                <label style={labelStyle}>{tr('met.ate')}</label>
                <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={{ ...inputStyle, width: 160 }} />
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: periodoOk ? 'var(--v2-ink3)' : 'var(--v2-hot)' }}>
                {periodoOk ? tr('met.um-lancamento', { periodo: rotuloIntervalo(de, ate, idioma) }) : tr('met.data-invalida')}
              </p>
            </div>
            {campanhaInicial && (
              <p style={{ margin: '0 0 8px' }}>
                {soUma
                  ? <button onClick={() => setSoUma('')} style={botaoLink}>{tr('met.mostrar-todas')}</button>
                  : <button onClick={() => setSoUma(campanhaInicial.id)} style={botaoLink}>Mostrar só “{campanhaInicial.nome}”</button>}
              </p>
            )}

            {visiveis.map(c => {
              const ja = jaLancado(c.id)
              const temAlgo = ja.investimento > 0 || ja.resultados > 0
              const { principais, funil } = camposDoLancamento(c.objetivo, idioma)
              const linha = linhas[c.id] || {}
              const funilVisivel = funilAberto[c.id] ?? (!!objetivoDe(c.objetivo).receita || funil.some(f => (linha[f.k] || '').trim()))
              const lancados = lancamentosDe(c.id)
              return (
                <div key={c.id} style={{ padding: '12px 0', borderTop: '1px solid var(--v2-rule)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: corCanal(c.canal), flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)' }}>{c.nome}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--v2-ink3)' }}>{rotulosObjetivo(c.objetivo, idioma).label}</span>
                    {temAlgo && <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--v2-ok)' }}>já lançado no período: {fmtDinheiro(ja.investimento)} · {fmtNumero(ja.resultados)} {rotulosObjetivo(c.objetivo, idioma).plural}</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
                    {principais.map(col => <CampoValor key={col.k} campo={col} valor={linha[col.k] || ''} onChange={v => set(c.id, col.k, v)} />)}
                  </div>
                  <button onClick={() => setFunilAberto(f => ({ ...f, [c.id]: !funilVisivel }))} aria-expanded={funilVisivel} style={{ ...botaoLink, marginTop: 9, fontSize: 11.5 }}>
                    {funilVisivel ? '− Ocultar funil de vendas' : '+ Funil de vendas (carrinho, checkout, compras, receita)'}
                  </button>
                  {funilVisivel && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, marginTop: 8, padding: 10, borderRadius: 10, background: 'var(--v2-surface1)' }}>
                      {funil.map(col => <CampoValor key={col.k} campo={col} valor={linha[col.k] || ''} onChange={v => set(c.id, col.k, v)} />)}
                    </div>
                  )}
                  {lancados.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)' }}>{tr('met.lancamentos-periodo')}</span>
                      {lancados.map(m => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px dashed var(--v2-rule)', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--v2-ink2)', minWidth: 150 }}>{rotuloIntervalo(m.data, m.ate || m.data, idioma)}</span>
                          <span style={{ fontSize: 12, color: 'var(--v2-ink)', flex: 1, minWidth: 160 }}>{resumo(m)}</span>
                          <button onClick={() => abrirEdicao(m)} style={{ padding: '4px 11px', background: 'var(--v2-surface)', color: 'var(--v2-info)', border: '1px solid var(--v2-rule)', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('comum.editar')}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {!visiveis.length && <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--v2-ink3)' }}>{tr('met.sem-campanha-lancar')}</p>}

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={async () => { if (await lancar()) sair() }} disabled={salvando || !preenchidas.length} style={{ flex: 1, padding: '12px 0', background: preenchidas.length ? 'var(--v2-amber-on)' : 'var(--v2-surface2)', color: preenchidas.length ? '#17150E' : 'var(--v2-ink3)', border: 0, borderRadius: 10, fontWeight: 800, fontSize: 13.5, cursor: preenchidas.length ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                {salvando ? tr('met.lancando') : preenchidas.length ? tr('met.lancar-n', { n: preenchidas.length }) : tr('met.preencha-linha')}
              </button>
              <button onClick={voltar} disabled={salvando} style={{ padding: '12px 18px', background: 'var(--v2-surface2)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('comum.voltar')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ContasModal({ contas, clienteId, clienteNome, onClose, onSalvo }: {
  contas: Conta[]; clienteId: string; clienteNome?: string; onClose: () => void; onSalvo: () => void
}) {
  const tr = useT()
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
    if (!(await confirmar(tr('met.dlg-excluir-conta', { nome: c.nome }), { titulo: tr('met.dlg-titulo-conta'), okLabel: tr('comum.excluir'), perigo: true }))) return
    await fetch(`/api/ads/contas?id=${c.id}`, { method: 'DELETE' }).catch(() => null)
    registrarDesfazer(tr('met.desfazer-conta', { nome: c.nome }), async () => {
      const r = await fetch('/api/ads/contas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, restaurar: true }) }).catch(() => null)
      onSalvo()
      return !!r?.ok
    })
    onSalvo()
  }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--v2-ink)' }}>{tr('met.contas')}</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>{tr('met.conta-ajuda')}</p>

        {contas.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '1px solid var(--v2-rule)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: corCanal(c.canal), flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--v2-ink)' }}>{c.nome}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--v2-ink3)' }}>{labelCanal(c.canal)}{c.identificador ? ` · ${c.identificador}` : ''}</span>
            </div>
            <button onClick={() => excluir(c)} title={tr('comum.excluir')} style={{ background: 'none', border: 0, color: 'var(--v2-hot)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        ))}
        {!contas.length && <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--v2-ink3)' }}>{tr('met.sem-conta')}</p>}

        <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'var(--v2-surface1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>{tr('met.canal')}</label>
              <select value={canal} onChange={e => setCanal(e.target.value as CanalAds)} style={inputStyle}>
                {CANAIS.map(c => <option key={c.chave} value={c.chave}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{canal === 'google' ? 'ID do cliente (123-456-7890)' : 'ID da conta (act_…)'}</label>
              <input value={identificador} onChange={e => setIdentificador(e.target.value)} placeholder={tr('comum.opcional')} style={inputStyle} />
            </div>
          </div>
          <label style={labelStyle}>{tr('met.nome-conta')}</label>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder={tr('met.ex-conta')} style={inputStyle} />
          <button onClick={criar} disabled={!nome.trim() || salvando} style={{ marginTop: 10, padding: '9px 16px', background: nome.trim() ? 'var(--v2-ink)' : 'var(--v2-surface2)', color: nome.trim() ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 0, borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: nome.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {salvando ? 'Salvando…' : '+ Cadastrar conta'}
          </button>
        </div>

        <button onClick={onClose} style={{ marginTop: 18, width: '100%', padding: '11px 0', background: 'var(--v2-surface2)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('comum.fechar')}</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- campanha (estrutura)
function CampanhaModal({ campanha, clienteId, clienteNome, contas, marcos, metricas, podeEditar, onClose, onSalvo, onLancar }: {
  campanha: Campanha | null; clienteId: string; clienteNome?: string; contas: Conta[]; marcos: MarcoLeve[]
  metricas: Metrica[]; podeEditar: boolean; onClose: () => void; onSalvo: () => void; onLancar: (c: Campanha) => void
}) {
  const { idioma } = useIdioma()
  const tr = useT()
  const [form, setForm] = useState({
    nome: campanha?.nome || '',
    canal: (campanha?.canal || contas[0]?.canal || 'meta') as string,
    contaId: campanha?.contaId || contas[0]?.id || '',
    objetivo: campanha?.objetivo || '',
    tipoGoogle: campanha?.tipoGoogle || 'pesquisa',
    status: campanha?.status || 'ativa',
    dataInicio: (campanha?.dataInicio || '').slice(0, 10),
    dataFim: (campanha?.dataFim || '').slice(0, 10),
    orcamento: moedaParaCampo(campanha?.orcamento),
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
      orcamento: form.orcamento.trim() === '' ? undefined : parseMoeda(form.orcamento),
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
    if (!(await confirmar(tr('met.dlg-excluir-campanha', { nome: campanha.nome }), { titulo: tr('met.dlg-titulo-campanha'), okLabel: tr('comum.excluir'), perigo: true }))) return
    await fetch(`/api/ads/campanhas?id=${campanha.id}`, { method: 'DELETE' }).catch(() => null)
    registrarDesfazer(tr('met.desfazer-campanha', { nome: campanha.nome }), async () => {
      const r = await fetch('/api/ads/campanhas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: campanha.id, restaurar: true }) }).catch(() => null)
      onSalvo()
      return !!r?.ok
    })
    onSalvo()
  }

  const soma = somar(metricas.filter(m => m.nivel === 'campanha'))
  const res = resultadoDoObjetivo(objetivoOk, soma, idioma)

  return (
    <div onClick={fecharFora(fecharSalvando)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 760, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--v2-ink)' }}>{campanha ? 'Campanha' : 'Nova campanha'}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>{tr('met.canal-obrigatorio')}</label>
            <select disabled={!podeEditar} value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value, objetivo: '', contaId: '' }))} style={inputStyle}>
              {CANAIS.map(c => <option key={c.chave} value={c.chave}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{tr('met.conta')}</label>
            <select disabled={!podeEditar} value={form.contaId} onChange={e => setForm(f => ({ ...f, contaId: e.target.value }))} style={inputStyle}>
              <option value="">{contasDoCanal.length ? 'Selecione…' : 'Nenhuma conta deste canal'}</option>
              {contasDoCanal.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        <label style={labelStyle}>{tr('met.nome-campanha')}</label>
        <input disabled={!podeEditar} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder={tr('met.ex-campanha')} style={{ ...inputStyle, marginBottom: 10 }} />

        <div style={{ display: 'grid', gridTemplateColumns: form.canal === 'google' ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>{tr('met.objetivo')}<span style={{ fontWeight: 400 }}>{tr('met.objetivo-ajuda')}</span></label>
            <select disabled={!podeEditar} value={objetivoOk} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} style={inputStyle}>
              {objetivos.map(o => <option key={o.chave} value={o.chave}>{rotulosObjetivo(o.chave, idioma).label}</option>)}
            </select>
            <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--v2-info)' }}>Mede: {rotulosObjetivo(objetivoOk, idioma).plural} · {rotulosObjetivo(objetivoOk, idioma).custoLabel.toLowerCase()}</p>
          </div>
          {form.canal === 'google' && (
            <div>
              <label style={labelStyle}>{tr('met.tipo-campanha')}</label>
              <select disabled={!podeEditar} value={form.tipoGoogle} onChange={e => setForm(f => ({ ...f, tipoGoogle: e.target.value }))} style={inputStyle}>
                {TIPOS_GOOGLE.map(t => <option key={t.chave} value={t.chave}>{t.label}</option>)}
              </select>
              <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>{tipoG?.temPalavraChave ? 'Tem palavras-chave e negativas.' : 'Sem palavras-chave: usa sinais de público.'}</p>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>{tr('comum.status')}</label>
            <select disabled={!podeEditar} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
              {Object.entries(STATUS_CAMPANHA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{tr('met.inicio')}</label>
            <input disabled={!podeEditar} type="date" value={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{tr('met.fim-opcional')}</label>
            <input disabled={!podeEditar} type="date" value={form.dataFim} onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{tr('met.orcamento')}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12.5, color: 'var(--v2-ink3)', pointerEvents: 'none' }}>R$</span>
                <input disabled={!podeEditar} type="text" inputMode="decimal" value={form.orcamento} onChange={e => setForm(f => ({ ...f, orcamento: formatarEntradaMoeda(e.target.value) }))} placeholder="0,00" aria-label={tr('met.orcamento')} style={{ ...inputStyle, paddingLeft: 34 }} />
              </div>
              <select disabled={!podeEditar} value={form.orcamentoTipo} onChange={e => setForm(f => ({ ...f, orcamentoTipo: e.target.value }))} style={{ ...inputStyle, width: 110 }}>
                <option value="diario">{tr('met.por-dia')}</option>
                <option value="total">{tr('met.total')}</option>
              </select>
            </div>
          </div>
        </div>

        <label style={labelStyle}>{tr('met.etapa-playbook')}<span style={{ fontWeight: 400 }}>{tr('met.etapa-ajuda')}</span></label>
        <select disabled={!podeEditar} value={form.marcoId} onChange={e => setForm(f => ({ ...f, marcoId: e.target.value }))} style={{ ...inputStyle, marginBottom: 16 }}>
          <option value="">{tr('met.nenhuma')}</option>
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
                  <input disabled={!podeEditar} value={p.titulo} onChange={e => setPub(p.id, { titulo: e.target.value })} placeholder={tr('met.titulo-publico', { nivel: rotuloPub.singular.toLowerCase() })} style={inputStyle} />
                  <textarea disabled={!podeEditar} value={p.descricao || ''} onChange={e => setPub(p.id, { descricao: e.target.value })} rows={2} placeholder={tr('met.descricao-publico')} style={{ ...inputStyle, marginTop: 8, resize: 'vertical' }} />
                </div>
                {podeEditar && <button onClick={() => rmPub(p.id)} title={tr('comum.remover')} style={{ background: 'none', border: 0, color: 'var(--v2-hot)', cursor: 'pointer', fontSize: 16 }}>×</button>}
              </div>

              {mostraPalavras && (
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>{tr('met.palavras-chave')}</label>
                  {(p.palavrasChave || []).map((k, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input disabled={!podeEditar} value={k.termo} onChange={e => setPub(p.id, { palavrasChave: (p.palavrasChave || []).map((x, j) => j === i ? { ...x, termo: e.target.value } : x) })} placeholder={tr('met.termo')} style={inputStyle} />
                      <select disabled={!podeEditar} value={k.correspondencia} onChange={e => setPub(p.id, { palavrasChave: (p.palavrasChave || []).map((x, j) => j === i ? { ...x, correspondencia: e.target.value as Correspondencia } : x) })} style={{ ...inputStyle, width: 130 }}>
                        {CORRESPONDENCIAS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {podeEditar && <button onClick={() => setPub(p.id, { palavrasChave: (p.palavrasChave || []).filter((_, j) => j !== i) })} style={{ background: 'none', border: 0, color: 'var(--v2-hot)', cursor: 'pointer' }}>×</button>}
                    </div>
                  ))}
                  {podeEditar && <button onClick={() => setPub(p.id, { palavrasChave: [...(p.palavrasChave || []), { termo: '', correspondencia: 'ampla' as Correspondencia }] })} style={{ background: 'none', border: 0, color: 'var(--v2-info)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>{tr('met.add-palavra')}</button>}
                </div>
              )}

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--v2-rule)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--v2-ink3)' }}>{tr('met.anuncios')}</span>
                  {podeEditar && <button onClick={() => addAnuncio(p.id)} style={{ marginLeft: 'auto', background: 'none', border: 0, color: 'var(--v2-info)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>{tr('met.add-anuncio')}</button>}
                </div>
                {(p.anuncios || []).map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--v2-rule)' }}>
                    <div style={{ width: 76, flexShrink: 0 }}>
                      {a.criativoUrl ? (
                        <button type="button" onClick={() => window.open(a.criativoUrl, '_blank', 'noopener')} title={tr('met.abrir-criativo')} style={{ padding: 0, border: '1px solid var(--v2-rule)', borderRadius: 8, overflow: 'hidden', background: 'var(--v2-surface)', cursor: 'zoom-in', lineHeight: 0, width: 76 }}>
                          {(a.criativoTipo || '').startsWith('video')
                            ? <video src={a.criativoUrl} style={{ width: 76, height: 76, objectFit: 'cover' }} muted />
                            : <img src={a.criativoUrl} alt="" style={{ width: 76, height: 76, objectFit: 'cover' }} />}
                        </button>
                      ) : (
                        <div style={{ width: 76, height: 76, borderRadius: 8, border: '1px dashed var(--v2-rule2)', display: 'grid', placeItems: 'center', color: 'var(--v2-ink3)', fontSize: 10, textAlign: 'center', padding: 4 }}>{tr('met.sem-print')}</div>
                      )}
                      {podeEditar && (
                        <label style={{ display: 'block', marginTop: 5, fontSize: 10.5, color: 'var(--v2-info)', fontWeight: 700, cursor: enviando === a.id ? 'wait' : 'pointer', textAlign: 'center' }}>
                          {enviando === a.id ? 'enviando…' : a.criativoUrl ? 'trocar' : '+ print'}
                          <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) enviarCriativo(p.id, a.id, f); e.target.value = '' }} />
                        </label>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input disabled={!podeEditar} value={a.titulo} onChange={e => setAnuncio(p.id, a.id, { titulo: e.target.value })} placeholder={tr('met.titulo-anuncio')} style={inputStyle} />
                      <input disabled={!podeEditar} value={a.descricao || ''} onChange={e => setAnuncio(p.id, a.id, { descricao: e.target.value })} placeholder={tr('comum.descricao')} style={inputStyle} />
                      <textarea disabled={!podeEditar} value={a.textoPrincipal || ''} onChange={e => setAnuncio(p.id, a.id, { textoPrincipal: e.target.value })} rows={2} placeholder={tr('met.texto-principal')} style={{ ...inputStyle, resize: 'vertical' }} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input disabled={!podeEditar} value={a.cta || ''} onChange={e => setAnuncio(p.id, a.id, { cta: e.target.value })} placeholder={tr('met.cta')} style={inputStyle} />
                        <input disabled={!podeEditar} value={a.urlDestino || ''} onChange={e => setAnuncio(p.id, a.id, { urlDestino: e.target.value })} placeholder={tr('met.url-destino')} style={inputStyle} />
                      </div>
                    </div>
                    {podeEditar && <button onClick={() => rmAnuncio(p.id, a.id)} title={tr('met.remover-anuncio')} style={{ background: 'none', border: 0, color: 'var(--v2-hot)', cursor: 'pointer', fontSize: 15 }}>×</button>}
                  </div>
                ))}
                {!(p.anuncios || []).length && <p style={{ margin: 0, fontSize: 11.5, color: 'var(--v2-ink3)' }}>{tr('met.sem-anuncio')}</p>}
              </div>
            </div>
          ))}
          {!publicos.length && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Nenhum {rotuloPub.singular.toLowerCase()} cadastrado ainda.</p>}
        </div>

        {campanha && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'var(--v2-surface1)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)' }}>{tr('met.acumulado')}</span>
              <span style={{ fontSize: 13, color: 'var(--v2-ink)' }}>{fmtDinheiro(soma.investimento)}</span>
              <span style={{ fontSize: 13, color: 'var(--v2-ink2)' }}><strong>{fmtNumero(res.valor)}</strong> {res.rotulo}</span>
              <span style={{ fontSize: 13, color: 'var(--v2-ink2)' }}>{res.custoLabel}: {fmtDinheiro(res.custo)}</span>
              {podeEditar && <button onClick={async () => { if (alterado() && form.nome.trim()) await salvar(); onLancar(campanha) }} style={{ marginLeft: 'auto', padding: '6px 12px', background: 'var(--v2-surface)', color: 'var(--v2-info)', border: '1px solid var(--v2-info-bg)', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('met.lancar-editar')}</button>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          {podeEditar && (
            <button onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ flex: 1, padding: '11px 0', background: form.nome.trim() ? 'var(--v2-amber-on)' : 'var(--v2-surface2)', color: form.nome.trim() ? '#17150E' : 'var(--v2-ink3)', border: 0, borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: form.nome.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
              {salvando ? 'Salvando…' : campanha ? 'Salvar' : 'Criar campanha'}
            </button>
          )}
          <button onClick={fecharSalvando} style={{ padding: '11px 16px', background: 'var(--v2-surface2)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('comum.fechar')}</button>
          {campanha && podeEditar && (
            <button onClick={excluir} style={{ padding: '11px 16px', background: 'var(--v2-surface)', color: 'var(--v2-hot)', border: '1px solid var(--v2-hot-bg)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('comum.excluir')}</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- lançamento de números

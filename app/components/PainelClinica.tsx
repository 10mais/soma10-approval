'use client'
import { useEffect, useMemo, useState } from 'react'
import { useT, useIdioma } from './Idioma'
import { localeDe } from '@/lib/i18n'
import { intervaloSemana, intervaloMes, CORES_SITUACAO, type MetaAno } from '@/lib/metas'
import {
  metasDoPeriodo, semanaDaComercial, paradosHaDias, funilDoMes, pipelinesDaClinica, conversao, normalizaMetasSemana,
  type MensagemEnviada, type TarefaP, type UsuarioP, type MetasSemana, type CardMeta, type ChaveCard,
} from '@/lib/painelClinica'

// PAINEL DA CLÍNICA no CRM — plano aprovado pelo dono em 13/11/2026 (metas da
// semana, semana da comercial, paradas e funil do mês). As regras moram em
// lib/painelClinica e rodam AQUI, no fuso de quem olha; /api/crm/painel-clinica
// só entrega o que o CRM ainda não carregou. Nada da tela antiga sai: o painel
// por funil continua logo abaixo.

type Lista = any[]
type Dados = { mensagens: MensagemEnviada[]; ultimaMsgPorTel: Record<string, string>; ultimaMsgPorContato: Record<string, string>; tarefas: TarefaP[]; equipe: UsuarioP[]; metasAno: MetaAno[]; metasSemana: MetasSemana }

const card: React.CSSProperties = { background: 'var(--v2-surface)', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
const titulo: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: 'var(--v2-ink)', display: 'block', margin: '0 0 10px' }
const dica: React.CSSProperties = { margin: '8px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)', lineHeight: 1.5 }
const botaoSeta: React.CSSProperties = { border: 'none', background: 'none', cursor: 'pointer', padding: '4px 9px', fontSize: 15, color: 'var(--v2-ink3)', fontFamily: 'inherit' }

const ROTULO_CARD: Record<ChaveCard, string> = { consultasNovas: 'pc.consultas-novas', retornos: 'pc.retornos', comparecimentos: 'pc.comparecimentos', tratamentos: 'pc.tratamentos' }
const capitalizar = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function useFormatos() {
  const { idioma } = useIdioma()
  const loc = localeDe(idioma)
  return {
    loc,
    reais: (v: number) => (Number(v) || 0).toLocaleString(loc, { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
    mesLongo: (d: Date) => capitalizar(d.toLocaleDateString(loc, { month: 'long', year: 'numeric' })),
    mesCurto: (d: Date) => d.toLocaleDateString(loc, { month: 'short' }).replace(/\.$/, ''),
    diaMes: (d: Date) => d.toLocaleDateString(loc, { day: 'numeric', month: 'long' }),
    diaMesCurto: (d: Date) => d.toLocaleDateString(loc, { day: 'numeric', month: 'short' }).replace(/\.$/, ''),
  }
}

function Seletor({ rotulo, onAnterior, onProximo, extra }: { rotulo: string; onAnterior: () => void; onProximo: () => void; extra?: React.ReactNode }) {
  const tr = useT()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--v2-surface)', borderRadius: 999, padding: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <button onClick={onAnterior} title={tr('pc.anterior')} aria-label={tr('pc.anterior')} style={botaoSeta}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--v2-ink)', padding: '0 4px', whiteSpace: 'nowrap' }}>{rotulo}</span>
        <button onClick={onProximo} title={tr('pc.proximo')} aria-label={tr('pc.proximo')} style={botaoSeta}>›</button>
      </div>
      {extra}
    </div>
  )
}

function CartaoMeta({ c }: { c: CardMeta }) {
  const tr = useT()
  const f = useFormatos()
  const p = c.progresso
  const cores = CORES_SITUACAO[p.situacao]
  const num = (v: number) => (c.moeda ? f.reais(v) : String(Math.round(v)))
  const largura = p.semMeta ? 0 : Math.min(100, Math.max(0, p.pct))
  const esperado = Math.ceil(p.esperadoAteHoje)
  return (
    <div style={{ ...card, padding: 14 }}>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)', fontWeight: 700 }}>{tr(ROTULO_CARD[c.chave])}</p>
      <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: 'var(--v2-ink)', lineHeight: 1.2 }}>
        {num(c.realizado)}
        {!p.semMeta && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--v2-ink3)' }}> {tr('pc.de-meta', { meta: num(c.meta) })}</span>}
      </p>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--v2-surface2)', margin: '9px 0 8px', overflow: 'hidden' }}>
        <div style={{ width: `${largura}%`, height: '100%', background: p.semMeta ? 'transparent' : cores.cor, borderRadius: 999 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: cores.cor, background: cores.fundo, padding: '2px 8px', borderRadius: 999 }}>{tr(`pc.sit.${p.situacao}`)}</span>
        <span style={{ fontSize: 11.5, color: 'var(--v2-ink3)' }}>
          {p.semMeta ? tr('pc.sem-meta')
            : p.situacao === 'batida' ? ''
            : p.situacao === 'atrasado' ? tr('pc.esperado-hoje', { n: c.moeda ? f.reais(p.esperadoAteHoje) : esperado })
            : tr('pc.faltam', { n: num(p.falta) })}
          {c.faltas ? `${p.semMeta || p.situacao === 'batida' ? '' : ' · '}${tr('pc.faltas', { n: c.faltas })}` : ''}
        </span>
      </div>
      {c.chave === 'tratamentos' && <p style={{ ...dica, marginTop: 6 }}>{tr('pc.tratamentos-dica')}</p>}
    </div>
  )
}

export function PainelSemanaClinica({ negocios, contatos, agendamentos, estagios, pipelines, onAbrirNegocio, onWhatsApp }: {
  negocios: Lista; contatos: Lista; agendamentos: Lista; estagios: Lista; pipelines: Lista
  onAbrirNegocio?: (id: string) => void; onWhatsApp?: (telefone: string, contatoId?: string) => void
}) {
  const tr = useT()
  const f = useFormatos()
  const [modo, setModo] = useState<'semana' | 'mes'>('semana')
  const [ref, setRef] = useState(() => new Date())
  const [de, ate] = useMemo(() => (modo === 'mes' ? intervaloMes(ref.getFullYear(), ref.getMonth()) : intervaloSemana(ref)), [modo, ref])
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    setErro(false)
    fetch(`/api/crm/painel-clinica?de=${encodeURIComponent(de.toISOString())}&ate=${encodeURIComponent(ate.toISOString())}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => { if (vivo) setDados({ ...d, metasSemana: normalizaMetasSemana(d?.metasSemana) }) })
      .catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [de, ate])

  const andar = (passo: number) => setRef(r => {
    const n = new Date(r)
    if (modo === 'mes') { n.setDate(1); n.setMonth(n.getMonth() + passo) } else n.setDate(n.getDate() + passo * 7)
    return n
  })
  const rotulo = modo === 'mes'
    ? f.mesLongo(de)
    : tr('pc.semana-de', { de: de.getMonth() === ate.getMonth() ? String(de.getDate()) : f.diaMesCurto(de), ate: f.diaMes(ate) })

  const { tratamentos } = useMemo(() => pipelinesDaClinica(pipelines), [pipelines])
  const agora = new Date()
  const cards = useMemo(() => dados ? metasDoPeriodo({ agendamentos, contatos, negocios, pipelineTratamentosId: tratamentos, metasSemana: dados.metasSemana, metasAno: dados.metasAno, de, ate, agora }) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados, agendamentos, contatos, negocios, tratamentos, de, ate])
  const linhas = useMemo(() => dados ? semanaDaComercial({ usuarios: dados.equipe, agendamentos, tarefas: dados.tarefas, negocios, mensagens: dados.mensagens, de, ate, agora }) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados, agendamentos, negocios, de, ate])
  const parados = useMemo(() => dados ? paradosHaDias({ negocios, contatos, estagios, pipelines, ultimaMsgPorTel: dados.ultimaMsgPorTel, ultimaMsgPorContato: dados.ultimaMsgPorContato, agora }) : { itens: [], total: 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados, negocios, contatos, estagios, pipelines])

  const alterna = (
    <div style={{ display: 'flex', gap: 3, background: 'var(--v2-surface2)', borderRadius: 9, padding: 3 }}>
      {(['semana', 'mes'] as const).map(m => (
        <button key={m} onClick={() => { setModo(m); setRef(new Date()) }}
          style={{ padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', background: modo === m ? 'var(--v2-surface)' : 'transparent', color: modo === m ? 'var(--v2-ink)' : 'var(--v2-ink3)', boxShadow: modo === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
          {tr(m === 'semana' ? 'pc.semana' : 'pc.mes')}
        </button>
      ))}
    </div>
  )
  const th: React.CSSProperties = { textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.03em', padding: '8px 8px', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { textAlign: 'right', fontSize: 13, color: 'var(--v2-ink)', padding: '9px 8px', borderTop: '1px solid var(--v2-rule)', whiteSpace: 'nowrap' }

  return (
    <div style={{ maxWidth: 920, marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--v2-ink)' }}>{tr(modo === 'mes' ? 'pc.metas-do-mes' : 'pc.metas-semana')}</span>
        <span style={{ flex: 1 }} />
        <Seletor rotulo={rotulo} onAnterior={() => andar(-1)} onProximo={() => andar(1)} extra={alterna} />
      </div>

      {erro ? <p style={{ fontSize: 13, color: 'var(--v2-hot)' }}>{tr('pc.falha-carregar')}</p> : !dados ? <p style={{ fontSize: 13, color: 'var(--v2-ink3)' }}>{tr('conta.carregando')}</p> : (<>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {cards.map(c => <CartaoMeta key={c.chave} c={c} />)}
        </div>
        <p style={dica}>{tr('pc.regra')}</p>

        <div style={{ ...card, marginTop: 16 }}>
          <span style={titulo}>{tr(modo === 'mes' ? 'pc.comercial-mes' : 'pc.comercial-semana')}</span>
          {linhas.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)' }}>{tr('pc.comercial-vazio')}</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left' }}>{tr('pc.col-pessoa')}</th>
                    <th style={th}>{tr('pc.col-conversas')}</th>
                    <th style={th}>{tr('pc.col-followups')}</th>
                    <th style={th}>{tr('pc.col-atrasados')}</th>
                    <th style={th}>{tr('pc.col-agendou')}</th>
                    <th style={th}>{tr('pc.col-veio')}</th>
                    <th style={th}>{tr('pc.col-conversao')}</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l => (
                    <tr key={l.chave}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 700, whiteSpace: 'normal' }}>
                        {l.semAutor ? <span style={{ color: 'var(--v2-ink3)', fontWeight: 600 }}>{tr('pc.pelo-celular')}</span> : l.nome}
                        {!l.semAutor && l.papel === 'vendas' && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--v2-ink3)' }}>{tr('pc.papel-comercial')}</span>}
                      </td>
                      <td style={td}>{l.conversas}</td>
                      <td style={td}>{l.semAutor ? '—' : l.followupsFeitos}</td>
                      <td style={{ ...td, color: l.followupsAtrasados ? 'var(--v2-hot)' : 'var(--v2-ink)', fontWeight: l.followupsAtrasados ? 800 : 400 }}>{l.semAutor ? '—' : l.followupsAtrasados}</td>
                      <td style={td}>{l.semAutor ? '—' : l.agendou}</td>
                      <td style={td}>{l.semAutor ? '—' : l.veio}</td>
                      <td style={td}>{l.conversao == null ? '—' : `${l.conversao}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={dica}>{tr('pc.comercial-dica')}</p>
        </div>

        <div style={{ ...card, marginTop: 16 }}>
          <span style={titulo}>{tr('pc.parados')}{parados.total ? ` · ${parados.total}` : ''}</span>
          {parados.itens.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)' }}>{tr('pc.parados-vazio')}</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {parados.itens.map(i => (
                <div key={i.negocioId} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', border: '1px solid var(--v2-rule)', borderRadius: 10, padding: '8px 10px' }}>
                  <button onClick={() => onAbrirNegocio?.(i.negocioId)} title={tr('pc.abrir-oportunidade')}
                    style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, minWidth: 180, background: 'none', border: 'none', padding: 0, cursor: onAbrirNegocio ? 'pointer' : 'default', textAlign: 'left', fontFamily: 'inherit' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--v2-ink)' }}>{i.nome || i.titulo}</span>
                    <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>{[i.estagio, i.pipeline].filter(Boolean).join(' · ')}</span>
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 700, color: i.dias >= 14 ? 'var(--v2-hot)' : 'var(--v2-amber)' }}>{tr('pc.dias-sem-contato', { n: i.dias })}</span>
                  {i.telefone && onWhatsApp && (
                    <button onClick={() => onWhatsApp(i.telefone!, i.contatoId)}
                      style={{ padding: '5px 12px', background: '#25D366', color: 'var(--v2-surface)', border: 'none', borderRadius: 999, fontWeight: 800, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('crm.whatsapp')}</button>
                  )}
                </div>
              ))}
              {parados.total > parados.itens.length && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>{tr('pc.e-mais', { n: parados.total - parados.itens.length })}</p>}
            </div>
          )}
          <p style={dica}>{tr('pc.parados-dica')}</p>
        </div>
      </>)}
    </div>
  )
}

// ── Funil por mês: seletor + faixa Entraram → Agendaram → Compareceram → Fecharam
export function FunilMesClinica({ negocios, agendamentos, contatos, pipelines, mes, onMes, incluirAbertas, onIncluirAbertas }: {
  negocios: Lista; agendamentos: Lista; contatos: Lista; pipelines: Lista
  mes: string // 'YYYY-MM' ou '' = todos os meses (o quadro como era)
  onMes: (mes: string) => void; incluirAbertas: boolean; onIncluirAbertas: (v: boolean) => void
}) {
  const tr = useT()
  const f = useFormatos()
  const hoje = new Date()
  const base = /^\d{4}-\d{2}$/.test(mes) ? new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1) : new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const anterior = new Date(base.getFullYear(), base.getMonth() - 1, 1)
  const chaveMes = (d: Date) => ymd(d).slice(0, 7)
  const { entrada, tratamentos } = useMemo(() => pipelinesDaClinica(pipelines), [pipelines])
  const padrao = [...(pipelines || [])].sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))[0]?.id
  const calc = (d: Date) => {
    const [de, ate] = intervaloMes(d.getFullYear(), d.getMonth())
    return funilDoMes({ negocios, agendamentos, contatos, pipelineEntradaId: entrada, pipelineTratamentosId: tratamentos, pipelinePadraoId: padrao, de, ate })
  }
  const atual = useMemo(() => calc(base), // eslint-disable-next-line react-hooks/exhaustive-deps
    [negocios, agendamentos, contatos, entrada, tratamentos, padrao, mes])
  const antes = useMemo(() => calc(anterior), // eslint-disable-next-line react-hooks/exhaustive-deps
    [negocios, agendamentos, contatos, entrada, tratamentos, padrao, mes])
  const andar = (passo: number) => onMes(chaveMes(new Date(base.getFullYear(), base.getMonth() + passo, 1)))
  const comparar = (a: number, b: number) => {
    const d = a - b
    return d === 0 ? { txt: tr('pc.igual', { mes: f.mesCurto(anterior) }), cor: 'var(--v2-ink3)' } : { txt: tr('pc.vs', { d: d > 0 ? `+${d}` : String(d), mes: f.mesCurto(anterior) }), cor: d > 0 ? 'var(--v2-ok)' : 'var(--v2-hot)' }
  }
  const etapas = [
    { k: 'pc.entraram', v: atual.entraram, a: antes.entraram, pct: null as number | null },
    { k: 'pc.agendaram', v: atual.agendaram, a: antes.agendaram, pct: conversao(atual.entraram, atual.agendaram) },
    { k: 'pc.compareceram', v: atual.compareceram, a: antes.compareceram, pct: conversao(atual.agendaram, atual.compareceram) },
    { k: 'pc.fecharam', v: atual.fecharam, a: antes.fecharam, pct: conversao(atual.compareceram, atual.fecharam) },
  ]
  const chave = (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: mes ? 'var(--v2-ink2)' : 'var(--v2-ink3)', cursor: mes ? 'pointer' : 'default' }}>
      <input type="checkbox" checked={incluirAbertas} disabled={!mes} onChange={e => onIncluirAbertas(e.target.checked)} style={{ width: 15, height: 15, cursor: mes ? 'pointer' : 'default' }} />
      {tr('pc.incluir-abertas')}
    </label>
  )
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <Seletor rotulo={mes ? f.mesLongo(base) : tr('pc.todos-meses')} onAnterior={() => andar(mes ? -1 : 0)} onProximo={() => andar(mes ? 1 : 0)}
          extra={mes
            ? <button onClick={() => onMes('')} style={{ padding: '5px 11px', borderRadius: 999, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('pc.todos-meses')}</button>
            : <button onClick={() => onMes(chaveMes(hoje))} style={{ padding: '5px 11px', borderRadius: 999, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('pc.este-mes')}</button>} />
        {chave}
      </div>
      {mes && (<>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {etapas.map(e => {
            const c = comparar(e.v, e.a)
            return (
              <div key={e.k} style={{ ...card, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)', fontWeight: 700 }}>{tr(e.k)}</p>
                <p style={{ margin: '3px 0 0', fontSize: 20, fontWeight: 800, color: 'var(--v2-ink)' }}>
                  {/* Acima de 100% a conversão mente: consulta marcada por quem nem
                      passou pelo funil (paciente antiga, indicação direta) entra em
                      "agendaram" sem ter entrado. Nesse caso o % some. */}
                  {e.v}{e.pct != null && e.pct <= 100 && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v2-ink3)' }}> · {e.pct}%</span>}
                </p>
                {e.k === 'pc.fecharam' && atual.valorFechado > 0 && <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--v2-ok)' }}>{f.reais(atual.valorFechado)}</p>}
                <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: c.cor }}>{c.txt}</p>
              </div>
            )
          })}
        </div>
        <p style={dica}>{tr('pc.funil-legenda')} {tr('pc.funil-dica')}</p>
      </>)}
    </div>
  )
}

'use client'
import { useEffect, useMemo, useState } from 'react'
import { fecharFora } from '@/lib/fecharModal'
import { toast } from '@/lib/toast'
import {
  MetaAno, metaVazia, distribuirAnual, totalAno, metaIntervalo,
  intervaloMes, intervaloTrimestre, intervaloAno, intervaloSemana,
  realizadoNoIntervalo, progresso, dataDoGanho, NegocioMeta, Progresso,
  CORES_SITUACAO, MESES_CURTO, MESES_LONGO,
} from '@/lib/metas'

// META DE VENDAS — o painel que responde "quanto falta para bater o mês?".
//
// A meta é definida pelo admin (12 meses, ver lib/metas) e o REALIZADO vem
// sozinho: toda oportunidade marcada como ganha no CRM entra aqui, no mês em que
// foi fechada. Ninguém digita realizado — número derivado que vira registro é
// número que dessincroniza.

const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const brlExato = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataCurta = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }

// Anel de progresso. Vai além de 100% sem estourar o desenho: o excedente
// pinta o anel inteiro e o número segue crescendo (bater 140% da meta é
// notícia boa, e a tela não pode esconder).
function Anel({ pct, cor, tamanho = 132, espessura = 13, children }: { pct: number; cor: string; tamanho?: number; espessura?: number; children?: React.ReactNode }) {
  const r = (tamanho - espessura) / 2
  const circ = 2 * Math.PI * r
  const preenchido = Math.max(0, Math.min(100, pct)) / 100
  return (
    <div style={{ position: 'relative', width: tamanho, height: tamanho, flexShrink: 0 }}>
      <svg width={tamanho} height={tamanho} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="#f1f1f1" strokeWidth={espessura} />
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke={cor} strokeWidth={espessura} strokeLinecap="round"
          strokeDasharray={`${circ * preenchido} ${circ}`} style={{ transition: 'stroke-dasharray .5s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  )
}

// Barra com a marca do "onde a régua deveria estar hoje". É esse traço que
// transforma "faturei 12 mil" em "estou atrasado" — sem ele, só no fim do mês
// se descobre.
function BarraRitmo({ p, cor }: { p: Progresso; cor: string }) {
  const pctReal = p.semMeta ? 0 : Math.max(0, Math.min(100, p.pct))
  const pctHoje = p.semMeta || !p.meta ? 0 : Math.max(0, Math.min(100, (p.esperadoAteHoje / p.meta) * 100))
  return (
    <div style={{ position: 'relative', height: 12, background: '#f1f1f1', borderRadius: 8, overflow: 'visible' }}>
      <div style={{ width: `${pctReal}%`, height: '100%', background: cor, borderRadius: 8, transition: 'width .5s ease' }} />
      {pctHoje > 0 && pctHoje < 100 && (
        <div title="Onde a meta deveria estar hoje" style={{ position: 'absolute', left: `${pctHoje}%`, top: -3, width: 2, height: 18, background: '#111', opacity: 0.55, borderRadius: 2 }} />
      )}
    </div>
  )
}

export default function Metas({ podeEditar = false }: { podeEditar?: boolean }) {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [meta, setMeta] = useState<MetaAno>(metaVazia(hoje.getFullYear()))
  const [negocios, setNegocios] = useState<NegocioMeta[]>([])
  const [pipelines, setPipelines] = useState<{ id: string; nome: string }[]>([])
  const [funil, setFunil] = useState('')            // '' = todos os funis
  const [mesFoco, setMesFoco] = useState(hoje.getMonth())
  const [editar, setEditar] = useState(false)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    setCarregando(true)
    Promise.all([
      fetch(`/api/metas?ano=${ano}`).then(r => r.json()).catch(() => null),
      fetch('/api/crm/negocios').then(r => r.json()).catch(() => []),
      fetch('/api/crm/pipelines').then(r => r.json()).catch(() => []),
    ]).then(([m, n, p]) => {
      setMeta(m?.meta || metaVazia(ano))
      setNegocios(Array.isArray(n) ? n : [])
      setPipelines(Array.isArray(p) ? p : [])
      setCarregando(false)
    })
  }, [ano])

  // Foco volta para o mês corrente quando o ano é o de hoje; em outro ano, começa em janeiro.
  useEffect(() => { setMesFoco(ano === hoje.getFullYear() ? hoje.getMonth() : 0) }, [ano]) // eslint-disable-line react-hooks/exhaustive-deps

  const calc = (de: Date, ate: Date) => {
    const m = metaIntervalo(meta, de, ate)
    const r = realizadoNoIntervalo(negocios, de, ate, funil)
    return { ...progresso(m, r.valor, de, ate, hoje), qtd: r.qtd, lista: r.negocios }
  }

  const anoP = useMemo(() => calc(...intervaloAno(ano)), [meta, negocios, funil, ano])
  const trimestres = useMemo(() => [0, 1, 2, 3].map(t => ({ t, ...calc(...intervaloTrimestre(ano, t)) })), [meta, negocios, funil, ano])
  const meses = useMemo(() => Array.from({ length: 12 }, (_, m) => ({ m, ...calc(...intervaloMes(ano, m)) })), [meta, negocios, funil, ano])
  const foco = meses[mesFoco]
  const semanaAtual = useMemo(() => {
    const [de, ate] = intervaloSemana(hoje)
    return calc(de, ate)
  }, [meta, negocios, funil, ano])
  const ehAnoCorrente = ano === hoje.getFullYear()
  const maiorBarra = Math.max(1, ...meses.map(x => Math.max(x.meta, x.realizado)))

  const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
  const Selo = ({ p }: { p: Progresso }) => {
    const c = CORES_SITUACAO[p.situacao]
    return <span style={{ fontSize: 11, fontWeight: 800, color: c.cor, background: c.fundo, padding: '3px 9px', borderRadius: 999 }}>{c.label}</span>
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#111' }}>Metas</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#fff', borderRadius: 999, padding: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <button onClick={() => setAno(a => a - 1)} title="Ano anterior" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 9px', fontSize: 14, color: '#888' }}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#111', minWidth: 42, textAlign: 'center' }}>{ano}</span>
          <button onClick={() => setAno(a => a + 1)} title="Próximo ano" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 9px', fontSize: 14, color: '#888' }}>›</button>
        </div>
        <span style={{ flex: 1 }} />
        {podeEditar && (
          <button onClick={() => setEditar(true)} style={{ padding: '9px 16px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            {totalAno(meta) > 0 ? 'Editar meta' : 'Definir meta'}
          </button>
        )}
      </div>

      {/* Funil: a clínica tem mais de um (Agendamentos e Tratamentos). A meta em
          R$ costuma viver no de tratamento — mas quem escolhe é quem olha. */}
      {pipelines.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {[{ id: '', nome: 'Todos os funis' }, ...pipelines].map(p => (
            <button key={p.id} onClick={() => setFunil(p.id)}
              style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid ' + (funil === p.id ? '#111' : '#e6e6e6'), background: funil === p.id ? '#111' : '#fff', color: funil === p.id ? '#fff' : '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {p.nome}
            </button>
          ))}
        </div>
      )}

      {carregando ? <p style={{ fontSize: 13, color: '#aaa' }}>Carregando…</p> : (<>
        {totalAno(meta) === 0 && (
          <div style={{ ...cardStyle, marginBottom: 14, background: '#fffbeb', boxShadow: 'none', border: '1px solid #fde68a' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#92400e', fontWeight: 700 }}>Nenhuma meta definida para {ano}.</p>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#a16207' }}>
              {podeEditar ? 'Clique em "Definir meta" para lançar o valor do ano — ele é distribuído entre os 12 meses e você ajusta mês a mês.' : 'O administrador precisa definir a meta do ano. O realizado abaixo continua sendo contado.'}
            </p>
          </div>
        )}

        {/* ANO */}
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24 }}>
            <Anel pct={anoP.pct} cor={CORES_SITUACAO[anoP.situacao].cor === '#9ca3af' ? '#d4d4d4' : CORES_SITUACAO[anoP.situacao].cor} tamanho={140}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#111', lineHeight: 1 }}>{Math.round(anoP.pct)}%</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#999' }}>do ano</span>
            </Anel>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>Meta anual {ano}</span>
                <Selo p={anoP} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div><p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 600 }}>Meta</p><p style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 800, color: '#111' }}>{brl(anoP.meta)}</p></div>
                <div><p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 600 }}>Realizado</p><p style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 800, color: '#16a34a' }}>{brl(anoP.realizado)}</p></div>
                <div><p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 600 }}>{anoP.excedente > 0 ? 'Excedente' : 'Falta'}</p><p style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 800, color: anoP.excedente > 0 ? '#16a34a' : '#b91c1c' }}>{brl(anoP.excedente > 0 ? anoP.excedente : anoP.falta)}</p></div>
                <div><p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 600 }}>Vendas ganhas</p><p style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 800, color: '#111' }}>{anoP.qtd}</p></div>
              </div>
              <BarraRitmo p={anoP} cor={anoP.situacao === 'atrasado' ? '#ef4444' : '#16a34a'} />
            </div>
          </div>
        </div>

        {/* TRIMESTRES */}
        <span style={{ fontSize: 13, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Trimestres</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
          {trimestres.map(t => {
            const corrente = ehAnoCorrente && Math.floor(hoje.getMonth() / 3) === t.t
            const c = CORES_SITUACAO[t.situacao]
            return (
              <button key={t.t} onClick={() => setMesFoco(t.t * 3)} title={`Ver ${MESES_LONGO[t.t * 3]}`}
                style={{ ...cardStyle, textAlign: 'left', cursor: 'pointer', border: corrente ? '1.5px solid #111' : '1.5px solid transparent', font: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#111' }}>T{t.t + 1}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: t.semMeta ? '#bbb' : c.cor }}>{t.semMeta ? '—' : `${Math.round(t.pct)}%`}</span>
                </div>
                <p style={{ margin: '8px 0 2px', fontSize: 15, fontWeight: 800, color: '#111' }}>{brl(t.realizado)}</p>
                <p style={{ margin: 0, fontSize: 11.5, color: '#999' }}>de {brl(t.meta)}</p>
                <div style={{ height: 7, background: '#f1f1f1', borderRadius: 6, overflow: 'hidden', marginTop: 8 }}>
                  <div style={{ width: `${Math.min(100, t.pct)}%`, height: '100%', background: t.semMeta ? '#e5e5e5' : c.cor, transition: 'width .4s ease' }} />
                </div>
              </button>
            )
          })}
        </div>

        {/* MESES — clicar troca o foco de baixo */}
        <span style={{ fontSize: 13, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Meses</span>
        <div style={{ ...cardStyle, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 150, overflowX: 'auto' }}>
            {meses.map(x => {
              const selecionado = x.m === mesFoco
              const corrente = ehAnoCorrente && x.m === hoje.getMonth()
              const hMeta = Math.round((x.meta / maiorBarra) * 108)
              const hReal = Math.round((x.realizado / maiorBarra) * 108)
              const c = CORES_SITUACAO[x.situacao]
              return (
                <button key={x.m} onClick={() => setMesFoco(x.m)} title={`${MESES_LONGO[x.m]}: ${brl(x.realizado)} de ${brl(x.meta)}`}
                  style={{ flex: 1, minWidth: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: selecionado ? '#f7f7f7' : 'none', border: 'none', borderRadius: 10, padding: '6px 2px', cursor: 'pointer', font: 'inherit' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: x.realizado > 0 ? '#111' : '#ccc' }}>{x.realizado > 0 ? Math.round(x.realizado / 1000) + 'k' : ''}</span>
                  {/* meta = coluna cinza atrás; realizado = coluna colorida na frente */}
                  <div style={{ position: 'relative', width: 26, height: 110, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', bottom: 0, width: 26, height: Math.max(2, hMeta), background: '#f1f1f1', borderRadius: 6 }} />
                    <div style={{ position: 'absolute', bottom: 0, width: 26, height: hReal, background: x.semMeta ? '#cbd5e1' : c.cor, borderRadius: 6, transition: 'height .4s ease' }} />
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: selecionado || corrente ? 800 : 600, color: corrente ? '#111' : '#999', borderBottom: corrente ? '2px solid #111' : '2px solid transparent', paddingBottom: 1 }}>{MESES_CURTO[x.m]}</span>
                </button>
              )
            })}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#bbb' }}>Coluna cinza = meta do mês · coluna colorida = ganho no mês. Clique num mês para abrir o detalhe.</p>
        </div>

        {/* FOCO DO MÊS — geral, parcial e quanto falta */}
        <span style={{ fontSize: 13, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>{MESES_LONGO[mesFoco]} de {ano}</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 18 }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <Anel pct={foco.pct} cor={foco.semMeta ? '#d4d4d4' : CORES_SITUACAO[foco.situacao].cor}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#111', lineHeight: 1 }}>{foco.semMeta ? '—' : `${Math.round(foco.pct)}%`}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#999' }}>da meta</span>
              </Anel>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Selo p={foco} />
                <p style={{ margin: '10px 0 0', fontSize: 12, color: '#999', fontWeight: 600 }}>{foco.excedente > 0 ? 'Passou da meta em' : 'Falta para bater'}</p>
                <p style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 800, color: foco.excedente > 0 ? '#16a34a' : '#b91c1c', lineHeight: 1.1 }}>{brl(foco.excedente > 0 ? foco.excedente : foco.falta)}</p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#888' }}>{brl(foco.realizado)} de {brl(foco.meta)} · {foco.qtd} venda(s)</p>
              </div>
            </div>
            <div style={{ marginTop: 14 }}><BarraRitmo p={foco} cor={foco.situacao === 'atrasado' ? '#ef4444' : '#16a34a'} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 600 }}>Deveria estar hoje</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: '#111' }}>{brl(foco.esperadoAteHoje)}</p>
                <p style={{ margin: 0, fontSize: 10.5, color: '#bbb' }}>dia {foco.diasDecorridos} de {foco.diasTotais}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 600 }}>Projeção no ritmo atual</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: foco.projecao >= foco.meta && foco.meta > 0 ? '#16a34a' : '#a16207' }}>{brl(foco.projecao)}</p>
                <p style={{ margin: 0, fontSize: 10.5, color: '#bbb' }}>fechamento estimado</p>
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            {/* SEMANA — só faz sentido no mês corrente: semana de mês passado é história. */}
            {ehAnoCorrente && mesFoco === hoje.getMonth() ? (<>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>Esta semana</span>
                <Selo p={semanaAtual} />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#999' }}>
                {dataCurta(intervaloSemana(hoje)[0].toISOString())} a {dataCurta(intervaloSemana(hoje)[1].toISOString())} · meta proporcional aos dias
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, margin: '12px 0' }}>
                <div><p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 600 }}>Meta</p><p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: '#111' }}>{brl(semanaAtual.meta)}</p></div>
                <div><p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 600 }}>Realizado</p><p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: '#16a34a' }}>{brl(semanaAtual.realizado)}</p></div>
                <div><p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 600 }}>Falta</p><p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: semanaAtual.falta > 0 ? '#b91c1c' : '#16a34a' }}>{brl(semanaAtual.falta)}</p></div>
              </div>
              <BarraRitmo p={semanaAtual} cor={semanaAtual.situacao === 'atrasado' ? '#ef4444' : '#16a34a'} />
            </>) : (
              <p style={{ margin: 0, fontSize: 12.5, color: '#aaa' }}>A visão da semana aparece quando o mês em foco é o mês corrente.</p>
            )}

            {/* O parcial que dá para conferir: as vendas que formaram o número. */}
            <div style={{ borderTop: '1px solid #f2f2f2', marginTop: 16, paddingTop: 12 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Vendas ganhas em {MESES_LONGO[mesFoco]}</span>
              {foco.lista.length === 0 && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#aaa' }}>Nenhuma oportunidade ganha neste mês ainda.</p>}
              <div style={{ maxHeight: 190, overflowY: 'auto', marginTop: 6 }}>
                {foco.lista.map(n => (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid #f7f7f7' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#999', flexShrink: 0, minWidth: 34 }}>{dataCurta(dataDoGanho(n))}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.titulo || 'Oportunidade'}{n.donoNome ? ` · ${n.donoNome}` : ''}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: '#16a34a', flexShrink: 0 }}>{brl(Number(n.valor) || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>)}

      {editar && podeEditar && (
        <EditarMetaModal meta={meta} ano={ano} onClose={() => setEditar(false)} onSalvo={m => { setMeta(m); setEditar(false) }} />
      )}
    </div>
  )
}

// Definição da meta — admin. Dois caminhos: o valor do ano (dividido igual) ou
// mês a mês. O total aparece o tempo todo, porque é o número que o dono tem na
// cabeça e ele precisa ver a conta fechando enquanto ajusta.
function EditarMetaModal({ meta, ano, onClose, onSalvo }: { meta: MetaAno; ano: number; onClose: () => void; onSalvo: (m: MetaAno) => void }) {
  const [meses, setMeses] = useState<string[]>(meta.meses.map(v => (v ? String(v) : '')))
  const [anual, setAnual] = useState('')
  const [salvando, setSalvando] = useState(false)
  const total = meses.reduce((s, v) => s + (Number(String(v).replace(',', '.')) || 0), 0)

  async function salvar() {
    setSalvando(true)
    const r = await fetch('/api/metas', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ano, meses: meses.map(v => Number(String(v).replace(',', '.')) || 0) }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { toast(r?.error || 'Não foi possível salvar a meta.', 'erro'); return }
    toast(`Meta de ${ano} salva.`, 'sucesso')
    onSalvo(r.meta)
  }

  const campo: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 9, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#111' }}>Meta de vendas — {ano}</h3>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#999' }}>Valores em R$. O realizado vem sozinho das oportunidades ganhas no CRM.</p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Meta do ano inteiro</label>
            <input value={anual} onChange={e => setAnual(e.target.value)} inputMode="decimal" placeholder="Ex.: 600000" style={campo} />
          </div>
          <button onClick={() => { const m = distribuirAnual(Number(anual.replace(',', '.')) || 0); setMeses(m.map(v => (v ? String(v) : ''))) }}
            style={{ padding: '9px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Dividir em 12
          </button>
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8 }}>Mês a mês (ajuste o que for sazonal)</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
          {MESES_CURTO.map((nome, i) => (
            <div key={nome}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 3 }}>{nome}</span>
              <input value={meses[i]} onChange={e => { const c = [...meses]; c[i] = e.target.value; setMeses(c) }} inputMode="decimal" placeholder="0" style={campo} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: '12px 14px', background: '#fafafa', borderRadius: 12 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#666' }}>Total do ano</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#111' }}>{brlExato(total)}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '10px 16px', background: '#fff', border: '1.5px solid #e0e0e0', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', color: '#666' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ padding: '10px 18px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Salvando…' : 'Salvar meta'}
          </button>
        </div>
      </div>
    </div>
  )
}

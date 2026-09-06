'use client'
import { useEffect, useMemo, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { fecharFora } from '@/lib/fecharModal'
import {
  DiaRitual, RITUAL_PADRAO, NOMES_DIA, NOMES_DIA_CURTO,
  ritualDoDia, tituloDoDia, diaDaSemana, corDoDia, tomClaro, CORES_RITUAL,
  semanaDe, gradeMes, ymd, dataComHora,
} from '@/lib/ritualSemana'

// REUNIÕES INTERNAS — a reunião é DIÁRIA e cada dia tem uma área da empresa
// (segunda Comercial, terça Posicionamento…). Por isso a tela é um CALENDÁRIO,
// não uma lista: a pergunta do time é "o que tem hoje/nesta semana", e a lista
// respondia "o que existe cadastrado".
//
// Dentro do dia cabem VÁRIAS pautas — todas da área daquele dia. A ata e as
// decisões (que viram tarefas) continuam por reunião. Ver lib/ritualSemana.

type Decisao = { id: string; texto: string; responsavelEmail?: string; responsavelNome?: string; prazo?: string; tarefaId?: string }
type Pauta = { id: string; texto: string; responsavelNome?: string; feita?: boolean }
type Reuniao = {
  id: string; titulo: string; data: string; area?: string; participantes?: string
  pauta?: string; pautas?: Pauta[]; ata?: string; decisoes?: Decisao[]
  serieId?: string; status: 'agendada' | 'realizada'; criadoEm: string
}
type Usuario = { nome: string; email: string }

const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const ehHoje = (d: Date) => ymd(d) === ymd(new Date())

export default function Reunioes({ usuarios = [], podeEditar = true }: { usuarios?: Usuario[]; podeEditar?: boolean }) {
  const [reunioes, setReunioes] = useState<Reuniao[]>([])
  const [ritual, setRitual] = useState<DiaRitual[]>(RITUAL_PADRAO)
  const [carregando, setCarregando] = useState(true)
  const [aberta, setAberta] = useState<Reuniao | null>(null)
  const [novaEm, setNovaEm] = useState<Date | null>(null)
  const [ritualAberto, setRitualAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [vista, setVista] = useState<'semana' | 'mes'>(() => {
    try { return (sessionStorage.getItem('reunioes_vista') as any) === 'mes' ? 'mes' : 'semana' } catch { return 'semana' }
  })
  useEffect(() => { try { sessionStorage.setItem('reunioes_vista', vista) } catch {} }, [vista])
  // Dia de referência da navegação (‹ ›). Em semana anda 7 dias; em mês, 1 mês.
  const [ref, setRef] = useState(() => new Date())

  function carregar() {
    fetch('/api/reunioes').then(r => r.json())
      .then(d => { if (Array.isArray(d?.reunioes)) setReunioes(d.reunioes) })
      .catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(() => {
    carregar()
    fetch('/api/reunioes/ritual').then(r => r.json())
      .then(d => { if (Array.isArray(d?.ritual)) setRitual(d.ritual) }).catch(() => {})
  }, [])

  // Índice por dia: o calendário pergunta "o que tem em 31/08" dezenas de vezes
  // por render; varrer a lista toda vez seria trabalho jogado fora.
  const porDia = useMemo(() => {
    const m = new Map<string, Reuniao[]>()
    for (const r of reunioes) {
      const k = ymd(new Date(r.data))
      const lista = m.get(k) || []
      lista.push(r)
      m.set(k, lista)
    }
    // forEach em vez de for..of: o target do tsconfig não itera MapIterator.
    m.forEach(lista => lista.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()))
    return m
  }, [reunioes])

  const dias = useMemo(() => (vista === 'semana' ? [semanaDe(ref)] : gradeMes(ref.getFullYear(), ref.getMonth())), [vista, ref])
  const realizadas = useMemo(() => reunioes.filter(r => r.status === 'realizada').slice(0, 6), [reunioes])

  function andar(passo: number) {
    setRef(d => {
      const n = new Date(d)
      if (vista === 'semana') n.setDate(n.getDate() + passo * 7)
      else n.setMonth(n.getMonth() + passo)
      return n
    })
  }

  async function criar(form: any) {
    setSalvando(true)
    const r = await fetch('/api/reunioes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) {
      toast(r.criadas > 1 ? `${r.criadas} reuniões criadas (recorrência semanal).` : 'Reunião criada.', 'sucesso')
      setNovaEm(null); carregar(); setAberta(r.reuniao)
    } else toast(r?.error || 'Falha ao criar.', 'erro')
  }

  async function salvar(r: Reuniao, extra: any = {}) {
    setSalvando(true)
    const resp = await fetch('/api/reunioes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...r, ...extra }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (resp?.ok) { setAberta(resp.reuniao); carregar(); return resp.reuniao }
    toast(resp?.error || 'Falha ao salvar.', 'erro')
    return null
  }

  async function excluir(r: Reuniao) {
    // Reunião de série pergunta o alcance: apagar só o dia ou dali para a frente.
    const serie = !!r.serieId
    const ok = await confirmar(
      serie
        ? 'Esta reunião faz parte de uma recorrência. Excluir apenas ESTA, ou esta e as próximas? (As já realizadas nunca são apagadas — elas têm ata.)'
        : 'Excluir esta reunião (pauta, ata e decisões)? Tarefas já criadas continuam existindo.',
      { titulo: serie ? 'Excluir recorrência' : 'Excluir reunião', okLabel: serie ? 'Esta e as próximas' : 'Excluir', cancelLabel: serie ? 'Só esta' : 'Cancelar', perigo: true },
    )
    // No caso de série, "cancelar" quer dizer "só esta" — e não "desisti".
    if (!ok && !serie) return
    const resp = await fetch('/api/reunioes', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, serie: serie && ok }),
    }).then(x => x.json()).catch(() => null)
    if (resp?.excluidas > 1) toast(`${resp.excluidas} reuniões excluídas.`, 'sucesso')
    setAberta(null); carregar()
  }

  // Cartão de uma reunião dentro do calendário. A moldura usa a COR DO DIA (é
  // ela que identifica a área num relance); o status vira selo, não cor — senão
  // segunda realizada e sexta realizada ficariam iguais.
  function Chip({ r, compacto = false, cor }: { r: Reuniao; compacto?: boolean; cor: string }) {
    const feito = r.status === 'realizada'
    const pendentes = (r.pautas || []).filter(p => !p.feita).length
    return (
      <button onClick={() => setAberta(r)} title={`${r.titulo}${r.participantes ? ` · ${r.participantes}` : ''}`}
        style={{ width: '100%', textAlign: 'left', border: 'none', borderRadius: 8, padding: compacto ? '3px 6px' : '6px 8px', cursor: 'pointer', font: 'inherit', background: 'var(--v2-surface)', borderLeft: `3px solid ${cor}`, boxShadow: '0 1px 2px rgba(0,0,0,0.06)', marginBottom: 3, opacity: feito ? 0.75 : 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {feito && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--v2-ok)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 6 9 17l-5-5" /></svg>
          )}
          <span style={{ flex: 1, minWidth: 0, fontSize: compacto ? 10.5 : 12, fontWeight: 700, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {hhmm(r.data)} {r.titulo}
          </span>
        </span>
        {!compacto && (
          <span style={{ display: 'block', fontSize: 10.5, color: 'var(--v2-ink3)', marginTop: 1 }}>
            {(r.pautas || []).length > 0 ? `${(r.pautas || []).length} pauta(s)${pendentes ? ` · ${pendentes} aberta(s)` : ''}` : feito ? 'realizada' : 'agendada'}
            {r.serieId ? ' · série' : ''}
          </span>
        )}
      </button>
    )
  }

  // Cada DIA é um bloco na cor da sua área: faixa colorida no topo, fundo no tom
  // clarinho da cor e o número do dia na cor. Sem isso, cinco colunas brancas
  // exigem LER para saber onde se está.
  function Celula({ d, altura, compacto }: { d: Date; altura: number; compacto: boolean }) {
    const lista = porDia.get(ymd(d)) || []
    const rit = ritualDoDia(ritual, d)
    const cor = corDoDia(ritual, d)
    const doMes = vista === 'semana' || d.getMonth() === ref.getMonth()
    const hoje = ehHoje(d)
    return (
      <div style={{ flex: 1, minWidth: 0, background: rit ? tomClaro(cor, '0f') : 'var(--v2-surface)', border: `1px solid ${hoje ? cor : 'var(--v2-surface2)'}`, boxShadow: hoje ? `0 0 0 1.5px ${tomClaro(cor, '55')}` : 'none', borderRadius: 10, overflow: 'hidden', minHeight: altura, display: 'flex', flexDirection: 'column', opacity: doMes ? 1 : 0.45 }}>
        {/* faixa da cor do dia */}
        <div style={{ height: 4, background: rit ? cor : 'var(--v2-surface2)', flexShrink: 0 }} />
        <div style={{ padding: 7, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: rit ? cor : 'var(--v2-ink3)' }}>{d.getDate()}</span>
            {compacto && <span style={{ fontSize: 9.5, color: 'var(--v2-ink3)' }}>{NOMES_DIA_CURTO[diaDaSemana(d)]}</span>}
            {hoje && <span style={{ fontSize: 8.5, fontWeight: 800, color: 'var(--v2-surface)', background: cor, borderRadius: 999, padding: '1px 6px' }}>HOJE</span>}
            <span style={{ flex: 1 }} />
            {podeEditar && (
              <button onClick={() => setNovaEm(d)} title="Nova reunião neste dia"
                style={{ background: 'none', border: 'none', color: rit ? cor : 'var(--v2-rule2)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0, opacity: 0.7 }}>+</button>
            )}
          </div>
          {rit && !compacto && (
            <span style={{ display: 'block', fontSize: 9.5, fontWeight: 800, color: cor, background: tomClaro(cor, '22'), borderRadius: 6, padding: '2px 6px', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rit.area}</span>
          )}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {lista.slice(0, compacto ? 3 : 20).map(r => <Chip key={r.id} r={r} compacto={compacto} cor={cor} />)}
            {compacto && lista.length > 3 && <span style={{ fontSize: 9.5, color: 'var(--v2-ink3)', fontWeight: 700 }}>+{lista.length - 3}</span>}
          </div>
        </div>
      </div>
    )
  }

  const periodo = vista === 'semana'
    ? (() => { const s = semanaDe(ref); return `${s[0].getDate()}/${s[0].getMonth() + 1} a ${s[6].getDate()}/${s[6].getMonth() + 1}` })()
    : `${MESES[ref.getMonth()]} de ${ref.getFullYear()}`

  return (
    <div style={{ maxWidth: 1080 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: 'var(--v2-ink)' }}>Reuniões internas</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--v2-ink3)' }}>Uma por dia, cada dia com a sua área. Pauta antes, ata depois — e cada decisão pode virar tarefa.</p>
        </div>
        <span style={{ flex: 1 }} />
        {podeEditar && <button onClick={() => setNovaEm(new Date())} style={{ padding: '10px 18px', background: 'var(--marca, var(--v2-amber-on))', color: 'var(--marca-texto, var(--v2-ink))', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Nova reunião</button>}
      </div>

      {/* RITUAL DA SEMANA — cartões, um por dia, na cor da área. É o mapa da
          semana: bate o olho e sabe que hoje é comercial. Clicar leva o
          calendário para aquele dia. */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {ritual.length === 0 && <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>Nenhuma área definida para os dias da semana.</span>}
        {ritual.map(r => {
          const cor = r.cor || '#64748b'
          const dia = semanaDe(ref).find(d => diaDaSemana(d) === r.dia)!
          const qtd = (porDia.get(ymd(dia)) || []).length
          const hoje = ehHoje(dia)
          return (
            <button key={r.dia} onClick={() => { setRef(dia); if (vista === 'mes') setVista('semana') }}
              title={`Ver ${NOMES_DIA[r.dia]} (${dia.toLocaleDateString('pt-BR')})`}
              style={{ flex: '1 1 150px', minWidth: 132, textAlign: 'left', font: 'inherit', cursor: 'pointer', border: `1px solid ${hoje ? cor : '#efefef'}`, borderRadius: 12, overflow: 'hidden', background: 'var(--v2-surface)', boxShadow: hoje ? `0 2px 10px ${tomClaro(cor, '40')}` : '0 1px 3px rgba(0,0,0,0.05)', padding: 0 }}>
              <div style={{ height: 5, background: cor }} />
              <div style={{ padding: '9px 11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{NOMES_DIA[r.dia]}</span>
                  {hoje && <span style={{ fontSize: 8.5, fontWeight: 800, color: 'var(--v2-surface)', background: cor, borderRadius: 999, padding: '1px 6px' }}>HOJE</span>}
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 13.5, fontWeight: 800, color: cor, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.area}</p>
                <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--v2-ink3)' }}>
                  {r.hora ? `${r.hora} · ` : ''}{qtd ? `${qtd} nesta semana` : 'sem reunião'}
                </p>
              </div>
            </button>
          )
        })}
        {podeEditar && (
          <button onClick={() => setRitualAberto(true)} title="Definir a área e a cor de cada dia"
            style={{ flex: '0 0 auto', minWidth: 104, border: '1px dashed #dcdcdc', borderRadius: 12, background: 'var(--v2-surface)', cursor: 'pointer', font: 'inherit', color: 'var(--v2-ink3)', fontSize: 11.5, fontWeight: 700, padding: '10px 12px' }}>
            Editar ritual
          </button>
        )}
      </div>

      {/* Navegação do calendário */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--v2-surface)', borderRadius: 999, padding: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <button onClick={() => andar(-1)} title="Anterior" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 10px', fontSize: 14, color: 'var(--v2-ink3)' }}>‹</button>
          <button onClick={() => setRef(new Date())} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink)' }}>Hoje</button>
          <button onClick={() => andar(1)} title="Próximo" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 10px', fontSize: 14, color: 'var(--v2-ink3)' }}>›</button>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)', textTransform: 'capitalize' }}>{periodo}</span>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', background: 'var(--v2-surface2)', borderRadius: 9, padding: 3 }}>
          {(['semana', 'mes'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)}
              style={{ padding: '6px 14px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: vista === v ? 'var(--v2-surface)' : 'transparent', color: vista === v ? 'var(--v2-ink)' : 'var(--v2-ink3)' }}>
              {v === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {carregando ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Carregando...</p> : (<>
        {/* Cabeçalho dos dias (só no mês — na semana cada célula já se identifica) */}
        {vista === 'mes' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
            {[1, 2, 3, 4, 5, 6, 7].map(d => {
              const rit = ritual.find(r => r.dia === d)
              return (
                <div key={d} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: 'var(--v2-ink3)' }}>{NOMES_DIA_CURTO[d]}</span>
                  {rit && <span style={{ display: 'block', fontSize: 9, fontWeight: 800, color: rit.cor || '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{rit.area}</span>}
                </div>
              )
            })}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {dias.map((semana, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              {semana.map(d => (
                <div key={ymd(d)} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  {vista === 'semana' && (
                    <span style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: ritualDoDia(ritual, d) ? corDoDia(ritual, d) : 'var(--v2-ink3)', marginBottom: 3, textAlign: 'center' }}>
                      {NOMES_DIA_CURTO[diaDaSemana(d)]}
                    </span>
                  )}
                  <Celula d={d} altura={vista === 'semana' ? 190 : 96} compacto={vista === 'mes'} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {realizadas.length > 0 && (
          <div style={{ maxWidth: 760 }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Atas recentes</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {realizadas.map(r => (
                <button key={r.id} onClick={() => setAberta(r)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--v2-surface)', borderRadius: 10, border: '1px solid var(--v2-rule)', cursor: 'pointer', font: 'inherit' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--v2-ink3)', flexShrink: 0, minWidth: 44 }}>{new Date(r.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--v2-ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titulo}</span>
                  {!!(r.decisoes || []).length && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#4f46e5', background: 'var(--v2-info-bg)', borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>{(r.decisoes || []).length} decisão(ões)</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </>)}

      {novaEm && <NovaReuniaoModal dia={novaEm} ritual={ritual} salvando={salvando} onCriar={criar} onClose={() => setNovaEm(null)} />}
      {ritualAberto && <RitualModal ritual={ritual} onClose={() => setRitualAberto(false)} onSalvo={r => { setRitual(r); setRitualAberto(false) }} />}
      {aberta && (
        <ReuniaoModal
          reuniao={aberta} ritual={ritual} usuarios={usuarios} salvando={salvando} podeEditar={podeEditar}
          onSalvar={salvar} onExcluir={() => excluir(aberta)} onClose={() => { setAberta(null); carregar() }}
        />
      )}
    </div>
  )
}

// ---- Ritual da semana (admin/gerente) ----
function RitualModal({ ritual, onClose, onSalvo }: { ritual: DiaRitual[]; onClose: () => void; onSalvo: (r: DiaRitual[]) => void }) {
  // Sete linhas sempre: um dia sem área é um dia sem reunião fixa, e some da
  // faixa ao salvar (o servidor descarta área vazia).
  const [dias, setDias] = useState<{ dia: number; area: string; hora: string; cor: string }[]>(
    [1, 2, 3, 4, 5, 6, 7].map(d => {
      const r = ritual.find(x => x.dia === d)
      // Dia novo já nasce com uma cor da paleta (nunca duas iguais em sequência):
      // pedir para escolher cor antes de digitar a área é atrito à toa.
      return { dia: d, area: r?.area || '', hora: r?.hora || '', cor: r?.cor || CORES_RITUAL[(d - 1) % CORES_RITUAL.length].cor }
    }),
  )
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    const r = await fetch('/api/reunioes/ritual', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dias: dias.filter(d => d.area.trim()) }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { toast(r?.error || 'Não foi possível salvar o ritual.', 'erro'); return }
    toast('Ritual da semana salvo.', 'sucesso')
    onSalvo(r.ritual)
  }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16.5, color: 'var(--v2-ink)' }}>Ritual da semana</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>A área que é tema de cada dia. Deixe em branco o dia que não tem reunião fixa.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dias.map((d, i) => (
            <div key={d.dia} style={{ border: '1px solid #f2f2f2', borderRadius: 12, padding: 10, borderLeft: `4px solid ${d.area.trim() ? d.cor : 'var(--v2-surface2)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 62, fontSize: 12.5, fontWeight: 800, color: 'var(--v2-ink2)', flexShrink: 0 }}>{NOMES_DIA[d.dia]}</span>
                <input value={d.area} onChange={e => setDias(ds => ds.map((x, idx) => idx === i ? { ...x, area: e.target.value } : x))}
                  placeholder="Ex.: Comercial" style={{ ...input, flex: 1 }} />
                <input type="time" value={d.hora} onChange={e => setDias(ds => ds.map((x, idx) => idx === i ? { ...x, hora: e.target.value } : x))}
                  style={{ ...input, width: 96 }} />
              </div>
              {/* Cor do dia: paleta fechada — é ela que vai pintar o calendário. */}
              <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap', opacity: d.area.trim() ? 1 : 0.4 }}>
                {CORES_RITUAL.map(c => (
                  <button key={c.cor} onClick={() => setDias(ds => ds.map((x, idx) => idx === i ? { ...x, cor: c.cor } : x))} title={c.nome}
                    style={{ width: 20, height: 20, borderRadius: 6, background: c.cor, cursor: 'pointer', border: d.cor === c.cor ? '2px solid var(--v2-ink)' : '2px solid transparent', padding: 0 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', background: 'var(--v2-surface2)', border: 'none', borderRadius: 9, color: 'var(--v2-ink2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ padding: '10px 18px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ---- Nova reunião (única ou recorrente) ----
function NovaReuniaoModal({ dia, ritual, onCriar, onClose, salvando }: { dia: Date; ritual: DiaRitual[]; onCriar: (f: any) => void; onClose: () => void; salvando: boolean }) {
  const rit = ritualDoDia(ritual, dia)
  // Título e hora já vêm do ritual do dia: criar a reunião de segunda não deve
  // exigir digitar "Segunda Comercial" toda semana.
  const [f, setF] = useState({
    titulo: tituloDoDia(ritual, dia),
    area: rit?.area || '',
    data: toLocalInput(dataComHora(ymd(dia), rit?.hora)),
    participantes: '',
  })
  const [pautas, setPautas] = useState<string[]>([])
  const [nova, setNova] = useState('')
  const [recorrente, setRecorrente] = useState(false)
  const [ate, setAte] = useState(() => { const d = new Date(dia); d.setMonth(d.getMonth() + 3); return ymd(d) })

  function addPauta() {
    const t = nova.trim()
    if (!t) return
    setPautas(ps => [...ps, t]); setNova('')
  }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16.5, color: 'var(--v2-ink)' }}>Nova reunião</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>
          {NOMES_DIA[diaDaSemana(dia)]}, {dia.toLocaleDateString('pt-BR')}{rit ? ` · área do dia: ${rit.area}` : ' · sem área fixa neste dia'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={label}>Título *</label><input value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Segunda Comercial" style={input} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={label}>Data e hora *</label><input type="datetime-local" value={f.data} onChange={e => setF({ ...f, data: e.target.value })} style={input} /></div>
            <div><label style={label}>Área / setor</label><input value={f.area} onChange={e => setF({ ...f, area: e.target.value })} placeholder="Ex.: Comercial" style={input} /></div>
          </div>
          <div><label style={label}>Participantes</label><input value={f.participantes} onChange={e => setF({ ...f, participantes: e.target.value })} placeholder="Ex.: Dra. Ana, recepção" style={input} /></div>

          <div>
            <label style={label}>Pautas do dia</label>
            {pautas.length === 0 && <p style={{ margin: '0 0 6px', fontSize: 11.5, color: 'var(--v2-ink3)' }}>Vários assuntos da mesma área — dá para adicionar depois, durante a reunião.</p>}
            {pautas.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: i ? '1px solid var(--v2-surface1)' : 'none' }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--v2-ink3)', minWidth: 16 }}>{i + 1}.</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--v2-ink)' }}>{p}</span>
                <button onClick={() => setPautas(ps => ps.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 15 }}>×</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input value={nova} onChange={e => setNova(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPauta() } }}
                placeholder="Nova pauta… (Enter adiciona)" style={{ ...input, flex: 1 }} />
              <button onClick={addPauta} style={{ padding: '10px 14px', background: 'var(--v2-surface1)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', color: 'var(--v2-ink)' }}>+</button>
            </div>
          </div>

          {/* RECORRÊNCIA — gera as ocorrências de verdade, cada uma com sua ata */}
          <div style={{ background: 'var(--v2-surface1)', borderRadius: 12, padding: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--v2-ink)' }}>Repetir toda {NOMES_DIA[diaDaSemana(dia)].toLowerCase()}</span>
            </label>
            {recorrente && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--v2-ink3)', fontWeight: 600 }}>até</span>
                <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={{ ...input, width: 160 }} />
                <span style={{ fontSize: 11, color: 'var(--v2-ink3)' }}>máx. 53 semanas</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', background: 'var(--v2-surface2)', border: 'none', borderRadius: 9, color: 'var(--v2-ink2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onCriar({
            titulo: f.titulo, area: f.area, participantes: f.participantes,
            data: new Date(f.data).toISOString(),
            pautas: pautas.map(texto => ({ texto })),
            ...(recorrente ? { recorrencia: { tipo: 'semanal', ate } } : {}),
          })} disabled={salvando || !f.titulo.trim()}
            style={{ padding: '10px 18px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: f.titulo.trim() ? 1 : 0.5 }}>
            {salvando ? 'Criando…' : recorrente ? 'Criar recorrência' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReuniaoModal({ reuniao, ritual, usuarios, salvando, podeEditar, onSalvar, onExcluir, onClose }: {
  reuniao: Reuniao; ritual: DiaRitual[]; usuarios: Usuario[]; salvando: boolean; podeEditar: boolean
  onSalvar: (r: Reuniao, extra?: any) => Promise<Reuniao | null>; onExcluir: () => void; onClose: () => void
}) {
  const [r, setR] = useState<Reuniao>(reuniao)
  const [novaDecisao, setNovaDecisao] = useState('')
  const [novaPauta, setNovaPauta] = useState('')
  useEffect(() => { setR(reuniao) }, [reuniao.id])
  const corArea = corDoDia(ritual, new Date(r.data))

  function addDecisao() {
    const texto = novaDecisao.trim()
    if (!texto) return
    setR(x => ({ ...x, decisoes: [...(x.decisoes || []), { id: Math.random().toString(36).slice(2), texto }] }))
    setNovaDecisao('')
  }
  function mudaDecisao(id: string, patch: Partial<Decisao>) {
    setR(x => ({ ...x, decisoes: (x.decisoes || []).map(d => d.id === id ? { ...d, ...patch } : d) }))
  }
  function addPauta() {
    const texto = novaPauta.trim()
    if (!texto) return
    setR(x => ({ ...x, pautas: [...(x.pautas || []), { id: Math.random().toString(36).slice(2), texto, feita: false }] }))
    setNovaPauta('')
  }
  function mudaPauta(id: string, patch: Partial<Pauta>) {
    setR(x => ({ ...x, pautas: (x.pautas || []).map(p => p.id === id ? { ...p, ...patch } : p) }))
  }

  async function virarTarefa(d: Decisao) {
    // Salva o estado atual e pede a criação da tarefa numa tacada
    await onSalvar(r, { criarTarefaDaDecisao: d.id })
  }

  const pautas = r.pautas || []
  const feitas = pautas.filter(p => p.feita).length

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <input value={r.titulo} onChange={e => setR({ ...r, titulo: e.target.value })} disabled={!podeEditar}
            style={{ flex: 1, fontSize: 16.5, fontWeight: 800, color: 'var(--v2-ink)', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
          {r.area && <span style={{ fontSize: 10.5, fontWeight: 800, color: corArea, background: tomClaro(corArea, '22'), borderRadius: 999, padding: '3px 9px', textTransform: 'uppercase' }}>{r.area}</span>}
          {r.serieId && <span title="Faz parte de uma recorrência semanal" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--v2-amber)', background: 'var(--v2-amber-bg)', borderRadius: 999, padding: '3px 9px' }}>série semanal</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <input type="datetime-local" value={toLocalInput(new Date(r.data))} onChange={e => setR({ ...r, data: new Date(e.target.value).toISOString() })} disabled={!podeEditar}
            style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit' }} />
          <input value={r.participantes || ''} onChange={e => setR({ ...r, participantes: e.target.value })} placeholder="Participantes" disabled={!podeEditar}
            style={{ flex: 1, minWidth: 140, padding: '7px 10px', borderRadius: 9, border: '1px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit' }} />
          {(['agendada', 'realizada'] as const).map(st => (
            <button key={st} onClick={() => podeEditar && setR({ ...r, status: st })}
              style={{ padding: '7px 14px', borderRadius: 999, border: r.status === st ? '1.5px solid var(--v2-ink)' : '1px solid var(--v2-surface2)', background: r.status === st ? 'var(--v2-ink)' : 'var(--v2-surface)', color: r.status === st ? 'var(--v2-surface)' : 'var(--v2-ink3)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
              {st === 'agendada' ? 'Agendada' : 'Realizada'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* PAUTAS DO DIA — vários assuntos da área daquele dia */}
          <div>
            <label style={label}>Pautas{pautas.length ? ` · ${feitas}/${pautas.length} tratadas` : ''}</label>
            {pautas.length === 0 && <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--v2-ink3)' }}>Nenhuma pauta listada.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {pautas.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: i ? '1px solid var(--v2-surface1)' : 'none' }}>
                  <input type="checkbox" checked={!!p.feita} disabled={!podeEditar} onChange={e => mudaPauta(p.id, { feita: e.target.checked })}
                    title="Tratada nesta reunião" style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
                  <input value={p.texto} disabled={!podeEditar} onChange={e => mudaPauta(p.id, { texto: e.target.value })}
                    style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'inherit', color: p.feita ? 'var(--v2-ink3)' : 'var(--v2-ink)', textDecoration: p.feita ? 'line-through' : 'none', background: 'transparent' }} />
                  {podeEditar && (
                    <button onClick={() => setR(x => ({ ...x, pautas: (x.pautas || []).filter(y => y.id !== p.id) }))}
                      style={{ background: 'none', border: 'none', color: 'var(--v2-rule2)', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>×</button>
                  )}
                </div>
              ))}
            </div>
            {podeEditar && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input value={novaPauta} onChange={e => setNovaPauta(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPauta() } }}
                  placeholder="Nova pauta… (Enter adiciona)" style={{ ...input, flex: 1 }} />
                <button onClick={addPauta} style={{ padding: '10px 14px', background: 'var(--v2-surface1)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', color: 'var(--v2-ink)' }}>+ Adicionar</button>
              </div>
            )}
          </div>

          {/* Texto livre antigo: só aparece quando existe (reuniões de antes das pautas) */}
          {(r.pauta || '').trim() && (
            <div>
              <label style={label}>Pauta (texto livre)</label>
              <textarea lang="pt-BR" value={r.pauta || ''} onChange={e => setR({ ...r, pauta: e.target.value })} rows={3} disabled={!podeEditar} style={{ ...input, resize: 'vertical' }} />
            </div>
          )}

          <div>
            <label style={label}>Ata (o que foi discutido e decidido)</label>
            <textarea lang="pt-BR" value={r.ata || ''} onChange={e => setR({ ...r, ata: e.target.value })} rows={5} disabled={!podeEditar} placeholder="Registro da reunião — fica guardado como histórico." style={{ ...input, resize: 'vertical' }} />
          </div>

          <div>
            <label style={label}>Decisões</label>
            {(r.decisoes || []).length === 0 && <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--v2-ink3)' }}>Nenhuma decisão registrada.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(r.decisoes || []).map(d => (
                <div key={d.id} style={{ border: '1px solid var(--v2-rule)', borderRadius: 10, padding: 10 }}>
                  <input value={d.texto} onChange={e => mudaDecisao(d.id, { texto: e.target.value })} disabled={!podeEditar || !!d.tarefaId}
                    style={{ ...input, border: 'none', padding: '2px 0', fontWeight: 600, borderRadius: 0 }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                    <select value={d.responsavelEmail || ''} disabled={!podeEditar || !!d.tarefaId}
                      onChange={e => { const u = usuarios.find(x => x.email === e.target.value); mudaDecisao(d.id, { responsavelEmail: e.target.value || undefined, responsavelNome: u?.nome }) }}
                      style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                      <option value="">Responsável…</option>
                      {usuarios.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
                    </select>
                    <input type="date" value={(d.prazo || '').slice(0, 10)} disabled={!podeEditar || !!d.tarefaId}
                      onChange={e => mudaDecisao(d.id, { prazo: e.target.value || undefined })}
                      style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit' }} />
                    <span style={{ flex: 1 }} />
                    {d.tarefaId
                      ? <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--v2-ok)', background: 'var(--v2-ok-bg)', borderRadius: 999, padding: '4px 10px' }}>Virou tarefa</span>
                      : podeEditar && (
                        <button onClick={() => virarTarefa(d)} disabled={salvando}
                          style={{ padding: '6px 12px', background: 'var(--marca, var(--v2-amber-on))', border: 'none', borderRadius: 999, fontWeight: 800, fontSize: 11.5, cursor: 'pointer', color: 'var(--marca-texto, var(--v2-ink))' }}>
                          Virar tarefa
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
            {podeEditar && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input value={novaDecisao} onChange={e => setNovaDecisao(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addDecisao() }}
                  placeholder="Nova decisão… (Enter adiciona)" style={{ ...input, flex: 1 }} />
                <button onClick={addDecisao} style={{ padding: '10px 14px', background: 'var(--v2-surface1)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', color: 'var(--v2-ink)' }}>+ Adicionar</button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, alignItems: 'center' }}>
          {podeEditar && <button onClick={onExcluir} style={{ padding: '9px 14px', background: 'var(--v2-surface)', border: '1px solid var(--v2-hot-bg)', borderRadius: 9, color: 'var(--v2-hot)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Excluir</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: '10px 16px', background: 'var(--v2-surface2)', border: 'none', borderRadius: 9, color: 'var(--v2-ink2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
          {podeEditar && (
            <button onClick={() => onSalvar(r)} disabled={salvando} style={{ padding: '10px 18px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: salvando ? 'wait' : 'pointer' }}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

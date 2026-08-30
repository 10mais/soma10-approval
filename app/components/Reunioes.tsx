'use client'
import { useEffect, useMemo, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { fecharFora } from '@/lib/fecharModal'
import {
  DiaRitual, RITUAL_PADRAO, NOMES_DIA, NOMES_DIA_CURTO,
  ritualDoDia, tituloDoDia, diaDaSemana,
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

const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 5 }
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

  // Cartão de uma reunião dentro do calendário.
  function Chip({ r, compacto = false }: { r: Reuniao; compacto?: boolean }) {
    const feito = r.status === 'realizada'
    const pendentes = (r.pautas || []).filter(p => !p.feita).length
    return (
      <button onClick={() => setAberta(r)} title={`${r.titulo}${r.participantes ? ` · ${r.participantes}` : ''}`}
        style={{ width: '100%', textAlign: 'left', border: 'none', borderRadius: 8, padding: compacto ? '3px 6px' : '6px 8px', cursor: 'pointer', font: 'inherit', background: feito ? '#f0fdf4' : '#fffbeb', borderLeft: `3px solid ${feito ? '#16a34a' : '#f59e0b'}`, marginBottom: 3 }}>
        <span style={{ display: 'block', fontSize: compacto ? 10.5 : 12, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {hhmm(r.data)} {r.titulo}
        </span>
        {!compacto && (
          <span style={{ display: 'block', fontSize: 10.5, color: '#999', marginTop: 1 }}>
            {(r.pautas || []).length > 0 ? `${(r.pautas || []).length} pauta(s)${pendentes ? ` · ${pendentes} aberta(s)` : ''}` : feito ? 'realizada' : 'agendada'}
            {r.serieId ? ' · série' : ''}
          </span>
        )}
      </button>
    )
  }

  function Celula({ d, altura, compacto }: { d: Date; altura: number; compacto: boolean }) {
    const lista = porDia.get(ymd(d)) || []
    const rit = ritualDoDia(ritual, d)
    const doMes = vista === 'semana' || d.getMonth() === ref.getMonth()
    const hoje = ehHoje(d)
    return (
      <div style={{ flex: 1, minWidth: 0, background: '#fff', border: `1px solid ${hoje ? '#111' : '#f0f0f0'}`, borderRadius: 10, padding: 7, minHeight: altura, display: 'flex', flexDirection: 'column', opacity: doMes ? 1 : 0.45 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: hoje ? '#111' : '#999' }}>{d.getDate()}</span>
          {compacto && <span style={{ fontSize: 9.5, color: '#bbb' }}>{NOMES_DIA_CURTO[diaDaSemana(d)]}</span>}
          <span style={{ flex: 1 }} />
          {podeEditar && (
            <button onClick={() => setNovaEm(d)} title="Nova reunião neste dia"
              style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>+</button>
          )}
        </div>
        {rit && !compacto && (
          <span style={{ display: 'block', fontSize: 9.5, fontWeight: 800, color: '#4f46e5', background: '#eef2ff', borderRadius: 6, padding: '2px 6px', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rit.area}</span>
        )}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {lista.slice(0, compacto ? 3 : 20).map(r => <Chip key={r.id} r={r} compacto={compacto} />)}
          {compacto && lista.length > 3 && <span style={{ fontSize: 9.5, color: '#bbb', fontWeight: 700 }}>+{lista.length - 3}</span>}
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
          <h2 style={{ margin: 0, fontSize: 20, color: '#111' }}>Reuniões internas</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Uma por dia, cada dia com a sua área. Pauta antes, ata depois — e cada decisão pode virar tarefa.</p>
        </div>
        <span style={{ flex: 1 }} />
        {podeEditar && <button onClick={() => setNovaEm(new Date())} style={{ padding: '10px 18px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Nova reunião</button>}
      </div>

      {/* RITUAL DA SEMANA — a régua que dá foco à reunião do dia */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {ritual.length === 0 && <span style={{ fontSize: 12, color: '#bbb' }}>Nenhuma área definida para os dias da semana.</span>}
        {ritual.map(r => (
          <span key={r.dia} style={{ fontSize: 11, fontWeight: 800, color: '#4f46e5', background: '#eef2ff', borderRadius: 999, padding: '5px 11px' }}>
            {NOMES_DIA[r.dia]} · {r.area.toUpperCase()}{r.hora ? ` · ${r.hora}` : ''}
          </span>
        ))}
        {podeEditar && (
          <button onClick={() => setRitualAberto(true)} style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Editar ritual da semana
          </button>
        )}
      </div>

      {/* Navegação do calendário */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#fff', borderRadius: 999, padding: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <button onClick={() => andar(-1)} title="Anterior" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 10px', fontSize: 14, color: '#888' }}>‹</button>
          <button onClick={() => setRef(new Date())} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: 12, fontWeight: 700, color: '#111' }}>Hoje</button>
          <button onClick={() => andar(1)} title="Próximo" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 10px', fontSize: 14, color: '#888' }}>›</button>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111', textTransform: 'capitalize' }}>{periodo}</span>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 9, padding: 3 }}>
          {(['semana', 'mes'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)}
              style={{ padding: '6px 14px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: vista === v ? '#fff' : 'transparent', color: vista === v ? '#111' : '#888' }}>
              {v === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {carregando ? <p style={{ color: '#aaa', fontSize: 13 }}>Carregando...</p> : (<>
        {/* Cabeçalho dos dias (só no mês — na semana cada célula já se identifica) */}
        {vista === 'mes' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
            {[1, 2, 3, 4, 5, 6, 7].map(d => {
              const rit = ritual.find(r => r.dia === d)
              return (
                <div key={d} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: '#999' }}>{NOMES_DIA_CURTO[d]}</span>
                  {rit && <span style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#4f46e5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rit.area}</span>}
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
                    <span style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: ehHoje(d) ? '#111' : '#aaa', marginBottom: 3, textAlign: 'center' }}>
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
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Atas recentes</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {realizadas.map(r => (
                <button key={r.id} onClick={() => setAberta(r)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', cursor: 'pointer', font: 'inherit' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: '#999', flexShrink: 0, minWidth: 44 }}>{new Date(r.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#111', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titulo}</span>
                  {!!(r.decisoes || []).length && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#4f46e5', background: '#eef2ff', borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>{(r.decisoes || []).length} decisão(ões)</span>}
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
          reuniao={aberta} usuarios={usuarios} salvando={salvando} podeEditar={podeEditar}
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
  const [dias, setDias] = useState<{ dia: number; area: string; hora: string }[]>(
    [1, 2, 3, 4, 5, 6, 7].map(d => {
      const r = ritual.find(x => x.dia === d)
      return { dia: d, area: r?.area || '', hora: r?.hora || '' }
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
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16.5, color: '#111' }}>Ritual da semana</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#999' }}>A área que é tema de cada dia. Deixe em branco o dia que não tem reunião fixa.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dias.map((d, i) => (
            <div key={d.dia} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 66, fontSize: 12.5, fontWeight: 700, color: '#666', flexShrink: 0 }}>{NOMES_DIA[d.dia]}</span>
              <input value={d.area} onChange={e => setDias(ds => ds.map((x, idx) => idx === i ? { ...x, area: e.target.value } : x))}
                placeholder="Ex.: Comercial" style={{ ...input, flex: 1 }} />
              <input type="time" value={d.hora} onChange={e => setDias(ds => ds.map((x, idx) => idx === i ? { ...x, hora: e.target.value } : x))}
                style={{ ...input, width: 104 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 9, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ padding: '10px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
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
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16.5, color: '#111' }}>Nova reunião</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#999' }}>
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
            {pautas.length === 0 && <p style={{ margin: '0 0 6px', fontSize: 11.5, color: '#bbb' }}>Vários assuntos da mesma área — dá para adicionar depois, durante a reunião.</p>}
            {pautas.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: i ? '1px solid #f7f7f7' : 'none' }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#bbb', minWidth: 16 }}>{i + 1}.</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#333' }}>{p}</span>
                <button onClick={() => setPautas(ps => ps.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 15 }}>×</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input value={nova} onChange={e => setNova(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPauta() } }}
                placeholder="Nova pauta… (Enter adiciona)" style={{ ...input, flex: 1 }} />
              <button onClick={addPauta} style={{ padding: '10px 14px', background: '#f4f4f5', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', color: '#333' }}>+</button>
            </div>
          </div>

          {/* RECORRÊNCIA — gera as ocorrências de verdade, cada uma com sua ata */}
          <div style={{ background: '#fafafa', borderRadius: 12, padding: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111' }}>Repetir toda {NOMES_DIA[diaDaSemana(dia)].toLowerCase()}</span>
            </label>
            {recorrente && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>até</span>
                <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={{ ...input, width: 160 }} />
                <span style={{ fontSize: 11, color: '#aaa' }}>máx. 53 semanas</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 9, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onCriar({
            titulo: f.titulo, area: f.area, participantes: f.participantes,
            data: new Date(f.data).toISOString(),
            pautas: pautas.map(texto => ({ texto })),
            ...(recorrente ? { recorrencia: { tipo: 'semanal', ate } } : {}),
          })} disabled={salvando || !f.titulo.trim()}
            style={{ padding: '10px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: f.titulo.trim() ? 1 : 0.5 }}>
            {salvando ? 'Criando…' : recorrente ? 'Criar recorrência' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReuniaoModal({ reuniao, usuarios, salvando, podeEditar, onSalvar, onExcluir, onClose }: {
  reuniao: Reuniao; usuarios: Usuario[]; salvando: boolean; podeEditar: boolean
  onSalvar: (r: Reuniao, extra?: any) => Promise<Reuniao | null>; onExcluir: () => void; onClose: () => void
}) {
  const [r, setR] = useState<Reuniao>(reuniao)
  const [novaDecisao, setNovaDecisao] = useState('')
  const [novaPauta, setNovaPauta] = useState('')
  useEffect(() => { setR(reuniao) }, [reuniao.id])

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
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <input value={r.titulo} onChange={e => setR({ ...r, titulo: e.target.value })} disabled={!podeEditar}
            style={{ flex: 1, fontSize: 16.5, fontWeight: 800, color: '#111', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
          {r.area && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#4f46e5', background: '#eef2ff', borderRadius: 999, padding: '3px 9px', textTransform: 'uppercase' }}>{r.area}</span>}
          {r.serieId && <span title="Faz parte de uma recorrência semanal" style={{ fontSize: 10.5, fontWeight: 700, color: '#a16207', background: '#fffbeb', borderRadius: 999, padding: '3px 9px' }}>série semanal</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <input type="datetime-local" value={toLocalInput(new Date(r.data))} onChange={e => setR({ ...r, data: new Date(e.target.value).toISOString() })} disabled={!podeEditar}
            style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit' }} />
          <input value={r.participantes || ''} onChange={e => setR({ ...r, participantes: e.target.value })} placeholder="Participantes" disabled={!podeEditar}
            style={{ flex: 1, minWidth: 140, padding: '7px 10px', borderRadius: 9, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit' }} />
          {(['agendada', 'realizada'] as const).map(st => (
            <button key={st} onClick={() => podeEditar && setR({ ...r, status: st })}
              style={{ padding: '7px 14px', borderRadius: 999, border: r.status === st ? '1.5px solid #111' : '1px solid #e6e6e6', background: r.status === st ? '#111' : '#fff', color: r.status === st ? '#fff' : '#777', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
              {st === 'agendada' ? 'Agendada' : 'Realizada'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* PAUTAS DO DIA — vários assuntos da área daquele dia */}
          <div>
            <label style={label}>Pautas{pautas.length ? ` · ${feitas}/${pautas.length} tratadas` : ''}</label>
            {pautas.length === 0 && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#bbb' }}>Nenhuma pauta listada.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {pautas.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: i ? '1px solid #f7f7f7' : 'none' }}>
                  <input type="checkbox" checked={!!p.feita} disabled={!podeEditar} onChange={e => mudaPauta(p.id, { feita: e.target.checked })}
                    title="Tratada nesta reunião" style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
                  <input value={p.texto} disabled={!podeEditar} onChange={e => mudaPauta(p.id, { texto: e.target.value })}
                    style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'inherit', color: p.feita ? '#aaa' : '#333', textDecoration: p.feita ? 'line-through' : 'none', background: 'transparent' }} />
                  {podeEditar && (
                    <button onClick={() => setR(x => ({ ...x, pautas: (x.pautas || []).filter(y => y.id !== p.id) }))}
                      style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>×</button>
                  )}
                </div>
              ))}
            </div>
            {podeEditar && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input value={novaPauta} onChange={e => setNovaPauta(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPauta() } }}
                  placeholder="Nova pauta… (Enter adiciona)" style={{ ...input, flex: 1 }} />
                <button onClick={addPauta} style={{ padding: '10px 14px', background: '#f4f4f5', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', color: '#333' }}>+ Adicionar</button>
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
            {(r.decisoes || []).length === 0 && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#bbb' }}>Nenhuma decisão registrada.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(r.decisoes || []).map(d => (
                <div key={d.id} style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: 10 }}>
                  <input value={d.texto} onChange={e => mudaDecisao(d.id, { texto: e.target.value })} disabled={!podeEditar || !!d.tarefaId}
                    style={{ ...input, border: 'none', padding: '2px 0', fontWeight: 600, borderRadius: 0 }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                    <select value={d.responsavelEmail || ''} disabled={!podeEditar || !!d.tarefaId}
                      onChange={e => { const u = usuarios.find(x => x.email === e.target.value); mudaDecisao(d.id, { responsavelEmail: e.target.value || undefined, responsavelNome: u?.nome }) }}
                      style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
                      <option value="">Responsável…</option>
                      {usuarios.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
                    </select>
                    <input type="date" value={(d.prazo || '').slice(0, 10)} disabled={!podeEditar || !!d.tarefaId}
                      onChange={e => mudaDecisao(d.id, { prazo: e.target.value || undefined })}
                      style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12, fontFamily: 'inherit' }} />
                    <span style={{ flex: 1 }} />
                    {d.tarefaId
                      ? <span style={{ fontSize: 11, fontWeight: 800, color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '4px 10px' }}>Virou tarefa</span>
                      : podeEditar && (
                        <button onClick={() => virarTarefa(d)} disabled={salvando}
                          style={{ padding: '6px 12px', background: 'var(--marca, #ffc00f)', border: 'none', borderRadius: 999, fontWeight: 800, fontSize: 11.5, cursor: 'pointer', color: 'var(--marca-texto, #111)' }}>
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
                <button onClick={addDecisao} style={{ padding: '10px 14px', background: '#f4f4f5', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', color: '#333' }}>+ Adicionar</button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, alignItems: 'center' }}>
          {podeEditar && <button onClick={onExcluir} style={{ padding: '9px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 9, color: '#b91c1c', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Excluir</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 9, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
          {podeEditar && (
            <button onClick={() => onSalvar(r)} disabled={salvando} style={{ padding: '10px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: salvando ? 'wait' : 'pointer' }}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

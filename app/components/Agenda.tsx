'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'

// Módulo Agenda (clínicas/serviços): semana e dia, agendamento por profissional,
// status que flui (agendado -> confirmado -> atendido | faltou | cancelado) e
// detecção de conflito de horário (o servidor recusa; a UI oferece encaixe).

type Usuario = { nome: string; email: string }
type Ag = {
  id: string; pacienteNome: string; pacienteTelefone?: string
  profissionalEmail: string; profissionalNome: string; servico?: string
  dataInicio: string; duracaoMin: number; status: string; observacoes?: string
}

const STATUS: { key: string; label: string; cor: string; bg: string }[] = [
  { key: 'agendado', label: 'Agendado', cor: '#1d4ed8', bg: '#eff6ff' },
  { key: 'confirmado', label: 'Confirmado', cor: '#166534', bg: '#dcfce7' },
  { key: 'atendido', label: 'Atendido', cor: '#374151', bg: '#e5e7eb' },
  { key: 'faltou', label: 'Faltou', cor: '#b91c1c', bg: '#fee2e2' },
  { key: 'cancelado', label: 'Cancelado', cor: '#9ca3af', bg: '#f4f4f5' },
]
const stInfo = (s: string) => STATUS.find(x => x.key === s) || STATUS[0]
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function inicioDaSemana(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)) // segunda-feira
  return x
}
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function Agenda({ usuarios, meuEmail, podeEditar = true }: {
  usuarios: Usuario[]
  meuEmail?: string
  podeEditar?: boolean
}) {
  const [ref, setRef] = useState(() => new Date())
  const [visao, setVisao] = useState<'semana' | 'dia'>('semana')
  const [profFiltro, setProfFiltro] = useState('')
  const [ags, setAgs] = useState<Ag[]>([])
  const [servicos, setServicos] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState<Partial<Ag> | null>(null) // sem id = novo
  const [salvando, setSalvando] = useState(false)

  const semana = inicioDaSemana(ref)
  const fimSemana = new Date(semana); fimSemana.setDate(fimSemana.getDate() + 7)

  const carregar = useCallback(() => {
    setCarregando(true)
    fetch(`/api/agenda?de=${semana.toISOString()}&ate=${fimSemana.toISOString()}`)
      .then(r => r.json())
      .then(d => { if (d && !d.error) { setAgs(d.agendamentos || []); setServicos(d.servicos || []) } })
      .catch(() => {})
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semana.getTime()])
  useEffect(() => { carregar() }, [carregar])

  const visiveis = useMemo(() => profFiltro ? ags.filter(a => a.profissionalEmail === profFiltro) : ags, [ags, profFiltro])
  const doDia = (d: Date) => visiveis.filter(a => { const t = new Date(a.dataInicio); return t.getDate() === d.getDate() && t.getMonth() === d.getMonth() && t.getFullYear() === d.getFullYear() })

  function mover(dias: number) { const d = new Date(ref); d.setDate(d.getDate() + dias); setRef(d) }

  function novo(dia?: Date) {
    const base = dia ? new Date(dia) : new Date(ref)
    base.setHours(9, 0, 0, 0)
    const eu = usuarios.find(u => u.email === meuEmail)
    setModal({ pacienteNome: '', profissionalEmail: eu?.email || usuarios[0]?.email || '', dataInicio: toLocalInput(base), duracaoMin: 30, status: 'agendado' })
  }

  async function salvar(forcar = false) {
    if (!modal || salvando) return
    const prof = usuarios.find(u => u.email === modal.profissionalEmail)
    const corpo: any = { ...modal, profissionalNome: prof?.nome || modal.profissionalEmail, dataInicio: new Date(modal.dataInicio as string).toISOString(), forcar }
    setSalvando(true)
    const r = await fetch('/api/agenda', {
      method: modal.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast(modal.id ? 'Agendamento atualizado.' : 'Agendamento criado.', 'sucesso'); setModal(null); carregar(); return }
    if (r?.conflito) {
      if (await confirmar(`${r.error}\n\nEncaixar mesmo assim?`, { titulo: 'Conflito de horário', okLabel: 'Encaixar', perigo: true })) await salvar(true)
      return
    }
    toast(r?.error || 'Falha ao salvar.', 'erro')
  }

  async function excluir() {
    if (!modal?.id) return
    if (!(await confirmar('Excluir este agendamento de vez? (Para manter o histórico, prefira marcar como Cancelado.)', { titulo: 'Excluir agendamento', okLabel: 'Excluir', perigo: true }))) return
    await fetch('/api/agenda', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: modal.id }) }).catch(() => {})
    setModal(null); carregar()
  }

  const tituloPeriodo = visao === 'semana'
    ? `${semana.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${new Date(fimSemana.getTime() - 1).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
    : ref.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  function Cartao({ a, detalhe }: { a: Ag; detalhe?: boolean }) {
    const st = stInfo(a.status)
    return (
      <div onClick={() => setModal({ ...a, dataInicio: toLocalInput(new Date(a.dataInicio)) })}
        style={{ padding: detalhe ? '10px 14px' : '7px 9px', borderRadius: 10, background: '#fff', border: `1px solid ${st.bg}`, borderLeft: `3px solid ${st.cor}`, cursor: 'pointer', opacity: a.status === 'cancelado' ? 0.55 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: detalhe ? 13 : 11.5, fontWeight: 800, color: '#111' }}>{hora(a.dataInicio)}</span>
          <span style={{ fontSize: detalhe ? 13 : 11.5, fontWeight: 600, color: '#333', textDecoration: a.status === 'cancelado' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{a.pacienteNome}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: st.cor, background: st.bg, borderRadius: 999, padding: '2px 7px' }}>{st.label}</span>
          {a.servico && <span style={{ fontSize: detalhe ? 11.5 : 10.5, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.servico}</span>}
          {!profFiltro && <span style={{ fontSize: 10.5, color: '#bbb' }}>· {(a.profissionalNome || '').split(' ')[0]}</span>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#111' }}>Agenda</h2>
        <div style={{ display: 'inline-flex', gap: 2, background: '#f4f4f5', borderRadius: 10, padding: 3 }}>
          {(['semana', 'dia'] as const).map(v => (
            <button key={v} onClick={() => setVisao(v)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: visao === v ? '#fff' : 'transparent', fontWeight: visao === v ? 700 : 500, fontSize: 12.5, cursor: 'pointer', color: '#333', boxShadow: visao === v ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
              {v === 'semana' ? 'Semana' : 'Dia'}
            </button>
          ))}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => mover(visao === 'semana' ? -7 : -1)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e6e6e6', background: '#fff', cursor: 'pointer', fontSize: 14 }}>‹</button>
          <button onClick={() => setRef(new Date())} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e6e6e6', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#333' }}>Hoje</button>
          <button onClick={() => mover(visao === 'semana' ? 7 : 1)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e6e6e6', background: '#fff', cursor: 'pointer', fontSize: 14 }}>›</button>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#555', textTransform: 'capitalize' }}>{tituloPeriodo}</span>
        <span style={{ flex: 1 }} />
        <select value={profFiltro} onChange={e => setProfFiltro(e.target.value)}
          style={{ padding: '8px 11px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}>
          <option value="">Todos os profissionais</option>
          {usuarios.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
        </select>
        {podeEditar && (
          <button onClick={() => novo()} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Agendamento</button>
        )}
      </div>

      {carregando ? (
        <p style={{ color: '#aaa', fontSize: 13, padding: 30, textAlign: 'center' }}>Carregando agenda...</p>
      ) : visao === 'semana' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))', gap: 8, overflowX: 'auto' }}>
          {Array.from({ length: 7 }, (_, i) => {
            const dia = new Date(semana); dia.setDate(dia.getDate() + i)
            const hoje = new Date().toDateString() === dia.toDateString()
            const lista = doDia(dia)
            return (
              <div key={i} style={{ background: hoje ? '#fffdf2' : '#fafafa', border: `1px solid ${hoje ? '#f3e3ac' : '#f0f0f0'}`, borderRadius: 12, padding: 8, minHeight: 160 }}>
                <div onClick={() => { setRef(dia); setVisao('dia') }} style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 8, cursor: 'pointer' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: hoje ? '#a9781a' : '#888' }}>{DIAS[dia.getDay()]}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{dia.getDate()}</span>
                  {lista.length > 0 && <span style={{ fontSize: 10, color: '#bbb', marginLeft: 'auto' }}>{lista.length}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lista.map(a => <Cartao key={a.id} a={a} />)}
                  {podeEditar && (
                    <button onClick={() => novo(dia)} style={{ padding: '5px 0', borderRadius: 8, border: '1px dashed #ddd', background: 'transparent', color: '#bbb', fontSize: 11, cursor: 'pointer' }}>+</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640 }}>
          {doDia(ref).length === 0 && <p style={{ color: '#aaa', fontSize: 13, padding: '26px 0', textAlign: 'center', background: '#fafafa', borderRadius: 12 }}>Nenhum agendamento neste dia.</p>}
          {doDia(ref).map(a => <Cartao key={a.id} a={a} detalhe />)}
        </div>
      )}

      {/* Modal criar/editar */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16.5, color: '#111' }}>{modal.id ? 'Editar agendamento' : 'Novo agendamento'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={modal.pacienteNome || ''} onChange={e => setModal(m => ({ ...m, pacienteNome: e.target.value }))} placeholder="Nome do paciente/cliente *"
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13.5, fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={modal.pacienteTelefone || ''} onChange={e => setModal(m => ({ ...m, pacienteTelefone: e.target.value }))} placeholder="Telefone/WhatsApp"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }} />
                <input list="agenda-servicos" value={modal.servico || ''} onChange={e => setModal(m => ({ ...m, servico: e.target.value }))} placeholder="Serviço"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }} />
                <datalist id="agenda-servicos">{servicos.map(s => <option key={s} value={s} />)}</datalist>
              </div>
              <select value={modal.profissionalEmail || ''} onChange={e => setModal(m => ({ ...m, profissionalEmail: e.target.value }))}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                {usuarios.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="datetime-local" value={(modal.dataInicio as string) || ''} onChange={e => setModal(m => ({ ...m, dataInicio: e.target.value }))}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }} />
                <select value={modal.duracaoMin || 30} onChange={e => setModal(m => ({ ...m, duracaoMin: Number(e.target.value) }))}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                  {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              {modal.id && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {STATUS.map(s => (
                    <button key={s.key} onClick={() => setModal(m => ({ ...m, status: s.key }))}
                      style={{ padding: '6px 12px', borderRadius: 999, border: modal.status === s.key ? `1.5px solid ${s.cor}` : '1px solid #e6e6e6', background: modal.status === s.key ? s.bg : '#fff', color: modal.status === s.key ? s.cor : '#777', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              <textarea value={modal.observacoes || ''} onChange={e => setModal(m => ({ ...m, observacoes: e.target.value }))} placeholder="Observações" rows={2}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
              {modal.id && podeEditar && (
                <button onClick={excluir} style={{ padding: '9px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 9, color: '#b91c1c', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginRight: 'auto' }}>Excluir</button>
              )}
              <span style={{ flex: modal.id ? undefined : 1 }} />
              <button onClick={() => setModal(null)} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 9, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              {podeEditar && (
                <button onClick={() => salvar()} disabled={salvando || !(modal.pacienteNome || '').trim()} style={{ padding: '10px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: salvando ? 'wait' : 'pointer', opacity: !(modal.pacienteNome || '').trim() ? 0.5 : 1 }}>
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'

// Módulo Agenda (clínicas/serviços): semana e dia, agendamento por profissional,
// status que flui (agendado -> confirmado -> atendido | faltou | cancelado) e
// detecção de conflito de horário (o servidor recusa; a UI oferece encaixe).

type Usuario = { nome: string; email: string; areaSaude?: string; corAgenda?: string; role?: string }
const CORES_PROF = ['#7c3aed', '#1d4ed8', '#16a34a', '#d97706', '#db2777', '#0891b2', '#9333ea', '#ea580c']
// Grade proporcional do dia: expediente 7h–21h, cada 30 min = SLOT_H px de altura
const DIA_INICIO_H = 7, DIA_FIM_H = 21, SLOT_H = 30
type ContatoLite = { id: string; nome: string; telefone?: string; tipo?: string }
type Ag = {
  id: string; pacienteNome: string; pacienteTelefone?: string; contatoId?: string
  profissionalEmail: string; profissionalNome: string; servico?: string
  dataInicio: string; duracaoMin: number; status: string; observacoes?: string
  queixaPrincipal?: string
  registroAtendimento?: string
}
// Tipos de atendimento da clínica (dropdown fixo — pedido do dono)
const SERVICOS_CLINICA = ['Consulta', 'Revisão', 'Procedimento']
type Espera = { id: string; pacienteNome: string; pacienteTelefone?: string; contatoId?: string; servico?: string; observacoes?: string; criadoEm: string }

const STATUS: { key: string; label: string; cor: string; bg: string }[] = [
  { key: 'agendado', label: 'Agendado', cor: '#1d4ed8', bg: '#eff6ff' },
  { key: 'confirmado', label: 'Confirmado', cor: '#166534', bg: '#dcfce7' },
  { key: 'atendido', label: 'Atendido', cor: '#374151', bg: '#e5e7eb' },
  { key: 'faltou', label: 'Faltou', cor: '#b91c1c', bg: '#fee2e2' },
  { key: 'cancelado', label: 'Cancelado', cor: '#9ca3af', bg: '#f4f4f5' },
]
const stInfo = (s: string) => STATUS.find(x => x.key === s) || STATUS[0]
// Rótulos de clínica: "aguardando confirmação" = aguardando pagamento; "confirmado" = pago
const LABEL_CLINICA: Record<string, string> = { agendado: 'Aguardando confirmação', confirmado: 'Confirmado (pago)' }
const labelSt = (key: string, label: string, clinica: boolean) => (clinica && LABEL_CLINICA[key]) || label
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

export default function Agenda({ usuarios, meuEmail, podeEditar = true, perfilClinica = false }: {
  usuarios: Usuario[]
  meuEmail?: string
  podeEditar?: boolean
  perfilClinica?: boolean
}) {
  const [ref, setRef] = useState(() => new Date())
  const [visao, setVisao] = useState<'mes' | 'semana' | 'dia'>('semana')
  const [profFiltro, setProfFiltro] = useState('')
  const [ags, setAgs] = useState<Ag[]>([])
  const [servicos, setServicos] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState<Partial<Ag> | null>(null) // sem id = novo
  const [salvando, setSalvando] = useState(false)
  // Lista de espera (clínicas): quem quer horário mas ainda não tem
  const [espera, setEspera] = useState<Espera[]>([])
  const [esperaAberta, setEsperaAberta] = useState(false)
  const [esperaForm, setEsperaForm] = useState<{ pacienteNome: string; pacienteTelefone: string; servico: string; observacoes: string } | null>(null)
  const [esperaOrigem, setEsperaOrigem] = useState<string | null>(null) // id da espera que virou agendamento
  const carregarEspera = useCallback(() => {
    if (!perfilClinica) return
    fetch('/api/agenda/espera').then(r => r.json()).then(d => { if (Array.isArray(d?.itens)) setEspera(d.itens) }).catch(() => {})
  }, [perfilClinica])
  useEffect(() => { carregarEspera() }, [carregarEspera])
  // Perfil clínica: cadastro de pacientes alimenta o campo de nome (datalist)
  const [contatos, setContatos] = useState<ContatoLite[]>([])
  useEffect(() => {
    if (!perfilClinica) return
    fetch('/api/crm/contatos').then(r => r.json()).then(d => { if (Array.isArray(d)) setContatos(d) }).catch(() => {})
  }, [perfilClinica])
  const normaliza = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
  function aoDigitarPaciente(nome: string) {
    const m = contatos.find(c => normaliza(c.nome) === normaliza(nome))
    setModal(x => ({ ...x, pacienteNome: nome, contatoId: m?.id, pacienteTelefone: (x?.pacienteTelefone || m?.telefone || '') || undefined }))
  }
  // Agendamento iniciado no CRM ("Agendar" no negócio/contato): pré-preenche o modal
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('agenda_prefill')
      if (!raw) return
      sessionStorage.removeItem('agenda_prefill')
      const p = JSON.parse(raw)
      const base = new Date(); base.setHours(9, 0, 0, 0); base.setDate(base.getDate() + 1)
      setModal({ pacienteNome: p.pacienteNome || '', pacienteTelefone: p.pacienteTelefone || undefined, contatoId: p.contatoId || undefined, profissionalEmail: profissionais.find(u => u.email === meuEmail)?.email || profissionais[0]?.email || '', dataInicio: toLocalInput(base), duracaoMin: 30, status: 'agendado' })
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const semana = inicioDaSemana(ref)
  const fimSemana = new Date(semana); fimSemana.setDate(fimSemana.getDate() + 7)
  // Grade do mês: da segunda-feira anterior ao dia 1 até fechar 6 semanas (42 dias)
  const inicioMes = inicioDaSemana(new Date(ref.getFullYear(), ref.getMonth(), 1))
  const fimMes = new Date(inicioMes); fimMes.setDate(fimMes.getDate() + 42)
  const deBusca = visao === 'mes' ? inicioMes : semana
  const ateBusca = visao === 'mes' ? fimMes : fimSemana

  const carregar = useCallback(() => {
    setCarregando(true)
    fetch(`/api/agenda?de=${deBusca.toISOString()}&ate=${ateBusca.toISOString()}`)
      .then(r => r.json())
      .then(d => { if (d && !d.error) { setAgs(d.agendamentos || []); setServicos(d.servicos || []) } })
      .catch(() => {})
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deBusca.getTime(), ateBusca.getTime()])
  useEffect(() => { carregar() }, [carregar])

  // Profissionais que atendem (têm área de saúde/estética). Comercial e quem não
  // atende ficam fora da agenda. Se ninguém tiver área ainda, cai p/ todos (não trava).
  const profissionais = useMemo(() => {
    if (!perfilClinica) return usuarios
    const comArea = usuarios.filter(u => u.areaSaude)
    return comArea.length ? comArea : usuarios.filter(u => u.role !== 'vendas')
  }, [usuarios, perfilClinica])
  const corProf = useCallback((email: string) => {
    const u = usuarios.find(x => x.email === email)
    if (u?.corAgenda) return u.corAgenda
    const i = profissionais.findIndex(x => x.email === email)
    return CORES_PROF[(i >= 0 ? i : 0) % CORES_PROF.length]
  }, [usuarios, profissionais])

  const visiveis = useMemo(() => profFiltro ? ags.filter(a => a.profissionalEmail === profFiltro) : ags, [ags, profFiltro])
  const doDia = (d: Date) => visiveis.filter(a => { const t = new Date(a.dataInicio); return t.getDate() === d.getDate() && t.getMonth() === d.getMonth() && t.getFullYear() === d.getFullYear() })

  // Layout proporcional do dia: posiciona/dimensiona por horário e resolve
  // sobreposições em colunas lado a lado (ex.: 2 profissionais no mesmo horário).
  function layoutDia(lista: Ag[]): { a: Ag; col: number; cols: number }[] {
    const items = [...lista].sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime())
    const res: { a: Ag; col: number; cols: number }[] = []
    let grupo: { a: Ag; start: number; end: number; col: number }[] = []
    let grupoFim = -1
    const fechar = () => {
      if (!grupo.length) return
      const cols = Math.max(...grupo.map(c => c.col + 1))
      grupo.forEach(c => res.push({ a: c.a, col: c.col, cols }))
      grupo = []; grupoFim = -1
    }
    for (const a of items) {
      const start = new Date(a.dataInicio).getTime()
      const end = start + Math.max(15, a.duracaoMin || 30) * 60000
      if (grupo.length && start >= grupoFim) fechar()
      const usadas = new Set(grupo.filter(c => c.end > start).map(c => c.col))
      let col = 0; while (usadas.has(col)) col++
      grupo.push({ a, start, end, col })
      grupoFim = Math.max(grupoFim, end)
    }
    fechar()
    return res
  }
  // Cria um agendamento num horário clicado da grade (minutos desde 00h do dia).
  function novoEmMinutos(dia: Date, minutos: number) {
    if (!podeEditar) return
    const base = new Date(dia); base.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0)
    const eu = profissionais.find(u => u.email === meuEmail)
    setModal({ pacienteNome: '', profissionalEmail: profFiltro || eu?.email || profissionais[0]?.email || '', dataInicio: toLocalInput(base), duracaoMin: 30, status: 'agendado' })
  }

  function mover(dias: number) {
    const d = new Date(ref)
    if (visao === 'mes') d.setMonth(d.getMonth() + (dias > 0 ? 1 : -1))
    else d.setDate(d.getDate() + dias)
    setRef(d)
  }

  function novo(dia?: Date) {
    const base = dia ? new Date(dia) : new Date(ref)
    base.setHours(9, 0, 0, 0)
    const eu = profissionais.find(u => u.email === meuEmail)
    setModal({ pacienteNome: '', profissionalEmail: eu?.email || profissionais[0]?.email || '', dataInicio: toLocalInput(base), duracaoMin: 30, status: 'agendado' })
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
    if (r?.ok) {
      // Veio da lista de espera? Agendou = sai da fila.
      if (esperaOrigem) {
        await fetch('/api/agenda/espera', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: esperaOrigem }) }).catch(() => {})
        setEsperaOrigem(null); carregarEspera()
      }
      toast(modal.id ? 'Agendamento atualizado.' : 'Agendamento criado.', 'sucesso'); setModal(null); carregar(); return
    }
    if (r?.conflito) {
      if (await confirmar(`${r.error}\n\nEncaixar mesmo assim?`, { titulo: 'Conflito de horário', okLabel: 'Encaixar', perigo: true })) await salvar(true)
      return
    }
    toast(r?.error || 'Falha ao salvar.', 'erro')
  }

  async function adicionarEspera() {
    if (!esperaForm?.pacienteNome.trim()) return
    const r = await fetch('/api/agenda/espera', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(esperaForm) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { toast('Adicionado à lista de espera.', 'sucesso'); setEsperaForm(null); carregarEspera() }
    else toast(r?.error || 'Falha ao adicionar.', 'erro')
  }

  async function removerEspera(id: string) {
    if (!(await confirmar('Remover da lista de espera?', { titulo: 'Lista de espera', okLabel: 'Remover', perigo: true }))) return
    await fetch('/api/agenda/espera', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {})
    carregarEspera()
  }

  function agendarDaEspera(item: Espera) {
    const base = new Date(ref); base.setHours(9, 0, 0, 0)
    const eu = profissionais.find(u => u.email === meuEmail)
    setEsperaOrigem(item.id)
    setModal({ pacienteNome: item.pacienteNome, pacienteTelefone: item.pacienteTelefone, contatoId: item.contatoId, servico: item.servico, profissionalEmail: eu?.email || profissionais[0]?.email || '', dataInicio: toLocalInput(base), duracaoMin: 30, status: 'agendado' })
    setEsperaAberta(false)
  }

  async function excluir() {
    if (!modal?.id) return
    if (!(await confirmar('Excluir este agendamento de vez? (Para manter o histórico, prefira marcar como Cancelado.)', { titulo: 'Excluir agendamento', okLabel: 'Excluir', perigo: true }))) return
    await fetch('/api/agenda', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: modal.id }) }).catch(() => {})
    setModal(null); carregar()
  }

  const tituloPeriodo = visao === 'mes'
    ? ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : visao === 'semana'
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
          <span style={{ fontSize: 10, fontWeight: 800, color: st.cor, background: st.bg, borderRadius: 999, padding: '2px 7px' }}>{labelSt(st.key, st.label, perfilClinica)}</span>
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
          {(['mes', 'semana', 'dia'] as const).map(v => (
            <button key={v} onClick={() => setVisao(v)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: visao === v ? '#fff' : 'transparent', fontWeight: visao === v ? 700 : 500, fontSize: 12.5, cursor: 'pointer', color: '#333', boxShadow: visao === v ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
              {v === 'mes' ? 'Mês' : v === 'semana' ? 'Semana' : 'Dia'}
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
          {profissionais.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
        </select>
        {perfilClinica && (
          <button onClick={() => setEsperaAberta(v => !v)} style={{ padding: '9px 14px', background: esperaAberta ? '#111' : '#fff', color: esperaAberta ? '#fff' : '#333', border: '1px solid #e6e6e6', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            Lista de espera{espera.length > 0 ? ` (${espera.length})` : ''}
          </button>
        )}
        {podeEditar && (
          <button onClick={() => novo()} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Agendamento</button>
        )}
      </div>

      {/* Painel da lista de espera */}
      {perfilClinica && esperaAberta && (
        <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: '#111' }}>Lista de espera</h3>
            <span style={{ fontSize: 11.5, color: '#999' }}>ordem de chegada</span>
            <span style={{ flex: 1 }} />
            {podeEditar && !esperaForm && (
              <button onClick={() => setEsperaForm({ pacienteNome: '', pacienteTelefone: '', servico: '', observacoes: '' })} style={{ padding: '6px 12px', background: '#f4f4f5', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', color: '#333' }}>+ Adicionar</button>
            )}
          </div>
          {esperaForm && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
              <input value={esperaForm.pacienteNome} onChange={e => setEsperaForm(f => f && { ...f, pacienteNome: e.target.value })} placeholder="Nome do paciente *" style={{ flex: 2, minWidth: 140, padding: '8px 10px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit' }} />
              <input value={esperaForm.pacienteTelefone} onChange={e => setEsperaForm(f => f && { ...f, pacienteTelefone: e.target.value })} placeholder="Telefone" style={{ flex: 1, minWidth: 110, padding: '8px 10px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit' }} />
              <input value={esperaForm.servico} onChange={e => setEsperaForm(f => f && { ...f, servico: e.target.value })} list="agenda-servicos" placeholder="Serviço" style={{ flex: 1, minWidth: 110, padding: '8px 10px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit' }} />
              <input value={esperaForm.observacoes} onChange={e => setEsperaForm(f => f && { ...f, observacoes: e.target.value })} placeholder="Observações (preferência de horário...)" style={{ flex: 2, minWidth: 150, padding: '8px 10px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit' }} />
              <button onClick={adicionarEspera} disabled={!esperaForm.pacienteNome.trim()} style={{ padding: '8px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: esperaForm.pacienteNome.trim() ? 1 : 0.5 }}>Salvar</button>
              <button onClick={() => setEsperaForm(null)} style={{ padding: '8px 12px', background: '#f0f0f0', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', color: '#666' }}>Cancelar</button>
            </div>
          )}
          {espera.length === 0 && !esperaForm && <p style={{ margin: 0, fontSize: 12.5, color: '#aaa' }}>Ninguém aguardando horário.</p>}
          {espera.map((it, i) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: i > 0 ? '1px solid #f6f6f6' : 'none' }}>
              <span style={{ width: 20, fontSize: 11, fontWeight: 800, color: '#bbb', flexShrink: 0 }}>{i + 1}º</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111', flexShrink: 0 }}>{it.pacienteNome}</span>
              <span style={{ flex: 1, fontSize: 12, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[it.servico, it.pacienteTelefone, it.observacoes].filter(Boolean).join(' · ')}</span>
              <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0 }}>desde {new Date(it.criadoEm).toLocaleDateString('pt-BR')}</span>
              {podeEditar && (
                <>
                  <button onClick={() => agendarDaEspera(it)} style={{ padding: '5px 12px', background: '#ffc00f', border: 'none', borderRadius: 999, fontWeight: 800, fontSize: 11.5, cursor: 'pointer', color: '#111', flexShrink: 0 }}>Agendar</button>
                  <button onClick={() => removerEspera(it.id)} style={{ padding: '5px 10px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 999, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', color: '#b91c1c', flexShrink: 0 }}>Remover</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {carregando ? (
        <p style={{ color: '#aaa', fontSize: 13, padding: 30, textAlign: 'center' }}>Carregando agenda...</p>
      ) : visao === 'mes' ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))', gap: 6, marginBottom: 6 }}>
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
              <span key={d} style={{ fontSize: 11, fontWeight: 800, color: '#999', textAlign: 'center' }}>{d}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))', gap: 6, overflowX: 'auto' }}>
            {Array.from({ length: 42 }, (_, i) => {
              const dia = new Date(inicioMes); dia.setDate(dia.getDate() + i)
              const foraDoMes = dia.getMonth() !== ref.getMonth()
              const hoje = new Date().toDateString() === dia.toDateString()
              const lista = doDia(dia).filter(a => a.status !== 'cancelado')
              return (
                <div key={i} onClick={() => { setRef(new Date(dia)); setVisao('dia') }}
                  style={{ minHeight: 84, background: hoje ? '#fffdf2' : foraDoMes ? '#fcfcfc' : '#fafafa', border: `1px solid ${hoje ? '#f3e3ac' : '#f0f0f0'}`, borderRadius: 10, padding: 7, cursor: 'pointer', opacity: foraDoMes ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: hoje ? '#a9781a' : '#111' }}>{dia.getDate()}</span>
                    {lista.length > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: '#111', borderRadius: 999, padding: '1px 6px', marginLeft: 'auto' }}>{lista.length}</span>}
                  </div>
                  {lista.slice(0, 3).map(a => (
                    <p key={a.id} style={{ margin: '0 0 2px', fontSize: 10.5, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {hora(a.dataInicio)} {a.pacienteNome.split(' ')[0]}
                    </p>
                  ))}
                  {lista.length > 3 && <p style={{ margin: 0, fontSize: 10, color: '#aaa' }}>+{lista.length - 3}</p>}
                </div>
              )
            })}
          </div>
        </div>
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
        // Visão DIA proporcional: expediente inteiro com altura ∝ duração
        <div style={{ display: 'flex', background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12, overflow: 'hidden', maxWidth: 760 }}>
          {/* Eixo de horas */}
          <div style={{ width: 52, flexShrink: 0, borderRight: '1px solid #f0f0f0' }}>
            {Array.from({ length: DIA_FIM_H - DIA_INICIO_H }, (_, i) => (
              <div key={i} style={{ height: SLOT_H * 2, position: 'relative' }}>
                <span style={{ position: 'absolute', top: -7, right: 6, fontSize: 10.5, color: '#aaa', fontWeight: 600 }}>{String(DIA_INICIO_H + i).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          {/* Lanes */}
          <div
            onClick={e => {
              if (!podeEditar) return
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              const slot = Math.max(0, Math.floor((e.clientY - rect.top) / SLOT_H))
              novoEmMinutos(ref, DIA_INICIO_H * 60 + slot * 30)
            }}
            style={{ position: 'relative', flex: 1, height: (DIA_FIM_H - DIA_INICIO_H) * 2 * SLOT_H, cursor: podeEditar ? 'copy' : 'default' }}>
            {/* Linhas de hora/meia-hora */}
            {Array.from({ length: (DIA_FIM_H - DIA_INICIO_H) * 2 + 1 }, (_, i) => (
              <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * SLOT_H, borderTop: `1px ${i % 2 === 0 ? 'solid #eee' : 'dashed #f4f4f4'}` }} />
            ))}
            {/* Agendamentos posicionados */}
            {layoutDia(doDia(ref)).map(({ a, col, cols }) => {
              const t = new Date(a.dataInicio)
              const minutos = t.getHours() * 60 + t.getMinutes() - DIA_INICIO_H * 60
              const top = Math.max(0, (minutos / 30) * SLOT_H)
              const altura = Math.max(SLOT_H - 2, (Math.max(15, a.duracaoMin || 30) / 30) * SLOT_H - 2)
              const cor = corProf(a.profissionalEmail)
              const cancelado = a.status === 'cancelado'
              const st = stInfo(a.status)
              return (
                <div key={a.id} onClick={ev => { ev.stopPropagation(); setModal({ ...a, dataInicio: toLocalInput(new Date(a.dataInicio)) }) }}
                  title={`${hora(a.dataInicio)} · ${a.pacienteNome} · ${a.profissionalNome}`}
                  style={{ position: 'absolute', top, height: altura, left: `calc(${(col / cols) * 100}% + 3px)`, width: `calc(${100 / cols}% - 6px)`, background: cancelado ? '#f4f4f5' : `${cor}18`, borderLeft: `3px solid ${cor}`, borderRadius: 7, padding: '3px 6px', overflow: 'hidden', cursor: 'pointer', opacity: cancelado ? 0.6 : 1, boxSizing: 'border-box' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hora(a.dataInicio)} {a.pacienteNome}</div>
                  {altura > SLOT_H && <div style={{ fontSize: 9.5, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[a.servico, (a.profissionalNome || '').split(' ')[0]].filter(Boolean).join(' · ')}</div>}
                  {altura > SLOT_H * 2 && <div style={{ fontSize: 9, fontWeight: 800, color: st.cor, marginTop: 2 }}>{labelSt(st.key, st.label, perfilClinica)}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal criar/editar */}
      {modal && (
        <div onClick={() => { setModal(null); setEsperaOrigem(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16.5, color: '#111' }}>{modal.id ? 'Editar agendamento' : 'Novo agendamento'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input list={perfilClinica ? 'agenda-pacientes' : undefined} value={modal.pacienteNome || ''} onChange={e => perfilClinica ? aoDigitarPaciente(e.target.value) : setModal(m => ({ ...m, pacienteNome: e.target.value }))} placeholder="Nome do paciente/cliente *"
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13.5, fontFamily: 'inherit' }} />
              {perfilClinica && (
                <>
                  <datalist id="agenda-pacientes">{contatos.filter(c => !c.tipo || c.tipo === 'paciente' || c.tipo === 'lead').map(c => <option key={c.id} value={c.nome} />)}</datalist>
                  {(modal.pacienteNome || '').trim() && (
                    modal.contatoId
                      ? <p style={{ margin: '-4px 0 0', fontSize: 11, color: '#166534' }}>Paciente do cadastro — o atendimento entra no histórico dele.</p>
                      : <p style={{ margin: '-4px 0 0', fontSize: 11, color: '#888' }}>Paciente novo — será cadastrado automaticamente ao salvar.</p>
                  )}
                </>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={modal.pacienteTelefone || ''} onChange={e => setModal(m => ({ ...m, pacienteTelefone: e.target.value }))} placeholder="Telefone/WhatsApp"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }} />
                {perfilClinica ? (
                  <select value={modal.servico || ''} onChange={e => setModal(m => ({ ...m, servico: e.target.value }))}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                    <option value="">Tipo de atendimento...</option>
                    {SERVICOS_CLINICA.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input list="agenda-servicos" value={modal.servico || ''} onChange={e => setModal(m => ({ ...m, servico: e.target.value }))} placeholder="Serviço"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }} />
                )}
                <datalist id="agenda-servicos">{servicos.map(s => <option key={s} value={s} />)}</datalist>
              </div>
              <select value={modal.profissionalEmail || ''} onChange={e => setModal(m => ({ ...m, profissionalEmail: e.target.value }))}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                {profissionais.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="datetime-local" value={(modal.dataInicio as string) || ''} onChange={e => setModal(m => ({ ...m, dataInicio: e.target.value }))}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }} />
                <select value={modal.duracaoMin || 30} onChange={e => setModal(m => ({ ...m, duracaoMin: Number(e.target.value) }))}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                  {(perfilClinica ? [30, 45, 60, 90, 120, 150, 180, 210, 240] : [15, 30, 45, 60, 90, 120]).map(d => (
                    <option key={d} value={d}>{d < 60 ? `${d} min` : `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}min` : ''}`}</option>
                  ))}
                </select>
              </div>
              {(modal.id || perfilClinica) && (
                <div>
                  {perfilClinica && !modal.id && <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 5 }}>Situação (confirmado = pagamento recebido)</label>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(modal.id ? STATUS : STATUS.filter(s => s.key === 'agendado' || s.key === 'confirmado')).map(s => (
                      <button key={s.key} onClick={() => setModal(m => ({ ...m, status: s.key }))}
                        style={{ padding: '6px 12px', borderRadius: 999, border: modal.status === s.key ? `1.5px solid ${s.cor}` : '1px solid #e6e6e6', background: modal.status === s.key ? s.bg : '#fff', color: modal.status === s.key ? s.cor : '#777', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                        {labelSt(s.key, s.label, perfilClinica)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {perfilClinica && (
                <input value={modal.queixaPrincipal || ''} onChange={e => setModal(m => ({ ...m, queixaPrincipal: e.target.value }))} placeholder="Queixa principal (motivo da consulta)"
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }} />
              )}
              <textarea value={modal.observacoes || ''} onChange={e => setModal(m => ({ ...m, observacoes: e.target.value }))} placeholder="Observações" rows={2}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
              {perfilClinica && modal.id && (modal.status === 'atendido' || !!modal.registroAtendimento) && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 5 }}>Registro do atendimento (evolução)</label>
                  <textarea value={modal.registroAtendimento || ''} onChange={e => setModal(m => ({ ...m, registroAtendimento: e.target.value }))} placeholder="O que foi feito, orientações, próximos passos..." rows={4}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
                  <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#aaa' }}>Fica no histórico do paciente. Dado sensível — visível só para a equipe.</p>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
              {modal.id && podeEditar && (
                <button onClick={excluir} style={{ padding: '9px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 9, color: '#b91c1c', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginRight: 'auto' }}>Excluir</button>
              )}
              <span style={{ flex: modal.id ? undefined : 1 }} />
              <button onClick={() => { setModal(null); setEsperaOrigem(null) }} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 9, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
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

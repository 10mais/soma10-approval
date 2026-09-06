'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { Bloqueio, bloqueioNoDia, feriadoDoDia, ehProfissionalAgenda } from '@/lib/agenda'

// Módulo Agenda (clínicas/serviços): semana e dia, agendamento por profissional,
// status que flui (agendado -> confirmado -> atendido | faltou | cancelado) e
// detecção de conflito de horário (o servidor recusa; a UI oferece encaixe).

type Usuario = { nome: string; email: string; areaSaude?: string; corAgenda?: string; recebeAgenda?: boolean; role?: string }
const CORES_PROF = ['#7c3aed', 'var(--v2-info)', 'var(--v2-ok)', 'var(--v2-amber)', '#db2777', '#0891b2', '#9333ea', '#ea580c']
// Grade proporcional do dia: expediente 7h–21h, cada 30 min = SLOT_H px de altura.
// SLOT_H=20 -> dia inteiro (14h) em ~560px, cabe numa tela sem rolar.
const DIA_INICIO_H = 7, DIA_FIM_H = 21, SLOT_H = 20
type ContatoLite = { id: string; nome: string; telefone?: string; tipo?: string }
type Ag = {
  id: string; pacienteNome: string; pacienteTelefone?: string; contatoId?: string
  profissionalEmail: string; profissionalNome: string; servico?: string
  dataInicio: string; duracaoMin: number; status: string; observacoes?: string
  queixaPrincipal?: string
  registroAtendimento?: string
  procedimentosRealizados?: string[]
  valorInvestido?: number
}
// Tipos de atendimento da clínica (dropdown fixo — pedido do dono)
const SERVICOS_CLINICA = ['Consulta', 'Revisão', 'Procedimento']
type Espera = { id: string; pacienteNome: string; pacienteTelefone?: string; contatoId?: string; servico?: string; observacoes?: string; criadoEm: string }

const STATUS: { key: string; label: string; cor: string; bg: string }[] = [
  { key: 'agendado', label: 'Agendado', cor: 'var(--v2-info)', bg: 'var(--v2-info-bg)' },
  { key: 'confirmado', label: 'Confirmado', cor: 'var(--v2-ok)', bg: 'var(--v2-ok-bg)' },
  { key: 'atendido', label: 'Atendido', cor: 'var(--v2-ink2)', bg: 'var(--v2-surface2)' },
  { key: 'faltou', label: 'Faltou', cor: 'var(--v2-hot)', bg: 'var(--v2-hot-bg)' },
  { key: 'cancelado', label: 'Cancelado', cor: 'var(--v2-ink3)', bg: 'var(--v2-surface1)' },
]
const stInfo = (s: string) => STATUS.find(x => x.key === s) || STATUS[0]
// Rótulos de clínica: "aguardando confirmação" = aguardando pagamento; "confirmado" = pago
const LABEL_CLINICA: Record<string, string> = { agendado: 'Aguardando confirmação', confirmado: 'Confirmado (pago)' }
const labelSt = (key: string, label: string, clinica: boolean) => (clinica && LABEL_CLINICA[key]) || label
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
// Seletor de dias no form de bloqueio recorrente (começa na segunda)
const DIAS_ORDEM = [1, 2, 3, 4, 5, 6, 0]
const GRID_H = (DIA_FIM_H - DIA_INICIO_H) * 2 * SLOT_H // altura da grade proporcional (Dia/Semana)
const HEADER_H = 32 // cabeçalho de cada coluna-dia na Semana (alinha com o eixo de horas)
type BlocoForm = { profissionalEmail: string; titulo: string; recorrente: boolean; dataInicio: string; duracaoMin: number; diasSemana: number[]; horaInicio: string; horaFim: string; ate: string }

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
  const [visao, setVisao] = useState<'mes' | 'semana' | 'dia' | 'lista'>('semana')
  const [profFiltro, setProfFiltro] = useState('')
  const [ags, setAgs] = useState<Ag[]>([])
  const [servicos, setServicos] = useState<string[]>([])
  // Catálogo de Procedimentos e Métodos (clínica): alimenta o "tipo de atendimento"
  // e o pós-atendimento. Vazio = usa a lista básica SERVICOS_CLINICA.
  const [procedimentos, setProcedimentos] = useState<string[]>([])
  useEffect(() => {
    if (!perfilClinica) return
    fetch('/api/procedimentos').then(r => r.json())
      .then(d => { if (Array.isArray(d?.procedimentos)) setProcedimentos(d.procedimentos.map((p: any) => p.nome)) })
      .catch(() => {})
  }, [perfilClinica])
  const servicosClinica = procedimentos.length ? procedimentos : SERVICOS_CLINICA
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
  // Bloqueios/compromissos da profissional (independem do período — recorrentes valem sempre)
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([])
  const [blocosModal, setBlocosModal] = useState(false)
  const [blocoForm, setBlocoForm] = useState<BlocoForm | null>(null)
  const [salvandoBloco, setSalvandoBloco] = useState(false)
  const carregarBloqueios = useCallback(() => {
    fetch('/api/agenda/bloqueios').then(r => r.json()).then(d => { if (Array.isArray(d?.bloqueios)) setBloqueios(d.bloqueios) }).catch(() => {})
  }, [])
  useEffect(() => { carregarBloqueios() }, [carregarBloqueios])
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
    const pros = usuarios.filter(ehProfissionalAgenda)
    return pros.length ? pros : usuarios.filter(u => u.role !== 'vendas')
  }, [usuarios, perfilClinica])
  const corProf = useCallback((email: string) => {
    const u = usuarios.find(x => x.email === email)
    if (u?.corAgenda) return u.corAgenda
    const i = profissionais.findIndex(x => x.email === email)
    return CORES_PROF[(i >= 0 ? i : 0) % CORES_PROF.length]
  }, [usuarios, profissionais])

  // Feriados nacionais (marcados, não bloqueiam). Cache de mapas por ano.
  const feriadoCache = useMemo(() => ({} as Record<number, Record<string, string>>), [])
  const feriadoDe = useCallback((d: Date) => feriadoDoDia(d, feriadoCache), [feriadoCache])

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

  // --- Bloqueios/compromissos da profissional ---
  function novoBloco() {
    const base = new Date(ref); base.setHours(12, 0, 0, 0)
    const eu = profissionais.find(u => u.email === meuEmail)
    setBlocoForm({ profissionalEmail: profFiltro || eu?.email || profissionais[0]?.email || '', titulo: '', recorrente: true, dataInicio: toLocalInput(base), duracaoMin: 60, diasSemana: [], horaInicio: '12:00', horaFim: '13:00', ate: '' })
  }
  async function salvarBloco() {
    if (!blocoForm || salvandoBloco) return
    if (!blocoForm.profissionalEmail) { toast('Escolha o profissional.', 'erro'); return }
    const prof = usuarios.find(u => u.email === blocoForm.profissionalEmail)
    const corpo: any = { profissionalEmail: blocoForm.profissionalEmail, profissionalNome: prof?.nome, titulo: blocoForm.titulo.trim() || undefined, recorrente: blocoForm.recorrente }
    if (blocoForm.recorrente) {
      if (!blocoForm.diasSemana.length) { toast('Escolha ao menos um dia da semana.', 'erro'); return }
      corpo.diasSemana = blocoForm.diasSemana; corpo.horaInicio = blocoForm.horaInicio; corpo.horaFim = blocoForm.horaFim
      if (blocoForm.ate) corpo.ate = blocoForm.ate
    } else {
      corpo.dataInicio = new Date(blocoForm.dataInicio).toISOString(); corpo.duracaoMin = blocoForm.duracaoMin
    }
    setSalvandoBloco(true)
    const r = await fetch('/api/agenda/bloqueios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then(x => x.json()).catch(() => null)
    setSalvandoBloco(false)
    if (r?.ok) { toast('Bloqueio adicionado.', 'sucesso'); setBlocoForm(null); carregarBloqueios() }
    else toast(r?.error || 'Falha ao salvar o bloqueio.', 'erro')
  }
  async function removerBloco(id: string) {
    if (!(await confirmar('Remover este bloqueio?', { titulo: 'Bloqueio', okLabel: 'Remover', perigo: true }))) return
    await fetch('/api/agenda/bloqueios', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {})
    carregarBloqueios()
  }
  function descBloco(b: Bloqueio): string {
    if (b.recorrente) {
      const dias = DIAS_ORDEM.filter(d => (b.diasSemana || []).includes(d)).map(d => DIAS[d]).join(', ')
      const ate = b.ate ? ` · até ${new Date(b.ate + 'T00:00').toLocaleDateString('pt-BR')}` : ''
      return `${dias} · ${b.horaInicio}–${b.horaFim}${ate}`
    }
    return `${new Date(b.dataInicio || '').toLocaleDateString('pt-BR')} ${hora(b.dataInicio || '')} · ${b.duracaoMin} min`
  }
  // Bloqueios que incidem num dia local (aplica o filtro de profissional da toolbar)
  const blocosDoDia = useCallback((d: Date) => bloqueios
    .filter(b => !profFiltro || b.profissionalEmail === profFiltro)
    .map(b => { const intr = bloqueioNoDia(b, d); return intr ? { b, ...intr } : null })
    .filter(Boolean) as { b: Bloqueio; inicio: number; fim: number }[], [bloqueios, profFiltro])

  const tituloPeriodo = visao === 'mes'
    ? ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : (visao === 'semana' || visao === 'lista')
    ? `${semana.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${new Date(fimSemana.getTime() - 1).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
    : ref.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  // Eixo de horas (07:00…20:00). `spacer` alinha os rótulos com o cabeçalho das colunas na Semana.
  function EixoHoras({ spacer }: { spacer?: boolean }) {
    return (
      <div style={{ width: 46, flexShrink: 0, borderRight: '1px solid var(--v2-rule)' }}>
        {spacer && <div style={{ height: HEADER_H }} />}
        {Array.from({ length: DIA_FIM_H - DIA_INICIO_H }, (_, i) => (
          <div key={i} style={{ height: SLOT_H * 2, position: 'relative' }}>
            <span style={{ position: 'absolute', top: -7, right: 6, fontSize: 10, color: 'var(--v2-ink3)', fontWeight: 600 }}>{String(DIA_INICIO_H + i).padStart(2, '0')}:00</span>
          </div>
        ))}
      </div>
    )
  }

  // Grade proporcional de UM dia (usada pelo Dia e por cada coluna da Semana):
  // linhas de hora, bloqueios (faixas hachuradas ao fundo) e agendamentos posicionados.
  function LanesDia({ dia, compact }: { dia: Date; compact?: boolean }) {
    const lista = doDia(dia)
    const gridTopMs = (() => { const d = new Date(dia); d.setHours(DIA_INICIO_H, 0, 0, 0); return d.getTime() })()
    const gridBotMs = gridTopMs + (DIA_FIM_H - DIA_INICIO_H) * 3600000
    const y = (ms: number) => ((Math.min(gridBotMs, Math.max(gridTopMs, ms)) - gridTopMs) / 60000 / 30) * SLOT_H
    const blocos = blocosDoDia(dia)
    return (
      <div
        onClick={e => {
          if (!podeEditar) return
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          const slot = Math.max(0, Math.floor((e.clientY - rect.top) / SLOT_H))
          novoEmMinutos(dia, DIA_INICIO_H * 60 + slot * 30)
        }}
        style={{ position: 'relative', flex: 1, minWidth: compact ? 120 : undefined, height: GRID_H, cursor: podeEditar ? 'copy' : 'default', borderLeft: compact ? '1px solid var(--v2-rule)' : undefined }}>
        {/* Linhas de hora/meia-hora */}
        {Array.from({ length: (DIA_FIM_H - DIA_INICIO_H) * 2 + 1 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * SLOT_H, borderTop: `1px ${i % 2 === 0 ? 'solid var(--v2-surface2)' : 'dashed var(--v2-surface1)'}` }} />
        ))}
        {/* Bloqueios (ao fundo, não-clicáveis — editar/remover na tela de Bloqueios) */}
        {blocos.map(({ b, inicio, fim }, i) => {
          const top = y(inicio), h = Math.max(3, y(fim) - top)
          return (
            <div key={b.id + i} title={`${b.titulo || 'Bloqueado'}${!profFiltro ? ' · ' + (b.profissionalNome || '').split(' ')[0] : ''}`}
              style={{ position: 'absolute', top, height: h, left: 2, right: 2, background: 'repeating-linear-gradient(45deg,#f1f1f3,#f1f1f3 6px,#e7e7ec 6px,#e7e7ec 12px)', border: '1px solid #e2e2e7', borderRadius: 6, pointerEvents: 'none', padding: '2px 6px', overflow: 'hidden', boxSizing: 'border-box' }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: '#9a9aa2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{b.titulo || 'Bloqueado'}</span>
            </div>
          )
        })}
        {/* Agendamentos */}
        {layoutDia(lista).map(({ a, col, cols }) => {
          const start = new Date(a.dataInicio).getTime()
          const top = y(start)
          const altura = Math.max(SLOT_H - 2, y(start + Math.max(15, a.duracaoMin || 30) * 60000) - top - 2)
          const cor = corProf(a.profissionalEmail)
          const cancelado = a.status === 'cancelado'
          const st = stInfo(a.status)
          return (
            <div key={a.id} onClick={ev => { ev.stopPropagation(); setModal({ ...a, dataInicio: toLocalInput(new Date(a.dataInicio)) }) }}
              title={`${hora(a.dataInicio)} · ${a.pacienteNome} · ${a.profissionalNome}`}
              style={{ position: 'absolute', top, height: altura, left: `calc(${(col / cols) * 100}% + 3px)`, width: `calc(${100 / cols}% - 6px)`, background: cancelado ? 'var(--v2-surface1)' : `${cor}18`, borderLeft: `3px solid ${cor}`, borderRadius: 7, padding: '3px 6px', overflow: 'hidden', cursor: 'pointer', opacity: cancelado ? 0.6 : 1, boxSizing: 'border-box', zIndex: 1 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--v2-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: cancelado ? 'line-through' : 'none' }}>{hora(a.dataInicio)} {a.pacienteNome}</div>
              {altura > SLOT_H && <div style={{ fontSize: 9.5, color: 'var(--v2-ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[a.servico, !profFiltro && (a.profissionalNome || '').split(' ')[0]].filter(Boolean).join(' · ')}</div>}
              {altura > SLOT_H * 2 && <div style={{ fontSize: 9, fontWeight: 800, color: st.cor, marginTop: 2 }}>{labelSt(st.key, st.label, perfilClinica)}</div>}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--v2-ink)' }}>Agenda</h2>
        <div style={{ display: 'inline-flex', gap: 2, background: 'var(--v2-surface1)', borderRadius: 10, padding: 3 }}>
          {(['mes', 'semana', 'dia', 'lista'] as const).map(v => (
            <button key={v} onClick={() => setVisao(v)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: visao === v ? 'var(--v2-surface)' : 'transparent', fontWeight: visao === v ? 700 : 500, fontSize: 12.5, cursor: 'pointer', color: 'var(--v2-ink)', boxShadow: visao === v ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
              {v === 'mes' ? 'Mês' : v === 'semana' ? 'Semana' : v === 'dia' ? 'Dia' : 'Lista'}
            </button>
          ))}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => mover((visao === 'semana' || visao === 'lista') ? -7 : -1)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', cursor: 'pointer', fontSize: 14 }}>‹</button>
          <button onClick={() => setRef(new Date())} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink)' }}>Hoje</button>
          <button onClick={() => mover((visao === 'semana' || visao === 'lista') ? 7 : 1)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', cursor: 'pointer', fontSize: 14 }}>›</button>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink2)', textTransform: 'capitalize' }}>{tituloPeriodo}</span>
        {visao === 'dia' && feriadoDe(ref) && (
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#be185d', background: '#fdf2f8', border: '1px solid #f9d7e6', borderRadius: 999, padding: '3px 10px' }}>Feriado · {feriadoDe(ref)}</span>
        )}
        <span style={{ flex: 1 }} />
        <select value={profFiltro} onChange={e => setProfFiltro(e.target.value)}
          style={{ padding: '8px 11px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--v2-surface)', cursor: 'pointer' }}>
          <option value="">Todos os profissionais</option>
          {profissionais.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
        </select>
        {perfilClinica && (
          <button onClick={() => setEsperaAberta(v => !v)} style={{ padding: '9px 14px', background: esperaAberta ? 'var(--v2-ink)' : 'var(--v2-surface)', color: esperaAberta ? 'var(--v2-surface)' : 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            Lista de espera{espera.length > 0 ? ` (${espera.length})` : ''}
          </button>
        )}
        {podeEditar && (
          <button onClick={() => setBlocosModal(true)} style={{ padding: '9px 14px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            Bloqueios{bloqueios.length > 0 ? ` (${bloqueios.length})` : ''}
          </button>
        )}
        {podeEditar && (
          <button onClick={() => novo()} style={{ padding: '9px 16px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Agendamento</button>
        )}
      </div>

      {/* Painel da lista de espera */}
      {perfilClinica && esperaAberta && (
        <div style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: 'var(--v2-ink)' }}>Lista de espera</h3>
            <span style={{ fontSize: 11.5, color: 'var(--v2-ink3)' }}>ordem de chegada</span>
            <span style={{ flex: 1 }} />
            {podeEditar && !esperaForm && (
              <button onClick={() => setEsperaForm({ pacienteNome: '', pacienteTelefone: '', servico: '', observacoes: '' })} style={{ padding: '6px 12px', background: 'var(--v2-surface1)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', color: 'var(--v2-ink)' }}>+ Adicionar</button>
            )}
          </div>
          {esperaForm && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
              <input value={esperaForm.pacienteNome} onChange={e => setEsperaForm(f => f && { ...f, pacienteNome: e.target.value })} placeholder="Nome do paciente *" style={{ flex: 2, minWidth: 140, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit' }} />
              <input value={esperaForm.pacienteTelefone} onChange={e => setEsperaForm(f => f && { ...f, pacienteTelefone: e.target.value })} placeholder="Telefone" style={{ flex: 1, minWidth: 110, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit' }} />
              <input value={esperaForm.servico} onChange={e => setEsperaForm(f => f && { ...f, servico: e.target.value })} list="agenda-servicos" placeholder="Serviço" style={{ flex: 1, minWidth: 110, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit' }} />
              <input value={esperaForm.observacoes} onChange={e => setEsperaForm(f => f && { ...f, observacoes: e.target.value })} placeholder="Observações (preferência de horário...)" style={{ flex: 2, minWidth: 150, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit' }} />
              <button onClick={adicionarEspera} disabled={!esperaForm.pacienteNome.trim()} style={{ padding: '8px 14px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: esperaForm.pacienteNome.trim() ? 1 : 0.5 }}>Salvar</button>
              <button onClick={() => setEsperaForm(null)} style={{ padding: '8px 12px', background: 'var(--v2-surface2)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', color: 'var(--v2-ink2)' }}>Cancelar</button>
            </div>
          )}
          {espera.length === 0 && !esperaForm && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Ninguém aguardando horário.</p>}
          {espera.map((it, i) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: i > 0 ? '1px solid var(--v2-surface1)' : 'none' }}>
              <span style={{ width: 20, fontSize: 11, fontWeight: 800, color: 'var(--v2-ink3)', flexShrink: 0 }}>{i + 1}º</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--v2-ink)', flexShrink: 0 }}>{it.pacienteNome}</span>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--v2-ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[it.servico, it.pacienteTelefone, it.observacoes].filter(Boolean).join(' · ')}</span>
              <span style={{ fontSize: 11, color: 'var(--v2-ink3)', flexShrink: 0 }}>desde {new Date(it.criadoEm).toLocaleDateString('pt-BR')}</span>
              {podeEditar && (
                <>
                  <button onClick={() => agendarDaEspera(it)} style={{ padding: '5px 12px', background: 'var(--v2-amber-on)', border: 'none', borderRadius: 999, fontWeight: 800, fontSize: 11.5, cursor: 'pointer', color: '#17150E', flexShrink: 0 }}>Agendar</button>
                  <button onClick={() => removerEspera(it.id)} style={{ padding: '5px 10px', background: 'var(--v2-surface)', border: '1px solid var(--v2-hot-bg)', borderRadius: 999, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', color: 'var(--v2-hot)', flexShrink: 0 }}>Remover</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {carregando ? (
        <p style={{ color: 'var(--v2-ink3)', fontSize: 13, padding: 30, textAlign: 'center' }}>Carregando agenda...</p>
      ) : visao === 'mes' ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))', gap: 6, marginBottom: 6 }}>
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
              <span key={d} style={{ fontSize: 11, fontWeight: 800, color: 'var(--v2-ink3)', textAlign: 'center' }}>{d}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))', gap: 6, overflowX: 'auto' }}>
            {Array.from({ length: 42 }, (_, i) => {
              const dia = new Date(inicioMes); dia.setDate(dia.getDate() + i)
              const foraDoMes = dia.getMonth() !== ref.getMonth()
              const hoje = new Date().toDateString() === dia.toDateString()
              const feriado = feriadoDe(dia)
              const lista = doDia(dia).filter(a => a.status !== 'cancelado')
              return (
                <div key={i} onClick={() => { setRef(new Date(dia)); setVisao('dia') }}
                  style={{ minHeight: 84, background: hoje ? '#fffdf2' : feriado ? '#fdf2f8' : foraDoMes ? '#fcfcfc' : 'var(--v2-surface1)', border: `1px solid ${hoje ? '#f3e3ac' : feriado ? '#f9d7e6' : 'var(--v2-surface2)'}`, borderRadius: 10, padding: 7, cursor: 'pointer', opacity: foraDoMes ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: hoje ? '#a9781a' : 'var(--v2-ink)' }}>{dia.getDate()}</span>
                    {lista.length > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--v2-surface)', background: 'var(--v2-ink)', borderRadius: 999, padding: '1px 6px', marginLeft: 'auto' }}>{lista.length}</span>}
                  </div>
                  {feriado && <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: '#be185d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={feriado}>{feriado}</p>}
                  {lista.slice(0, 3).map(a => (
                    <p key={a.id} style={{ margin: '0 0 2px', fontSize: 10.5, color: 'var(--v2-ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {hora(a.dataInicio)} {a.pacienteNome.split(' ')[0]}
                    </p>
                  ))}
                  {lista.length > 3 && <p style={{ margin: 0, fontSize: 10, color: 'var(--v2-ink3)' }}>+{lista.length - 3}</p>}
                </div>
              )
            })}
          </div>
        </div>
      ) : visao === 'semana' ? (
        // Semana proporcional: eixo de horas único + 7 colunas-dia com a mesma grade do Dia
        <div style={{ display: 'flex', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 12, overflow: 'hidden', overflowX: 'auto' }}>
          <EixoHoras spacer />
          {Array.from({ length: 7 }, (_, i) => {
            const dia = new Date(semana); dia.setDate(dia.getDate() + i)
            const hoje = new Date().toDateString() === dia.toDateString()
            const feriado = feriadoDe(dia)
            const qtd = doDia(dia).length
            return (
              <div key={i} style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column' }}>
                <div onClick={() => { setRef(dia); setVisao('dia') }} title={feriado || undefined}
                  style={{ height: HEADER_H, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer', background: hoje ? '#fffdf2' : feriado ? '#fdf2f8' : 'var(--v2-surface1)', borderBottom: '1px solid var(--v2-rule)', borderLeft: '1px solid var(--v2-rule)' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: hoje ? '#a9781a' : feriado ? '#be185d' : 'var(--v2-ink3)' }}>{DIAS[dia.getDay()]}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--v2-ink)' }}>{dia.getDate()}</span>
                  {feriado ? <span style={{ fontSize: 11, color: '#be185d' }}>•</span> : qtd > 0 && <span style={{ fontSize: 10, color: 'var(--v2-ink3)' }}>· {qtd}</span>}
                </div>
                <LanesDia dia={dia} compact />
              </div>
            )
          })}
        </div>
      ) : visao === 'dia' ? (
        // Visão DIA proporcional: expediente inteiro com altura ∝ duração
        <div style={{ display: 'flex', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 12, overflow: 'hidden', maxWidth: 820 }}>
          <EixoHoras />
          <LanesDia dia={ref} />
        </div>
      ) : (
        // Visão LISTA: agendamentos da semana em ordem cronológica, agrupados por dia
        <div style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 12, overflow: 'hidden', maxWidth: 760 }}>
          {(() => {
            const dias = Array.from({ length: 7 }, (_, i) => { const d = new Date(semana); d.setDate(d.getDate() + i); return d })
              .map(d => ({ d, lista: doDia(d).sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime()), feriado: feriadoDe(d) }))
              .filter(x => x.lista.length > 0 || x.feriado)
            if (!dias.length) return <p style={{ margin: 0, padding: 30, textAlign: 'center', color: 'var(--v2-ink3)', fontSize: 13 }}>Nenhum agendamento nesta semana.</p>
            return dias.map(({ d, lista, feriado }) => {
              const hoje = new Date().toDateString() === d.toDateString()
              return (
                <div key={d.toISOString()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: hoje ? '#fffdf2' : 'var(--v2-surface1)', borderTop: '1px solid var(--v2-rule)', borderBottom: '1px solid var(--v2-surface1)', position: 'sticky', top: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: hoje ? '#a9781a' : 'var(--v2-ink)', textTransform: 'capitalize' }}>{d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                    {feriado && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#be185d', background: '#fdf2f8', borderRadius: 999, padding: '2px 8px' }}>{feriado}</span>}
                    <span style={{ flex: 1 }} />
                    {lista.length > 0 && <span style={{ fontSize: 11, color: 'var(--v2-ink3)' }}>{lista.length}</span>}
                  </div>
                  {lista.map(a => {
                    const st = stInfo(a.status), cor = corProf(a.profissionalEmail), cancelado = a.status === 'cancelado'
                    return (
                      <div key={a.id} onClick={() => setModal({ ...a, dataInicio: toLocalInput(new Date(a.dataInicio)) })}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: '1px solid var(--v2-surface1)', cursor: 'pointer', opacity: cancelado ? 0.55 : 1 }}>
                        <span style={{ width: 42, fontSize: 13, fontWeight: 800, color: 'var(--v2-ink)', flexShrink: 0 }}>{hora(a.dataInicio)}</span>
                        <span style={{ width: 3, alignSelf: 'stretch', background: cor, borderRadius: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v2-ink)', textDecoration: cancelado ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.pacienteNome}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--v2-ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[a.servico, `${a.duracaoMin}min`, !profFiltro && (a.profissionalNome || '').split(' ')[0]].filter(Boolean).join(' · ')}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: st.cor, background: st.bg, borderRadius: 999, padding: '3px 9px', flexShrink: 0 }}>{labelSt(st.key, st.label, perfilClinica)}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })
          })()}
        </div>
      )}

      {/* Modal criar/editar */}
      {modal && (
        <div onClick={() => { setModal(null); setEsperaOrigem(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16.5, color: 'var(--v2-ink)' }}>{modal.id ? 'Editar agendamento' : 'Novo agendamento'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input list={perfilClinica ? 'agenda-pacientes' : undefined} value={modal.pacienteNome || ''} onChange={e => perfilClinica ? aoDigitarPaciente(e.target.value) : setModal(m => ({ ...m, pacienteNome: e.target.value }))} placeholder="Nome do paciente/cliente *"
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13.5, fontFamily: 'inherit' }} />
              {perfilClinica && (
                <>
                  <datalist id="agenda-pacientes">{contatos.filter(c => !c.tipo || c.tipo === 'paciente' || c.tipo === 'lead').map(c => <option key={c.id} value={c.nome} />)}</datalist>
                  {(modal.pacienteNome || '').trim() && (
                    modal.contatoId
                      ? <p style={{ margin: '-4px 0 0', fontSize: 11, color: 'var(--v2-ok)' }}>Paciente do cadastro — o atendimento entra no histórico dele.</p>
                      : <p style={{ margin: '-4px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>Paciente novo — será cadastrado automaticamente ao salvar.</p>
                  )}
                </>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={modal.pacienteTelefone || ''} onChange={e => setModal(m => ({ ...m, pacienteTelefone: e.target.value }))} placeholder="Telefone/WhatsApp"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit' }} />
                {perfilClinica ? (
                  <select value={modal.servico || ''} onChange={e => setModal(m => ({ ...m, servico: e.target.value }))}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                    <option value="">Tipo de atendimento...</option>
                    {servicosClinica.map(s => <option key={s} value={s}>{s}</option>)}
                    {modal.servico && !servicosClinica.includes(modal.servico) && <option value={modal.servico}>{modal.servico}</option>}
                  </select>
                ) : (
                  <input list="agenda-servicos" value={modal.servico || ''} onChange={e => setModal(m => ({ ...m, servico: e.target.value }))} placeholder="Serviço"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit' }} />
                )}
                <datalist id="agenda-servicos">{servicos.map(s => <option key={s} value={s} />)}</datalist>
              </div>
              <select value={modal.profissionalEmail || ''} onChange={e => setModal(m => ({ ...m, profissionalEmail: e.target.value }))}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                {profissionais.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="datetime-local" value={(modal.dataInicio as string) || ''} onChange={e => setModal(m => ({ ...m, dataInicio: e.target.value }))}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit' }} />
                <select value={modal.duracaoMin || 30} onChange={e => setModal(m => ({ ...m, duracaoMin: Number(e.target.value) }))}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                  {(perfilClinica ? [30, 45, 60, 90, 120, 150, 180, 210, 240] : [15, 30, 45, 60, 90, 120]).map(d => (
                    <option key={d} value={d}>{d < 60 ? `${d} min` : `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}min` : ''}`}</option>
                  ))}
                </select>
              </div>
              {(modal.id || perfilClinica) && (
                <div>
                  {perfilClinica && !modal.id && <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }}>Situação (confirmado = pagamento recebido)</label>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(modal.id ? STATUS : STATUS.filter(s => s.key === 'agendado' || s.key === 'confirmado')).map(s => (
                      <button key={s.key} onClick={() => setModal(m => ({ ...m, status: s.key }))}
                        style={{ padding: '6px 12px', borderRadius: 999, border: modal.status === s.key ? `1.5px solid ${s.cor}` : '1px solid var(--v2-surface2)', background: modal.status === s.key ? s.bg : 'var(--v2-surface)', color: modal.status === s.key ? s.cor : 'var(--v2-ink3)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                        {labelSt(s.key, s.label, perfilClinica)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {perfilClinica && (
                <input value={modal.queixaPrincipal || ''} onChange={e => setModal(m => ({ ...m, queixaPrincipal: e.target.value }))} placeholder="Queixa principal (motivo da consulta)"
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit' }} />
              )}
              <textarea lang="pt-BR" value={modal.observacoes || ''} onChange={e => setModal(m => ({ ...m, observacoes: e.target.value }))} placeholder="Observações" rows={2}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
              {perfilClinica && modal.id && (modal.status === 'atendido' || !!modal.registroAtendimento) && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }}>Registro do atendimento (evolução)</label>
                  <textarea lang="pt-BR" value={modal.registroAtendimento || ''} onChange={e => setModal(m => ({ ...m, registroAtendimento: e.target.value }))} placeholder="O que foi feito, orientações, próximos passos..." rows={4}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
                  {/* Pós-atendimento estruturado: procedimentos realizados (do catálogo) + investimento */}
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', margin: '10px 0 5px' }}>Procedimentos realizados</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Array.from(new Set([...servicosClinica, ...(modal.procedimentosRealizados || [])])).map(p => {
                      const marcado = (modal.procedimentosRealizados || []).includes(p)
                      return (
                        <button key={p} type="button" onClick={() => setModal(m => ({ ...m, procedimentosRealizados: marcado ? (m?.procedimentosRealizados || []).filter(x => x !== p) : [...(m?.procedimentosRealizados || []), p] }))}
                          style={{ padding: '5px 12px', borderRadius: 999, border: marcado ? '1.5px solid var(--v2-ok)' : '1px solid var(--v2-surface2)', background: marcado ? 'var(--v2-ok-bg)' : 'var(--v2-surface)', color: marcado ? 'var(--v2-ok)' : 'var(--v2-ink3)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                          {p}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', flexShrink: 0 }}>Investimento (R$)</label>
                    <input type="number" min={0} step="0.01" value={modal.valorInvestido ?? ''} onChange={e => setModal(m => ({ ...m, valorInvestido: e.target.value === '' ? undefined : Number(e.target.value) }))} placeholder="0,00"
                      style={{ width: 140, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit' }} />
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--v2-ink3)' }}>Fica no histórico do paciente. Dado sensível — visível só para a equipe.</p>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
              {modal.id && podeEditar && (
                <button onClick={excluir} style={{ padding: '9px 14px', background: 'var(--v2-surface)', border: '1px solid var(--v2-hot-bg)', borderRadius: 9, color: 'var(--v2-hot)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginRight: 'auto' }}>Excluir</button>
              )}
              <span style={{ flex: modal.id ? undefined : 1 }} />
              <button onClick={() => { setModal(null); setEsperaOrigem(null) }} style={{ padding: '10px 16px', background: 'var(--v2-surface2)', border: 'none', borderRadius: 9, color: 'var(--v2-ink2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              {podeEditar && (
                <button onClick={() => salvar()} disabled={salvando || !(modal.pacienteNome || '').trim()} style={{ padding: '10px 18px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: salvando ? 'wait' : 'pointer', opacity: !(modal.pacienteNome || '').trim() ? 0.5 : 1 }}>
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de bloqueios/compromissos da profissional */}
      {blocosModal && (
        <div onClick={() => { setBlocosModal(false); setBlocoForm(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 16.5, color: 'var(--v2-ink)' }}>Bloqueios da agenda</h3>
              <span style={{ flex: 1 }} />
              {podeEditar && !blocoForm && (
                <button onClick={novoBloco} style={{ padding: '7px 13px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>+ Novo bloqueio</button>
              )}
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--v2-ink3)' }}>Horários em que o profissional não atende (almoço, folga, reunião). A agenda avisa e recusa marcar por cima.</p>

            {/* Formulário */}
            {blocoForm && (
              <div style={{ background: 'var(--v2-surface1)', border: '1px solid var(--v2-rule)', borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <select value={blocoForm.profissionalEmail} onChange={e => setBlocoForm(f => f && { ...f, profissionalEmail: e.target.value })}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                  {profissionais.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
                </select>
                <input value={blocoForm.titulo} onChange={e => setBlocoForm(f => f && { ...f, titulo: e.target.value })} placeholder="Título (ex.: Almoço, Folga, Reunião)"
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit' }} />
                <div style={{ display: 'inline-flex', gap: 2, background: 'var(--v2-surface2)', borderRadius: 9, padding: 3, alignSelf: 'flex-start' }}>
                  {([['recorrente', 'Recorrente'], ['pontual', 'Pontual']] as const).map(([k, label]) => {
                    const ativo = (k === 'recorrente') === blocoForm.recorrente
                    return (
                      <button key={k} onClick={() => setBlocoForm(f => f && { ...f, recorrente: k === 'recorrente' })}
                        style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: ativo ? 'var(--v2-surface)' : 'transparent', fontWeight: ativo ? 700 : 500, fontSize: 12.5, cursor: 'pointer', color: 'var(--v2-ink)', boxShadow: ativo ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>{label}</button>
                    )
                  })}
                </div>
                {blocoForm.recorrente ? (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Dias da semana</label>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {DIAS_ORDEM.map(d => {
                          const on = blocoForm.diasSemana.includes(d)
                          return (
                            <button key={d} onClick={() => setBlocoForm(f => f && { ...f, diasSemana: on ? f.diasSemana.filter(x => x !== d) : [...f.diasSemana, d] })}
                              style={{ width: 40, padding: '7px 0', borderRadius: 8, border: on ? '1.5px solid var(--v2-ink)' : '1px solid var(--v2-surface2)', background: on ? 'var(--v2-ink)' : 'var(--v2-surface)', color: on ? 'var(--v2-surface)' : 'var(--v2-ink3)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{DIAS[d]}</button>
                          )
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }}>Das</label>
                        <input type="time" value={blocoForm.horaInicio} onChange={e => setBlocoForm(f => f && { ...f, horaInicio: e.target.value })} style={{ padding: '9px 11px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }}>Às</label>
                        <input type="time" value={blocoForm.horaFim} onChange={e => setBlocoForm(f => f && { ...f, horaFim: e.target.value })} style={{ padding: '9px 11px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }}>Até (opcional)</label>
                        <input type="date" value={blocoForm.ate} onChange={e => setBlocoForm(f => f && { ...f, ate: e.target.value })} style={{ padding: '9px 11px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit' }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="datetime-local" value={blocoForm.dataInicio} onChange={e => setBlocoForm(f => f && { ...f, dataInicio: e.target.value })} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit' }} />
                    <select value={blocoForm.duracaoMin} onChange={e => setBlocoForm(f => f && { ...f, duracaoMin: Number(e.target.value) })}
                      style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                      {[30, 60, 90, 120, 180, 240, 480].map(d => <option key={d} value={d}>{d < 60 ? `${d} min` : `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}min` : ''}`}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setBlocoForm(null)} style={{ padding: '9px 14px', background: 'var(--v2-surface2)', border: 'none', borderRadius: 9, color: 'var(--v2-ink2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={salvarBloco} disabled={salvandoBloco} style={{ padding: '9px 16px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: salvandoBloco ? 'wait' : 'pointer' }}>{salvandoBloco ? 'Salvando…' : 'Salvar bloqueio'}</button>
                </div>
              </div>
            )}

            {/* Lista de bloqueios */}
            {bloqueios.length === 0 && !blocoForm && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Nenhum bloqueio cadastrado.</p>}
            {[...bloqueios].sort((a, b) => (a.profissionalNome || '').localeCompare(b.profissionalNome || '')).map((b, i) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i > 0 ? '1px solid var(--v2-surface1)' : 'none' }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: b.recorrente ? '#7c3aed' : '#0891b2', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.titulo || (b.recorrente ? 'Bloqueio recorrente' : 'Bloqueio')}
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--v2-ink3)' }}> · {(b.profissionalNome || '').split(' ')[0]}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--v2-ink3)' }}>{descBloco(b)}</div>
                </div>
                {podeEditar && (
                  <button onClick={() => removerBloco(b.id)} style={{ padding: '5px 11px', background: 'var(--v2-surface)', border: '1px solid var(--v2-hot-bg)', borderRadius: 999, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', color: 'var(--v2-hot)', flexShrink: 0 }}>Remover</button>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => { setBlocosModal(false); setBlocoForm(null) }} style={{ padding: '10px 18px', background: 'var(--v2-surface2)', border: 'none', borderRadius: 9, color: 'var(--v2-ink2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

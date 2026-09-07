// CARD DO COLABORADOR — "cada um como card, com atribuições, responsabilidades e
// tarefas, igual ao perfil de cada cliente" (pedido do dono, 07/09/2026).
// Substitui o "Meu dia". Esta lib só RESUME o que está assinalado para a
// pessoa: tarefas por urgência, o que fechou e apontou nos últimos 7 dias, e
// os clientes em que ela atua. Puro, sem rede; a tela e o card do admin leem daqui.

export type TarefaPessoa = {
  id: string
  titulo: string
  status: string
  prioridade?: string
  prazo?: string
  clienteId?: string
  clienteNome?: string
  responsavelEmail?: string
  concluidoEm?: string
  atualizadoEm?: string
  apontamentos?: { usuarioEmail?: string; minutos?: number; data?: string }[]
}

export type ResumoPessoa = {
  abertas: number
  atrasadas: TarefaPessoa[]
  hoje: TarefaPessoa[]
  semana: TarefaPessoa[] // prazo nos próximos 7 dias (depois de hoje)
  depois: TarefaPessoa[]
  semPrazo: TarefaPessoa[]
  concluidas7d: TarefaPessoa[]
  minutos7d: number
  porCliente: { clienteId: string; clienteNome: string; abertas: number }[]
  clientes: string[] // ids: responsabilidade explícita + onde tem tarefa aberta
}

const DIA = 86400000
const ABERTA = ['a_fazer', 'em_andamento', 'em_revisao']
const PESO: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 }

function diaLocal(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const msDe = (iso?: string) => { const n = iso ? new Date(iso).getTime() : NaN; return Number.isFinite(n) ? n : undefined }

export function ordenarPorUrgencia(a: TarefaPessoa, b: TarefaPessoa): number {
  const pa = msDe(a.prazo) ?? Infinity, pb = msDe(b.prazo) ?? Infinity
  if (pa !== pb) return pa - pb
  return (PESO[a.prioridade || ''] ?? 2) - (PESO[b.prioridade || ''] ?? 2)
}

export function resumoDaPessoa(input: {
  email: string
  tarefas?: TarefaPessoa[]
  clientesResponsavel?: string[]
  agora?: number
}): ResumoPessoa {
  const agora = input.agora ?? Date.now()
  const email = input.email.toLowerCase()
  const todas = (input.tarefas || []).filter(t => (t.responsavelEmail || '').toLowerCase() === email)
  const abertas = todas.filter(t => ABERTA.includes(t.status)).sort(ordenarPorUrgencia)
  const hojeStr = diaLocal(agora)
  const fimSemana = diaLocal(agora + 7 * DIA)

  const atrasadas: TarefaPessoa[] = [], hoje: TarefaPessoa[] = [], semana: TarefaPessoa[] = [], depois: TarefaPessoa[] = [], semPrazo: TarefaPessoa[] = []
  for (const t of abertas) {
    const p = msDe(t.prazo)
    if (p === undefined) { semPrazo.push(t); continue }
    const d = diaLocal(p)
    if (d < hojeStr) atrasadas.push(t)
    else if (d === hojeStr) hoje.push(t)
    else if (d <= fimSemana) semana.push(t)
    else depois.push(t)
  }

  const desde = agora - 7 * DIA
  const concluidas7d = todas
    .filter(t => t.status === 'concluido' && (msDe(t.concluidoEm || t.atualizadoEm) ?? 0) >= desde)
    .sort((a, b) => (msDe(b.concluidoEm || b.atualizadoEm) ?? 0) - (msDe(a.concluidoEm || a.atualizadoEm) ?? 0))

  // Horas apontadas: contam em QUALQUER tarefa (a pessoa pode apontar em tarefa de outro).
  let minutos7d = 0
  for (const t of input.tarefas || []) for (const a of t.apontamentos || []) {
    if ((a.usuarioEmail || '').toLowerCase() !== email) continue
    const d = msDe(a.data)
    if (d !== undefined && d >= desde) minutos7d += Number(a.minutos) || 0
  }

  const mapa = new Map<string, { clienteId: string; clienteNome: string; abertas: number }>()
  for (const t of abertas) {
    const id = t.clienteId || ''
    const atual = mapa.get(id) || { clienteId: id, clienteNome: t.clienteNome || (id ? 'Cliente' : 'Interno'), abertas: 0 }
    atual.abertas += 1
    mapa.set(id, atual)
  }
  const porCliente = Array.from(mapa.values()).sort((a, b) => b.abertas - a.abertas)

  const clientes = new Set<string>(input.clientesResponsavel || [])
  for (const c of porCliente) if (c.clienteId) clientes.add(c.clienteId)

  return { abertas: abertas.length, atrasadas, hoje, semana, depois, semPrazo, concluidas7d, minutos7d, porCliente, clientes: Array.from(clientes) }
}

export function fmtMinutos(min: number): string {
  return `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`
}

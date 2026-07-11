// Regras puras do módulo Agenda (client-safe, testável).
// Conflito de horário: dois agendamentos do MESMO profissional se sobrepõem
// quando os intervalos [início, início+duração) se cruzam. Cancelado/faltou
// não ocupam a agenda.

type Compromisso = {
  id?: string
  profissionalEmail: string
  dataInicio: string
  duracaoMin: number
  status?: string
}

const OCUPA = ['agendado', 'confirmado', 'atendido']

export function ocupaAgenda(status?: string): boolean {
  return OCUPA.includes(status || 'agendado')
}

// Sobreposição de intervalos meio-abertos: fim às 10h e início às 10h NÃO conflitam.
export function sobrepoe(a: Compromisso, b: Compromisso): boolean {
  const ia = new Date(a.dataInicio).getTime()
  const ib = new Date(b.dataInicio).getTime()
  if (isNaN(ia) || isNaN(ib)) return false
  const fa = ia + Math.max(1, a.duracaoMin || 30) * 60000
  const fb = ib + Math.max(1, b.duracaoMin || 30) * 60000
  return ia < fb && ib < fa
}

// Acha o conflito de `novo` contra a lista (mesmo profissional, que ocupa agenda,
// ignorando ele mesmo em edições). Devolve o primeiro conflitante ou null.
export function acharConflito<T extends Compromisso>(novo: Compromisso, existentes: T[]): T | null {
  for (const e of existentes) {
    if (e.id && novo.id && e.id === novo.id) continue
    if (e.profissionalEmail !== novo.profissionalEmail) continue
    if (!ocupaAgenda(e.status)) continue
    if (sobrepoe(novo, e)) return e
  }
  return null
}

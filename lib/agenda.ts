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

// Vínculo agenda↔paciente (perfil clínica): casa o nome digitado com um contato
// existente. Comparação por nome normalizado (trim/caixa/acentos) — evita criar
// "Maria" e "maria " como pacientes diferentes.
export function normalizaNome(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function acharContatoPorNome<T extends { nome: string }>(contatos: T[], nome: string): T | null {
  const alvo = normalizaNome(nome)
  if (!alvo) return null
  return contatos.find(c => normalizaNome(c.nome) === alvo) || null
}

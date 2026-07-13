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

// ---------------------------------------------------------------------------
// Bloqueios/compromissos da profissional: faixas em que ela NÃO atende (almoço,
// folga, reunião externa). Ocupam a agenda como um agendamento — o servidor
// recusa marcar por cima (com opção de encaixe consciente). Podem ser:
//  - pontual: um instante (`dataInicio` ISO) + `duracaoMin`.
//  - recorrente: dias da semana (`diasSemana` 0=dom…6=sáb) + faixa de relógio de
//    parede (`horaInicio`/`horaFim` "HH:MM"), com data-limite opcional (`ate`).
// Chaves Redis: `bloqueio:{id}`, set `bloqueios`.
export type Bloqueio = {
  id: string
  profissionalEmail: string
  profissionalNome?: string
  titulo?: string
  recorrente: boolean
  dataInicio?: string   // pontual — ISO
  duracaoMin?: number   // pontual
  diasSemana?: number[] // recorrente — 0=dom … 6=sáb
  horaInicio?: string   // recorrente — "HH:MM" (relógio de parede)
  horaFim?: string      // recorrente — "HH:MM"
  ate?: string          // recorrente — "YYYY-MM-DD" última data válida (opcional)
  criadoEm: string
  criadoPor?: string
}

// Fuso das instâncias (clínicas brasileiras). O Brasil não tem horário de verão
// desde 2019, então UTC-3 é constante. Usado SÓ para resolver bloqueios
// recorrentes no servidor, que roda em UTC — "toda segunda às 12h" é relógio de
// parede local e precisa do fuso. (Se um dia houver instância fora do BR, virar
// config por instância.)
export const OFFSET_CLINICA_MIN = -180

// "HH:MM" -> minutos desde a meia-noite (0..1440), tolerante a lixo.
export function horaParaMin(hhmm?: string): number {
  const [h, m] = (hhmm || '0:0').split(':').map(n => parseInt(n, 10) || 0)
  return Math.min(1440, Math.max(0, h * 60 + m))
}

// Componentes de relógio de parede (no fuso da clínica) de um instante ISO:
// dia da semana, minutos desde a meia-noite e a data local (YYYY-MM-DD).
export function componentesLocais(iso: string): { dow: number; min: number; ymd: string } | null {
  const t = new Date(iso).getTime()
  if (isNaN(t)) return null
  const d = new Date(t + OFFSET_CLINICA_MIN * 60000) // desloca p/ ler UTC como se fosse local
  const p = (n: number) => String(n).padStart(2, '0')
  return {
    dow: d.getUTCDay(),
    min: d.getUTCHours() * 60 + d.getUTCMinutes(),
    ymd: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
  }
}

// Um bloqueio recorrente incide num dia local (dow + data)?
function recorrenteValidoNoDia(b: Bloqueio, dow: number, ymd: string): boolean {
  if (b.diasSemana && b.diasSemana.length && !b.diasSemana.includes(dow)) return false
  if (b.ate && ymd > b.ate) return false // 'YYYY-MM-DD' compara lexicograficamente
  return true
}

// Acha o 1º bloqueio do MESMO profissional que colide com o novo agendamento.
// Pontual: sobreposição absoluta (fuso-independente). Recorrente: compara a faixa
// de relógio de parede local, resolvida no fuso da clínica.
export function acharBloqueioConflitante(
  novo: { profissionalEmail: string; dataInicio: string; duracaoMin: number },
  bloqueios: Bloqueio[],
): Bloqueio | null {
  const t = new Date(novo.dataInicio).getTime()
  if (isNaN(t)) return null
  const dur = Math.max(1, novo.duracaoMin || 30)
  const fim = t + dur * 60000
  const loc = componentesLocais(novo.dataInicio)
  for (const b of bloqueios) {
    if (b.profissionalEmail !== novo.profissionalEmail) continue
    if (b.recorrente) {
      if (!loc || !recorrenteValidoNoDia(b, loc.dow, loc.ymd)) continue
      const iniMin = loc.min, fimMin = loc.min + dur
      const bIni = horaParaMin(b.horaInicio || '00:00'), bFim = horaParaMin(b.horaFim || '23:59')
      if (iniMin < bFim && bIni < fimMin) return b
    } else {
      if (!b.dataInicio) continue
      const bt = new Date(b.dataInicio).getTime()
      if (isNaN(bt)) continue
      const bfim = bt + Math.max(1, b.duracaoMin || 30) * 60000
      if (t < bfim && bt < fim) return b
    }
  }
  return null
}

// Expande um bloqueio no intervalo absoluto [inicio, fim) que ele ocupa num DIA
// LOCAL (Date à meia-noite local do browser) — para desenhar na grade. null se
// não incide nesse dia.
export function bloqueioNoDia(b: Bloqueio, dia: Date): { inicio: number; fim: number } | null {
  if (b.recorrente) {
    if (b.diasSemana && b.diasSemana.length && !b.diasSemana.includes(dia.getDay())) return null
    if (b.ate) {
      const p = (n: number) => String(n).padStart(2, '0')
      const ymd = `${dia.getFullYear()}-${p(dia.getMonth() + 1)}-${p(dia.getDate())}`
      if (ymd > b.ate) return null
    }
    const ini = new Date(dia); ini.setHours(0, 0, 0, 0); ini.setMinutes(horaParaMin(b.horaInicio || '00:00'))
    const fim = new Date(dia); fim.setHours(0, 0, 0, 0); fim.setMinutes(horaParaMin(b.horaFim || '23:59'))
    if (fim.getTime() <= ini.getTime()) return null
    return { inicio: ini.getTime(), fim: fim.getTime() }
  }
  if (!b.dataInicio) return null
  const t = new Date(b.dataInicio)
  if (isNaN(t.getTime()) || t.toDateString() !== dia.toDateString()) return null
  const inicio = t.getTime()
  return { inicio, fim: inicio + Math.max(5, b.duracaoMin || 30) * 60000 }
}

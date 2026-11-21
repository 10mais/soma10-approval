// CALENDÁRIO DE POSTS — as contas do mês, usadas pelo Calendário do Programador e pelo
// seletor de data do agendamento (Mudança 1, dono 21/11/2026: "ao abrir o calendário para
// agendar, o usuário enxerga todas as postagens já programadas em cada dia e escolhe a data
// com contexto"). Nada aqui bloqueia: mesmo dia e mesmo horário são permitidos, a tela só
// informa.
//
// Datas no fuso de quem usa a tela (o mesmo do <input type="datetime-local"> que o composer
// já usa: o valor local vira ISO com new Date(local).toISOString() em quem salva).

export type PostCal = { id: string; dataAgendada?: string; formato?: string; status?: string; legenda?: string }

const pad = (n: number) => String(n).padStart(2, '0')

/** Grade do mês começando no domingo: null = casa vazia antes do dia 1 / depois do último. */
export function gradeDoMes(ano: number, mes: number): (number | null)[] {
  const inicio = new Date(ano, mes, 1).getDay()
  const dias = new Date(ano, mes + 1, 0).getDate()
  const out: (number | null)[] = []
  for (let i = 0; i < inicio; i++) out.push(null)
  for (let d = 1; d <= dias; d++) out.push(d)
  while (out.length % 7 !== 0) out.push(null)
  return out
}

/** "HH:mm" do instante, no fuso local. Inválido = ''. */
export function horaDe(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Posts do mês, por dia, em ordem de horário. Post sem data fica de fora. */
export function postsPorDia<T extends PostCal>(posts: T[], ano: number, mes: number): Map<number, T[]> {
  const mapa = new Map<number, T[]>()
  for (const p of posts) {
    if (!p.dataAgendada) continue
    const d = new Date(p.dataAgendada)
    if (isNaN(d.getTime()) || d.getFullYear() !== ano || d.getMonth() !== mes) continue
    const lista = mapa.get(d.getDate()) || []
    lista.push(p)
    mapa.set(d.getDate(), lista)
  }
  for (const lista of Array.from(mapa.values())) lista.sort((a, b) => new Date(a.dataAgendada!).getTime() - new Date(b.dataAgendada!).getTime())
  return mapa
}

export type HorarioUsado = { hora: string; total: number; formatos: string[] }

/** Horários já usados num dia: "10:00 · 2 posts (reel, feed)". */
export function horariosDoDia(postsDoDia: PostCal[]): HorarioUsado[] {
  const mapa = new Map<string, HorarioUsado>()
  for (const p of postsDoDia) {
    const h = horaDe(p.dataAgendada)
    if (!h) continue
    const item = mapa.get(h) || { hora: h, total: 0, formatos: [] }
    item.total++
    if (p.formato && !item.formatos.includes(p.formato)) item.formatos.push(p.formato)
    mapa.set(h, item)
  }
  return Array.from(mapa.values()).sort((a, b) => a.hora.localeCompare(b.hora))
}

export const HORARIOS_PADRAO = ['09:00', '12:00', '18:00']

/**
 * Atalhos de horário: os mais usados por este cliente (o costume da conta), completados com
 * o padrão, sem repetir, em ordem do dia.
 */
export function horariosSugeridos(posts: PostCal[], limite = 4): string[] {
  const contagem = new Map<string, number>()
  for (const p of posts) { const h = horaDe(p.dataAgendada); if (h) contagem.set(h, (contagem.get(h) || 0) + 1) }
  const usados = Array.from(contagem.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([h]) => h)
  const out: string[] = []
  for (const h of [...usados, ...HORARIOS_PADRAO]) { if (!out.includes(h)) out.push(h); if (out.length >= limite) break }
  return out.sort()
}

/** Quantos posts já estão exatamente neste horário (para o aviso, nunca para bloquear). */
export const postsNoHorario = (postsDoDia: PostCal[], hora: string): number => postsDoDia.filter(p => horaDe(p.dataAgendada) === hora).length

/** Valor do <input type="datetime-local">: "2026-11-18T10:00". */
export const valorLocal = (ano: number, mes: number, dia: number, hora: string): string => `${ano}-${pad(mes + 1)}-${pad(dia)}T${/^\d{2}:\d{2}$/.test(hora) ? hora : '09:00'}`

/** Lê o valor do datetime-local de volta: ano, mês (0-11), dia e hora. Inválido = null. */
export function lerValorLocal(v?: string): { ano: number; mes: number; dia: number; hora: string } | null {
  const m = (v || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/)
  if (!m) return null
  return { ano: Number(m[1]), mes: Number(m[2]) - 1, dia: Number(m[3]), hora: m[4] }
}

/** O dia já acabou? (hoje ainda vale; o horário passado de hoje o próprio campo recusa) */
export function diaPassado(ano: number, mes: number, dia: number, agora: Date = new Date()): boolean {
  return new Date(ano, mes, dia) < new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
}

/** O instante escolhido já passou? (hoje, mas num horário que já foi) */
export function instantePassado(valor: string, agora: Date = new Date()): boolean {
  const l = lerValorLocal(valor)
  if (!l) return false
  const [h, mi] = l.hora.split(':').map(Number)
  return new Date(l.ano, l.mes, l.dia, h, mi) < agora
}

export const STATUS_ROTULO: Record<string, string> = {
  rascunho: 'Rascunho', agendado: 'Agendado', aguardando_aprovacao: 'Aguardando aprovação', aprovado: 'Aprovado',
  corrigir: 'Em ajuste', reprovado: 'Reprovado', publicando: 'Publicando', publicado: 'Publicado', falha_publicacao: 'Falha ao publicar',
}

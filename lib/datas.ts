// Matemática de data em YYYY-MM-DD. Puro, client-safe, testável.
//
// Casa canônica: `somarDias` nasceu em pacoteViagem e `diasEntre` em frotaAlertas.
// Com o calendário precisando dos dois, virariam três cópias — e três cópias é
// como um off-by-one de fuso sobrevive num lugar depois de corrigido nos outros.
//
// TUDO em meia-noite LOCAL ('T00:00'). Usar UTC aqui erraria o dia no Brasil
// inteiro (fuso negativo): '2026-07-27' viraria 26/07 às 21h.

export const ehData = (s?: string | null): boolean => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

export const paraDate = (ymd: string): Date => new Date(ymd + 'T00:00')

export function paraYmd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function somarDias(ymd: string, dias: number): string {
  const d = paraDate(ymd)
  d.setDate(d.getDate() + dias)
  return paraYmd(d)
}

// Dias de `de` até `ate` (negativo = ate é antes). Mesmo dia = 0.
export function diasEntre(de: string, ate: string): number {
  return Math.round((paraDate(ate).getTime() - paraDate(de).getTime()) / 86400000)
}

export const hojeYmd = (): string => paraYmd(new Date())

// N dias ÚTEIS antes (segunda a sexta; feriado não entra). Sexta − 1 útil = quinta; segunda − 1 = sexta.
export function subtrairDiasUteis(ymd: string, n: number): string {
  let d = ymd
  let faltam = Math.max(0, Math.floor(n))
  while (faltam > 0) {
    d = somarDias(d, -1)
    const semana = paraDate(d).getDay()
    if (semana !== 0 && semana !== 6) faltam--
  }
  return d
}

// pt-BR: '2026-07-27' → '27/07/2026'
export const fmtDataBR = (ymd?: string): string => (ehData(ymd) ? ymd!.split('-').reverse().join('/') : '')

// '27/07' — para o calendário, onde o ano é redundante.
export const fmtDiaMes = (ymd?: string): string => (ehData(ymd) ? ymd!.slice(5).split('-').reverse().join('/') : '')

// ---------------------------------------------------------------------------
// PRAZO e INÍCIO de tarefa: o dia escolhido é guardado como INSTANTE (ISO), no horário de
// Brasília. Dono, 20/10/2026: "Quando criamos tarefa e colocamos DATA, ele automaticamente
// adiciona mais um dia." O prazo era gravado como 23:59 do dia no fuso do navegador, que em UTC
// já é o dia SEGUINTE; a edição lia o dia pelo texto UTC (split('T')) e cada salvamento empurrava
// o prazo mais um dia. No servidor (UTC) os avisos "Prazo: dd/mm" saíam com +1 pelo mesmo motivo.
//
// Regra: quem GRAVA usa fimDoDiaBR (prazo) / inicioDoDiaBR (início); quem precisa do DIA usa
// diaDoInstante — nunca split/slice no texto do ISO. O prazo fica no FIM do dia para "atrasada"
// (comparação de instantes, espalhada pelo sistema) só valer depois que o dia acaba.
// Brasília está fixo em -03:00 desde 2019 (sem horário de verão).
const FUSO_BR = 'America/Sao_Paulo'
const OFFSET_BR = '-03:00'
const formatoDiaBR = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_BR, year: 'numeric', month: '2-digit', day: '2-digit' })

/** O dia (YYYY-MM-DD, em Brasília) de um prazo/início gravado. Aceita também o dia puro. */
export function diaDoInstante(valor?: string | null): string {
  if (!valor) return ''
  if (ehData(valor)) return valor
  const d = new Date(valor)
  if (isNaN(d.getTime())) return ''
  const p: Record<string, string> = {}
  for (const parte of formatoDiaBR.formatToParts(d)) p[parte.type] = parte.value
  return `${p.year}-${p.month}-${p.day}`
}

/** Prazo do dia: 23:59:59 em Brasília. */
export const fimDoDiaBR = (ymd: string): string => (ehData(ymd) ? new Date(`${ymd}T23:59:59.000${OFFSET_BR}`).toISOString() : '')

/** O prazo gravado é "de dia" (fim do dia em Brasília, como o modal e o Estúdio gravam)? */
export const ehFimDoDiaBR = (valor?: string | null): boolean => {
  const dia = diaDoInstante(valor)
  if (!dia || ehData(valor || '')) return !!dia
  const d = new Date(valor!)
  return !isNaN(d.getTime()) && d.toISOString() === fimDoDiaBR(dia)
}

/** Início do dia: 00:00 em Brasília. */
export const inicioDoDiaBR = (ymd: string): string => (ehData(ymd) ? new Date(`${ymd}T00:00:00.000${OFFSET_BR}`).toISOString() : '')

/** '27/07/2026' (ou '27/07' sem o ano) de um prazo/início gravado — igual no navegador e no servidor. */
export const fmtDiaDoInstante = (valor?: string | null, comAno = true): string => {
  const ymd = diaDoInstante(valor)
  return comAno ? fmtDataBR(ymd) : fmtDiaMes(ymd)
}

const formatoHoraBR = new Intl.DateTimeFormat('en-GB', { timeZone: FUSO_BR, hour: '2-digit', hourCycle: 'h23' })
/** Hora (0-23) em Brasília de um instante — o servidor roda em UTC. */
export const horaBR = (ms: number): number => Number(formatoHoraBR.format(new Date(ms)))

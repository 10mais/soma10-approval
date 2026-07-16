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

// pt-BR: '2026-07-27' → '27/07/2026'
export const fmtDataBR = (ymd?: string): string => (ehData(ymd) ? ymd!.split('-').reverse().join('/') : '')

// '27/07' — para o calendário, onde o ano é redundante.
export const fmtDiaMes = (ymd?: string): string => (ehData(ymd) ? ymd!.slice(5).split('-').reverse().join('/') : '')

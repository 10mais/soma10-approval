// RITUAL DA SEMANA — cada dia útil tem uma ÁREA fixa da empresa.
//
// Segunda é Comercial, terça é Posicionamento, e assim por diante. Não é
// enfeite de calendário: é o que faz a reunião diária ter foco em vez de virar
// "vamos falar de tudo um pouco". A reunião de segunda pode ter dez pautas —
// todas comerciais.
//
// O ritual é CONFIGURÁVEL (config:reunioesRitual). O que está aqui é semente:
// nenhuma empresa herda a divisão de área de outra.

export type DiaRitual = { dia: number; area: string; hora?: string } // dia: 1 = segunda … 7 = domingo

export const NOMES_DIA = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
export const NOMES_DIA_CURTO = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export const RITUAL_PADRAO: DiaRitual[] = [
  { dia: 1, area: 'Comercial', hora: '09:00' },
  { dia: 2, area: 'Posicionamento', hora: '09:00' },
  { dia: 3, area: 'Operação', hora: '09:00' },
  { dia: 4, area: 'Marketing', hora: '09:00' },
  { dia: 5, area: 'Resultados', hora: '09:00' },
]

// Aceita o que veio do banco sem confiar: ritual torto não pode derrubar a tela
// nem inventar um dia 9.
export function normalizaRitual(bruto: any): DiaRitual[] {
  const lista = Array.isArray(bruto?.dias) ? bruto.dias : Array.isArray(bruto) ? bruto : null
  if (!lista) return RITUAL_PADRAO
  const vistos = new Set<number>()
  const saida: DiaRitual[] = []
  for (const d of lista) {
    const dia = Number(d?.dia)
    if (!Number.isInteger(dia) || dia < 1 || dia > 7 || vistos.has(dia)) continue
    const area = String(d?.area || '').trim().slice(0, 60)
    if (!area) continue // dia sem área é dia sem ritual — some da faixa
    vistos.add(dia)
    saida.push({ dia, area, ...(/^\d{2}:\d{2}$/.test(String(d?.hora || '')) ? { hora: String(d.hora) } : {}) })
  }
  return saida.sort((a, b) => a.dia - b.dia)
}

// 1 = segunda … 7 = domingo (o getDay() do JS começa no domingo, o que sempre
// produz um bug de fuso na primeira vez que alguém esquece).
export function diaDaSemana(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1
}

export function ritualDoDia(ritual: DiaRitual[], d: Date): DiaRitual | undefined {
  return ritual.find(r => r.dia === diaDaSemana(d))
}

// Título sugerido da reunião do dia: "Segunda Comercial". Sem ritual naquele
// dia, devolve vazio — quem cria escreve o título à mão.
export function tituloDoDia(ritual: DiaRitual[], d: Date): string {
  const r = ritualDoDia(ritual, d)
  return r ? `${NOMES_DIA[r.dia]} ${r.area}` : ''
}

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ---- Grades do calendário ----

// Semana de SEGUNDA a domingo (a semana comercial brasileira).
export function semanaDe(d: Date): Date[] {
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const seg = new Date(base)
  seg.setDate(base.getDate() - (diaDaSemana(base) - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(seg)
    x.setDate(seg.getDate() + i)
    return x
  })
}

// Matriz de semanas cobrindo o mês inteiro, começando na segunda. As bordas
// trazem dias do mês vizinho (é o que faz o calendário não ter buraco) — a tela
// os pinta mais claros.
export function gradeMes(ano: number, mes: number): Date[][] {
  const primeiro = new Date(ano, mes, 1)
  const ultimo = new Date(ano, mes + 1, 0)
  const inicio = semanaDe(primeiro)[0]
  const semanas: Date[][] = []
  const cursor = new Date(inicio)
  while (cursor <= ultimo || semanas.length === 0 || cursor.getDay() !== 1) {
    semanas.push(semanaDe(cursor))
    cursor.setDate(cursor.getDate() + 7)
    if (semanas.length >= 6) break // nenhum mês precisa de mais de 6 semanas
  }
  return semanas
}

// ---- Recorrência ----

// Datas de uma reunião SEMANAL, do primeiro dia até `ate` (inclusive), no mesmo
// dia da semana da data inicial. Teto de 53 ocorrências: um ano de reuniões
// semanais é bastante, e sem teto um "até 2099" digitado sem querer criaria
// milhares de registros.
export function ocorrenciasSemanais(inicio: Date, ate: Date, maximo = 53): Date[] {
  const saida: Date[] = []
  const cursor = new Date(inicio)
  const limite = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate(), 23, 59, 59)
  while (cursor <= limite && saida.length < maximo) {
    saida.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }
  return saida
}

// Junta a data (YYYY-MM-DD) com a hora (HH:MM) num Date local. Hora ausente
// vira 09:00 — reunião sem hora marcada na prática acontece de manhã, e um
// horário 00:00 apareceria como "meia-noite" no calendário.
export function dataComHora(dia: string, hora?: string): Date {
  const [a, m, d] = dia.split('-').map(Number)
  const [h, min] = (/^\d{2}:\d{2}$/.test(hora || '') ? (hora as string) : '09:00').split(':').map(Number)
  return new Date(a, (m || 1) - 1, d || 1, h, min, 0, 0)
}

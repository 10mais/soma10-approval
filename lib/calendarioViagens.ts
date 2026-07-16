// Calendário de viagens: mês, lista e gantt. Puro, client-safe, testável.
//
// O que torna isto diferente do Calendar.tsx (posts) e da Agenda (clínica): uma
// VIAGEM ATRAVESSA DIAS. 27/07 → 02/08 não é um ponto no calendário, é uma barra
// que cruza a virada de semana E a virada de mês. Os dois calendários que já
// existem sabem desenhar só evento de um dia — por isso este núcleo existe.
//
// Três coisas moram aqui, e as três erram silenciosamente se feitas na tela:
//  1. FATIAR a barra por semana (uma viagem de 7 dias vira 2 segmentos).
//  2. EMPILHAR em faixas quando duas viagens se sobrepõem — sem isso elas
//     desenham uma por cima da outra e o dono não vê que há duas saídas no dia.
//  3. RECORTAR no mês visível: a viagem que começou em julho e termina em agosto
//     precisa aparecer nos DOIS meses, cada um mostrando só o seu pedaço.

import { somarDias, diasEntre, ehData, paraDate, paraYmd } from './datas'

export type ViagemCal = {
  id: string
  titulo: string
  dataIda: string
  dataVolta?: string
  status?: string
  tipo?: 'pacote' | 'fretamento'
}

// Faixa contínua de uma viagem: início e fim já resolvidos (sem volta = 1 dia).
export type Periodo = { id: string; inicio: string; fim: string; viagem: ViagemCal }

// Pedaço de uma barra dentro de UMA semana da grade do mês.
export type Segmento = {
  id: string
  semana: number      // índice da linha na grade
  col: number         // 0..6 — coluna onde o pedaço começa
  span: number        // quantas colunas ocupa
  faixa: number       // linha de empilhamento dentro da semana (0 = primeira)
  comecaAqui: boolean // é o começo real da viagem? (senão veio da semana anterior)
  terminaAqui: boolean
  viagem: ViagemCal
}

export type LinhaGantt = {
  id: string
  offset: number   // dias desde o início da régua
  duracao: number  // em dias (mínimo 1)
  inicio: string
  fim: string
  viagem: ViagemCal
}

// Sem volta a viagem é bate-volta (1 dia). Volta antes da ida seria barra
// negativa: trata como bate-volta em vez de desenhar lixo.
export function periodoDaViagem(v: ViagemCal): Periodo | null {
  if (!ehData(v?.dataIda)) return null
  const fim = ehData(v.dataVolta) && diasEntre(v.dataIda, v.dataVolta!) >= 0 ? v.dataVolta! : v.dataIda
  return { id: v.id, inicio: v.dataIda, fim, viagem: v }
}

export function periodos(viagens: ViagemCal[]): Periodo[] {
  return (viagens || []).map(periodoDaViagem).filter(Boolean) as Periodo[]
}

// ── Grade do mês ─────────────────────────────────────────────────────────────
// Semana começa na SEGUNDA (padrão brasileiro de operação; a Agenda já faz assim).
export function inicioDaSemana(ymd: string): string {
  const d = paraDate(ymd)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return paraYmd(d)
}

// Semanas que cobrem o mês inteiro, cada uma com os 7 dias (YYYY-MM-DD).
// Inclui os dias vizinhos que completam a primeira e a última semana.
export function semanasDoMes(ano: number, mes: number): string[][] {
  const primeiro = paraYmd(new Date(ano, mes, 1))
  const ultimo = paraYmd(new Date(ano, mes + 1, 0))
  const inicio = inicioDaSemana(primeiro)
  const semanas: string[][] = []
  let cursor = inicio
  // Enquanto a semana ainda não passou do fim do mês.
  while (diasEntre(cursor, ultimo) >= 0) {
    semanas.push(Array.from({ length: 7 }, (_, i) => somarDias(cursor, i)))
    cursor = somarDias(cursor, 7)
  }
  return semanas
}

// Duas faixas se cruzam? (bordas inclusivas — uma viagem que termina no dia em
// que outra começa OCUPA o mesmo dia e precisa de faixa própria.)
const cruzam = (aIni: number, aFim: number, bIni: number, bFim: number) => aIni <= bFim && bIni <= aFim

// Empilha os segmentos de UMA semana: cada um vai para a primeira faixa livre.
// Guloso e determinístico — ordena por coluna, depois pelo mais longo (barra
// longa embaixo lê melhor), depois por id para não dançar entre renders.
function empilhar(brutos: Omit<Segmento, 'faixa'>[]): Segmento[] {
  const ordenados = [...brutos].sort((a, b) =>
    a.col - b.col || b.span - a.span || a.id.localeCompare(b.id))
  const faixas: { col: number; fim: number }[][] = []
  return ordenados.map(s => {
    const fim = s.col + s.span - 1
    let f = faixas.findIndex(faixa => !faixa.some(o => cruzam(s.col, fim, o.col, o.fim)))
    if (f < 0) { faixas.push([]); f = faixas.length - 1 }
    faixas[f].push({ col: s.col, fim })
    return { ...s, faixa: f }
  })
}

// Segmentos de todas as viagens, prontos para desenhar na grade do mês.
export function segmentosDoMes(viagens: ViagemCal[], ano: number, mes: number): Segmento[] {
  const semanas = semanasDoMes(ano, mes)
  const ps = periodos(viagens)
  const out: Segmento[] = []

  semanas.forEach((dias, iSemana) => {
    const d0 = dias[0]
    const d6 = dias[6]
    const brutos: Omit<Segmento, 'faixa'>[] = []
    for (const p of ps) {
      // Fora desta semana?
      if (diasEntre(p.fim, d0) > 0 || diasEntre(d6, p.inicio) > 0) continue
      // RECORTA na semana: o que começou antes entra na coluna 0.
      const col = Math.max(0, diasEntre(d0, p.inicio))
      const fimCol = Math.min(6, diasEntre(d0, p.fim))
      brutos.push({
        id: p.id,
        semana: iSemana,
        col,
        span: fimCol - col + 1,
        comecaAqui: diasEntre(d0, p.inicio) >= 0,
        terminaAqui: diasEntre(p.fim, d6) >= 0,
        viagem: p.viagem,
      })
    }
    out.push(...empilhar(brutos))
  })
  return out
}

// Quantas faixas a semana precisa (altura da linha na grade).
export function faixasNaSemana(segs: Segmento[], semana: number): number {
  const daSemana = segs.filter(s => s.semana === semana)
  return daSemana.length ? Math.max(...daSemana.map(s => s.faixa)) + 1 : 0
}

// ── Lista ────────────────────────────────────────────────────────────────────
// Ordenada pela ida (a próxima saída primeiro) e agrupada por mês.
export function listaPorMes(viagens: ViagemCal[]): { mes: string; viagens: ViagemCal[] }[] {
  const ordenadas = periodos(viagens).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.viagem.titulo.localeCompare(b.viagem.titulo, 'pt'))
  const grupos: { mes: string; viagens: ViagemCal[] }[] = []
  for (const p of ordenadas) {
    const mes = p.inicio.slice(0, 7) // YYYY-MM
    const g = grupos.find(x => x.mes === mes)
    if (g) g.viagens.push(p.viagem)
    else grupos.push({ mes, viagens: [p.viagem] })
  }
  return grupos
}

// ── Gantt ────────────────────────────────────────────────────────────────────
// Régua = do início da primeira viagem ao fim da última. Sem viagem, sem régua.
export function reguaGantt(viagens: ViagemCal[]): { inicio: string; fim: string; dias: number } | null {
  const ps = periodos(viagens)
  if (!ps.length) return null
  const inicio = ps.reduce((m, p) => (p.inicio < m ? p.inicio : m), ps[0].inicio)
  const fim = ps.reduce((m, p) => (p.fim > m ? p.fim : m), ps[0].fim)
  return { inicio, fim, dias: diasEntre(inicio, fim) + 1 }
}

export function linhasGantt(viagens: ViagemCal[]): LinhaGantt[] {
  const regua = reguaGantt(viagens)
  if (!regua) return []
  return periodos(viagens)
    .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.viagem.titulo.localeCompare(b.viagem.titulo, 'pt'))
    .map(p => ({
      id: p.id,
      offset: diasEntre(regua.inicio, p.inicio),
      duracao: diasEntre(p.inicio, p.fim) + 1,
      inicio: p.inicio,
      fim: p.fim,
      viagem: p.viagem,
    }))
}

// Marcos de mês na régua do gantt: onde cada mês começa, para rotular o eixo.
export function marcosDeMes(inicio: string, dias: number): { offset: number; rotulo: string }[] {
  if (!ehData(inicio) || dias < 1) return []
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const out: { offset: number; rotulo: string }[] = []
  let ultimoMes = ''
  for (let i = 0; i < dias; i++) {
    const d = somarDias(inicio, i)
    const mes = d.slice(0, 7)
    if (mes !== ultimoMes) {
      const dt = paraDate(d)
      out.push({ offset: i, rotulo: `${MESES[dt.getMonth()]} ${dt.getFullYear()}` })
      ultimoMes = mes
    }
  }
  return out
}

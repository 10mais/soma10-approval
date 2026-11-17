// PLANO DE AÇÃO POR SEMANAS dentro do Plano de entregas (dono, 17/11/2026: "quero
// estas funções dentro do soma10: plano de ação claro, SLAs claros… para a clareza
// da equipe e também para o cliente"). Plano completo em
// docs/redesenho-agency/PLANO-PLANO-DE-ACAO.md.
//
// A planilha que o 10+ usava ("Playbook de Entregas por Semana") já mentia sozinha:
// progresso geral 5% com 34% feito, abas discordando, semanas sobrepostas, e uma
// coluna Observação onde alguém copiava à mão o status do Soma10. Aqui nada disso é
// digitado: a semana sai do calendário, o progresso sai das entregas e o status da
// entrega sai da tarefa ou do post ligado a ela.
//
// Onde mora: a SEMANA é um `Marco` com `tipo: 'semana'` e `foco`; a ENTREGA é uma
// sub-etapa dele (lib/subetapas) com `frente`, `responsavelTipo` e `vinculo`. Sem
// chave nova no Redis — Gantt, visão do cliente, bola da vez e backup seguem valendo.
//
// Decisões do dono (17/11, "Aprovo"): semana fixa de segunda a domingo contada do
// início do plano; entrega da equipe nasce com a tarefa; "A confirmar" deixa de
// existir; o cliente vê o primeiro nome de quem faz.
//
// Datas em YYYY-MM-DD, meia-noite LOCAL (lib/datas). Puro e testável.

import { ehData, paraDate, paraYmd, somarDias, diasEntre } from './datas'
import type { SubEtapa, SubEtapaStatus } from './subetapas'

// ---------------------------------------------------------------- frentes
export const FRENTES: { key: string; label: string }[] = [
  { key: 'consultoria', label: 'Consultoria' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'trafego', label: 'Tráfego' },
  { key: 'social_media', label: 'Social media' },
  { key: 'videos', label: 'Vídeos' },
  { key: 'landing_page', label: 'Landing page' },
  { key: 'google_meu_negocio', label: 'Google Meu Negócio' },
  { key: 'indicadores', label: 'Indicadores' },
]
const FRENTE_OK = new Set(FRENTES.map(f => f.key))

/** Sem acento, minúsculo, espaços simples. Para casar texto de planilha com chave. */
export function semAcento(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function chaveFrente(texto?: string | null): string | undefined {
  const t = semAcento(texto || '')
  if (!t) return undefined
  if (FRENTE_OK.has(t)) return t
  const f = FRENTES.find(x => semAcento(x.label) === t || x.key === t.replace(/ /g, '_'))
  return f?.key
}

export const rotuloFrente = (key?: string): string => FRENTES.find(f => f.key === key)?.label || ''

// ---------------------------------------------------------------- semana
/** Segunda-feira da semana do dia (domingo pertence à semana que começou na segunda anterior). */
export function segundaDaSemana(ymd: string): string {
  const dia = paraDate(ymd).getDay() // 0 = domingo
  return somarDias(ymd, dia === 0 ? -6 : 1 - dia)
}
export const domingoDaSemana = (segunda: string): string => somarDias(segunda, 6)
export const sextaDaSemana = (segunda: string): string => somarDias(segunda, 4)

/** Número da semana (1 = a semana do início do plano). Antes do início = 0 ou negativo. */
export function numeroDaSemana(inicioPlano: string, ymd: string): number {
  return Math.floor(diasEntre(segundaDaSemana(inicioPlano), segundaDaSemana(ymd)) / 7) + 1
}

export type MarcoSemana = { id: string; dataInicio: string; dataFim?: string; tipo?: string; foco?: string; titulo?: string; recesso?: boolean; subetapas?: SubEtapa[] }

/** As semanas do plano em ordem, numeradas a partir da primeira. Marco comum fica de fora. */
export function semanasDoPlano<T extends MarcoSemana>(marcos: T[]): (T & { numero: number; segunda: string })[] {
  const semanas = marcos
    .filter(m => m.tipo === 'semana' && ehData((m.dataInicio || '').slice(0, 10)))
    .map(m => ({ m, segunda: segundaDaSemana(m.dataInicio.slice(0, 10)) }))
    .sort((a, b) => (a.segunda < b.segunda ? -1 : a.segunda > b.segunda ? 1 : 0))
  if (!semanas.length) return []
  const primeira = semanas[0].segunda
  return semanas.map(({ m, segunda }) => ({ ...m, segunda, numero: numeroDaSemana(primeira, segunda) }))
}

/** A semana que contém `hoje`; antes do plano = a primeira; depois = a última. */
export function semanaAtual<T extends { segunda: string }>(semanas: T[], hoje: string): T | undefined {
  if (!semanas.length) return undefined
  const seg = segundaDaSemana(hoje)
  const exata = semanas.find(s => s.segunda === seg)
  if (exata) return exata
  if (seg < semanas[0].segunda) return semanas[0]
  const passadas = semanas.filter(s => s.segunda <= seg)
  return passadas[passadas.length - 1]
}

// ---------------------------------------------------------------- status pela ligação
export type Ligado =
  | { tipo: 'tarefa'; status?: string; concluidoEm?: string }
  | { tipo: 'post'; status?: string; atualizadoEm?: string }

const POST_FEITO = new Set(['aprovado', 'agendado', 'publicando', 'publicado'])

/**
 * O status que a coisa ligada impõe à entrega. `null` = a ligação não decide (tarefa
 * descartada, status desconhecido) e vale o status marcado à mão.
 */
export function statusPelaLigacao(l?: Ligado | null): SubEtapaStatus | null {
  if (!l || !l.status) return null
  if (l.tipo === 'tarefa') {
    if (l.status === 'concluido') return 'concluido'
    if (l.status === 'a_fazer') return 'pendente'
    if (['em_andamento', 'em_ajuste', 'em_revisao'].includes(l.status)) return 'em_andamento'
    return null
  }
  if (POST_FEITO.has(l.status)) return 'concluido'
  if (l.status === 'rascunho') return 'pendente'
  return 'em_andamento'
}

export function statusDaEntrega(e: Pick<SubEtapa, 'status'>, ligado?: Ligado | null): SubEtapaStatus {
  return statusPelaLigacao(ligado) ?? e.status
}

// ---------------------------------------------------------------- relógio (SLA)
export type EstadoRelogio = 'concluida' | 'recesso' | 'sem_prazo' | 'no_prazo' | 'vence_hoje' | 'atrasada'
export type Relogio = { estado: EstadoRelogio; dias: number } // dias: até o prazo (no_prazo) ou de atraso (atrasada)

export function relogioDaEntrega(status: SubEtapaStatus, prazo: string | undefined, hoje: string, recesso = false): Relogio {
  if (status === 'concluido') return { estado: 'concluida', dias: 0 }
  if (recesso) return { estado: 'recesso', dias: 0 }
  if (!ehData(prazo)) return { estado: 'sem_prazo', dias: 0 }
  const d = diasEntre(hoje, prazo!)
  if (d > 0) return { estado: 'no_prazo', dias: d }
  if (d === 0) return { estado: 'vence_hoje', dias: 0 }
  return { estado: 'atrasada', dias: -d }
}

// ---------------------------------------------------------------- progresso
export type EntregaConta = { status: SubEtapaStatus; prazo?: string; concluidaEm?: string }
export type SemanaConta = { id: string; numero: number; recesso?: boolean; entregas: EntregaConta[] }
export type ProgressoSemana = { id: string; numero: number; previstas: number; concluidas: number; pct: number; atrasadas: number }
export type ProgressoPlano = {
  porSemana: ProgressoSemana[]
  previstas: number; concluidas: number; pct: number
  atrasadas: number
  // % no prazo: das entregas cujo prazo já chegou (fora de recesso), quantas foram
  // concluídas até o dia do prazo. Concluída sem data de conclusão (importada) conta
  // como no prazo: não há como saber, e punir o histórico sem prova distorce o número.
  vencidas: number; noPrazo: number; pctNoPrazo: number | null
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

export function progressoDoPlano(semanas: SemanaConta[], hoje: string): ProgressoPlano {
  let previstas = 0, concluidas = 0, atrasadas = 0, vencidas = 0, noPrazo = 0
  const porSemana = semanas.map(s => {
    let c = 0, a = 0
    for (const e of s.entregas) {
      if (e.status === 'concluido') c++
      if (relogioDaEntrega(e.status, e.prazo, hoje, s.recesso).estado === 'atrasada') a++
      // Prazo que vence HOJE só entra na conta se já foi entregue: o dia ainda não acabou.
      if (!s.recesso && ehData(e.prazo) && (e.prazo! < hoje || (e.prazo === hoje && e.status === 'concluido'))) {
        vencidas++
        if (e.status === 'concluido' && (!ehData(e.concluidaEm) || e.concluidaEm! <= e.prazo!)) noPrazo++
      }
    }
    previstas += s.entregas.length; concluidas += c; atrasadas += a
    return { id: s.id, numero: s.numero, previstas: s.entregas.length, concluidas: c, pct: pct(c, s.entregas.length), atrasadas: a }
  })
  return { porSemana, previstas, concluidas, pct: pct(concluidas, previstas), atrasadas, vencidas, noPrazo, pctNoPrazo: vencidas ? pct(noPrazo, vencidas) : null }
}

// ---------------------------------------------------------------- importar a planilha
// Formato: o que sai ao COPIAR as abas "Progresso" e "Entregas" do Google Sheets e
// colar (texto separado por TAB). A linha de cabeçalho é achada pelo nome das colunas,
// então linhas acima dela (progresso geral, semana atual) são ignoradas.

export function lerTabela(texto: string): string[][] {
  return (texto || '').replace(/\r/g, '').split('\n').map(l => l.split('\t').map(c => c.trim())).filter(l => l.some(Boolean))
}

function colunas(linhas: string[][], nomes: Record<string, string[]>): { idx: Record<string, number>; dados: string[][] } | null {
  for (let i = 0; i < linhas.length; i++) {
    const cab = linhas[i].map(semAcento)
    const idx: Record<string, number> = {}
    for (const [campo, alternativas] of Object.entries(nomes)) {
      const j = cab.findIndex(c => alternativas.includes(c))
      if (j >= 0) idx[campo] = j
    }
    if (idx.semana !== undefined && Object.keys(idx).length >= 2) return { idx, dados: linhas.slice(i + 1) }
  }
  return null
}

const COL_PROGRESSO = { semana: ['semana'], periodo: ['periodo'], foco: ['foco da semana', 'foco'], previstas: ['previstas'], concluidas: ['concluidas'] }
const COL_ENTREGAS = { semana: ['semana'], entrega: ['entrega'], frente: ['frente'], responsavel: ['responsavel'], status: ['status'], observacao: ['observacao', 'observacoes'] }

export type LinhaProgresso = { numero: number; periodo: string; foco: string; previstas: number; concluidas: number }
export type LinhaEntrega = { numero: number; entrega: string; frente: string; responsavel: string; status: string; observacao: string }

/** "W5", "Semana 5", "5" → 5. */
export function numeroDoRotulo(s: string): number {
  const m = (s || '').match(/(\d+)/)
  return m ? Number(m[1]) : 0
}

export function lerProgresso(texto: string): LinhaProgresso[] {
  const t = colunas(lerTabela(texto), COL_PROGRESSO)
  if (!t) return []
  const g = (l: string[], c: string) => (t.idx[c] !== undefined ? l[t.idx[c]] || '' : '')
  return t.dados
    .map(l => ({ numero: numeroDoRotulo(g(l, 'semana')), periodo: g(l, 'periodo'), foco: g(l, 'foco'), previstas: Number(g(l, 'previstas')) || 0, concluidas: Number(g(l, 'concluidas')) || 0 }))
    .filter(l => l.numero > 0)
}

export function lerEntregas(texto: string): LinhaEntrega[] {
  const t = colunas(lerTabela(texto), COL_ENTREGAS)
  if (!t || t.idx.entrega === undefined) return []
  const g = (l: string[], c: string) => (t.idx[c] !== undefined ? l[t.idx[c]] || '' : '')
  return t.dados
    .map(l => ({ numero: numeroDoRotulo(g(l, 'semana')), entrega: g(l, 'entrega'), frente: g(l, 'frente'), responsavel: g(l, 'responsavel'), status: g(l, 'status'), observacao: g(l, 'observacao') }))
    .filter(l => l.numero > 0 && l.entrega)
}

/** "dd/mm" perto de `referencia`: escolhe o ano que deixa a data mais próxima (virada de ano). */
export function diaMesPerto(diaMes: string, referencia: string): string | undefined {
  const m = (diaMes || '').match(/(\d{1,2})\/(\d{1,2})/)
  if (!m || !ehData(referencia)) return undefined
  const [d, mes] = [Number(m[1]), Number(m[2])]
  if (d < 1 || d > 31 || mes < 1 || mes > 12) return undefined
  const ano = Number(referencia.slice(0, 4))
  let melhor: string | undefined
  for (const a of [ano - 1, ano, ano + 1]) {
    const ymd = `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (paraYmd(paraDate(ymd)) !== ymd) continue // 31/11 e afins
    if (!melhor || Math.abs(diasEntre(referencia, ymd)) < Math.abs(diasEntre(referencia, melhor))) melhor = ymd
  }
  return melhor
}

/** Prazo escrito na linha: "Prazo no SOMA10: 10/11", "prazo 16/11" (observação) ou "(20/10)" no título. */
export function prazoEscrito(entrega: string, observacao: string, referencia: string): string | undefined {
  // `.*?` e não `[^0-9]*`: "Prazo no SOMA10: 10/11" tem dígito no nome do sistema.
  const obs = (observacao || '').match(/prazo.*?(\d{1,2}\/\d{1,2})/i)
  if (obs) return diaMesPerto(obs[1], referencia)
  const tit = (entrega || '').match(/\((\d{1,2}\/\d{1,2})\)/)
  if (tit) return diaMesPerto(tit[1], referencia)
  return undefined
}

export type Pessoa = { email: string; nome?: string }

/** Acha a pessoa da equipe pelo nome escrito (nome completo ou primeiro nome, sem acento). */
export function acharPessoa(nome: string, equipe: Pessoa[]): Pessoa | undefined {
  const n = semAcento(nome)
  if (!n) return undefined
  const completo = equipe.find(p => semAcento(p.nome || '') === n)
  if (completo) return completo
  const primeiro = n.split(' ')[0]
  const candidatos = equipe.filter(p => semAcento(p.nome || '').split(' ')[0] === primeiro)
  return candidatos.length === 1 ? candidatos[0] : undefined
}

export type SemanaImportada = { numero: number; dataInicio: string; dataFim: string; foco: string; recesso: boolean; entregas: SubEtapa[] }
export type PlanoImportado = { inicio: string; semanas: SemanaImportada[]; avisos: string[] }

/** Segunda-feira da W1 a partir do período da W1 ("19/10 a 25/10"). */
export function inicioPelaPlanilha(progresso: LinhaProgresso[], hoje: string): string | undefined {
  const w1 = progresso.find(p => p.numero === 1) || progresso[0]
  if (!w1) return undefined
  const dia = diaMesPerto(w1.periodo, hoje)
  if (!dia) return undefined
  // A W1 pode ter começado no ano passado; o número da semana diz quanto voltar.
  return segundaDaSemana(somarDias(dia, -7 * ((w1.numero || 1) - 1)))
}

const STATUS_PLANILHA: Record<string, SubEtapaStatus> = { concluido: 'concluido', concluida: 'concluido', feito: 'concluido', 'em andamento': 'em_andamento', andamento: 'em_andamento' }

/**
 * Monta as semanas a partir das duas abas. Regras:
 * - semana N começa na segunda `inicio + 7·(N−1)` — o período escrito na planilha é
 *   ignorado (estava sobreposto); as datas das reuniões semanais batem com esta conta;
 * - foco vem da aba Progresso; foco com "recesso" marca a semana como recesso;
 * - status: Concluído / Em andamento valem; o resto ("A fazer", "A confirmar") vira
 *   pendente. Se a aba Progresso deu a semana como toda concluída, as entregas dela
 *   entram concluídas (era lá que a equipe marcava de fato);
 * - prazo: o escrito na linha; senão, a sexta da semana;
 * - responsável "Cliente" fica com o cliente; nome achado na equipe ganha o e-mail.
 */
export function montarPlanoImportado(progresso: LinhaProgresso[], entregas: LinhaEntrega[], inicio: string, equipe: Pessoa[] = []): PlanoImportado {
  const avisos: string[] = []
  const seg1 = segundaDaSemana(inicio)
  const numeros = Array.from(new Set([...progresso.map(p => p.numero), ...entregas.map(e => e.numero)])).sort((a, b) => a - b)
  const naoAchados = new Set<string>()
  let semDono = 0, aConfirmar = 0

  const semanas = numeros.map(n => {
    const segunda = somarDias(seg1, 7 * (n - 1))
    const prog = progresso.find(p => p.numero === n)
    const linhas = entregas.filter(e => e.numero === n)
    const todaFeita = !!prog && linhas.length > 0 && prog.concluidas >= linhas.length
    const foco = (prog?.foco || '').trim()
    const recesso = /recesso/i.test(foco)
    const subs: SubEtapa[] = linhas.map((l, i) => {
      const prazo = prazoEscrito(l.entrega, l.observacao, segunda) || sextaDaSemana(segunda)
      const st = semAcento(l.status)
      const status: SubEtapaStatus = todaFeita ? 'concluido' : STATUS_PLANILHA[st] || 'pendente'
      if (st === 'a confirmar' && status !== 'concluido') aConfirmar++
      // Prazo escrito antes da segunda (tarefa adiantada) puxa o início junto: barra do Gantt nunca invertida.
      const s: SubEtapa = { id: `pa-${n}-${i + 1}`, titulo: l.entrega.slice(0, 160), status, dataInicio: prazo < segunda ? prazo : segunda, dataFim: prazo }
      const frente = chaveFrente(l.frente)
      if (frente) s.frente = frente
      const resp = l.responsavel.trim()
      if (semAcento(resp) === 'cliente') { s.responsavelTipo = 'cliente'; s.responsavelNome = 'Cliente' }
      else if (resp) {
        s.responsavelTipo = 'equipe'; s.responsavelNome = resp
        const p = acharPessoa(resp, equipe)
        if (p) s.responsavelEmail = p.email
        else if (equipe.length) naoAchados.add(resp)
      } else semDono++
      return s
    })
    return { numero: n, dataInicio: segunda, dataFim: domingoDaSemana(segunda), foco: foco || `Semana ${n}`, recesso, entregas: subs }
  })

  if (semDono) avisos.push(`${semDono} ${semDono === 1 ? 'entrega está' : 'entregas estão'} sem responsável.`)
  if (aConfirmar) avisos.push(`${aConfirmar} ${aConfirmar === 1 ? 'entrega marcada' : 'entregas marcadas'} "A confirmar" ${aConfirmar === 1 ? 'entrou como pendente' : 'entraram como pendentes'}: confira e conclua o que já foi feito.`)
  for (const nome of Array.from(naoAchados)) avisos.push(`"${nome}" não foi achado na equipe: fica só o nome, sem ligar à pessoa.`)
  const semFoco = semanas.filter(s => /^Semana \d+$/.test(s.foco)).map(s => `W${s.numero}`)
  if (semFoco.length) avisos.push(`Sem foco definido: ${semFoco.join(', ')}.`)
  return { inicio: seg1, semanas, avisos }
}

// ================================================================ F2: a entrega vira tarefa
// Decisão do dono (17/11): "entrega da equipe nasce com a tarefa e conclui junto". A tarefa
// guarda `marcoId` + `subetapaId` (o vínculo que o Gantt já entende) e a entrega guarda
// `vinculo: { tipo: 'tarefa', id }`. Daí em diante o status da entrega SAI da tarefa.
//
// Só nasce tarefa para o que está perto: prazo até `janelaDias` à frente (ou já vencido).
// Importar 15 semanas de uma vez não pode despejar 58 tarefas no quadro de ninguém, nem
// ocupar as vagas do limitador com coisa de janeiro.
// Reunião semanal fica de fora: ela mora na agenda, e a entrega é marcada à mão.

export const JANELA_TAREFA_DIAS = 14
export const ehReuniao = (titulo?: string): boolean => /^\s*reuni(a|ã)o(\s|$|\()/i.test(titulo || '')

const TIPO_POR_FRENTE: Record<string, string> = {
  trafego: 'campanha', social_media: 'post', videos: 'video', landing_page: 'landing_page',
  consultoria: 'estrategia', onboarding: 'tarefa', google_meu_negocio: 'tarefa', indicadores: 'tarefa',
}
export const tipoTarefaDaFrente = (frente?: string): string => TIPO_POR_FRENTE[frente || ''] || 'tarefa'

export type SemanaComEntregas = { id: string; recesso?: boolean; subetapas?: SubEtapa[] }

/** Entregas que devem ganhar tarefa agora. */
export function entregasParaCriarTarefa(semanas: SemanaComEntregas[], hoje: string, janelaDias = JANELA_TAREFA_DIAS): { marcoId: string; entrega: SubEtapa }[] {
  const limite = somarDias(hoje, janelaDias)
  const out: { marcoId: string; entrega: SubEtapa }[] = []
  for (const s of semanas) {
    if (s.recesso) continue
    for (const e of s.subetapas || []) {
      if (e.responsavelTipo !== 'equipe' || !e.responsavelEmail) continue
      if (e.vinculo || e.status === 'concluido' || ehReuniao(e.titulo)) continue
      if (!ehData(e.dataFim) || e.dataFim! > limite) continue
      out.push({ marcoId: s.id, entrega: e })
    }
  }
  return out
}

export type TarefaLigada = { id: string; status?: string; concluidoEm?: string; responsavelEmail?: string; responsavelNome?: string }

/**
 * Traz para a entrega o que a tarefa ligada diz: status, dia da conclusão e responsável
 * (trocar o responsável na tarefa troca na entrega). Devolve as entregas e se alguma
 * mudou (só grava quem mudou). Tarefa sumida não apaga nada.
 */
export function reconciliarEntregas(entregas: SubEtapa[], tarefas: Map<string, TarefaLigada>, diaDe: (iso?: string) => string): { entregas: SubEtapa[]; mudou: boolean } {
  let mudou = false
  const novas = entregas.map(e => {
    if (e.vinculo?.tipo !== 'tarefa') return e
    const t = tarefas.get(e.vinculo.id)
    if (!t) return e
    const status = statusPelaLigacao({ tipo: 'tarefa', status: t.status }) ?? e.status
    const concluidaEm = status === 'concluido' ? (e.concluidaEm || (t.concluidoEm ? diaDe(t.concluidoEm) : undefined)) : undefined
    const trocouDono = !!t.responsavelEmail && t.responsavelEmail !== e.responsavelEmail
    if (status === e.status && concluidaEm === e.concluidaEm && !trocouDono) return e
    mudou = true
    const n: SubEtapa = { ...e, status }
    if (trocouDono) { n.responsavelEmail = t.responsavelEmail; if (t.responsavelNome) n.responsavelNome = t.responsavelNome }
    if (concluidaEm) n.concluidaEm = concluidaEm; else delete n.concluidaEm
    return n
  })
  return { entregas: novas, mudou }
}

// ================================================================ F2: visão da equipe
// Pergunta da tela: "o que sai esta semana e quem está atrasado?". Três destaques só:
// atrasadas, sem responsável, esperando o cliente. O resto fica quieto.

export type EntregaNaTela = SubEtapa & { marcoId: string; semana: number; relogio: Relogio; doCliente: boolean; semDono: boolean }
export type GrupoFrente = { frente: string; rotulo: string; entregas: EntregaNaTela[] }
export type VisaoSemana = {
  numero: number; total: number; segunda: string; domingo: string; foco: string; recesso: boolean; marcoId: string
  grupos: GrupoFrente[]
  atrasadasAntes: EntregaNaTela[] // de semanas anteriores, ainda abertas
  destaques: { atrasadas: number; semDono: number; doCliente: number }
  proximas: { numero: number; segunda: string; foco: string; entregas: number }[]
  progresso: ProgressoPlano
}

function naTela(e: SubEtapa, marcoId: string, numero: number, hoje: string, recesso: boolean): EntregaNaTela {
  const doCliente = e.responsavelTipo === 'cliente'
  return { ...e, marcoId, semana: numero, relogio: relogioDaEntrega(e.status, e.dataFim, hoje, recesso), doCliente, semDono: !doCliente && !e.responsavelNome && !e.responsavelEmail }
}

const ORDEM_RELOGIO: Record<EstadoRelogio, number> = { atrasada: 0, vence_hoje: 1, no_prazo: 2, sem_prazo: 3, recesso: 4, concluida: 5 }
const porUrgencia = (a: EntregaNaTela, b: EntregaNaTela) =>
  ORDEM_RELOGIO[a.relogio.estado] - ORDEM_RELOGIO[b.relogio.estado] || (a.dataFim || '9').localeCompare(b.dataFim || '9')

/** Monta a semana pedida (`numero`) ou a atual. As entregas já devem vir reconciliadas. */
export function visaoDaSemana<T extends MarcoSemana>(marcos: T[], hoje: string, numero?: number): VisaoSemana | null {
  const semanas = semanasDoPlano(marcos)
  if (!semanas.length) return null
  const alvo = (numero ? semanas.find(s => s.numero === numero) : undefined) || semanaAtual(semanas, hoje)!
  const recesso = !!alvo.recesso
  const lista = (alvo.subetapas || []).map(e => naTela(e, alvo.id, alvo.numero, hoje, recesso)).sort(porUrgencia)

  const grupos: GrupoFrente[] = []
  for (const e of lista) {
    const chave = e.frente || ''
    let g = grupos.find(x => x.frente === chave)
    if (!g) { g = { frente: chave, rotulo: rotuloFrente(chave) || 'Outras', entregas: [] }; grupos.push(g) }
    g.entregas.push(e)
  }
  // Frente com algo atrasado sobe; depois a ordem fixa de FRENTES.
  const ordemFrente = (k: string) => { const i = FRENTES.findIndex(f => f.key === k); return i < 0 ? 99 : i }
  const temAtraso = (g: GrupoFrente) => (g.entregas[0].relogio.estado === 'atrasada' ? 0 : 1)
  grupos.sort((a, b) => temAtraso(a) - temAtraso(b) || ordemFrente(a.frente) - ordemFrente(b.frente))

  const atrasadasAntes = semanas
    .filter(s => s.numero < alvo.numero && !s.recesso)
    .flatMap(s => (s.subetapas || []).map(e => naTela(e, s.id, s.numero, hoje, false)))
    .filter(e => e.relogio.estado === 'atrasada')
    .sort(porUrgencia)

  const abertas = [...lista, ...atrasadasAntes].filter(e => e.status !== 'concluido')
  const progresso = progressoDoPlano(semanas.map(s => ({ id: s.id, numero: s.numero, recesso: s.recesso, entregas: (s.subetapas || []).map(e => ({ status: e.status, prazo: e.dataFim, concluidaEm: e.concluidaEm })) })), hoje)
  return {
    numero: alvo.numero, total: semanas[semanas.length - 1].numero, segunda: alvo.segunda, domingo: domingoDaSemana(alvo.segunda),
    foco: alvo.foco || alvo.titulo || `Semana ${alvo.numero}`, recesso, marcoId: alvo.id,
    grupos, atrasadasAntes,
    destaques: {
      atrasadas: abertas.filter(e => e.relogio.estado === 'atrasada').length,
      semDono: abertas.filter(e => e.semDono).length,
      doCliente: abertas.filter(e => e.doCliente).length,
    },
    proximas: semanas.filter(s => s.numero > alvo.numero).slice(0, 2).map(s => ({ numero: s.numero, segunda: s.segunda, foco: s.foco || s.titulo || `Semana ${s.numero}`, entregas: (s.subetapas || []).length })),
    progresso,
  }
}

/** Texto do relógio para a tela: "atrasada há 3 dias", "vence hoje", "faltam 2 dias". */
export function textoRelogio(r: Relogio): string {
  switch (r.estado) {
    case 'atrasada': return r.dias === 1 ? 'atrasada há 1 dia' : `atrasada há ${r.dias} dias`
    case 'vence_hoje': return 'vence hoje'
    case 'no_prazo': return r.dias === 1 ? 'vence amanhã' : `faltam ${r.dias} dias`
    case 'concluida': return 'entregue'
    case 'recesso': return 'recesso'
    default: return 'sem prazo'
  }
}

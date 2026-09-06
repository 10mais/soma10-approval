// RELATÓRIO DA SEMANA por cliente — "evidência de serviço" (pedido do dono, 04/09
// e 06/09): o que foi entregue, o que está em andamento (e com quem está a bola)
// e os próximos passos. Tudo derivado dos dados que já existem (posts, tarefas,
// etapas do Playbook); nada é digitado duas vezes.
//
// Semana = segunda 00:00 a domingo 23:59:59 (horário local de quem gera).
// Funções puras: a tela e a IA recebem o resultado pronto; os testes cobrem as
// regras de classificação, que são o que pode errar.

import { esperandoCliente } from './bolaDaVez'

export type PostRel = {
  id: string
  legenda?: string
  headline?: string
  briefing?: string
  status?: string
  etapa?: string
  formato?: string
  dataAgendada?: string
  copyAprovadaEm?: string
  criativoAprovadoEm?: string
  atualizadoEm?: string
  criadoEm?: string
  excluidoEm?: string
  aguardandoDesde?: string
  redesPublicadas?: string[]
}

export type TarefaRel = {
  id: string
  titulo: string
  status: string
  tipo?: string
  prazo?: string
  concluidoEm?: string
  responsavelNome?: string
  atualizadoEm?: string
}

export type MarcoRel = {
  id: string
  titulo: string
  status: string
  categoria?: string
  dataFim?: string
  atualizadoEm?: string
}

export type Semana = { inicio: string; fim: string }

export type ItemRel = {
  id: string
  titulo: string
  tipo: 'post' | 'tarefa' | 'marco'
  quando?: string // ISO do fato (publicação, conclusão, prazo…)
  detalhe?: string // "Reel · Instagram", "Ana", "Etapa: Lançamento"
}

export type Relatorio = {
  periodo: { inicio: string; fim: string; rotulo: string }
  entregas: {
    publicados: ItemRel[]
    aprovados: ItemRel[]
    tarefasConcluidas: ItemRel[]
    marcosConcluidos: ItemRel[]
  }
  emAndamento: {
    aguardandoCliente: ItemRel[]
    emProducao: ItemRel[]
    tarefasAbertas: ItemRel[]
  }
  proximos: {
    agendados: ItemRel[]
    tarefasComPrazo: ItemRel[]
  }
  numeros: { entregues: number; aguardandoCliente: number; proximos: number }
}

const DIA = 86400000
const FORMATO_LABEL: Record<string, string> = { feed: 'Feed', reel: 'Reel', story: 'Story', carrossel: 'Carrossel', grafico: 'Material gráfico' }
const ETAPA_LABEL: Record<string, string> = { briefing: 'Briefing', copy: 'Copy em produção', aprovacao_copy: 'Copy em aprovação', criativo: 'Criativo em produção', aprovacao_criativo: 'Criativo em aprovação', pronto: 'Pronto' }
const EM_PRODUCAO = ['briefing', 'copy', 'criativo']
const TAREFA_ABERTA = ['a_fazer', 'em_andamento', 'em_revisao']

function ms(iso?: string): number | undefined {
  if (!iso) return undefined
  const n = new Date(iso).getTime()
  return Number.isFinite(n) ? n : undefined
}

function dentro(iso: string | undefined, s: Semana): boolean {
  const n = ms(iso)
  if (n === undefined) return false
  return n >= new Date(s.inicio).getTime() && n <= new Date(s.fim).getTime()
}

/** Segunda 00:00:00 → domingo 23:59:59.999 da semana que contém `ref`. */
export function semanaDe(ref: Date | number = Date.now()): Semana {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay() // 0 = domingo
  const paraSegunda = dow === 0 ? -6 : 1 - dow
  const ini = new Date(d.getTime() + paraSegunda * DIA)
  ini.setHours(0, 0, 0, 0)
  const fim = new Date(ini.getTime() + 6 * DIA)
  fim.setHours(23, 59, 59, 999)
  return { inicio: ini.toISOString(), fim: fim.toISOString() }
}

export function deslocarSemana(s: Semana, n: number): Semana {
  return semanaDe(new Date(s.inicio).getTime() + n * 7 * DIA + 12 * 3600000)
}

export function rotuloSemana(s: Semana): string {
  const f = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
  return `${f(s.inicio)} a ${f(s.fim)}`
}

export function tituloDoPost(p: PostRel): string {
  const t = (p.headline || p.briefing || p.legenda || '').replace(/\s+/g, ' ').trim()
  return t ? (t.length > 72 ? t.slice(0, 70).trimEnd() + '…' : t) : 'Post sem título'
}

function detalhePost(p: PostRel): string {
  const partes = [FORMATO_LABEL[p.formato || ''] || '']
  if (p.redesPublicadas?.length) partes.push(p.redesPublicadas.map(r => r === 'instagram' ? 'Instagram' : r === 'facebook' ? 'Facebook' : r).join(' + '))
  return partes.filter(Boolean).join(' · ')
}

function itemPost(p: PostRel, quando?: string, detalhe?: string): ItemRel {
  return { id: p.id, titulo: tituloDoPost(p), tipo: 'post', quando, detalhe: detalhe ?? detalhePost(p) }
}
function itemTarefa(t: TarefaRel, quando?: string): ItemRel {
  return { id: t.id, titulo: t.titulo || 'Tarefa sem título', tipo: 'tarefa', quando, detalhe: t.responsavelNome || undefined }
}
function itemMarco(m: MarcoRel, quando?: string): ItemRel {
  return { id: m.id, titulo: m.titulo, tipo: 'marco', quando, detalhe: m.categoria ? `Etapa · ${m.categoria}` : 'Etapa do Playbook' }
}

const porData = (a: ItemRel, b: ItemRel) => (ms(a.quando) || 0) - (ms(b.quando) || 0)

export function montarRelatorio(input: {
  posts?: PostRel[]
  tarefas?: TarefaRel[]
  marcos?: MarcoRel[]
  semana: Semana
  agora?: number
}): Relatorio {
  const { semana } = input
  const posts = (input.posts || []).filter(p => !p.excluidoEm)
  const tarefas = input.tarefas || []
  const marcos = input.marcos || []
  const fimMs = new Date(semana.fim).getTime()
  const proximaJanela: Semana = { inicio: new Date(fimMs + 1).toISOString(), fim: new Date(fimMs + 7 * DIA).toISOString() }

  // ENTREGUE na semana
  const publicados = posts
    .filter(p => p.status === 'publicado' && dentro(p.dataAgendada || p.atualizadoEm, semana))
    .map(p => itemPost(p, p.dataAgendada || p.atualizadoEm))
  const publicadosIds = new Set(publicados.map(i => i.id))
  const aprovados = posts
    .filter(p => !publicadosIds.has(p.id) && (dentro(p.criativoAprovadoEm, semana) || dentro(p.copyAprovadaEm, semana)))
    .map(p => {
      const criativo = dentro(p.criativoAprovadoEm, semana)
      return itemPost(p, criativo ? p.criativoAprovadoEm : p.copyAprovadaEm, criativo ? 'Criativo aprovado' : 'Copy aprovada')
    })
  const tarefasConcluidas = tarefas
    .filter(t => t.status === 'concluido' && dentro(t.concluidoEm || t.atualizadoEm, semana))
    .map(t => itemTarefa(t, t.concluidoEm || t.atualizadoEm))
  const marcosConcluidos = marcos
    .filter(m => m.status === 'concluido' && dentro(m.atualizadoEm || m.dataFim, semana))
    .map(m => itemMarco(m, m.atualizadoEm || m.dataFim))

  // EM ANDAMENTO (foto de agora, não da semana)
  const aguardandoCliente = posts
    .filter(p => esperandoCliente(p))
    .map(p => itemPost(p, p.aguardandoDesde || p.atualizadoEm, ETAPA_LABEL[p.etapa || ''] || 'Aguardando aprovação'))
  const emProducao = posts
    .filter(p => p.etapa && EM_PRODUCAO.includes(p.etapa))
    .map(p => itemPost(p, undefined, ETAPA_LABEL[p.etapa || ''] || 'Em produção'))
  const tarefasAbertas = tarefas
    .filter(t => TAREFA_ABERTA.includes(t.status))
    .map(t => itemTarefa(t, t.prazo))

  // PRÓXIMOS PASSOS: os 7 dias depois da semana
  const agendados = posts
    .filter(p => (p.status === 'agendado' || p.etapa === 'pronto') && p.status !== 'publicado' && dentro(p.dataAgendada, proximaJanela))
    .map(p => itemPost(p, p.dataAgendada))
  const tarefasComPrazo = tarefas
    .filter(t => TAREFA_ABERTA.includes(t.status) && t.prazo && ms(t.prazo)! <= new Date(proximaJanela.fim).getTime())
    .map(t => itemTarefa(t, t.prazo))

  for (const l of [publicados, aprovados, tarefasConcluidas, marcosConcluidos, aguardandoCliente, agendados, tarefasComPrazo]) l.sort(porData)

  return {
    periodo: { inicio: semana.inicio, fim: semana.fim, rotulo: rotuloSemana(semana) },
    entregas: { publicados, aprovados, tarefasConcluidas, marcosConcluidos },
    emAndamento: { aguardandoCliente, emProducao, tarefasAbertas },
    proximos: { agendados, tarefasComPrazo },
    numeros: {
      entregues: publicados.length + aprovados.length + tarefasConcluidas.length + marcosConcluidos.length,
      aguardandoCliente: aguardandoCliente.length,
      proximos: agendados.length + tarefasComPrazo.length,
    },
  }
}

function fmtDia(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
}

/** Texto pronto para WhatsApp / e-mail. Sem emoji, sem markdown pesado. */
export function textoRelatorio(r: Relatorio, clienteNome: string): string {
  const L: string[] = []
  const linha = (i: ItemRel) => `- ${i.titulo}${i.detalhe ? ` (${i.detalhe})` : ''}${i.quando ? ` — ${fmtDia(i.quando)}` : ''}`
  L.push(`RELATÓRIO DA SEMANA — ${clienteNome}`)
  L.push(`Período: ${r.periodo.rotulo}`)
  L.push('')
  L.push('O QUE FOI ENTREGUE')
  const e = r.entregas
  if (r.numeros.entregues === 0) L.push('- Nenhuma entrega registrada nesta semana.')
  if (e.publicados.length) { L.push(`Publicações no ar (${e.publicados.length}):`); e.publicados.forEach(i => L.push(linha(i))) }
  if (e.aprovados.length) { L.push(`Materiais aprovados (${e.aprovados.length}):`); e.aprovados.forEach(i => L.push(linha(i))) }
  if (e.tarefasConcluidas.length) { L.push(`Tarefas concluídas (${e.tarefasConcluidas.length}):`); e.tarefasConcluidas.forEach(i => L.push(linha(i))) }
  if (e.marcosConcluidos.length) { L.push(`Etapas do Playbook concluídas (${e.marcosConcluidos.length}):`); e.marcosConcluidos.forEach(i => L.push(linha(i))) }
  L.push('')
  L.push('EM ANDAMENTO')
  const a = r.emAndamento
  if (a.aguardandoCliente.length) { L.push(`Aguardando a sua aprovação (${a.aguardandoCliente.length}):`); a.aguardandoCliente.forEach(i => L.push(linha(i))) }
  if (a.emProducao.length) { L.push(`Em produção na agência (${a.emProducao.length}):`); a.emProducao.forEach(i => L.push(linha(i))) }
  if (a.tarefasAbertas.length) L.push(`Tarefas abertas na agência: ${a.tarefasAbertas.length}`)
  if (!a.aguardandoCliente.length && !a.emProducao.length && !a.tarefasAbertas.length) L.push('- Nada em andamento no momento.')
  L.push('')
  L.push('PRÓXIMOS PASSOS')
  const p = r.proximos
  if (p.agendados.length) { L.push(`Publicações programadas (${p.agendados.length}):`); p.agendados.forEach(i => L.push(linha(i))) }
  if (p.tarefasComPrazo.length) { L.push(`Tarefas com prazo (${p.tarefasComPrazo.length}):`); p.tarefasComPrazo.forEach(i => L.push(linha(i))) }
  if (!p.agendados.length && !p.tarefasComPrazo.length) L.push('- Próximos passos serão definidos na próxima reunião.')
  return L.join('\n')
}

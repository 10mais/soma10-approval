// PAINEL DA CLÍNICA — plano aprovado pelo dono em 13/11/2026 (itens 2, 3 e 5
// da nota "MELHORIAS SOMA10"): metas da semana, semana da comercial,
// oportunidades paradas e o funil do mês.
//
// Regras combinadas com o dono:
// - NOVA = primeira consulta da paciente na clínica. RETORNO = já tinha
//   consulta antes desta (marcada, confirmada ou atendida — cancelada e falta
//   não contam) OU tem "Último procedimento" anotado na ficha, que é a base
//   que veio do sistema anterior.
// - AGENDAMENTO conta pelo dia em que foi MARCADO (`criadoEm`): é o que mede o
//   trabalho da comercial. Cancelado não conta.
// - COMPARECIMENTO conta pelo dia da consulta (status atendido).
// - Quem define as metas é o admin, na aba Metas. A meta da semana vale para
//   qualquer período na proporção dos dias (o mês de 30 dias = 30/7 semanas).
// - "Conversas" por pessoa só enxerga mensagem enviada PELO Soma10: a que sai
//   direto do celular não tem autor e aparece numa linha à parte.
// - Os três follow-ups que existem hoje (tarefa de retorno, cadência da
//   oportunidade e "próximo contato") contam juntos. Unificar é decisão do dono
//   ainda em aberto (docs/redesenho-clinica, §10.7) — aqui ninguém some.
//
// Puro (sem Redis, sem React): a rota /api/crm/painel-clinica carrega e chama;
// a tela do Funil chama direto; o teste cobre.

import { progresso, metaIntervalo, realizadoNoIntervalo, dataDoGanho, type MetaAno, type Progresso, type NegocioMeta } from './metas'
import { telefoneWhatsApp } from './telefoneBR'

const DIA = 86400000
const tempo = (iso?: string): number => { const v = iso ? new Date(iso).getTime() : NaN; return Number.isFinite(v) ? v : NaN }
const noIntervalo = (iso: string | undefined, de: Date, ate: Date) => { const v = tempo(iso); return Number.isFinite(v) && v >= de.getTime() && v <= ate.getTime() }
const soData = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
// "2026-11-10" (só a data) vale até o FIM daquele dia local.
const fimDoDiaYmd = (ymd?: string): number => {
  const s = String(ymd || '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d, 23, 59, 59, 999).getTime() }
  return tempo(s)
}
export const normNome = (s?: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// ── Tipos de entrada (só o que as regras leem) ───────────────────────────────
export type AgendamentoP = { id: string; contatoId?: string; status: string; dataInicio: string; criadoEm?: string; criadoPor?: string }
export type ContatoP = { id: string; nome?: string; telefone?: string; ultimoProcedimento?: string; ultimoContato?: string }
export type TarefaP = { id: string; tipo?: string; status: string; responsavelEmail?: string; responsavelNome?: string; prazo?: string; concluidoEm?: string }
export type CadenciaP = { quando?: string; feito?: boolean; feitoEm?: string; feitoPor?: string }
export type NegocioP = NegocioMeta & {
  id: string; status?: string; estagioId?: string; pipelineId?: string; dono?: string; donoNome?: string; contatoId?: string; titulo?: string
  criadoEm?: string; atualizadoEm?: string; proximoFollowUp?: string
  atividades?: { tipo?: string; autor?: string; criadoEm?: string }[]
  agendamentos?: CadenciaP[]
}
export type UsuarioP = { email: string; nome?: string; role?: string }
export type EstagioP = { id: string; nome: string; ganho?: boolean; perdido?: boolean; pipelineId?: string }
export type PipelineP = { id: string; nome: string; ordem?: number }
export type MensagemEnviada = { tel: string; em: string; autor?: string }

// ── Funis da clínica ─────────────────────────────────────────────────────────
// O perfil clínica semeia "Agendamentos" (entrada do lead) e "Tratamentos" (a
// venda na cadeira). Acha pelo NOME (a equipe pode reordenar); sem nome
// reconhecível, cai na ordem: o 1º é a entrada, o 2º é o de tratamento.
export function pipelinesDaClinica(pipelines: PipelineP[]): { entrada?: string; tratamentos?: string } {
  const lista = [...(pipelines || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  const achar = (trecho: string) => lista.find(p => normNome(p.nome).includes(trecho))?.id
  const tratamentos = achar('tratament') ?? lista[1]?.id
  const entrada = achar('agendament') ?? lista.find(p => p.id !== tratamentos)?.id
  return { entrada, tratamentos }
}

// ── Nova × retorno ───────────────────────────────────────────────────────────
const CONTA_COMO_CONSULTA = new Set(['agendado', 'confirmado', 'atendido'])

export function classificarNovaRetorno(agendamentos: AgendamentoP[], contatos: ContatoP[] = []): Map<string, 'nova' | 'retorno'> {
  const anotado = new Set((contatos || []).filter(c => String(c?.ultimoProcedimento || '').trim()).map(c => c.id))
  const porContato = new Map<string, { id: string; t: number }[]>()
  for (const a of agendamentos || []) {
    if (!a?.contatoId || !CONTA_COMO_CONSULTA.has(a.status)) continue
    const v = tempo(a.dataInicio)
    if (!Number.isFinite(v)) continue
    const arr = porContato.get(a.contatoId)
    arr ? arr.push({ id: a.id, t: v }) : porContato.set(a.contatoId, [{ id: a.id, t: v }])
  }
  const saida = new Map<string, 'nova' | 'retorno'>()
  for (const a of agendamentos || []) {
    if (!a?.id) continue
    let retorno = false
    if (a.contatoId) {
      if (anotado.has(a.contatoId)) retorno = true
      else {
        const v = tempo(a.dataInicio)
        retorno = Number.isFinite(v) && (porContato.get(a.contatoId) || []).some(b => b.id !== a.id && (b.t < v || (b.t === v && b.id < a.id)))
      }
    }
    saida.set(a.id, retorno ? 'retorno' : 'nova')
  }
  return saida
}

// ── Metas da semana (quantidade) ─────────────────────────────────────────────
export type MetasSemana = { consultasNovas: number; retornos: number; comparecimentos: number; atualizadoEm?: string; atualizadoPorNome?: string }

export function normalizaMetasSemana(bruta: any): MetasSemana {
  const n = (v: any) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x > 0 ? Math.min(x, 100000) : 0 }
  return {
    consultasNovas: n(bruta?.consultasNovas), retornos: n(bruta?.retornos), comparecimentos: n(bruta?.comparecimentos),
    ...(bruta?.atualizadoEm ? { atualizadoEm: String(bruta.atualizadoEm) } : {}),
    ...(bruta?.atualizadoPorNome ? { atualizadoPorNome: String(bruta.atualizadoPorNome).slice(0, 80) } : {}),
  }
}

// A meta da semana levada para um período qualquer, na proporção dos dias.
export function metaContagemNoIntervalo(semanal: number, de: Date, ate: Date): number {
  if (!(semanal > 0)) return 0
  const dias = Math.round((soData(ate) - soData(de)) / DIA) + 1
  return Math.max(1, Math.round(semanal * dias / 7))
}

export type ChaveCard = 'consultasNovas' | 'retornos' | 'comparecimentos' | 'tratamentos'
export type CardMeta = { chave: ChaveCard; realizado: number; meta: number; progresso: Progresso; faltas?: number; moeda?: boolean }

export function metasDoPeriodo(p: {
  agendamentos: AgendamentoP[]; contatos: ContatoP[]; negocios: NegocioP[]; pipelineTratamentosId?: string
  metasSemana: MetasSemana; metasAno?: MetaAno[]; de: Date; ate: Date; agora: Date
}): CardMeta[] {
  const classe = classificarNovaRetorno(p.agendamentos, p.contatos)
  const marcados = (p.agendamentos || []).filter(a => a.status !== 'cancelado' && noIntervalo(a.criadoEm, p.de, p.ate))
  const novas = marcados.filter(a => classe.get(a.id) === 'nova').length
  const retornos = marcados.length - novas
  const nesteDia = (a: AgendamentoP, st: string) => a.status === st && noIntervalo(a.dataInicio, p.de, p.ate)
  const comparecimentos = (p.agendamentos || []).filter(a => nesteDia(a, 'atendido')).length
  const faltas = (p.agendamentos || []).filter(a => nesteDia(a, 'faltou')).length
  const tratamentos = realizadoNoIntervalo(p.negocios || [], p.de, p.ate, p.pipelineTratamentosId || '').valor
  const metaR$ = Math.round((p.metasAno || []).reduce((s, m) => s + metaIntervalo(m, p.de, p.ate), 0) * 100) / 100
  const card = (chave: ChaveCard, realizado: number, meta: number, extra: Partial<CardMeta> = {}): CardMeta =>
    ({ chave, realizado, meta, progresso: progresso(meta, realizado, p.de, p.ate, p.agora), ...extra })
  return [
    card('consultasNovas', novas, metaContagemNoIntervalo(p.metasSemana.consultasNovas, p.de, p.ate)),
    card('retornos', retornos, metaContagemNoIntervalo(p.metasSemana.retornos, p.de, p.ate)),
    card('comparecimentos', comparecimentos, metaContagemNoIntervalo(p.metasSemana.comparecimentos, p.de, p.ate), { faltas }),
    card('tratamentos', tratamentos, metaR$, { moeda: true }),
  ]
}

// ── Semana da comercial ──────────────────────────────────────────────────────
// Follow-up de verdade: tarefas de retorno/confirmação/orçamento (os passos da
// ficha viram tarefa do tipo retorno) e os toques registrados na oportunidade.
export const TIPOS_TAREFA_FOLLOWUP = ['confirmacao_agenda', 'retorno_paciente', 'followup_orcamento']
export const TIPOS_TOQUE = ['nota', 'ligacao', 'whatsapp', 'email', 'reuniao']
export const CHAVE_SEM_AUTOR = '__celular__'

export type LinhaComercial = {
  chave: string; nome: string; papel?: string
  conversas: number; followupsFeitos: number; followupsAtrasados: number; agendou: number; veio: number
  conversao: number | null // agendou ÷ conversas, em %
  semAutor?: boolean
}

export function semanaDaComercial(p: {
  usuarios: UsuarioP[]; agendamentos: AgendamentoP[]; tarefas: TarefaP[]; negocios: NegocioP[]; mensagens: MensagemEnviada[]
  de: Date; ate: Date; agora: Date
}): LinhaComercial[] {
  const porEmail = new Map<string, UsuarioP>()
  const porNome = new Map<string, UsuarioP>()
  for (const u of p.usuarios || []) {
    if (!u?.email) continue
    porEmail.set(u.email.toLowerCase(), u)
    if (u.nome) porNome.set(normNome(u.nome), u)
  }
  // Uma PESSOA a partir do que cada fonte guarda: tarefa e dono têm e-mail;
  // atividade, mensagem e agendamento guardam o nome (ou o e-mail).
  const quem = (email?: string, nome?: string): { chave: string; nome: string; papel?: string } | null => {
    const e = String(email || '').trim().toLowerCase()
    const n = String(nome || '').trim()
    const u = (e && porEmail.get(e)) || (n.includes('@') ? porEmail.get(n.toLowerCase()) : undefined) || (n ? porNome.get(normNome(n)) : undefined)
    if (u) return { chave: u.email.toLowerCase(), nome: u.nome || u.email, papel: u.role }
    if (n) return { chave: 'nome:' + normNome(n), nome: n }
    if (e) return { chave: e, nome: e }
    return null
  }
  const linhas = new Map<string, LinhaComercial>()
  const linha = (pessoa: { chave: string; nome: string; papel?: string }) => {
    let l = linhas.get(pessoa.chave)
    if (!l) { l = { chave: pessoa.chave, nome: pessoa.nome, papel: pessoa.papel, conversas: 0, followupsFeitos: 0, followupsAtrasados: 0, agendou: 0, veio: 0, conversao: null }; linhas.set(pessoa.chave, l) }
    return l
  }
  // A comercial aparece mesmo com a semana zerada: zero também é informação.
  for (const u of p.usuarios || []) if (u?.email && u.role === 'vendas') linha({ chave: u.email.toLowerCase(), nome: u.nome || u.email, papel: u.role })

  const limite = Math.min(p.agora.getTime(), p.ate.getTime())
  const dentro = (iso?: string) => noIntervalo(iso, p.de, p.ate)

  // Conversas: telefones distintos que receberam mensagem da pessoa no período.
  const telsPorPessoa = new Map<string, Set<string>>()
  const telsSemAutor = new Set<string>()
  for (const m of p.mensagens || []) {
    if (!m?.tel || !dentro(m.em)) continue
    const pessoa = quem(undefined, m.autor)
    if (!pessoa) { telsSemAutor.add(m.tel); continue }
    linha(pessoa)
    const s = telsPorPessoa.get(pessoa.chave)
    s ? s.add(m.tel) : telsPorPessoa.set(pessoa.chave, new Set([m.tel]))
  }
  telsPorPessoa.forEach((s, chave) => { linhas.get(chave)!.conversas = s.size })

  for (const t of p.tarefas || []) {
    if (!TIPOS_TAREFA_FOLLOWUP.includes(String(t?.tipo || ''))) continue
    const pessoa = quem(t.responsavelEmail, t.responsavelNome)
    if (!pessoa) continue
    if (t.status === 'concluido') { if (dentro(t.concluidoEm)) linha(pessoa).followupsFeitos++ }
    else if (t.status !== 'descartado' && Number.isFinite(fimDoDiaYmd(t.prazo)) && fimDoDiaYmd(t.prazo) < limite) linha(pessoa).followupsAtrasados++
  }

  for (const n of p.negocios || []) {
    for (const a of n.atividades || []) {
      if (!TIPOS_TOQUE.includes(String(a?.tipo || '')) || !dentro(a.criadoEm)) continue
      const pessoa = quem(undefined, a.autor) || quem(n.dono, n.donoNome)
      if (pessoa) linha(pessoa).followupsFeitos++
    }
    const dono = quem(n.dono, n.donoNome)
    for (const c of n.agendamentos || []) {
      if (c?.feito) {
        if (dentro(c.feitoEm)) { const pessoa = quem(undefined, c.feitoPor) || dono; if (pessoa) linha(pessoa).followupsFeitos++ }
      } else if (n.status === 'aberto' && dono && Number.isFinite(fimDoDiaYmd(c?.quando)) && fimDoDiaYmd(c?.quando) < limite) linha(dono).followupsAtrasados++
    }
    if (n.status === 'aberto' && dono && n.proximoFollowUp && Number.isFinite(fimDoDiaYmd(n.proximoFollowUp)) && fimDoDiaYmd(n.proximoFollowUp) < limite) linha(dono).followupsAtrasados++
  }

  for (const a of p.agendamentos || []) {
    const pessoa = quem(undefined, a?.criadoPor)
    if (!pessoa) continue
    if (a.status !== 'cancelado' && dentro(a.criadoEm)) linha(pessoa).agendou++
    if (a.status === 'atendido' && dentro(a.dataInicio)) linha(pessoa).veio++
  }

  const saida = Array.from(linhas.values()).map(l => ({ ...l, conversao: l.conversas > 0 ? Math.round((l.agendou / l.conversas) * 100) : null }))
  const peso = (l: LinhaComercial) => l.conversas + l.followupsFeitos + l.agendou + l.veio
  saida.sort((a, b) => ((b.papel === 'vendas' ? 1 : 0) - (a.papel === 'vendas' ? 1 : 0)) || (peso(b) - peso(a)) || a.nome.localeCompare(b.nome, 'pt'))
  if (telsSemAutor.size) saida.push({ chave: CHAVE_SEM_AUTOR, nome: '', conversas: telsSemAutor.size, followupsFeitos: 0, followupsAtrasados: 0, agendou: 0, veio: 0, conversao: null, semAutor: true })
  return saida
}

// ── Oportunidades paradas ────────────────────────────────────────────────────
// Telefone vira chave DDD + 8 últimos dígitos: o WhatsApp às vezes guarda o
// celular sem o 9 da frente, e a ficha guarda com — os dois casam aqui.
export function chaveTelefone(tel?: string): string {
  const d = telefoneWhatsApp(tel)
  return d.length >= 12 ? d.slice(2, 4) + d.slice(-8) : ''
}

export type Parado = { negocioId: string; titulo: string; contatoId?: string; nome: string; telefone?: string; estagio: string; pipeline: string; dias: number; ultimoToque: string; dono?: string }

export function paradosHaDias(p: {
  negocios: NegocioP[]; contatos: ContatoP[]; estagios: EstagioP[]; pipelines: PipelineP[]
  ultimaMsgPorTel?: Record<string, string>; ultimaMsgPorContato?: Record<string, string>
  agora: Date; dias?: number; limite?: number
}): { itens: Parado[]; total: number } {
  const minimo = p.dias ?? 7
  const contato = new Map((p.contatos || []).map(c => [c.id, c]))
  const estagio = new Map((p.estagios || []).map(e => [e.id, e]))
  const pipeline = new Map((p.pipelines || []).map(x => [x.id, x]))
  const msgTel = new Map<string, number>()
  for (const [tel, iso] of Object.entries(p.ultimaMsgPorTel || {})) {
    const k = chaveTelefone(tel), v = tempo(iso)
    if (k && Number.isFinite(v) && v > (msgTel.get(k) ?? -Infinity)) msgTel.set(k, v)
  }
  const todos: Parado[] = []
  for (const n of p.negocios || []) {
    const e = estagio.get(String(n.estagioId || ''))
    if (n.status !== 'aberto' || e?.ganho || e?.perdido) continue
    const c = n.contatoId ? contato.get(n.contatoId) : undefined
    const toques = [
      tempo(n.criadoEm),
      ...(n.atividades || []).map(a => tempo(a.criadoEm)),
      ...(n.agendamentos || []).map(a => tempo(a.feitoEm)),
      tempo(c?.ultimoContato),
      tempo(n.contatoId ? p.ultimaMsgPorContato?.[n.contatoId] : undefined),
      c?.telefone ? (msgTel.get(chaveTelefone(c.telefone)) ?? NaN) : NaN,
    ].filter(Number.isFinite)
    if (!toques.length) continue
    const ultimo = Math.max(...toques)
    const dias = Math.floor((soData(p.agora) - soData(new Date(ultimo))) / DIA)
    if (dias < minimo) continue
    todos.push({
      negocioId: n.id, titulo: n.titulo || '', contatoId: n.contatoId, nome: c?.nome || n.titulo || '', telefone: c?.telefone,
      estagio: e?.nome || '', pipeline: pipeline.get(String(n.pipelineId || e?.pipelineId || ''))?.nome || '',
      dias, ultimoToque: new Date(ultimo).toISOString(), dono: n.donoNome,
    })
  }
  todos.sort((a, b) => b.dias - a.dias || a.nome.localeCompare(b.nome, 'pt'))
  return { itens: todos.slice(0, p.limite ?? 10), total: todos.length }
}

// ── Funil do mês ─────────────────────────────────────────────────────────────
export type FunilMes = { entraram: number; agendaram: number; compareceram: number; fecharam: number; valorFechado: number }

export function funilDoMes(p: {
  negocios: NegocioP[]; agendamentos: AgendamentoP[]; contatos: ContatoP[]
  // Oportunidade sem `pipelineId` mora no funil padrão (o 1º da lista), como no quadro.
  pipelineEntradaId?: string; pipelineTratamentosId?: string; pipelinePadraoId?: string; de: Date; ate: Date
}): FunilMes {
  const classe = classificarNovaRetorno(p.agendamentos, p.contatos)
  const nova = (a: AgendamentoP) => classe.get(a.id) === 'nova'
  const padrao = p.pipelinePadraoId || p.pipelineEntradaId
  const entraram = (p.negocios || []).filter(n => (!p.pipelineEntradaId || (n.pipelineId || padrao) === p.pipelineEntradaId) && noIntervalo(n.criadoEm, p.de, p.ate)).length
  const agendaram = (p.agendamentos || []).filter(a => a.status !== 'cancelado' && nova(a) && noIntervalo(a.criadoEm, p.de, p.ate)).length
  const compareceram = (p.agendamentos || []).filter(a => a.status === 'atendido' && nova(a) && noIntervalo(a.dataInicio, p.de, p.ate)).length
  const r = realizadoNoIntervalo(p.negocios || [], p.de, p.ate, p.pipelineTratamentosId || '')
  return { entraram, agendaram, compareceram, fecharam: r.qtd, valorFechado: r.valor }
}

// Conversão entre duas etapas do funil, em %. Sem base, não há conversão.
export const conversao = (de: number, para: number): number | null => (de > 0 ? Math.round((para / de) * 100) : null)

// ── Filtro do quadro por mês ─────────────────────────────────────────────────
// O quadro do mês mostra: o que ENTROU no mês, o que FECHOU no mês (ganho ou
// perdido) e, com a chave ligada (padrão), o que segue ABERTO de antes. Assim
// nada aberto some, e Ganho/Perdido deixam de acumular desde sempre.
export function dataDaPerda(n: NegocioP): string {
  const perda = (n.atividades || []).filter(a => a.tipo === 'perdido' && a.criadoEm).pop()
  return perda?.criadoEm || n.atualizadoEm || n.criadoEm || ''
}

export function passaMesFunil(n: NegocioP, de: Date, ate: Date, incluirAbertasDeAntes = true): boolean {
  if (noIntervalo(n.criadoEm, de, ate)) return true
  if (n.status === 'ganho') return noIntervalo(dataDoGanho(n), de, ate)
  if (n.status === 'perdido') return noIntervalo(dataDaPerda(n), de, ate)
  if (!incluirAbertasDeAntes) return false
  const criado = tempo(n.criadoEm)
  return !Number.isFinite(criado) || criado < de.getTime()
}

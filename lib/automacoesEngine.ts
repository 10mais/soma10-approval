import { redis, Automacao, AutomacaoCondicao, AutomacaoPasso, Tarefa, Marco, Cliente, Usuario } from './redis'
import { notificar, notificarEquipe, notificarAdmins } from './notificacoes'
import { v4 as uuid } from 'uuid'

// Motor de automações FLEXÍVEL. Os catálogos (gatilhos/ações) ficam em
// ./automacoesCatalogo (client-safe); aqui fica o dispatcher + executor (server).
export { GATILHOS, ACOES } from './automacoesCatalogo'

// ============================================================================
// Utilidades
// ============================================================================

const interpolar = (txt: string, ctx: Record<string, any>): string =>
  String(txt || '').replace(/\{(\w+)\}/g, (_, k) => (ctx[k] != null ? String(ctx[k]) : ''))

async function carregarRegras(): Promise<Automacao[]> {
  const r = await redis.get<Automacao[]>('config:automacoesRegras')
  return Array.isArray(r) ? r : []
}

function escopoBate(regra: Automacao, ctx: Record<string, any>): boolean {
  const cid = ctx.clienteId as string | undefined
  if (regra.alvo === 'selecionados') return !!cid && (regra.clienteIds || []).includes(cid)
  // alvo 'todos' — com override de exclusão por cliente
  if (cid && (regra.clienteIdsExcluidos || []).includes(cid)) return false
  return true
}

function condBate(c: AutomacaoCondicao, ctx: Record<string, any>): boolean {
  const v = ctx[c.campo]
  const alvo = c.valor ?? ''
  switch (c.operador) {
    case 'preenchido': return v != null && String(v) !== ''
    case 'vazio': return v == null || String(v) === ''
    case 'igual': return String(v ?? '').toLowerCase() === alvo.toLowerCase()
    case 'diferente': return String(v ?? '').toLowerCase() !== alvo.toLowerCase()
    case 'contem': return String(v ?? '').toLowerCase().includes(alvo.toLowerCase())
    case 'maior': return Number(v) > Number(alvo)
    case 'menor': return Number(v) < Number(alvo)
    default: return true
  }
}

function avaliarCondicoes(regra: Automacao, ctx: Record<string, any>): boolean {
  const cs = regra.condicoes || []
  if (!cs.length) return true
  return regra.condicaoLogica === 'qualquer' ? cs.some(c => condBate(c, ctx)) : cs.every(c => condBate(c, ctx))
}

// ============================================================================
// Dispatcher — chamado nos pontos de evento do sistema. Best-effort: nunca lança.
// ============================================================================

export async function dispararEvento(gatilho: string, ctx: Record<string, any>): Promise<void> {
  try {
    const regras = (await carregarRegras()).filter(r => r.ativo && r.gatilho === gatilho && escopoBate(r, ctx) && avaliarCondicoes(r, ctx))
    for (const regra of regras) {
      for (let i = 0; i < regra.passos.length; i++) {
        const passo = regra.passos[i]
        const atraso = Math.max(0, Number(passo.atrasoDias) || 0)
        if (atraso === 0) {
          await executarPasso(passo, ctx).catch(() => {})
        } else {
          const dueAt = Date.now() + atraso * 86400000
          await redis.zadd('automacoes:pendentes', { score: dueAt, member: JSON.stringify({ regraId: regra.id, passoIndex: i, ctx }) }).catch(() => {})
        }
      }
    }
  } catch { /* automações nunca quebram a requisição principal */ }
}

// Processa a fila (chamado pelo cron). Retorna quantos passos rodaram.
export async function processarPendentes(): Promise<number> {
  const agora = Date.now()
  const vencidos = (await redis.zrange<string[]>('automacoes:pendentes', 0, agora, { byScore: true })) || []
  if (!vencidos.length) return 0
  const regras = await carregarRegras()
  let n = 0
  for (const membro of vencidos) {
    await redis.zrem('automacoes:pendentes', membro).catch(() => {})
    try {
      const { regraId, passoIndex, ctx } = JSON.parse(membro)
      const regra = regras.find(r => r.id === regraId)
      const passo = regra?.passos?.[passoIndex]
      if (regra?.ativo && passo) { await executarPasso(passo, ctx); n++ }
    } catch { /* item inválido, ignora */ }
  }
  return n
}

// ============================================================================
// Executor de ações
// ============================================================================

async function executarPasso(passo: AutomacaoPasso, ctx: Record<string, any>): Promise<void> {
  const p = passo.params || {}
  switch (passo.acao) {
    case 'criar_tarefa': return criarTarefa(p, ctx)
    case 'criar_marco': return criarMarco(p, ctx)
    case 'notificar': return acaoNotificar(p, ctx)
    case 'enviar_email': return enviarEmail(p, ctx)
    case 'atribuir_responsavel': return atribuirResponsavel(p, ctx)
  }
}

async function clienteDe(ctx: Record<string, any>): Promise<Cliente | null> {
  return ctx.clienteId ? await redis.get<Cliente>(`cliente:${ctx.clienteId}`).catch(() => null) : null
}

async function criarTarefa(p: any, ctx: Record<string, any>) {
  const agora = new Date().toISOString()
  const respEmail = p.responsavel === 'especifico' ? (p.responsavelEmail || '') : (ctx.responsavelEmail || ctx.donoEmail || '')
  let respNome = ''
  if (respEmail) { const u = await redis.get<Usuario>(`usuario:${respEmail}`).catch(() => null); respNome = u?.nome || '' }
  const tarefa: Tarefa = {
    id: uuid(),
    titulo: interpolar(p.titulo, ctx) || 'Tarefa automática',
    descricao: '', tipo: p.tipo || 'tarefa', status: 'a_fazer', prioridade: p.prioridade || 'media',
    responsavelEmail: respEmail, responsavelNome: respNome,
    clienteId: ctx.clienteId || '', clienteNome: ctx.clienteNome || '',
    marcoId: '', prazo: '', criadoPor: 'Automação', criadoEm: agora, atualizadoEm: agora,
    atividades: [{ id: uuid(), tipo: 'criacao', descricao: 'Criada por automação', autor: 'Automação', criadoEm: agora }],
    comentarios: [],
  }
  await redis.set(`tarefa:${tarefa.id}`, tarefa)
  await redis.sadd('tarefas', tarefa.id)
  if (respEmail) await notificar(respEmail, 'tarefa_atribuida', 'Nova tarefa (automação)', tarefa.titulo, undefined, tarefa.id).catch(() => {})
}

async function criarMarco(p: any, ctx: Record<string, any>) {
  if (!ctx.clienteId) return
  const agora = new Date().toISOString()
  const marco: Marco = {
    id: uuid(), clienteId: ctx.clienteId, clienteNome: ctx.clienteNome || '',
    titulo: interpolar(p.titulo, ctx) || 'Etapa', descricao: '',
    categoria: (p.categoria || 'outro') as any, status: 'planejado',
    dataInicio: agora.slice(0, 10), atualizadoEm: agora,
  } as Marco
  await redis.set(`marco:${marco.id}`, marco)
  await redis.sadd('marcos', marco.id)
}

async function acaoNotificar(p: any, ctx: Record<string, any>) {
  const titulo = interpolar(p.titulo, ctx) || 'Automação'
  const msg = interpolar(p.mensagem, ctx)
  if (p.destino === 'equipe') return void notificarEquipe('geral', titulo, msg).catch(() => {})
  if (p.destino === 'admins') return void notificarAdmins('geral', titulo, msg).catch(() => {})
  if (p.destino === 'responsavel') {
    const email = ctx.responsavelEmail || ctx.donoEmail
    if (email) await notificar(email, 'geral', titulo, msg).catch(() => {})
    return
  }
  if (p.destino === 'cliente') {
    const c = await clienteDe(ctx)
    if (c?.loginEmail) await notificar(c.loginEmail, 'geral', titulo, msg).catch(() => {})
  }
}

async function enviarEmail(p: any, ctx: Record<string, any>) {
  if (!process.env.SMTP_USER) return
  let para = ''
  if (p.para === 'custom') para = interpolar(p.email, ctx)
  else { const c = await clienteDe(ctx); para = c?.loginEmail || '' }
  if (!para) return
  const nodemailer = (await import('nodemailer')).default
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.titan.email', port: Number(process.env.SMTP_PORT) || 587, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
  await transporter.sendMail({
    from: `"Soma10" <${process.env.SMTP_USER}>`, to: para,
    subject: interpolar(p.assunto, ctx) || 'Soma10',
    text: interpolar(p.corpo, ctx),
  }).catch(() => {})
}

async function atribuirResponsavel(p: any, ctx: Record<string, any>) {
  if (!ctx.tarefaId || !p.responsavelEmail) return
  const t = await redis.get<Tarefa>(`tarefa:${ctx.tarefaId}`).catch(() => null)
  if (!t) return
  const u = await redis.get<Usuario>(`usuario:${p.responsavelEmail}`).catch(() => null)
  await redis.set(`tarefa:${ctx.tarefaId}`, { ...t, responsavelEmail: p.responsavelEmail, responsavelNome: u?.nome || '', atualizadoEm: new Date().toISOString() })
  await notificar(p.responsavelEmail, 'tarefa_atribuida', 'Tarefa atribuída (automação)', t.titulo, undefined, t.id).catch(() => {})
}

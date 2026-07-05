import { redis, Notificacao, TipoNotificacao, Usuario } from './redis'
import { v4 as uuid } from 'uuid'
import { enviarPush } from './webpush'
import { NOTIF_OBRIGATORIOS } from './notificacoesCatalogo'

// Janela (segundos) do "avisar uma vez só": ao chegar várias juntas, só a
// primeira dispara push; as demais entram no Inbox sem novo ping (anti-spam).
const JANELA_PUSH = 60

// Para onde o clique na notificação push deve levar, por tipo.
function urlDaNotificacao(tipo: TipoNotificacao): string {
  if (tipo.startsWith('tarefa_')) return '/dashboard'
  if (tipo === 'mensagem_privada') return '/dashboard'
  return '/dashboard'
}

// Preferências: admin desliga tipos globalmente; usuário silencia os seus + canal push.
export type NotifConfig = { desabilitados?: string[] }
export type NotifPrefs = { mutados?: string[]; pushDesligado?: boolean }
export async function getNotifConfig(): Promise<NotifConfig> {
  return (await redis.get<NotifConfig>('config:notificacoes')) || {}
}
export async function getNotifPrefs(email: string): Promise<NotifPrefs> {
  return (await redis.get<NotifPrefs>(`notif:prefs:${email}`)) || {}
}

// Cria uma notificação para um destinatário específico (e-mail de usuário)
export async function notificar(destinatarioEmail: string, tipo: TipoNotificacao, titulo: string, mensagem: string, postId?: string, tarefaId?: string) {
  // Obrigatória (atribuída a você / mensagem privada): fura mute e desligamento.
  const obrigatoria = NOTIF_OBRIGATORIOS.includes(tipo)
  // Admin desligou este tipo globalmente? Não gera para ninguém (exceto obrigatórias).
  const cfg = await getNotifConfig().catch(() => ({} as NotifConfig))
  if (!obrigatoria && cfg.desabilitados?.includes(tipo)) return null
  // Usuário silenciou este tipo? Não gera para ele (exceto obrigatórias).
  const prefs = await getNotifPrefs(destinatarioEmail).catch(() => ({} as NotifPrefs))
  if (!obrigatoria && prefs.mutados?.includes(tipo)) return null

  const notificacao: Notificacao = {
    id: uuid(),
    destinatarioEmail,
    tipo,
    titulo,
    mensagem,
    postId,
    tarefaId,
    lida: false,
    criadoEm: new Date().toISOString(),
  }
  await redis.set(`notificacao:${notificacao.id}`, notificacao)
  await redis.sadd(`notificacoes:${destinatarioEmail}`, notificacao.id)

  // Push (best-effort) com "avisar uma vez só":
  // - obrigatória: sempre pinga e (re)abre a janela, segurando os próximos avisos;
  // - demais: só pinga se o push estiver ligado E for a primeira da janela.
  const push = { title: titulo, body: mensagem, url: urlDaNotificacao(tipo), tag: notificacao.id }
  const janelaKey = `push_janela:${destinatarioEmail}`
  if (obrigatoria) {
    await redis.set(janelaKey, '1', { ex: JANELA_PUSH }).catch(() => {})
    enviarPush(destinatarioEmail, push).catch(() => {})
  } else if (!prefs.pushDesligado) {
    const primeira = await redis.set(janelaKey, '1', { nx: true, ex: JANELA_PUSH }).catch(() => null)
    if (primeira) enviarPush(destinatarioEmail, push).catch(() => {})
  }
  return notificacao
}

// Notifica toda a equipe interna (admins e gerentes) — usado para falhas de publicacao e eventos do sistema
export async function notificarEquipe(tipo: TipoNotificacao, titulo: string, mensagem: string, postId?: string) {
  const emails = await redis.smembers('usuarios')
  const usuarios = (await Promise.all(emails.map(e => redis.get<Usuario>(`usuario:${e}`)))).filter(Boolean) as Usuario[]
  const equipe = usuarios.filter(u => u.role === 'admin' || u.role === 'gerente')
  await Promise.all(equipe.map(u => notificar(u.email, tipo, titulo, mensagem, postId)))
}

// Notifica APENAS administradores (ex.: Pessoas e Cultura / candidaturas).
export async function notificarAdmins(tipo: TipoNotificacao, titulo: string, mensagem: string, postId?: string) {
  const emails = await redis.smembers('usuarios')
  const usuarios = (await Promise.all(emails.map(e => redis.get<Usuario>(`usuario:${e}`)))).filter(Boolean) as Usuario[]
  const admins = usuarios.filter(u => u.role === 'admin')
  await Promise.all(admins.map(u => notificar(u.email, tipo, titulo, mensagem, postId)))
}

// Notifica apenas o dono da atividade (quem criou o post). Se nao encontrar, notifica a equipe como fallback.
export async function notificarDono(criadoPor: string | undefined, tipo: TipoNotificacao, titulo: string, mensagem: string, postId?: string) {
  if (!criadoPor) return notificarEquipe(tipo, titulo, mensagem, postId)
  // criadoPor e o nome; preciso achar o email
  const emails = await redis.smembers('usuarios')
  const usuarios = (await Promise.all(emails.map(e => redis.get<Usuario>(`usuario:${e}`)))).filter(Boolean) as Usuario[]
  const dono = usuarios.find(u => u.nome === criadoPor)
  if (dono) return notificar(dono.email, tipo, titulo, mensagem, postId)
  // Fallback: notifica a equipe se nao achar o usuario
  return notificarEquipe(tipo, titulo, mensagem, postId)
}

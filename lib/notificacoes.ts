import { redis, Notificacao, TipoNotificacao, Usuario } from './redis'
import { v4 as uuid } from 'uuid'
import { enviarPush } from './webpush'

// Para onde o clique na notificação push deve levar, por tipo.
function urlDaNotificacao(tipo: TipoNotificacao): string {
  if (tipo.startsWith('tarefa_')) return '/dashboard'
  if (tipo === 'mensagem_privada') return '/dashboard'
  return '/dashboard'
}

// Cria uma notificação para um destinatário específico (e-mail de usuário)
export async function notificar(destinatarioEmail: string, tipo: TipoNotificacao, titulo: string, mensagem: string, postId?: string, tarefaId?: string) {
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
  // Push (best-effort): não bloqueia nem quebra a criação da notificação
  enviarPush(destinatarioEmail, { title: titulo, body: mensagem, url: urlDaNotificacao(tipo), tag: notificacao.id }).catch(() => {})
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

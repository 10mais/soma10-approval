// Histórico do assistente/agentes de IA.
//
// Antes as conversas viviam só no sessionStorage do navegador: fechou a aba,
// acabou; trocou de agente, apagou; abriu no celular, não existia. O dono pediu
// (2026-07-16) que cada conversa fique salva — "podemos reaproveitar a qualquer
// momento".
//
// É PRIVADO por usuário: conversa de IA tem rascunho de proposta, dado de
// cliente e pergunta que ninguém faria em público. O índice é por e-mail e a
// rota nunca lê conversa de outro (nem admin — ninguém pediu bisbilhotar).

import { redis } from './redis'

export type MsgSalva = {
  role: 'user' | 'assistant'
  content: string
  imagens?: string[]
  propostas?: unknown[] // cartões de ação (Fase 2) — histórico, não re-executam
}

export type ConversaIA = {
  id: string
  email: string
  agenteId?: string
  agenteNome?: string
  titulo: string
  mensagens: MsgSalva[]
  criadoEm: string
  atualizadoEm: string
}

// Só o cabeçalho, para a lista do histórico não baixar todo o texto de todas.
export type ConversaResumo = Pick<ConversaIA, 'id' | 'titulo' | 'agenteId' | 'agenteNome' | 'atualizadoEm'>

// Teto por conversa: uma thread infinita estouraria o registro do Redis. 200
// mensagens é muito mais que qualquer conversa real — e corta do começo, que é
// o que menos importa quando se retoma.
const MAX_MSGS = 200

export const chaveConversa = (id: string) => `ia:conversa:${id}`
export const chaveIndice = (email: string) => `ia:conversas:${email.toLowerCase()}`

// Título = a primeira coisa que a pessoa perguntou. É como ela vai reconhecer a
// conversa na lista — data não diz nada.
export function tituloDe(mensagens: MsgSalva[]): string {
  const primeira = mensagens.find(m => m.role === 'user' && String(m.content || '').trim())
  const t = String(primeira?.content || '').trim().replace(/\s+/g, ' ')
  if (!t) return 'Conversa sem título'
  return t.length > 70 ? `${t.slice(0, 70)}…` : t
}

export function limitarMensagens(mensagens: MsgSalva[]): MsgSalva[] {
  return mensagens.length > MAX_MSGS ? mensagens.slice(-MAX_MSGS) : mensagens
}

export async function listarConversas(email: string): Promise<ConversaResumo[]> {
  const ids = await redis.smembers(chaveIndice(email))
  if (!ids.length) return []
  const convs = ((await redis.mget<(ConversaIA | null)[]>(...ids.map(chaveConversa))).filter(Boolean) as ConversaIA[])
  return convs
    .map(c => ({ id: c.id, titulo: c.titulo, agenteId: c.agenteId, agenteNome: c.agenteNome, atualizadoEm: c.atualizadoEm }))
    .sort((a, b) => new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime())
}

export async function lerConversa(id: string, email: string): Promise<ConversaIA | null> {
  const c = await redis.get<ConversaIA>(chaveConversa(id))
  if (!c || c.email.toLowerCase() !== email.toLowerCase()) return null // conversa é de quem escreveu
  return c
}

export async function salvarConversa(c: ConversaIA): Promise<ConversaIA> {
  const salvo: ConversaIA = { ...c, mensagens: limitarMensagens(c.mensagens), titulo: c.titulo || tituloDe(c.mensagens) }
  await redis.set(chaveConversa(salvo.id), salvo)
  await redis.sadd(chaveIndice(salvo.email), salvo.id)
  return salvo
}

export async function excluirConversa(id: string, email: string): Promise<boolean> {
  const c = await lerConversa(id, email)
  if (!c) return false
  await redis.del(chaveConversa(id))
  await redis.srem(chaveIndice(email), id)
  return true
}

import { redis } from './redis'
import type { Cliente } from './redis'

// Instagram Direct (Messaging API) — caminho "API do Instagram com login do Instagram"
// (graph.instagram.com). O envio usa o token DO CLIENTE dono da conta
// (cliente.instagramToken), não um token único no env como o WhatsApp.
// Sem token/permissão aprovada (instagram_business_manage_messages), o envio é no-op seguro.
//   INSTAGRAM_VERIFY_TOKEN — string que você escolhe; mesma no painel da Meta (webhook)
//   META_API_VERSION_PUBLISH (opcional) — versão da Graph API (default v21.0)

export type IgMensagem = { id: string; de: 'cliente' | 'agente'; texto: string; em: string; autor?: string }
// contaId = a conta que RECEBEU a DM (agência ou cliente); usado para achar o token de envio.
export type IgConversa = { id: string; contaId?: string; nome?: string; username?: string; contatoId?: string; clienteId?: string; ultimaMsg?: string; ultimaEm?: string; naoLidas?: number }

// Conta de mensagens conectada da PRÓPRIA AGÊNCIA (não é um cliente). Ex.: o Instagram
// da agência usado para o atendimento no CRM. Guardadas em config:contasMensagensIg.
export type ContaMensagemIg = { userId: string; username?: string; nome?: string; token: string; em: string }

export async function salvarContaMensagemIg(conta: ContaMensagemIg) {
  const atuais = (await redis.get<ContaMensagemIg[]>('config:contasMensagensIg')) || []
  const outras = atuais.filter(c => c.userId !== conta.userId)
  await redis.set('config:contasMensagensIg', [...outras, conta])
}
export async function listarContasMensagemIg(): Promise<ContaMensagemIg[]> {
  return (await redis.get<ContaMensagemIg[]>('config:contasMensagensIg')) || []
}
export async function removerContaMensagemIg(userId: string) {
  const atuais = await listarContasMensagemIg()
  await redis.set('config:contasMensagensIg', atuais.filter(c => c.userId !== userId))
}

// Resolve a conta (agência OU cliente) dona de um IG id -> token + info. A agência tem
// prioridade; se não achar, cai no cliente conectado (instagramUserId/BusinessId/pageId).
export async function resolverContaIg(igId: string): Promise<{ token: string; clienteId?: string; nome?: string } | null> {
  const id = String(igId || '').trim()
  if (!id) return null
  const contas = await listarContasMensagemIg()
  const c = contas.find(x => x.userId === id)
  if (c?.token) return { token: c.token, nome: c.nome || c.username }
  const cli = await clientePorInstagramId(id)
  if (cli) {
    const t = cli.instagramToken || cli.facebookPageToken
    if (t) return { token: t, clienteId: cli.id, nome: cli.nome }
  }
  return null
}

// Salva uma mensagem na conversa (por IG user id) e atualiza metadados/índice.
export async function salvarMensagemIg(igUserId: string, msg: IgMensagem, extra?: Partial<IgConversa>) {
  const id = String(igUserId || '').trim()
  if (!id) return
  await redis.rpush(`ig:msgs:${id}`, JSON.stringify(msg))
  await redis.sadd('ig:conversas', id)
  const atual = (await redis.get<IgConversa>(`ig:conversa:${id}`)) || { id }
  const conversa: IgConversa = {
    ...atual, ...extra, id,
    ultimaMsg: msg.texto.slice(0, 120), ultimaEm: msg.em,
    naoLidas: msg.de === 'cliente' ? (atual.naoLidas || 0) + 1 : (extra?.naoLidas ?? atual.naoLidas ?? 0),
  }
  await redis.set(`ig:conversa:${id}`, conversa)
}

// Encontra o cliente dono de uma conta IG (pelo id do negócio recebido no webhook).
export async function clientePorInstagramId(contaId: string): Promise<Cliente | null> {
  const bid = String(contaId || '').trim()
  if (!bid) return null
  const ids = await redis.smembers('clientes')
  for (const id of ids) {
    const c = await redis.get<Cliente>(`cliente:${id}`)
    // Login do Instagram salva o id em instagramUserId; caminho da Pagina usa instagramBusinessId/facebookPageId
    if (c && (c.instagramUserId === bid || c.instagramBusinessId === bid || c.facebookPageId === bid)) return c
  }
  return null
}

// Envia uma DM ao usuário do Instagram usando o token da conta (agência ou cliente).
// Caminho "Instagram Login": POST em graph.instagram.com/{versao}/me/messages.
export async function enviarDMInstagram(token: string, igUserId: string, texto: string, autor?: string): Promise<{ ok: boolean; erro?: string }> {
  const id = String(igUserId || '').trim()
  if (!id) return { ok: false, erro: 'destinatário inválido' }
  if (!token) return { ok: false, erro: 'Instagram não conectado (sem token)' }
  const versao = process.env.META_API_VERSION_PUBLISH || 'v21.0'
  try {
    const r = await fetch(`https://graph.instagram.com/${versao}/me/messages?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id }, message: { text: texto } }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return { ok: false, erro: d?.error?.message || `HTTP ${r.status}` }
    await salvarMensagemIg(id, { id: d?.message_id || crypto.randomUUID(), de: 'agente', texto, em: new Date().toISOString(), autor })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, erro: e?.message || String(e) }
  }
}

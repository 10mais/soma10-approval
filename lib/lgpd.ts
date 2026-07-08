import { redis, Cliente, Plano, Tarefa, Marco, BriefingCampanha, NpsResposta } from './redis'
import { getPostsDoCliente } from './postsIndex'

// LGPD: portabilidade (exportar) e direito ao esquecimento (apagar) dos dados de
// UM cliente. Tudo escopado por `clienteId` — nunca toca em dados de outros.

async function porClienteId<T>(setKey: string, prefix: string, clienteId: string): Promise<T[]> {
  const ids = await redis.smembers(setKey)
  if (!ids.length) return []
  const all = (await redis.mget<(T | null)[]>(...ids.map(i => `${prefix}:${i}`))).filter(Boolean) as T[]
  return all.filter(x => (x as any).clienteId === clienteId)
}

// Exportação (read-only) — todos os dados do cliente num JSON.
export async function exportarCliente(clienteId: string): Promise<any | null> {
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return null
  const [posts, planos, tarefas, marcos, briefings] = await Promise.all([
    getPostsDoCliente(clienteId),
    porClienteId<Plano>('planos', 'plano', clienteId),
    porClienteId<Tarefa>('tarefas', 'tarefa', clienteId),
    porClienteId<Marco>('marcos', 'marco', clienteId),
    porClienteId<BriefingCampanha>('briefings', 'briefing', clienteId),
  ])
  const npsIds = await redis.smembers(`cliente:${clienteId}:nps`)
  const nps = npsIds.length ? ((await redis.mget<(NpsResposta | null)[]>(...npsIds.map(i => `nps:${i}`))).filter(Boolean) as NpsResposta[]) : []
  const logIds = (await redis.zrange<string[]>(`logs:cliente:${clienteId}`, 0, -1)) || []
  const logs = logIds.length ? ((await redis.mget<any[]>(...logIds.map(i => `log:${i}`))).filter(Boolean)) : []

  // Nunca exporta segredos (senha em claro não existe mais; tokens/segredos ficam de fora).
  const { loginSenha, statusToken, aprovacaoToken, npsToken, facebookPageToken, instagramToken, ...clienteLimpo } = cliente as any

  return {
    _meta: {
      clienteId, clienteNome: cliente.nome, geradoEm: new Date().toISOString(),
      contagens: { posts: posts.length, planos: planos.length, tarefas: tarefas.length, marcos: marcos.length, briefings: briefings.length, nps: nps.length, logs: logs.length },
    },
    cliente: clienteLimpo, posts, planos, tarefas, marcos, briefings, nps, logs,
  }
}

// Direito ao esquecimento — apaga em cascata TODOS os dados do cliente + o acesso.
export async function apagarDadosCliente(clienteId: string): Promise<{ ok: boolean; contagens?: Record<string, number>; erro?: string }> {
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return { ok: false, erro: 'cliente não encontrado' }
  const contagens: Record<string, number> = {}

  async function apagarColecao(setKey: string, prefix: string) {
    const itens = await porClienteId<any>(setKey, prefix, clienteId)
    for (const it of itens) { await redis.del(`${prefix}:${it.id}`); await redis.srem(setKey, it.id) }
    contagens[prefix] = itens.length
  }

  // Posts (usa o índice por cliente) + remove dos índices globais.
  const posts = await getPostsDoCliente(clienteId)
  for (const p of posts) { await redis.del(`post:${p.id}`); await redis.srem('posts', p.id); await redis.srem('agendados', p.id) }
  contagens['post'] = posts.length
  await redis.del(`cliente:${clienteId}:posts`)
  await redis.del(`cliente:${clienteId}:posts:indexed`)

  await apagarColecao('planos', 'plano')
  await apagarColecao('tarefas', 'tarefa')
  await apagarColecao('marcos', 'marco')
  await apagarColecao('briefings', 'briefing')

  const npsIds = await redis.smembers(`cliente:${clienteId}:nps`)
  for (const id of npsIds) { await redis.del(`nps:${id}`); await redis.srem('nps', id) }
  await redis.del(`cliente:${clienteId}:nps`)
  contagens['nps'] = npsIds.length

  const logIds = (await redis.zrange<string[]>(`logs:cliente:${clienteId}`, 0, -1)) || []
  for (const id of logIds) { await redis.del(`log:${id}`); await redis.zrem('logs:cliente', id) }
  await redis.del(`logs:cliente:${clienteId}`)
  contagens['log'] = logIds.length

  // Tokens públicos do cliente
  if (cliente.statusToken) await redis.del(`statustoken:${cliente.statusToken}`)
  if ((cliente as any).aprovacaoToken) await redis.del(`aprovtoken:${(cliente as any).aprovacaoToken}`)
  if ((cliente as any).npsToken) await redis.del(`npstoken:${(cliente as any).npsToken}`)

  // Acesso de login do cliente (usuário + notificações)
  if (cliente.loginEmail) {
    await redis.del(`usuario:${cliente.loginEmail}`)
    await redis.srem('usuarios', cliente.loginEmail)
    await redis.del(`notificacoes:${cliente.loginEmail}`)
  }

  // Por fim, o próprio cliente
  await redis.del(`cliente:${clienteId}`)
  await redis.srem('clientes', clienteId)
  contagens['cliente'] = 1

  return { ok: true, contagens }
}

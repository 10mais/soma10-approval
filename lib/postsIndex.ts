import { redis, Post } from './redis'

// Índice de posts por cliente (cliente:{id}:posts). Construído de forma LAZY:
// na primeira leitura de um cliente, varre os posts uma vez, popula o índice e
// marca a flag :indexed. Depois, leituras usam só o subconjunto. As escritas
// (POST/PUT/DELETE) mantêm o índice em dia. Nada é apagado nem reescrito em massa.

export async function getPostsDoCliente(clienteId: string): Promise<Post[]> {
  const indexado = await redis.get(`cliente:${clienteId}:posts:indexed`)
  if (!indexado) return backfillCliente(clienteId)
  const ids = await redis.smembers(`cliente:${clienteId}:posts`)
  return ids.length ? ((await redis.mget<(Post | null)[]>(...ids.map(id => `post:${id}`))).filter(Boolean) as Post[]) : []
}

// Varre todos os posts uma vez, separa os do cliente e popula o índice + flag.
async function backfillCliente(clienteId: string): Promise<Post[]> {
  const allIds = await redis.smembers('posts')
  const all = allIds.length ? ((await redis.mget<(Post | null)[]>(...allIds.map(id => `post:${id}`))).filter(Boolean) as Post[]) : []
  const meus = all.filter(p => p.clienteId === clienteId)
  if (meus.length) await redis.sadd(`cliente:${clienteId}:posts`, ...(meus.map(p => p.id) as [string, ...string[]]))
  await redis.set(`cliente:${clienteId}:posts:indexed`, 1)
  return meus
}

export async function indexarPost(clienteId: string | undefined, postId: string) {
  if (clienteId) await redis.sadd(`cliente:${clienteId}:posts`, postId)
}

export async function desindexarPost(clienteId: string | undefined, postId: string) {
  if (clienteId) await redis.srem(`cliente:${clienteId}:posts`, postId)
}

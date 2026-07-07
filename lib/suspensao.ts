import { redis, Cliente } from '@/lib/redis'

// Suspensão por inadimplência (server-side). O guard do layout do portal cobre a
// navegação logada; este helper cobre os links públicos e as rotas de API para
// que um cliente suspenso não contorne o bloqueio.
export async function clienteSuspenso(clienteId?: string | null): Promise<boolean> {
  if (!clienteId) return false
  const c = await redis.get<Cliente>(`cliente:${clienteId}`)
  return !!c?.inadimplente
}

// Resolve o clienteId a partir de um token público (aprovação ou status) e diz se
// está suspenso. Retorna { clienteId, suspenso }.
export async function suspensoPorToken(tipo: 'aprov' | 'status', token?: string | null): Promise<{ clienteId: string | null; suspenso: boolean }> {
  if (!token) return { clienteId: null, suspenso: false }
  const chave = tipo === 'aprov' ? `aprovtoken:${token}` : `statustoken:${token}`
  const clienteId = await redis.get<string>(chave)
  return { clienteId: clienteId || null, suspenso: await clienteSuspenso(clienteId) }
}

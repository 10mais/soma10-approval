import { unstable_cache } from 'next/cache'
import { redis, Cliente, Usuario, ConfigAgencia } from './redis'

// Leituras cacheadas de dados que mudam pouco. O cache de dados do Next persiste
// entre invocacoes (na Vercel) e e invalidado por tag nas escritas (revalidateTag).
// O `revalidate` serve de rede de seguranca caso alguma invalidacao seja perdida.

const PADRAO_CONFIG: ConfigAgencia = {
  nomeAgencia: 'Soma10Approval',
  corPrimaria: '#ffc00f',
  corSecundaria: '#111111',
}

export const getClientesRaw = unstable_cache(
  async (): Promise<Cliente[]> => {
    const ids = await redis.smembers('clientes')
    return ids.length > 0 ? ((await redis.mget<(Cliente | null)[]>(...ids.map(id => `cliente:${id}`))).filter(Boolean) as Cliente[]) : []
  },
  ['clientes-raw'],
  { tags: ['clientes'], revalidate: 120 }
)

export const getUsuariosRaw = unstable_cache(
  async (): Promise<Usuario[]> => {
    const emails = await redis.smembers('usuarios')
    return emails.length > 0 ? ((await redis.mget<(Usuario | null)[]>(...emails.map(e => `usuario:${e}`))).filter(Boolean) as Usuario[]) : []
  },
  ['usuarios-raw'],
  { tags: ['usuarios'], revalidate: 120 }
)

export const getConfigCache = unstable_cache(
  async (): Promise<ConfigAgencia> => {
    return (await redis.get<ConfigAgencia>('config:agencia')) || PADRAO_CONFIG
  },
  ['config-agencia'],
  { tags: ['config'], revalidate: 300 }
)

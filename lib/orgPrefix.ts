// Multi-tenant F0 — núcleo PURO do isolamento por prefixo de chave (MULTITENANT-PLANO.md §1).
//
// A regra inteira do multi-tenant mora aqui: toda chave de dado vira
// `org:{orgId}:<chave>`. Quem acessa o banco pelo wrapper (dbOrgCom/dbOrg) NÃO
// CONSEGUE ler ou escrever fora da própria org — o isolamento é estrutural, não
// depende de cada rota lembrar de filtrar.
//
// MODO LEGADO (orgId = null): prefixo vazio, chaves idênticas às de hoje. É o que
// permite migrar as rotas AOS POUCOS na main sem big-bang: numa instância
// single-tenant atual, a rota migrada se comporta exatamente igual; o "corte"
// para multi-tenant vira apenas registrar as orgs e seus hosts (lib/orgs.ts).
//
// Este arquivo é puro de propósito (sem import de lib/redis): os testes exercitam
// o comportamento com um cliente falso, sem precisar de banco.

export function prefixarChave(orgId: string | null, chave: string): string {
  if (typeof chave !== 'string' || !chave.trim()) throw new Error('dbOrg: chave vazia')
  if (!orgId) return chave // modo legado (instância single-tenant)
  const p = `org:${orgId}:`
  return chave.startsWith(p) ? chave : `${p}${chave}` // idempotente
}

// Host do request -> forma canônica (minúsculo, sem porta).
export function normalizarHost(host?: string | null): string {
  return String(host || '').trim().toLowerCase().replace(/:\d+$/, '')
}

// Decide a org do request. `temOrgs` = existe ao menos uma org registrada.
// - Sem orgs registradas: instância legada -> orgId null (sem prefixo).
// - Host no mapa: a org dele.
// - Orgs existem mas o host é desconhecido: NÃO cai no legado (vazaria o banco
//   inteiro para um host errado) — devolve `desconhecida` e a rota recusa.
export function resolverOrgPorHost(
  mapa: Record<string, string>,
  host: string | null | undefined,
  temOrgs: boolean,
): { orgId: string | null; desconhecida?: boolean } {
  if (!temOrgs) return { orgId: null }
  const h = normalizarHost(host)
  const id = h ? mapa[h] : undefined
  return id ? { orgId: id } : { orgId: null, desconhecida: true }
}

// Cliente mínimo que o wrapper precisa (assinaturas do @upstash/redis usadas no
// repo). `any` nos retornos de propósito: o wrapper não reinterpreta nada, só
// prefixa as chaves e delega.
export type ClienteRedisMinimo = Record<string, (...args: any[]) => any>

// Fábrica do wrapper com cliente INJETADO (testável). A versão ligada ao Redis
// real é lib/dbOrg.ts. Métodos = exatamente os que o repo usa hoje; família nova
// de operação entra AQUI (nunca chamando o cliente cru na rota).
export function dbOrgCom(cliente: ClienteRedisMinimo, orgId: string | null) {
  const p = (k: string) => prefixarChave(orgId, k)
  return {
    orgId,
    get: <T = unknown>(k: string): Promise<T | null> => cliente.get(p(k)),
    set: (k: string, v: unknown, opts?: Record<string, unknown>) => (opts ? cliente.set(p(k), v, opts) : cliente.set(p(k), v)),
    del: (...ks: string[]) => cliente.del(...ks.map(p)),
    sadd: (k: string, ...m: unknown[]) => cliente.sadd(p(k), ...m),
    srem: (k: string, ...m: unknown[]) => cliente.srem(p(k), ...m),
    smembers: <T = string>(k: string): Promise<T[]> => cliente.smembers(p(k)),
    mget: <T = unknown>(...ks: string[]): Promise<(T | null)[]> => cliente.mget(...ks.map(p)),
    lrange: <T = unknown>(k: string, ini: number, fim: number): Promise<T[]> => cliente.lrange(p(k), ini, fim),
    lpush: (k: string, ...v: unknown[]) => cliente.lpush(p(k), ...v),
    rpush: (k: string, ...v: unknown[]) => cliente.rpush(p(k), ...v),
    lset: (k: string, i: number, v: unknown) => cliente.lset(p(k), i, v),
    lrem: (k: string, n: number, v: unknown) => cliente.lrem(p(k), n, v),
    ltrim: (k: string, ini: number, fim: number) => cliente.ltrim(p(k), ini, fim),
    zadd: (k: string, ...args: unknown[]) => cliente.zadd(p(k), ...args),
    zrem: (k: string, ...m: unknown[]) => cliente.zrem(p(k), ...m),
    zrange: <T = string>(k: string, ini: number, fim: number, opts?: Record<string, unknown>): Promise<T[]> => (opts ? cliente.zrange(p(k), ini, fim, opts) : cliente.zrange(p(k), ini, fim)),
    zremrangebyscore: (k: string, min: number, max: number) => cliente.zremrangebyscore(p(k), min, max),
    incr: (k: string) => cliente.incr(p(k)),
    incrby: (k: string, n: number) => cliente.incrby(p(k), n),
    expire: (k: string, seg: number) => cliente.expire(p(k), seg),
  }
}

export type DbOrg = ReturnType<typeof dbOrgCom>

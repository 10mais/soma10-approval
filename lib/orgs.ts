// Multi-tenant F0 — REGISTRO de organizações e resolução da org por host.
// (MULTITENANT-PLANO.md §1.3)
//
// Chaves GLOBAIS (deliberadamente FORA do prefixo — são o registro do próprio
// multi-tenant, não dado de org):
//   `orgs`           set de ids
//   `org-reg:{id}`   registro da org (o plano citava `org:{id}`; virou org-reg
//                    para nunca ambiguar com as chaves de DADO `org:{id}:...`)
//   `orgs:hosts`     Record host -> orgId (derivado dos registros; regravado inteiro)
//
// Numa instância single-tenant atual NADA disso existe -> modo legado: todas as
// rotas migradas continuam lendo as chaves sem prefixo (comportamento idêntico).
import { redis } from './redis'
import { dbOrg } from './dbOrg'
import { normalizarHost, resolverOrgPorHost, type DbOrg } from './orgPrefix'

export type Org = {
  id: string // slug curto e imutável (ex.: 'norah') — vira o prefixo de chave
  nome: string
  perfil?: string // clinica | turismo | cidadania | telefonia | gestao | '' (agência)
  hosts: string[] // ex.: ['norah.soma10.com.br'] — cada host pertence a UMA org
  ativo?: boolean // false = org suspensa (requests recusados); ausente = ativa
  criadoEm: string
}

export class OrgDesconhecidaError extends Error {
  constructor() { super('host não pertence a nenhuma organização') }
}

// Cache por instância de lambda: o mapa host->org muda raramente; 60s de TTL
// evita 2 leituras de Redis em TODA request. `invalidarCacheOrgs()` nas escritas.
let cache: { em: number; mapa: Record<string, string>; temOrgs: boolean } | null = null
const TTL_MS = 60_000

export function invalidarCacheOrgs() { cache = null }

async function carregarMapa(): Promise<{ mapa: Record<string, string>; temOrgs: boolean }> {
  if (cache && Date.now() - cache.em < TTL_MS) return cache
  const [mapa, ids] = await Promise.all([
    redis.get<Record<string, string>>('orgs:hosts'),
    redis.smembers('orgs'),
  ])
  cache = { em: Date.now(), mapa: mapa || {}, temOrgs: ids.length > 0 }
  return cache
}

export async function orgIdDoHost(host: string | null | undefined): Promise<{ orgId: string | null; desconhecida?: boolean }> {
  const { mapa, temOrgs } = await carregarMapa()
  return resolverOrgPorHost(mapa, host, temOrgs)
}

// A porta de entrada das rotas migradas: resolve a org pelo Host e devolve o
// banco JÁ escopado. Host desconhecido (com orgs registradas) = erro — nunca
// cai no banco sem prefixo.
export async function dbDaRequest(req: { headers: { get(n: string): string | null } }): Promise<DbOrg> {
  const { orgId, desconhecida } = await orgIdDoHost(req.headers.get('host'))
  if (desconhecida) throw new OrgDesconhecidaError()
  return dbOrg(orgId)
}

// ---- CRUD do registro (futuro /api/admin/orgs + script de migração) ----

export async function listarOrgs(): Promise<Org[]> {
  const ids = await redis.smembers('orgs')
  if (!ids.length) return []
  const regs = await redis.mget<(Org | null)[]>(...ids.map(i => `org-reg:${i}`))
  return (regs.filter(Boolean) as Org[]).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
}

export async function salvarOrg(org: Org): Promise<void> {
  const id = (org.id || '').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(id)) throw new Error('org.id inválido (slug a-z0-9-, 2-31 chars)')
  await redis.set(`org-reg:${id}`, { ...org, id, hosts: (org.hosts || []).map(normalizarHost).filter(Boolean) })
  await redis.sadd('orgs', id)
  // orgs:hosts é DERIVADO: regrava inteiro a partir de todos os registros (fonte
  // única; nunca editar o mapa à mão — um host órfão mandaria requests pra org errada).
  const todas = await listarOrgs()
  const mapa: Record<string, string> = {}
  for (const o of todas) { if (o.ativo === false) continue; for (const h of o.hosts) mapa[h] = o.id }
  await redis.set('orgs:hosts', mapa)
  invalidarCacheOrgs()
}

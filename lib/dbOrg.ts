// Multi-tenant F0 — o wrapper LIGADO ao Redis real. Todo o comportamento vive em
// lib/orgPrefix.ts (puro, testado); aqui é só a amarração. Rotas migradas usam
// `dbDaRequest(req)` (lib/orgs.ts), que resolve a org pelo host e devolve isto.
import { redis } from './redis'
import { dbOrgCom, type ClienteRedisMinimo, type DbOrg } from './orgPrefix'

export type { DbOrg }

export function dbOrg(orgId: string | null): DbOrg {
  // O cast é seguro: o wrapper só chama métodos que o Redis do Upstash expõe
  // (o contrato está exercitado em tests/orgPrefix.test.ts).
  return dbOrgCom(redis as unknown as ClienteRedisMinimo, orgId)
}

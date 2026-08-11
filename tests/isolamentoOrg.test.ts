import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Multi-tenant — TRAVA ESTÁTICA (MULTITENANT-PLANO.md §5.1).
// Arquivo listado em MIGRADOS não pode voltar a usar o Redis cru: só o wrapper
// (dbOrg/dbDaRequest). Como o `build` roda os testes antes do `next build`,
// regressão aqui = deploy BLOQUEADO em todas as instâncias.
//
// A lista CRESCE a cada rota migrada (fases F1-F5 do plano). Quando TODAS as
// rotas estiverem aqui, inverte-se a lógica: varrer app/api inteiro e permitir
// `redis` cru só na allowlist (dbOrg/orgs/admin/backup).
const MIGRADOS = [
  'app/api/agentes/route.ts', // piloto F0
]

// Importar TIPOS de lib/redis segue permitido (ex.: `import { Agente } from
// '@/lib/redis'`). Proibido é importar o IDENTIFICADOR `redis` (o cliente).
const IMPORT_REDIS_CRU = /import\s*(?:type\s*)?\{[^}]*(?<![\w$])redis(?![\w$])[^}]*\}\s*from\s*['"]@?\/?(?:\.\.\/)*lib\/redis['"]/

describe('isolamento multi-tenant — arquivos migrados não usam Redis cru', () => {
  for (const rel of MIGRADOS) {
    it(rel, () => {
      const src = readFileSync(join(process.cwd(), ...rel.split('/')), 'utf8')
      expect(IMPORT_REDIS_CRU.test(src), `${rel} voltou a importar { redis } de lib/redis — use dbDaRequest/dbOrg`).toBe(false)
    })
  }
})

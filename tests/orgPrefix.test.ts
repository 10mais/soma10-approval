import { describe, it, expect } from 'vitest'
import { prefixarChave, normalizarHost, resolverOrgPorHost, dbOrgCom } from '@/lib/orgPrefix'

describe('prefixarChave', () => {
  it('prefixa com a org', () => {
    expect(prefixarChave('norah', 'post:123')).toBe('org:norah:post:123')
    expect(prefixarChave('norah', 'posts')).toBe('org:norah:posts')
  })
  it('modo legado (null) não prefixa — instância single-tenant fica idêntica', () => {
    expect(prefixarChave(null, 'post:123')).toBe('post:123')
  })
  it('é idempotente (chave já prefixada não duplica)', () => {
    expect(prefixarChave('norah', 'org:norah:post:1')).toBe('org:norah:post:1')
  })
  it('não confunde prefixo de OUTRA org (prefixa por cima — a chave resultante segue na org atual)', () => {
    expect(prefixarChave('deny', 'org:norah:post:1')).toBe('org:deny:org:norah:post:1')
  })
  it('chave vazia lança', () => {
    expect(() => prefixarChave('norah', '')).toThrow()
    expect(() => prefixarChave(null, '  ')).toThrow()
    expect(() => prefixarChave('norah', undefined as any)).toThrow()
  })
})

describe('normalizarHost', () => {
  it('minúsculo, sem porta, sem espaço', () => {
    expect(normalizarHost(' Norah.Soma10.com.br:443 ')).toBe('norah.soma10.com.br')
    expect(normalizarHost('localhost:3000')).toBe('localhost')
    expect(normalizarHost(null)).toBe('')
  })
})

describe('resolverOrgPorHost', () => {
  const mapa = { 'norah.soma10.com.br': 'norah', 'denyturismo.soma10.com.br': 'deny' }
  it('sem orgs registradas = modo legado (orgId null, sem erro)', () => {
    expect(resolverOrgPorHost({}, 'qualquer.coisa', false)).toEqual({ orgId: null })
  })
  it('host conhecido resolve a org (com porta e caixa alta)', () => {
    expect(resolverOrgPorHost(mapa, 'Norah.Soma10.com.br:443', true)).toEqual({ orgId: 'norah' })
  })
  it('host desconhecido COM orgs registradas NÃO cai no legado — marca desconhecida', () => {
    const r = resolverOrgPorHost(mapa, 'intruso.example.com', true)
    expect(r.orgId).toBeNull()
    expect(r.desconhecida).toBe(true)
  })
  it('host vazio com orgs registradas = desconhecida', () => {
    expect(resolverOrgPorHost(mapa, '', true).desconhecida).toBe(true)
  })
})

// Cliente falso em memória: o suficiente para provar que TODA operação do
// wrapper prefixa a chave e que duas orgs não se enxergam.
function fakeRedis() {
  const store = new Map<string, any>()
  const sets = new Map<string, Set<string>>()
  const listas = new Map<string, any[]>()
  return {
    store, sets, listas,
    get: async (k: string) => (store.has(k) ? store.get(k) : null),
    set: async (k: string, v: any) => { store.set(k, v); return 'OK' },
    del: async (...ks: string[]) => { let n = 0; for (const k of ks) { if (store.delete(k)) n++; sets.delete(k); listas.delete(k) } return n },
    sadd: async (k: string, ...m: string[]) => { const s = sets.get(k) || new Set(); m.forEach(x => s.add(x)); sets.set(k, s); return m.length },
    srem: async (k: string, ...m: string[]) => { const s = sets.get(k); if (s) m.forEach(x => s.delete(x)); return m.length },
    smembers: async (k: string) => Array.from(sets.get(k) || []),
    mget: async (...ks: string[]) => ks.map(k => (store.has(k) ? store.get(k) : null)),
    lrange: async (k: string, i: number, f: number) => (listas.get(k) || []).slice(i, f === -1 ? undefined : f + 1),
    lpush: async (k: string, ...v: any[]) => { const l = listas.get(k) || []; l.unshift(...v); listas.set(k, l); return l.length },
    rpush: async (k: string, ...v: any[]) => { const l = listas.get(k) || []; l.push(...v); listas.set(k, l); return l.length },
    lset: async (k: string, i: number, v: any) => { const l = listas.get(k) || []; l[i] = v; return 'OK' },
    lrem: async () => 0, ltrim: async () => 'OK',
    zadd: async () => 1, zrem: async () => 1, zrange: async () => [], zremrangebyscore: async () => 0,
    incr: async (k: string) => { const v = (Number(store.get(k)) || 0) + 1; store.set(k, v); return v },
    incrby: async (k: string, n: number) => { const v = (Number(store.get(k)) || 0) + n; store.set(k, v); return v },
    expire: async () => 1,
  }
}

describe('dbOrgCom — isolamento estrutural', () => {
  it('toda operação de escrita/leitura usa a chave prefixada', async () => {
    const r = fakeRedis()
    const a = dbOrgCom(r as any, 'norah')
    await a.set('post:1', { id: '1' })
    await a.sadd('posts', '1')
    await a.rpush('wa:msgs:55999', 'oi')
    expect(r.store.has('org:norah:post:1')).toBe(true)
    expect(r.store.has('post:1')).toBe(false)
    expect(r.sets.has('org:norah:posts')).toBe(true)
    expect(r.listas.has('org:norah:wa:msgs:55999')).toBe(true)
  })

  it('org B não enxerga NADA gravado pela org A (get/smembers/mget/lrange)', async () => {
    const r = fakeRedis()
    const a = dbOrgCom(r as any, 'norah')
    const b = dbOrgCom(r as any, 'deny')
    await a.set('cliente:c1', { nome: 'X' })
    await a.sadd('clientes', 'c1')
    await a.rpush('wa:msgs:55999', 'oi')
    expect(await b.get('cliente:c1')).toBeNull()
    expect(await b.smembers('clientes')).toEqual([])
    expect(await b.mget('cliente:c1')).toEqual([null])
    expect(await b.lrange('wa:msgs:55999', 0, -1)).toEqual([])
    // e a própria org A continua vendo o que gravou
    expect(await a.get('cliente:c1')).toEqual({ nome: 'X' })
    expect(await a.smembers('clientes')).toEqual(['c1'])
  })

  it('modo legado (null) grava nas chaves atuais, sem prefixo', async () => {
    const r = fakeRedis()
    const legado = dbOrgCom(r as any, null)
    await legado.set('cliente:c1', 1)
    await legado.sadd('clientes', 'c1')
    expect(r.store.has('cliente:c1')).toBe(true)
    expect(r.sets.has('clientes')).toBe(true)
  })

  it('del prefixa todas as chaves do lote', async () => {
    const r = fakeRedis()
    const a = dbOrgCom(r as any, 'norah')
    await a.set('x:1', 1); await a.set('x:2', 2)
    await a.del('x:1', 'x:2')
    expect(r.store.has('org:norah:x:1')).toBe(false)
    expect(r.store.has('org:norah:x:2')).toBe(false)
  })
})

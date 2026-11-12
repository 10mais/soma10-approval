import { describe, it, expect, vi, beforeEach } from 'vitest'

// Redis simulado em memória: guarda o valor JS direto (sem a serialização do SDK)
// e o TTL de cada chave, com só os comandos que lib/backup usa.
type Val = { tipo: 'string' | 'set' | 'list' | 'zset' | 'hash'; v: any; ttl?: number }
const { db, fake } = vi.hoisted(() => {
const db = new Map<string, Val>()

const fake = {
  async smembers(k: string) { const e = db.get(k); return e?.tipo === 'set' ? Array.from(e.v as Set<string>) : [] },
  async mget(...ks: string[]) { return ks.map(k => { const e = db.get(k); return e?.tipo === 'string' ? e.v : null }) },
  async get(k: string) { const e = db.get(k); return e?.tipo === 'string' ? e.v : null },
  async set(k: string, v: any, o?: { nx?: boolean; ex?: number }) {
    if (o?.nx && db.has(k)) return null
    db.set(k, { tipo: 'string', v, ttl: o?.ex }); return 'OK'
  },
  async sadd(k: string, ...ms: any[]) {
    const e = db.get(k) || { tipo: 'set' as const, v: new Set<string>() }
    for (const m of ms) e.v.add(String(m))
    db.set(k, e); return ms.length
  },
  async scan(cursor: number | string) {
    // devolve em duas páginas e repete uma chave (o SCAN real pode repetir)
    const todas = Array.from(db.keys())
    const meio = Math.ceil(todas.length / 2)
    if (String(cursor) === '0') return ['7', [...todas.slice(0, meio), todas[0]].filter(Boolean)]
    return ['0', todas.slice(meio)]
  },
  async type(k: string) { return db.get(k)?.tipo || 'none' },
  async lrange(k: string) { const e = db.get(k); return e?.tipo === 'list' ? [...e.v] : [] },
  async rpush(k: string, ...vs: any[]) { const e = db.get(k) || { tipo: 'list' as const, v: [] as any[] }; e.v.push(...vs); db.set(k, e); return e.v.length },
  async lpush(k: string, ...vs: any[]) { const e = db.get(k) || { tipo: 'list' as const, v: [] as any[] }; for (const x of vs) e.v.unshift(x); db.set(k, e); return e.v.length },
  async zrange(k: string) {
    const e = db.get(k); if (e?.tipo !== 'zset') return []
    return Array.from((e.v as Map<string, number>).entries()).sort((a, b) => a[1] - b[1]).flatMap(([m, s]) => [m, s])
  },
  async zadd(k: string, ...pares: { score: number; member: any }[]) {
    const e = db.get(k) || { tipo: 'zset' as const, v: new Map<string, number>() }
    for (const p of pares) e.v.set(p.member, p.score)
    db.set(k, e); return pares.length
  },
  async hgetall(k: string) { const e = db.get(k); return e?.tipo === 'hash' ? { ...e.v } : null },
  async hset(k: string, o: Record<string, any>) { const e = db.get(k) || { tipo: 'hash' as const, v: {} }; Object.assign(e.v, o); db.set(k, e); return 1 },
}
return { db, fake }
})

vi.mock('@/lib/redis', () => ({ redis: fake }))
vi.mock('@/lib/erros', () => ({ capturarErro: vi.fn(async () => null) }))
vi.mock('@vercel/blob', () => ({ put: vi.fn(), list: vi.fn(async () => ({ blobs: [] })), del: vi.fn() }))

import { exportarTudo, restaurarBackup, foraDoBackup, ttlRestante, itensQueFaltam, chaveDoCliente, salvarBackup, tokenBackup } from '@/lib/backup'
import { put } from '@vercel/blob'

const AGORA = Date.parse('2026-11-12T12:00:00.000Z')
const DIA = 24 * 3600 * 1000

function str(k: string, v: any, ttl?: number) { db.set(k, { tipo: 'string', v, ttl }) }
function set(k: string, ...ms: string[]) { db.set(k, { tipo: 'set', v: new Set(ms) }) }
function lista(k: string, ...vs: any[]) { db.set(k, { tipo: 'list', v: vs }) }

// Uma instância com um pouco de cada coisa que ficava fora do backup v1.
function semear() {
  db.clear()
  // v1 (estruturado)
  str('cliente:c1', { id: 'c1', nome: 'Norah', loginSenha: 'texto-plano' }); set('clientes', 'c1')
  str('cliente:c2', { id: 'c2', nome: 'Outro' }); set('clientes', 'c1', 'c2')
  str('usuario:dono@x.com', { nome: 'Dono', email: 'dono@x.com', role: 'admin' }) // admin do setup: sem id
  str('usuario:ana@x.com', { id: 'u-ana', nome: 'Ana', email: 'ana@x.com', role: 'cliente', clienteId: 'c1' })
  set('usuarios', 'dono@x.com', 'ana@x.com')
  str('post:p1', { id: 'p1', clienteId: 'c1', planoId: 'pl1', status: 'agendado' })
  str('post:p2', { id: 'p2', clienteId: 'c2', status: 'publicado' })
  set('posts', 'p1', 'p2'); set('agendados', 'p1'); set('plano:pl1:pautas', 'p1')
  str('plano:pl1', { id: 'pl1', clienteId: 'c1' }); set('planos', 'pl1')
  str('config:agencia', { nomeAgencia: '10+' })
  // lixeira de pautas: o post saiu do set `posts`
  str('post:p9', { id: 'p9', clienteId: 'c1', excluidoEm: '2026-11-10T10:00:00.000Z' }); set('posts_excluidos', 'p9')
  // Agenda da clínica
  str('agendamento:a1', { id: 'a1', clienteId: 'c1', status: 'Confirmado (pago)', registroAtendimento: 'evolução' }); set('agendamentos', 'a1')
  str('clinica:procedimentos', [{ nome: 'Limpeza' }])
  // Financeiro
  str('lancamento:l1', { id: 'l1', valor: 500 }); set('lancamentos', 'l1')
  str('financeiro:mes:2026-10', { mes: '2026-10', total: 9000 }); set('financeiro:meses', '2026-10')
  str('meta:2026', { ano: 2026 }); set('metas', '2026')
  // Configs fora de CONFIG_KEYS
  str('config:perfilInstancia', 'clinica'); str('config:onboarding', { fases: [] }); str('crm:bibliotecaVendas', { itens: [] })
  // Conversas
  lista('wa:msgs:5555', { id: 'm1', t: 'oi' }, { id: 'm2', t: 'tudo bem?' })
  str('wa:conversa:5555', { tel: '5555', naoLidas: 1 }); set('wa:conversas', '5555')
  // Turismo
  str('viagem:v1', { id: 'v1' }); set('viagens', 'v1'); set('viagem:v1:reservas', 'r1')
  str('reserva:r1', { id: 'r1' }); set('reservas', 'r1'); str('viagem:v1:assento:12', 'r1')
  // Comunicação por cliente
  str('comunicado:k1', { id: 'k1', clienteId: 'c1' }); set('comunicados:c1', 'k1')
  str('comunicado:k2', { id: 'k2', clienteId: 'c2' }); set('comunicados:c2', 'k2')
  // Estoque (contador) e automação agendada (zset)
  str('estoque:loja1:prod1', 7)
  db.set('automacoes:pendentes', { tipo: 'zset', v: new Map([['{"regraId":"r","passoIndex":1}', 1700000000000]]) })
  // Históricos com validade
  str('audit:x1', { id: 'x1', criadoEm: new Date(AGORA - 10 * DIA).toISOString() }, 180 * 86400)
  str('log:velho', { id: 'velho', ts: AGORA - 40 * DIA, clienteId: 'c1' }, 30 * 86400)
  lista('auditoria:log', 'x1')
  // Caches: ficam de fora
  str('home:cache:dono@x.com:todos:pt', { pesado: true }, 90)
  str('rl:login:1.2.3.4', 3, 60)
  str('tarefa_notif_dia:t1', '1', 72000)
  str('wa:foto:5555', 'https://x', 86400)
  str('cliente:c1:posts:indexed', '1'); set('cliente:c1:posts', 'p1')
}

beforeEach(() => semear())

describe('backup — exportar', () => {
  it('cobre as chaves de negócio que o v1 deixava de fora', async () => {
    const b = await exportarTudo()
    const k = Object.keys(b.chaves)
    for (const esperado of [
      'agendamento:a1', 'agendamentos', 'clinica:procedimentos', 'lancamento:l1', 'lancamentos',
      'financeiro:mes:2026-10', 'financeiro:meses', 'meta:2026', 'metas', 'config:perfilInstancia', 'config:onboarding',
      'crm:bibliotecaVendas', 'wa:msgs:5555', 'wa:conversa:5555', 'wa:conversas', 'viagem:v1', 'viagem:v1:reservas',
      'viagem:v1:assento:12', 'reserva:r1', 'comunicado:k1', 'comunicados:c1', 'estoque:loja1:prod1',
      'automacoes:pendentes', 'post:p9', 'posts_excluidos', 'plano:pl1:pautas', 'audit:x1', 'auditoria:log',
    ]) expect(k).toContain(esperado)
    expect(b.chaves['wa:msgs:5555']).toEqual({ tipo: 'list', valor: [{ id: 'm1', t: 'oi' }, { id: 'm2', t: 'tudo bem?' }] })
    expect(b.chaves['agendamentos'].tipo).toBe('set')
    expect(b.chaves['automacoes:pendentes']).toEqual({ tipo: 'zset', valor: [{ member: '{"regraId":"r","passoIndex":1}', score: 1700000000000 }] })
    expect(b._meta.versao).toBe(2)
    expect(b._meta.incompleto).toBe(false)
    expect(b._meta.contagens.chavesPorPrefixo.agendamento).toBe(1)
  })

  it('deixa de fora cache, trava curta e índice derivado', async () => {
    const b = await exportarTudo()
    const k = Object.keys(b.chaves)
    for (const fora of ['home:cache:dono@x.com:todos:pt', 'rl:login:1.2.3.4', 'tarefa_notif_dia:t1', 'wa:foto:5555', 'cliente:c1:posts', 'cliente:c1:posts:indexed', 'agendados'])
      expect(k).not.toContain(fora)
  })

  it('não duplica o que já está nas coleções estruturadas', async () => {
    const b = await exportarTudo()
    const k = Object.keys(b.chaves)
    for (const coberta of ['cliente:c1', 'clientes', 'usuario:ana@x.com', 'usuarios', 'post:p1', 'posts', 'config:agencia'])
      expect(k).not.toContain(coberta)
    expect(b.posts.map((p: any) => p.id).sort()).toEqual(['p1', 'p2'])
    expect(b.clientes.find((c: any) => c.id === 'c1').loginSenha).toBeUndefined()
  })

  it('prazo estourado: salva o que deu e marca incompleto', async () => {
    const b = await exportarTudo({ prazo: Date.now() - 1 })
    expect(b._meta.incompleto).toBe(true)
    expect(b.clientes.length).toBe(2) // a parte estruturada sai inteira
  })
})

describe('backup — restaurar depois de perder o Redis', () => {
  it('volta tudo, com os índices, sem o cache', async () => {
    const b = JSON.parse(JSON.stringify(await exportarTudo()))
    db.clear()
    const r = await restaurarBackup(b, { agora: AGORA })

    expect((await fake.get('agendamento:a1')).registroAtendimento).toBe('evolução')
    expect(await fake.smembers('agendamentos')).toEqual(['a1'])
    expect(await fake.get('config:perfilInstancia')).toBe('clinica')
    expect(await fake.get('financeiro:mes:2026-10')).toEqual({ mes: '2026-10', total: 9000 })
    expect(await fake.lrange('wa:msgs:5555')).toEqual([{ id: 'm1', t: 'oi' }, { id: 'm2', t: 'tudo bem?' }])
    expect(await fake.get('viagem:v1:assento:12')).toBe('r1')
    expect(await fake.get('estoque:loja1:prod1')).toBe(7)
    expect(await fake.zrange('automacoes:pendentes')).toEqual(['{"regraId":"r","passoIndex":1}', 1700000000000])
    // lixeira de pautas
    expect((await fake.get('post:p9')).excluidoEm).toBeTruthy()
    expect(await fake.smembers('posts_excluidos')).toEqual(['p9'])
    // índices remontados
    expect(await fake.smembers('agendados')).toEqual(['p1'])
    expect(await fake.smembers('plano:pl1:pautas')).toEqual(['p1'])
    // cache não volta
    expect(db.has('home:cache:dono@x.com:todos:pt')).toBe(false)
    expect(r.contagens['chaves:string']).toBeGreaterThan(10)
  })

  it('usuários voltam pela chave do e-mail (o admin do setup não tem id)', async () => {
    const b = JSON.parse(JSON.stringify(await exportarTudo()))
    db.clear()
    await restaurarBackup(b, { agora: AGORA })
    expect((await fake.get('usuario:dono@x.com')).role).toBe('admin')
    expect((await fake.get('usuario:ana@x.com')).nome).toBe('Ana')
    expect(db.has('usuario:u-ana')).toBe(false)
    expect((await fake.smembers('usuarios')).sort()).toEqual(['ana@x.com', 'dono@x.com'])
  })

  it('histórico com validade volta com o TTL que restava; o vencido não volta', async () => {
    const b = JSON.parse(JSON.stringify(await exportarTudo()))
    db.clear()
    const r = await restaurarBackup(b, { agora: AGORA })
    expect(db.get('audit:x1')?.ttl).toBe(170 * 86400)
    expect(db.has('log:velho')).toBe(false)
    expect(r.contagens['chaves:vencidas']).toBe(1)
  })

  it('backup v1 (sem `chaves`) ainda restaura e remonta plano:{id}:pautas', async () => {
    const b = JSON.parse(JSON.stringify(await exportarTudo()))
    delete b.chaves
    b._meta.versao = 1
    db.clear()
    await restaurarBackup(b, { agora: AGORA })
    expect(await fake.smembers('plano:pl1:pautas')).toEqual(['p1'])
    expect((await fake.get('cliente:c1')).nome).toBe('Norah')
  })
})

describe('backup — restaurar sobre um banco vivo (UPSERT, sem flush)', () => {
  it('não apaga nada que nasceu depois do backup', async () => {
    const b = JSON.parse(JSON.stringify(await exportarTudo()))
    str('agendamento:a2', { id: 'a2' }); await fake.sadd('agendamentos', 'a2')
    await restaurarBackup(b, { agora: AGORA })
    expect((await fake.smembers('agendamentos')).sort()).toEqual(['a1', 'a2'])
    expect(db.has('agendamento:a2')).toBe(true)
  })

  it('conversa que recebeu mensagem depois do desastre: entram só as antigas, na frente', async () => {
    const b = JSON.parse(JSON.stringify(await exportarTudo()))
    lista('wa:msgs:5555', { id: 'm3', t: 'nova' })
    await restaurarBackup(b, { agora: AGORA })
    expect((await fake.lrange('wa:msgs:5555')).map((m: any) => m.id)).toEqual(['m1', 'm2', 'm3'])
    // restaurar de novo não duplica
    await restaurarBackup(b, { agora: AGORA })
    expect((await fake.lrange('wa:msgs:5555')).length).toBe(3)
  })

  it('lista com o mais novo na frente (auditoria) recebe os antigos no fim', async () => {
    const b = JSON.parse(JSON.stringify(await exportarTudo()))
    lista('auditoria:log', 'x9')
    await restaurarBackup(b, { agora: AGORA })
    expect(await fake.lrange('auditoria:log')).toEqual(['x9', 'x1'])
  })

  it('poltrona vendida depois do backup continua com o dono novo', async () => {
    const b = JSON.parse(JSON.stringify(await exportarTudo()))
    str('viagem:v1:assento:12', 'r-nova')
    const r = await restaurarBackup(b, { agora: AGORA })
    expect(await fake.get('viagem:v1:assento:12')).toBe('r-nova')
    expect(r.contagens['chaves:poltronaOcupada']).toBe(1)
  })
})

describe('backup — restaurar um cliente só', () => {
  it('volta o que é do cliente, das coleções e das chaves novas, e mais nada', async () => {
    const b = JSON.parse(JSON.stringify(await exportarTudo()))
    db.clear()
    await restaurarBackup(b, { clienteId: 'c1', agora: AGORA })
    expect(db.has('cliente:c1')).toBe(true)
    expect(db.has('cliente:c2')).toBe(false)
    expect(db.has('usuario:ana@x.com')).toBe(true)
    expect(db.has('usuario:dono@x.com')).toBe(false)
    expect(db.has('agendamento:a1')).toBe(true)
    expect(await fake.smembers('agendamentos')).toEqual(['a1'])
    expect(await fake.smembers('comunicados:c1')).toEqual(['k1'])
    expect(db.has('comunicado:k2')).toBe(false)
    expect(db.has('comunicados:c2')).toBe(false)
    // pauta da lixeira volta para a lixeira; pauta do plano volta para o plano
    expect(await fake.smembers('posts_excluidos')).toEqual(['p9'])
    expect(await fake.smembers('plano:pl1:pautas')).toEqual(['p1'])
    // global da instância não é tocado
    expect(db.has('config:perfilInstancia')).toBe(false)
    expect(db.has('lancamento:l1')).toBe(false)
    expect(db.has('wa:msgs:5555')).toBe(false)
  })

  it('simular não grava nada', async () => {
    const b = JSON.parse(JSON.stringify(await exportarTudo()))
    db.clear()
    const r = await restaurarBackup(b, { simular: true, agora: AGORA })
    expect(db.size).toBe(0)
    expect(r.simulado).toBe(true)
    expect(r.contagens['chaves:string']).toBeGreaterThan(10)
    expect(r.clientesNoBackup?.map(c => c.id).sort()).toEqual(['c1', 'c2'])
  })
})

describe('backup — regras puras', () => {
  it('foraDoBackup', () => {
    expect(foraDoBackup('aviso_pautas:a@b:c1')).toBe(true)
    expect(foraDoBackup('aviso:colab-busca-fora')).toBe(true)
    expect(foraDoBackup('erros:log')).toBe(true)
    expect(foraDoBackup('wa:msgs:5555')).toBe(false)
    expect(foraDoBackup('wa:conversa:5555')).toBe(false)
    expect(foraDoBackup('cliente:c1:nps')).toBe(false)
    expect(foraDoBackup('cliente:c1')).toBe(false)
  })
  it('ttlRestante', () => {
    expect(ttlRestante('agendamento:a1', {}, AGORA)).toBeUndefined()
    expect(ttlRestante('log:1', { ts: AGORA - DIA }, AGORA)).toBe(29 * 86400)
    expect(ttlRestante('log:1', { ts: AGORA - 31 * DIA }, AGORA)).toBe(0)
    expect(ttlRestante('audit:1', {}, AGORA)).toBe(180 * 86400) // sem data: TTL cheio
    expect(ttlRestante('logs:cliente', {}, AGORA)).toBeUndefined()
  })
  it('itensQueFaltam e chaveDoCliente', () => {
    expect(itensQueFaltam([{ id: 1 }, { id: 2 }], [{ id: 2 }])).toEqual([{ id: 1 }])
    expect(chaveDoCliente('cliente:c1:nps', 'c1')).toBe(true)
    expect(chaveDoCliente('ads_leitura:c1:2026-10', 'c1')).toBe(true)
    expect(chaveDoCliente('cliente:c10', 'c1')).toBe(false)
  })
})

describe('backup — store do Blob', () => {
  it('store público: o erro diz o que fazer, em vez do texto cru da Vercel', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'tok-principal'
    vi.mocked(put).mockRejectedValueOnce(new Error('Vercel Blob: Cannot use private access on a public store.'))
    await expect(salvarBackup()).rejects.toThrow(/BACKUP_BLOB_READ_WRITE_TOKEN/)
  })
  it('store só do backup ganha do principal', () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'tok-principal'
    process.env.BACKUP_BLOB_READ_WRITE_TOKEN = 'tok-backup'
    expect(tokenBackup()).toBe('tok-backup')
    delete process.env.BACKUP_BLOB_READ_WRITE_TOKEN
    expect(tokenBackup()).toBe('tok-principal')
  })
  it('grava privado, com o JSON inteiro', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'tok-principal'
    vi.mocked(put).mockResolvedValueOnce({ pathname: 'backups/x.json' } as any)
    const r = await salvarBackup()
    const [, corpo, opcoes] = vi.mocked(put).mock.calls.at(-1)!
    expect((opcoes as any).access).toBe('private')
    expect(JSON.parse(corpo as string).chaves['agendamento:a1']).toBeTruthy()
    expect(r.incompleto).toBe(false)
  })
})

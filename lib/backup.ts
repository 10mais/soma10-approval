import { redis } from './redis'
import { put, list, del, get } from '@vercel/blob'
import { capturarErro } from './erros'

// Backup do Redis para o Vercel Blob (PRIVADO). Usado pelo cron diário e pelo
// download on-demand do admin. NUNCA exponha o resultado publicamente (contém
// senhas hash, tokens etc.).
//
// O ARQUIVO TEM DUAS PARTES:
//  1. Coleções estruturadas (COLECOES + CONFIG_KEYS + personal): o formato da
//     versão 1, mantido igual para o restore por cliente e para abrir backups antigos.
//  2. `chaves`: TODA outra chave do Redis, achada por SCAN e guardada com o tipo
//     (string, set, list, zset, hash). Esta parte existe porque a lista fixa
//     envelheceu: de 10/07 a 12/11/2026 nasceram Agenda da clínica, lançamentos,
//     fechamento do mês, conversas de WhatsApp/Instagram, turismo, mídia paga,
//     comunicados, NPS, reuniões, processos e configs novas, e nada disso entrava.
//     Agora chave nova entra sozinha. O que fica de fora é decidido por EXCLUSÃO
//     (FORA_DO_BACKUP, abaixo): na dúvida, a chave entra.
//
// O QUE FICA DE FORA DE PROPÓSITO (FORA_DO_BACKUP): cache, trava curta,
// deduplicação de aviso e contador de janela, todos com TTL. Perder não dói, e
// restaurar sem o TTL seria pior (o aviso deduplicado nunca mais dispararia).
// Também o índice derivado `cliente:{id}:posts` (se remonta sozinho) e o set
// `agendados` (remontado dos posts no restore, ver abaixo).
//
// HISTÓRICOS COM VALIDADE (VALIDADE): `log:*` (30 dias) e `audit:*` (180 dias)
// entram e voltam com o TTL que ainda restava; o que já teria vencido não volta.
//
// TAMANHO E TEMPO: o arquivo vai para o Blob pelo servidor (sem o limite de
// ~4,5 MB, que só vale para corpo de requisição), e o restore pelo `pathname` lê
// no servidor. A varredura respeita um prazo (PRAZO_PADRAO_MS) para caber nos
// 300 s do cron: se estourar, o backup é salvo assim mesmo com
// `_meta.incompleto = true` e o erro é registrado (backup parcial > nenhum).

const CHUNK = 200
const PARALELO = 6
const PRAZO_PADRAO_MS = 200_000

// Roda `fn` sobre `itens` em lotes de `tam`, com até `paralelo` lotes ao mesmo tempo.
async function emLotes<T, R>(itens: T[], tam: number, fn: (lote: T[]) => Promise<R[]>, paralelo = PARALELO): Promise<R[]> {
  const lotes: T[][] = []
  for (let i = 0; i < itens.length; i += tam) lotes.push(itens.slice(i, i + tam))
  const saida: R[][] = new Array(lotes.length)
  for (let i = 0; i < lotes.length; i += paralelo) {
    const grupo = lotes.slice(i, i + paralelo)
    const res = await Promise.all(grupo.map(l => fn(l)))
    res.forEach((r, j) => { saida[i + j] = r })
  }
  return saida.flat()
}

async function mgetChunk<T>(keys: string[]): Promise<(T | null)[]> {
  if (!keys.length) return []
  return emLotes(keys, CHUNK, lote => redis.mget<(T | null)[]>(...lote))
}

// ── Parte 1: coleções estruturadas (formato v1) ─────────────────────────────

type Colecao = {
  campo: string // onde mora no arquivo (crm.* fica aninhado)
  set: string
  prefixo: string
  chaveDe?: (o: any) => string | undefined // sufixo da chave; padrão o.id
}

// Usuários são gravados como `usuario:{email}` e indexados pelo e-mail no set
// `usuarios` (app/api/usuarios, setup, clientes, crm/converter). O id do objeto
// NÃO é a chave — e o admin criado no setup nem tem id.
const porEmail = (o: any) => o?.email

const COLECOES: Colecao[] = [
  { campo: 'clientes', set: 'clientes', prefixo: 'cliente:' },
  { campo: 'usuarios', set: 'usuarios', prefixo: 'usuario:', chaveDe: porEmail },
  { campo: 'posts', set: 'posts', prefixo: 'post:' },
  { campo: 'tarefas', set: 'tarefas', prefixo: 'tarefa:' },
  { campo: 'tarefasExcluidas', set: 'tarefas_excluidas', prefixo: 'tarefa:' },
  { campo: 'marcos', set: 'marcos', prefixo: 'marco:' },
  { campo: 'templates', set: 'templates', prefixo: 'template:' },
  { campo: 'despesas', set: 'despesas', prefixo: 'despesa:' },
  { campo: 'candidaturas', set: 'candidaturas', prefixo: 'candidatura:' },
  { campo: 'briefings', set: 'briefings', prefixo: 'briefing:' },
  { campo: 'planos', set: 'planos', prefixo: 'plano:' },
  { campo: 'crm.negocios', set: 'crm:negocios', prefixo: 'negocio:' },
  { campo: 'crm.contatos', set: 'crm:contatos', prefixo: 'contato:' },
  { campo: 'crm.empresas', set: 'crm:empresas', prefixo: 'empresa:' },
  { campo: 'agentes', set: 'agentes', prefixo: 'agente:' },
  { campo: 'documentos', set: 'documentos', prefixo: 'documento:' },
  { campo: 'mapas', set: 'mapas', prefixo: 'mapa:' },
]

// Configs globais com campo próprio no arquivo. Config que não está aqui entra
// pela parte 2 (`chaves`) do mesmo jeito — esta lista só existe pelo formato v1.
// (`config:automacoes` saiu: só lib/automacoes.ts a lê, nada grava.)
const CONFIG_KEYS = [
  'config:agencia', 'config:automacoesRegras', 'config:permissoesPapel',
  'config:permissoesGranular', 'config:operacional', 'config:notificacoes', 'config:resumoTemplates',
  'config:contasBancarias', 'config:contasMensagensIg', 'crm:estagios', 'crm:pipelines',
  'crm:playbookQualificacao', 'tipos:tarefa', 'config:anthropicSaldo',
]

function lerCampo(dados: any, campo: string): any {
  return campo.split('.').reduce((o, p) => (o == null ? undefined : o[p]), dados)
}
function gravarCampo(dados: any, campo: string, valor: any) {
  const partes = campo.split('.')
  let o = dados
  for (const p of partes.slice(0, -1)) o = o[p] ??= {}
  o[partes[partes.length - 1]] = valor
}

async function exportarSet(setKey: string, prefixo: string): Promise<{ ids: string[]; objs: any[] }> {
  const ids = (await redis.smembers(setKey)).map(String)
  if (!ids.length) return { ids, objs: [] }
  const objs = await mgetChunk<any>(ids.map(id => `${prefixo}${id}`))
  return { ids, objs: objs.filter(Boolean) }
}

// ── Parte 2: toda outra chave, por descoberta ───────────────────────────────

export type TipoChave = 'string' | 'set' | 'list' | 'zset' | 'hash'
export type ChaveBackup = { tipo: TipoChave; valor: any }

// Exclusões. Cada linha diz por que perder a chave não dói.
const FORA_DO_BACKUP: { teste: RegExp; motivo: string }[] = [
  { teste: /^agendados$/, motivo: 'fila do cron, remontada dos posts no restore' },
  { teste: /^cliente:[^:]+:posts(:indexed)?$/, motivo: 'índice de posts por cliente, se remonta no 1º acesso (lib/postsIndex)' },
  { teste: /^home:cache:/, motivo: 'cache da Home (90 s)' },
  { teste: /^rl:/, motivo: 'limite de requisições (janela curta)' },
  { teste: /^login_fail:/, motivo: 'tentativas de login (15 min)' },
  { teste: /^2fa_email:/, motivo: 'código de 2FA por e-mail (5 min)' },
  { teste: /^publicando:/, motivo: 'trava de publicação (10 min)' },
  { teste: /^metapages:/, motivo: 'páginas da Meta durante a conexão (10 min)' },
  { teste: /^push_janela:/, motivo: 'janela anti-rajada de push (60 s)' },
  { teste: /^aviso_pautas:/, motivo: 'agrupamento de avisos de pautas (10 min)' },
  { teste: /^aviso:/, motivo: 'aviso único com TTL (ex.: colab fora do ar, 1 h)' },
  { teste: /^erro:|^erros:log$|^erro_alerta:/, motivo: 'erros técnicos (14 dias) e janela de alerta' },
  { teste: /^wa:(nome|foto|grupoinfo|webhook-eventos|digitando):/, motivo: 'cache do WhatsApp (nome, foto, grupo, webhook, digitando)' },
  { teste: /^wa:versao$/, motivo: 'contador da tela ao vivo' },
  { teste: /^(aprov_atraso|entrega_atraso|renov_alerta|frota_alerta):/, motivo: 'deduplicação de alerta com TTL' },
  { teste: /^(crm_followup_notif|crm_agenda_notif):/, motivo: 'deduplicação de aviso do CRM (26 h)' },
  { teste: /^tarefa_notif_/, motivo: 'deduplicação de aviso de prazo' },
]

export function foraDoBackup(chave: string): boolean {
  return FORA_DO_BACKUP.some(r => r.teste.test(chave))
}

// Históricos com validade: entram, e voltam com o TTL que ainda restava.
// TTLs copiados de lib/logCliente.ts (TTL_SEG) e lib/auditoria.ts (TTL).
const VALIDADE: { prefixo: string; ttlSeg: number; momento: (v: any) => number }[] = [
  { prefixo: 'log:', ttlSeg: 30 * 24 * 3600, momento: v => Number(v?.ts) },
  { prefixo: 'audit:', ttlSeg: 180 * 24 * 3600, momento: v => Date.parse(v?.criadoEm) },
]

// Quanto TTL resta para a chave no momento `agora`. undefined = não expira;
// 0 = já teria vencido (não restaura).
export function ttlRestante(chave: string, valor: any, agora = Date.now()): number | undefined {
  const r = VALIDADE.find(v => chave.startsWith(v.prefixo))
  if (!r) return undefined
  const m = r.momento(valor)
  if (!Number.isFinite(m)) return r.ttlSeg
  return Math.max(0, Math.ceil(r.ttlSeg - (agora - m) / 1000))
}

// Trava de poltrona (lib/assentos): é SET NX. No restore só volta se a poltrona
// estiver livre hoje — nunca toma o assento de uma reserva feita depois do backup.
const SO_SE_LIVRE = [/^viagem:[^:]+:assento:/]

// Listas gravadas com LPUSH (mais novo na frente). As demais (WhatsApp,
// Instagram, chat interno) são RPUSH (mais novo no fim).
const LISTAS_NOVO_NA_FRENTE = [/^auditoria:log$/, /^agente:acoes$/]

async function todasAsChaves(prazo: number): Promise<{ chaves: string[]; incompleto: boolean }> {
  const vistas = new Set<string>()
  let cursor: string | number = 0
  do {
    if (Date.now() > prazo) return { chaves: Array.from(vistas), incompleto: true }
    const [prox, lote] = await redis.scan(cursor, { count: 1000 })
    cursor = prox
    for (const k of lote as string[]) vistas.add(k)
  } while (String(cursor) !== '0')
  return { chaves: Array.from(vistas), incompleto: false }
}

async function lerPorTipo(chave: string): Promise<ChaveBackup | null> {
  const tipo = await redis.type(chave)
  if (tipo === 'string') { const v = await redis.get(chave); return v == null ? null : { tipo, valor: v } }
  if (tipo === 'set') return { tipo, valor: await redis.smembers(chave) }
  if (tipo === 'list') return { tipo, valor: await redis.lrange(chave, 0, -1) }
  if (tipo === 'hash') return { tipo, valor: await redis.hgetall(chave) }
  if (tipo === 'zset') {
    const plano = (await redis.zrange(chave, 0, -1, { withScores: true })) as any[]
    const pares: { member: any; score: number }[] = []
    for (let i = 0; i + 1 < plano.length; i += 2) pares.push({ member: plano[i], score: Number(plano[i + 1]) })
    return { tipo, valor: pares }
  }
  return null // 'none' (sumiu durante a varredura) ou tipo que o código não usa
}

export async function exportarChavesLivres(cobertas: Set<string>, prazo = Date.now() + PRAZO_PADRAO_MS): Promise<{ chaves: Record<string, ChaveBackup>; incompleto: boolean }> {
  const varredura = await todasAsChaves(prazo)
  let incompleto = varredura.incompleto
  const candidatas = varredura.chaves.filter(k => !cobertas.has(k) && !foraDoBackup(k)).sort()
  const chaves: Record<string, ChaveBackup> = {}

  // MGET devolve null para chave que não é string: as strings saem em lote, o
  // resto vai pelo TYPE, uma a uma.
  const valores = await mgetChunk<any>(candidatas)
  const outras: string[] = []
  candidatas.forEach((k, i) => {
    if (valores[i] != null) chaves[k] = { tipo: 'string', valor: valores[i] }
    else outras.push(k)
  })
  for (let i = 0; i < outras.length; i += PARALELO) {
    if (Date.now() > prazo) { incompleto = true; break }
    const lote = outras.slice(i, i + PARALELO)
    const lidos = await Promise.all(lote.map(k => lerPorTipo(k)))
    lote.forEach((k, j) => { const l = lidos[j]; if (l) chaves[k] = l })
  }
  return { chaves, incompleto }
}

function contarPorPrefixo(chaves: Record<string, ChaveBackup>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of Object.keys(chaves)) { const p = k.split(':')[0]; out[p] = (out[p] || 0) + 1 }
  return out
}

export async function exportarTudo(opts: { prazo?: number } = {}): Promise<any> {
  const lidos = await Promise.all(COLECOES.map(c => exportarSet(c.set, c.prefixo)))

  const dados: any = {}
  const cobertas = new Set<string>()
  COLECOES.forEach((c, i) => {
    gravarCampo(dados, c.campo, lidos[i].objs)
    cobertas.add(c.set)
    for (const id of lidos[i].ids) cobertas.add(`${c.prefixo}${id}`)
  })

  const configVals = await mgetChunk<any>(CONFIG_KEYS)
  const config: Record<string, any> = {}
  CONFIG_KEYS.forEach((k, i) => { cobertas.add(k); if (configVals[i] != null) config[k] = configVals[i] })

  // Área pessoal por usuário (notepads/microtarefas).
  const emails = (dados.usuarios as any[]).map(u => u?.email).filter(Boolean) as string[]
  const personalVals = await mgetChunk<any>(emails.map(e => `personal:${e}`))
  const personal: Record<string, any> = {}
  emails.forEach((e, i) => { cobertas.add(`personal:${e}`); if (personalVals[i] != null) personal[e] = personalVals[i] })

  // Remove senha em texto plano residual dos clientes (o hash fica em usuarios).
  dados.clientes = (dados.clientes as any[]).map(c => { const { loginSenha, ...resto } = c || {}; return resto })

  const livres = await exportarChavesLivres(cobertas, opts.prazo)

  return {
    _meta: {
      versao: 2,
      geradoEm: '',
      incompleto: livres.incompleto,
      contagens: {
        clientes: dados.clientes.length, usuarios: dados.usuarios.length, posts: dados.posts.length, tarefas: dados.tarefas.length,
        marcos: dados.marcos.length, briefings: dados.briefings.length, planos: dados.planos.length,
        crm: { negocios: dados.crm.negocios.length, contatos: dados.crm.contatos.length, empresas: dados.crm.empresas.length },
        chaves: Object.keys(livres.chaves).length,
        chavesPorPrefixo: contarPorPrefixo(livres.chaves),
      },
    },
    ...dados,
    config, personal,
    chaves: livres.chaves,
  }
}

// Store do backup. O backup tem hash de senha e tokens da Meta: só vai para store
// PRIVADO. Instância cujo store principal é público (a agência: o Instagram
// precisa baixar a mídia por URL) liga um segundo store, privado, só para o
// backup, com o prefixo de env BACKUP_BLOB (vira BACKUP_BLOB_READ_WRITE_TOKEN).
// Sem ele, cai no store principal — que precisa ser privado, ou o put falha.
export function tokenBackup(): string | undefined {
  return process.env.BACKUP_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN
}

// Gera o backup e salva no Blob PRIVADO em backups/YYYY-MM-DD.json (sobrescreve o
// do dia). Mantém os últimos 35 diários. Retorna a URL (privada) e o tamanho.
export async function salvarBackup(): Promise<{ pathname: string; tamanho: number; contagens: any; incompleto: boolean }> {
  const token = tokenBackup()
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN não configurado')
  const inicio = Date.now()
  const dados = await exportarTudo({ prazo: inicio + PRAZO_PADRAO_MS })
  const agora = new Date()
  dados._meta.geradoEm = agora.toISOString()
  const json = JSON.stringify(dados)
  const dia = agora.toISOString().slice(0, 10)
  const res = await put(`backups/${dia}.json`, json, { access: 'private' as any, contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, token })
    .catch((e: any) => {
      if (/private access on a public store/i.test(String(e?.message))) {
        throw new Error('o store de Blob desta instância é PÚBLICO e o backup não pode ir para lá. Crie um store privado na Vercel e ligue ao projeto com o prefixo BACKUP_BLOB (env BACKUP_BLOB_READ_WRITE_TOKEN).')
      }
      throw e
    })

  if (dados._meta.incompleto) {
    await capturarErro('cron/backup', new Error('backup salvo INCOMPLETO: a varredura das chaves estourou o prazo'), { tamanho: json.length, chaves: dados._meta.contagens.chaves })
  }

  // Retenção: mantém os 35 backups diários mais recentes.
  try {
    const { blobs } = await list({ prefix: 'backups/', token })
    const antigos = blobs
      .filter(b => /backups\/\d{4}-\d{2}-\d{2}\.json$/.test(b.pathname))
      .sort((a, b) => b.pathname.localeCompare(a.pathname))
      .slice(35)
    for (const b of antigos) await del(b.url, { token }).catch(() => {})
  } catch { /* retenção é best-effort */ }

  return { pathname: res.pathname, tamanho: json.length, contagens: dados._meta.contagens, incompleto: !!dados._meta.incompleto }
}

// Lê um backup gerenciado (backups/AAAA-MM-DD.json) no servidor. Store privado
// exige o get() do SDK: fetch cru com Authorization: Bearer não autentica.
export async function lerBackupDoBlob(pathname: string): Promise<any | null> {
  const token = tokenBackup()
  const { blobs } = await list({ prefix: 'backups/', token })
  const alvo = blobs.find(b => b.pathname === pathname)
  if (!alvo) return null
  const r = await get(alvo.url, { access: 'private', token })
  if (!r?.stream) throw new Error('não consegui ler o backup do Blob')
  return JSON.parse(await new Response(r.stream as any).text())
}

// ── Restore ─────────────────────────────────────────────────────────────────

// Restaura um backup (recuperação de desastre). Semântica de SEGURANÇA: UPSERT —
// reescreve cada entidade do backup e a re-indexa, mas NUNCA apaga/flush nada que
// exista hoje. Assim, no pior caso sobrescreve registros atuais com a versão do
// backup (comportamento esperado de DR), sem risco de zerar o banco.
// Por tipo, na parte `chaves`:
//  - string: sobrescreve (trava de poltrona: só se estiver livre; log/audit: com o TTL que restava)
//  - set / zset / hash: soma membros/campos aos que já existem
//  - list: se não existe, volta inteira; se já existe (ex.: chegou mensagem de
//    WhatsApp entre o desastre e o restore), entram só os itens que faltam, do
//    lado dos mais antigos
// Índices remontados: `agendados` (posts com status agendado) e
// `plano:{id}:pautas` (posts com planoId) — também ao abrir backup v1.
// Opções:
//  - simular: percorre e valida o backup inteiro e devolve o relatório do que
//    SERIA restaurado, sem gravar nada (ensaio de DR sem risco).
//  - clienteId: restaura SÓ o que é daquele cliente: o registro dele, entidades
//    com clienteId dele (das coleções e da parte `chaves`), chaves com o id dele
//    no nome (ex.: comunicados:{id}, cliente:{id}:nps) e, nos sets do backup, os
//    ids restaurados (ex.: a pauta volta para posts_excluidos ou plano:{id}:pautas).
//    Configs, área pessoal e o resto da instância não são tocados.
export type OpcoesRestore = { simular?: boolean; clienteId?: string; agora?: number }
export type ResultadoRestore = {
  contagens: Record<string, number>
  simulado: boolean
  clientesNoBackup?: { id: string; nome: string }[] // devolvido na simulação (p/ escolher o escopo)
}

const json = (v: any) => (typeof v === 'string' ? v : JSON.stringify(v))

// Lista que já existe: devolve os itens do backup que faltam nela, na ordem.
export function itensQueFaltam(backup: any[], atual: any[]): any[] {
  const tem = new Set(atual.map(json))
  return backup.filter(v => !tem.has(json(v)))
}

export function chaveDoCliente(chave: string, clienteId: string): boolean {
  return chave.split(':').includes(clienteId)
}

async function emPedacos<T>(itens: T[], tam: number, fn: (lote: T[]) => Promise<unknown>) {
  for (let i = 0; i < itens.length; i += tam) await fn(itens.slice(i, i + tam))
}

export async function restaurarBackup(dados: any, opts: OpcoesRestore = {}): Promise<ResultadoRestore> {
  if (!dados || typeof dados !== 'object' || !dados._meta) throw new Error('arquivo de backup inválido (sem _meta)')
  const contagens: Record<string, number> = {}
  const simular = !!opts.simular
  const escopo = (opts.clienteId || '').trim()
  const agora = opts.agora ?? Date.now()
  const idsRestaurados = new Set<string>()
  const postsRestaurados: any[] = []

  for (const c of COLECOES) {
    const itens = lerCampo(dados, c.campo)
    if (!Array.isArray(itens)) continue
    const chaveDe = c.chaveDe || ((o: any) => o?.id)
    let n = 0
    for (const o of itens) {
      const id = o ? chaveDe(o) : undefined
      if (!id) continue
      // Escopo por cliente: o próprio registro do cliente OU entidades com clienteId dele.
      if (escopo && !(c.set === 'clientes' ? o.id === escopo : o.clienteId === escopo)) continue
      if (!simular) {
        await redis.set(`${c.prefixo}${id}`, o)
        await redis.sadd(c.set, id)
      }
      idsRestaurados.add(String(id))
      if (c.set === 'posts') postsRestaurados.push(o)
      n++
    }
    contagens[c.set] = n
  }

  // Índices que vivem fora do objeto: fila do cron e pautas de cada plano.
  let nAg = 0, nPl = 0
  for (const p of postsRestaurados) {
    if (p.status === 'agendado') { if (!simular) await redis.sadd('agendados', p.id); nAg++ }
    if (p.planoId) { if (!simular) await redis.sadd(`plano:${p.planoId}:pautas`, p.id); nPl++ }
  }
  contagens['agendados'] = nAg
  contagens['plano:pautas'] = nPl

  // Config e área pessoal são globais — só entram no restore COMPLETO (sem escopo).
  let nc = 0
  if (!escopo && dados.config && typeof dados.config === 'object') {
    for (const [k, v] of Object.entries(dados.config)) { if (v != null) { if (!simular) await redis.set(k, v); nc++ } }
  }
  contagens['config'] = nc

  let np = 0
  if (!escopo && dados.personal && typeof dados.personal === 'object') {
    for (const [email, v] of Object.entries(dados.personal)) { if (v != null) { if (!simular) await redis.set(`personal:${email}`, v); np++ } }
  }
  contagens['personal'] = np

  // Parte 2 (backup v2+). Strings primeiro: no escopo, elas decidem que ids
  // voltam, e os sets depois recebem esses ids.
  const chaves: Record<string, ChaveBackup> = dados.chaves && typeof dados.chaves === 'object' ? dados.chaves : {}
  const entradas = Object.entries(chaves).filter(([k, c]) => c && c.tipo && !foraDoBackup(k))
  let nStr = 0, nSet = 0, nList = 0, nZset = 0, nHash = 0, nVencidas = 0, nOcupadas = 0

  for (const [k, c] of entradas) {
    if (c.tipo !== 'string' || c.valor == null) continue
    const v = c.valor
    if (escopo && !chaveDoCliente(k, escopo) && !(v && typeof v === 'object' && v.clienteId === escopo)) continue
    const ttl = ttlRestante(k, v, agora)
    if (ttl === 0) { nVencidas++; continue }
    if (!simular) {
      if (SO_SE_LIVRE.some(r => r.test(k))) {
        const ok = await redis.set(k, v, { nx: true })
        if (ok !== 'OK') { nOcupadas++; continue }
      } else if (ttl !== undefined) await redis.set(k, v, { ex: ttl })
      else await redis.set(k, v)
    }
    if (v && typeof v === 'object' && v.id) idsRestaurados.add(String(v.id))
    nStr++
  }

  for (const [k, c] of entradas) {
    if (c.tipo === 'string') continue
    const inteira = !escopo || chaveDoCliente(k, escopo)
    if (c.tipo === 'set' && Array.isArray(c.valor)) {
      const membros = inteira ? c.valor : c.valor.filter((m: any) => idsRestaurados.has(String(m)))
      if (!membros.length) continue
      if (!simular) await emPedacos(membros, 500, l => redis.sadd(k, l[0], ...l.slice(1)))
      nSet++
    } else if (!inteira) {
      continue // lista, zset e hash só voltam no escopo se a chave for do cliente
    } else if (c.tipo === 'list' && Array.isArray(c.valor) && c.valor.length) {
      if (!simular) {
        const atual = await redis.lrange(k, 0, -1)
        const faltam = atual.length ? itensQueFaltam(c.valor, atual) : c.valor
        if (faltam.length) {
          const novoNaFrente = LISTAS_NOVO_NA_FRENTE.some(r => r.test(k))
          // Lista vazia ou mais-novo-na-frente: os que faltam são os antigos e vão
          // para o fim. Mais-novo-no-fim: os antigos vão para a frente, na ordem.
          if (!atual.length || novoNaFrente) await emPedacos(faltam, 500, l => redis.rpush(k, ...l))
          else await redis.lpush(k, ...faltam.slice().reverse())
        }
      }
      nList++
    } else if (c.tipo === 'zset' && Array.isArray(c.valor) && c.valor.length) {
      if (!simular) await emPedacos(c.valor as { member: any; score: number }[], 500, l => (redis.zadd as any)(k, l[0], ...l.slice(1)))
      nZset++
    } else if (c.tipo === 'hash' && c.valor && typeof c.valor === 'object' && Object.keys(c.valor).length) {
      if (!simular) await redis.hset(k, c.valor)
      nHash++
    }
  }
  contagens['chaves:string'] = nStr
  contagens['chaves:set'] = nSet
  contagens['chaves:list'] = nList
  contagens['chaves:zset'] = nZset
  contagens['chaves:hash'] = nHash
  contagens['chaves:vencidas'] = nVencidas
  contagens['chaves:poltronaOcupada'] = nOcupadas

  const clientesNoBackup = simular && Array.isArray(dados.clientes)
    ? dados.clientes.filter((c: any) => c?.id).map((c: any) => ({ id: c.id, nome: c.nome || c.id }))
    : undefined

  return { contagens, simulado: simular, clientesNoBackup }
}

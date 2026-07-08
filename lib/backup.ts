import { redis } from './redis'
import { put, list, del } from '@vercel/blob'

// Backup completo do Redis para o Vercel Blob (PRIVADO). Exporta as entidades
// principais + config + dados pessoais. Usado pelo cron diário e pelo download
// on-demand do admin. NUNCA exponha o resultado publicamente (contém senhas hash,
// tokens etc.).

const CHUNK = 200

async function mgetChunk<T>(keys: string[]): Promise<(T | null)[]> {
  if (!keys.length) return []
  const out: (T | null)[] = []
  for (let i = 0; i < keys.length; i += CHUNK) {
    const slice = keys.slice(i, i + CHUNK)
    out.push(...(await redis.mget<(T | null)[]>(...slice)))
  }
  return out
}

async function exportarSet(setKey: string, prefixo: string): Promise<any[]> {
  const ids = await redis.smembers(setKey)
  if (!ids.length) return []
  const objs = await mgetChunk<any>(ids.map(id => `${prefixo}${id}`))
  return objs.filter(Boolean)
}

const CONFIG_KEYS = [
  'config:agencia', 'config:automacoes', 'config:automacoesRegras', 'config:permissoesPapel',
  'config:permissoesGranular', 'config:operacional', 'config:notificacoes', 'config:resumoTemplates',
  'config:contasBancarias', 'config:contasMensagensIg', 'crm:estagios', 'crm:pipelines',
  'crm:playbookQualificacao', 'tipos:tarefa', 'config:anthropicSaldo',
]

export async function exportarTudo(): Promise<any> {
  const [clientes, usuarios, posts, tarefas, tarefasExcluidas, marcos, templates, despesas, candidaturas, briefings, planos, negocios, contatos, empresas, agentes, documentos, mapas] = await Promise.all([
    exportarSet('clientes', 'cliente:'),
    exportarSet('usuarios', 'usuario:'),
    exportarSet('posts', 'post:'),
    exportarSet('tarefas', 'tarefa:'),
    exportarSet('tarefas_excluidas', 'tarefa:'),
    exportarSet('marcos', 'marco:'),
    exportarSet('templates', 'template:'),
    exportarSet('despesas', 'despesa:'),
    exportarSet('candidaturas', 'candidatura:'),
    exportarSet('briefings', 'briefing:'),
    exportarSet('planos', 'plano:'),
    exportarSet('crm:negocios', 'negocio:'),
    exportarSet('crm:contatos', 'contato:'),
    exportarSet('crm:empresas', 'empresa:'),
    exportarSet('agentes', 'agente:'),
    exportarSet('documentos', 'documento:'),
    exportarSet('mapas', 'mapa:'),
  ])

  const configVals = await mgetChunk<any>(CONFIG_KEYS)
  const config: Record<string, any> = {}
  CONFIG_KEYS.forEach((k, i) => { if (configVals[i] != null) config[k] = configVals[i] })

  // Área pessoal por usuário (notepads/microtarefas).
  const emails = usuarios.map((u: any) => u?.email).filter(Boolean) as string[]
  const personalVals = await mgetChunk<any>(emails.map(e => `personal:${e}`))
  const personal: Record<string, any> = {}
  emails.forEach((e, i) => { if (personalVals[i] != null) personal[e] = personalVals[i] })

  // Remove senha em texto plano residual dos clientes (o hash fica em usuarios).
  const clientesLimpos = clientes.map((c: any) => { const { loginSenha, ...resto } = c || {}; return resto })

  return {
    _meta: {
      versao: 1,
      geradoEm: '',
      contagens: {
        clientes: clientes.length, usuarios: usuarios.length, posts: posts.length, tarefas: tarefas.length,
        marcos: marcos.length, briefings: briefings.length, planos: planos.length,
        crm: { negocios: negocios.length, contatos: contatos.length, empresas: empresas.length },
      },
    },
    clientes: clientesLimpos, usuarios, posts, tarefas, tarefasExcluidas, marcos, templates, despesas, candidaturas, briefings, planos,
    crm: { negocios, contatos, empresas },
    agentes, documentos, mapas, config, personal,
  }
}

// Gera o backup e salva no Blob PRIVADO em backups/YYYY-MM-DD.json (sobrescreve o
// do dia). Mantém os últimos 35 diários. Retorna a URL (privada) e o tamanho.
export async function salvarBackup(): Promise<{ pathname: string; tamanho: number; contagens: any }> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN não configurado')
  const dados = await exportarTudo()
  const agora = new Date()
  dados._meta.geradoEm = agora.toISOString()
  const json = JSON.stringify(dados)
  const dia = agora.toISOString().slice(0, 10)
  const res = await put(`backups/${dia}.json`, json, { access: 'private' as any, contentType: 'application/json', addRandomSuffix: false, token })

  // Retenção: mantém os 35 backups diários mais recentes.
  try {
    const { blobs } = await list({ prefix: 'backups/', token })
    const antigos = blobs
      .filter(b => /backups\/\d{4}-\d{2}-\d{2}\.json$/.test(b.pathname))
      .sort((a, b) => b.pathname.localeCompare(a.pathname))
      .slice(35)
    for (const b of antigos) await del(b.url, { token }).catch(() => {})
  } catch { /* retenção é best-effort */ }

  return { pathname: res.pathname, tamanho: json.length, contagens: dados._meta.contagens }
}

// Restaura um backup (recuperação de desastre). Semântica de SEGURANÇA: UPSERT —
// reescreve cada entidade do backup e a re-indexa, mas NUNCA apaga/flush nada que
// exista hoje. Assim, no pior caso sobrescreve registros atuais com a versão do
// backup (comportamento esperado de DR), sem risco de zerar o banco.
// Limitação conhecida: índices derivados não exportados (ex.: cliente:{id}:posts,
// plano:{id}:pautas, notificacoes) não são reconstruídos aqui — o de posts por
// cliente é lazy (reconstrói sozinho); 'agendados' é reconstruído dos posts.
export async function restaurarBackup(dados: any): Promise<{ contagens: Record<string, number> }> {
  if (!dados || typeof dados !== 'object' || !dados._meta) throw new Error('arquivo de backup inválido (sem _meta)')
  const contagens: Record<string, number> = {}

  async function restaurarColecao(itens: any, setKey: string, prefixo: string, extra?: (o: any) => Promise<void>) {
    if (!Array.isArray(itens)) return
    let n = 0
    for (const o of itens) {
      if (!o || !o.id) continue
      await redis.set(`${prefixo}${o.id}`, o)
      await redis.sadd(setKey, o.id)
      if (extra) await extra(o)
      n++
    }
    contagens[setKey] = n
  }

  await restaurarColecao(dados.clientes, 'clientes', 'cliente:')
  await restaurarColecao(dados.usuarios, 'usuarios', 'usuario:')
  await restaurarColecao(dados.posts, 'posts', 'post:', async o => { if (o.status === 'agendado') await redis.sadd('agendados', o.id) })
  await restaurarColecao(dados.tarefas, 'tarefas', 'tarefa:')
  await restaurarColecao(dados.tarefasExcluidas, 'tarefas_excluidas', 'tarefa:')
  await restaurarColecao(dados.marcos, 'marcos', 'marco:')
  await restaurarColecao(dados.templates, 'templates', 'template:')
  await restaurarColecao(dados.despesas, 'despesas', 'despesa:')
  await restaurarColecao(dados.candidaturas, 'candidaturas', 'candidatura:')
  await restaurarColecao(dados.briefings, 'briefings', 'briefing:')
  await restaurarColecao(dados.planos, 'planos', 'plano:')
  await restaurarColecao(dados.crm?.negocios, 'crm:negocios', 'negocio:')
  await restaurarColecao(dados.crm?.contatos, 'crm:contatos', 'contato:')
  await restaurarColecao(dados.crm?.empresas, 'crm:empresas', 'empresa:')
  await restaurarColecao(dados.agentes, 'agentes', 'agente:')
  await restaurarColecao(dados.documentos, 'documentos', 'documento:')
  await restaurarColecao(dados.mapas, 'mapas', 'mapa:')

  let nc = 0
  if (dados.config && typeof dados.config === 'object') {
    for (const [k, v] of Object.entries(dados.config)) { if (v != null) { await redis.set(k, v); nc++ } }
  }
  contagens['config'] = nc

  let np = 0
  if (dados.personal && typeof dados.personal === 'object') {
    for (const [email, v] of Object.entries(dados.personal)) { if (v != null) { await redis.set(`personal:${email}`, v); np++ } }
  }
  contagens['personal'] = np

  return { contagens }
}

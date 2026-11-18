// Ferramentas de ESCRITA do conector MCP (app/api/mcp/[segredo]) — subir postagens em massa
// a partir do Claude (dono, 18/11/2026: "subir todas as postagens em massa").
//
// Duas ferramentas, usadas nesta ordem:
//   1. preparar_upload_midia — devolve, por arquivo, um token curto do Vercel Blob. Quem chama
//      envia o arquivo direto ao Blob (mesmo armazenamento do "Novo post"), sem passar pelo
//      servidor — então vídeo grande também cabe.
//   2. criar_postagens — cria até 50 posts de uma vez, com as URLs do passo 1.
//
// Proteções:
//   - Status só RASCUNHO ou AGUARDANDO APROVAÇÃO. Nunca "agendado": o cron publicaria sozinho
//     no Instagram sem ninguém da equipe olhar.
//   - Mídia só do Blob DESTE sistema (o host carrega o id do store do BLOB_READ_WRITE_TOKEN).
//   - Lote tudo-ou-nada: um item inválido e nenhum post é criado, com o erro de cada um.
//
// As regras (validar*, normalizar*) são puras e testadas em tests/mcpEscrita.test.ts. O Redis
// entra só na execução, por import dinâmico, para os testes não dependerem do banco.
import { v4 as uuid } from 'uuid'
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'
import type { Post, Cliente } from './redis'
import { limparColaboradores } from './colab'

export const AUTOR_CONECTOR = 'Claude (conector)'
export const MAX_POSTS_LOTE = 50
export const MAX_ARQUIVOS_UPLOAD = 60
export const MAX_IMAGENS_POST = 20
export const MAX_LEGENDA = 2200 // limite do Instagram
export const STATUS_PERMITIDOS = ['rascunho', 'aguardando_aprovacao'] as const
export const FORMATOS_PERMITIDOS = ['feed', 'carrossel', 'story', 'reel', 'grafico'] as const
export const TIPOS_MIDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']
const TAMANHO_MAX = 500 * 1024 * 1024
const VALIDADE_TOKEN_MS = 60 * 60 * 1000

type StatusPermitido = typeof STATUS_PERMITIDOS[number]
type FormatoPermitido = typeof FORMATOS_PERMITIDOS[number]

export function ferramentasEscrita(): any[] {
  return [
    {
      name: 'preparar_upload_midia',
      description: 'Passo 1 para subir postagens: gera, para cada arquivo, um token de upload do Vercel Blob do Soma10 (vale 1 hora). Envie cada arquivo com o SDK @vercel/blob: put(pathname, arquivo, { access: "public", token, contentType, addRandomSuffix: true }). A URL devolvida pelo put vai em criar_postagens.',
      input_schema: {
        type: 'object',
        properties: {
          arquivos: {
            type: 'array',
            description: `arquivos a enviar (até ${MAX_ARQUIVOS_UPLOAD})`,
            items: {
              type: 'object',
              properties: {
                nome: { type: 'string', description: 'nome do arquivo, ex.: Feed_01.png' },
                tipo: { type: 'string', enum: TIPOS_MIDIA, description: 'content-type do arquivo' },
              },
              required: ['nome', 'tipo'],
            },
          },
        },
        required: ['arquivos'],
      },
    },
    {
      name: 'criar_postagens',
      description: `Passo 2: cria postagens em massa (até ${MAX_POSTS_LOTE}) no Planner do Soma10, com imagens já enviadas ao Blob pelo preparar_upload_midia. Status só "rascunho" (padrão) ou "aguardando_aprovacao" (vai para a aprovação do cliente) — nunca agenda publicação. Se algum item for inválido, nada é criado e a resposta lista o erro de cada um.`,
      input_schema: {
        type: 'object',
        properties: {
          postagens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                cliente: { type: 'string', description: 'nome do cliente no Soma10 (obrigatório)' },
                imagens: { type: 'array', items: { type: 'string' }, description: 'URLs do Blob, na ordem (carrossel: 2 a 20)' },
                legenda: { type: 'string', description: `legenda do post (até ${MAX_LEGENDA} caracteres)` },
                formato: { type: 'string', enum: FORMATOS_PERMITIDOS as unknown as string[], description: 'padrão feed' },
                data: { type: 'string', description: 'data prevista AAAA-MM-DDTHH:mm (mesmo formato do campo de data do Planner) ou AAAA-MM-DD (vira 09:00). Opcional.' },
                status: { type: 'string', enum: STATUS_PERMITIDOS as unknown as string[], description: 'padrão rascunho' },
                colaboradores: { type: 'array', items: { type: 'string' }, description: '@ para colab no Instagram (até 3, opcional)' },
              },
              required: ['cliente', 'imagens'],
            },
          },
        },
        required: ['postagens'],
      },
    },
    {
      name: 'atualizar_postagens',
      description: `Edita postagens já criadas (até ${MAX_POSTS_LOTE}): data/hora prevista e/ou legenda, pelo id devolvido em criar_postagens. Só altera posts em "rascunho" ou "aguardando_aprovacao" — agendados, publicados e da lixeira ficam de fora. Se algum item for inválido, nada é alterado e a resposta lista o erro de cada um.`,
      input_schema: {
        type: 'object',
        properties: {
          postagens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'id do post (devolvido por criar_postagens)' },
                data: { type: 'string', description: 'nova data prevista AAAA-MM-DDTHH:mm ou AAAA-MM-DD (vira 09:00)' },
                legenda: { type: 'string', description: `nova legenda (até ${MAX_LEGENDA} caracteres)` },
              },
              required: ['id'],
            },
          },
        },
        required: ['postagens'],
      },
    },
  ]
}

const NOMES_ESCRITA = ['preparar_upload_midia', 'criar_postagens', 'atualizar_postagens']
export const ehFerramentaEscrita = (nome: string) => NOMES_ESCRITA.includes(nome)

// ---------- Regras puras ----------

/** Id do store a partir do token rw (vercel_blob_rw_<storeId>_<segredo>). Vazio se não reconhecer. */
export function storeIdDoToken(token: string | undefined): string {
  const partes = (token || '').split('_')
  return partes.length >= 5 && partes[0] === 'vercel' && partes[1] === 'blob' && partes[2] === 'rw' ? partes[3] : ''
}

/** A URL é do Blob deste sistema? Com store conhecido, o host tem de ser o dele. */
export function urlDoBlob(url: unknown, storeId: string): boolean {
  if (typeof url !== 'string') return false
  let u: URL
  try { u = new URL(url) } catch { return false }
  if (u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase()
  if (!host.endsWith('.public.blob.vercel-storage.com')) return false
  return !storeId || host === `${storeId.toLowerCase()}.public.blob.vercel-storage.com`
}

/** Nome de arquivo seguro para o pathname do Blob. */
export function nomeSeguro(nome: unknown): string {
  const base = String(nome ?? '').split(/[\\/]/).pop() || ''
  const limpo = base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|-+$/g, '')
  return (limpo || 'arquivo').slice(0, 80)
}

/** "2026-11-20T18:30" fica; "2026-11-20" vira 09:00; o resto é inválido (null). Vazio = sem data (''). */
export function normalizarData(valor: unknown): string | null {
  const s = String(valor ?? '').trim()
  if (!s) return ''
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/)
  if (!m) return null
  const [, a, mes, d, h = '09', min = '00'] = m
  const dt = new Date(Number(a), Number(mes) - 1, Number(d), Number(h), Number(min))
  if (dt.getFullYear() !== Number(a) || dt.getMonth() !== Number(mes) - 1 || dt.getDate() !== Number(d) || Number(h) > 23 || Number(min) > 59) return null
  return `${a}-${mes}-${d}T${h}:${min}`
}

export type PostagemValida = {
  cliente: string
  imagens: string[]
  legenda: string
  formato: FormatoPermitido
  dataAgendada: string
  status: StatusPermitido
  colaboradores: string[]
}

/** Valida um item do lote. Devolve a versão limpa ou a lista de erros. */
export function validarPostagem(item: any, storeId: string): { ok: true; valor: PostagemValida } | { ok: false; erros: string[] } {
  const erros: string[] = []
  const i = item && typeof item === 'object' ? item : {}
  const cliente = String(i.cliente ?? '').trim()
  if (!cliente) erros.push('cliente obrigatório')

  const formato = (String(i.formato ?? '').trim().toLowerCase() || 'feed') as FormatoPermitido
  if (!FORMATOS_PERMITIDOS.includes(formato)) erros.push(`formato inválido: ${i.formato}`)

  const status = (String(i.status ?? '').trim() || 'rascunho') as StatusPermitido
  if (!STATUS_PERMITIDOS.includes(status)) erros.push(`status não permitido: ${i.status} (use rascunho ou aguardando_aprovacao)`)

  const imagens: string[] = Array.isArray(i.imagens) ? i.imagens : []
  if (imagens.length === 0) erros.push('ao menos uma imagem')
  if (imagens.length > MAX_IMAGENS_POST) erros.push(`no máximo ${MAX_IMAGENS_POST} imagens`)
  if (formato === 'carrossel' && imagens.length === 1) erros.push('carrossel precisa de 2 imagens ou mais')
  imagens.forEach((url, n) => { if (!urlDoBlob(url, storeId)) erros.push(`imagem ${n + 1} fora do Blob do Soma10: ${String(url).slice(0, 120)}`) })

  const legenda = String(i.legenda ?? '')
  if (legenda.length > MAX_LEGENDA) erros.push(`legenda com ${legenda.length} caracteres (máx. ${MAX_LEGENDA})`)

  const dataAgendada = normalizarData(i.data)
  if (dataAgendada === null) erros.push(`data inválida: ${i.data} (use AAAA-MM-DDTHH:mm)`)

  if (erros.length) return { ok: false, erros }
  return { ok: true, valor: { cliente, imagens, legenda, formato, dataAgendada: dataAgendada as string, status, colaboradores: limparColaboradores(i.colaboradores) } }
}

export type AtualizacaoValida = { id: string; dataAgendada?: string; legenda?: string }

/** Valida um item de edição: id obrigatório e ao menos data ou legenda. Data vazia não apaga a data. */
export function validarAtualizacao(item: any): { ok: true; valor: AtualizacaoValida } | { ok: false; erros: string[] } {
  const erros: string[] = []
  const i = item && typeof item === 'object' ? item : {}
  const id = String(i.id ?? '').trim()
  if (!id) erros.push('id obrigatório')
  const temData = i.data !== undefined && i.data !== null
  const temLegenda = i.legenda !== undefined && i.legenda !== null
  if (!temData && !temLegenda) erros.push('informe data e/ou legenda')

  const valor: AtualizacaoValida = { id }
  if (temData) {
    const d = normalizarData(i.data)
    if (!d) erros.push(`data inválida: ${i.data} (use AAAA-MM-DDTHH:mm)`)
    else valor.dataAgendada = d
  }
  if (temLegenda) {
    const legenda = String(i.legenda)
    if (legenda.length > MAX_LEGENDA) erros.push(`legenda com ${legenda.length} caracteres (máx. ${MAX_LEGENDA})`)
    else valor.legenda = legenda
  }
  return erros.length ? { ok: false, erros } : { ok: true, valor }
}

/** Acha o cliente pelo nome: exato, depois contém. Mais de um "contém" = ambíguo. */
export function acharCliente<C extends { nome: string }>(clientes: C[], nome: string): { cliente: C } | { erro: string } {
  const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const alvo = norm(nome)
  const exato = clientes.find(c => norm(c.nome) === alvo)
  if (exato) return { cliente: exato }
  const parecidos = clientes.filter(c => norm(c.nome).includes(alvo) || (norm(c.nome) && alvo.includes(norm(c.nome))))
  if (parecidos.length === 1) return { cliente: parecidos[0] }
  if (parecidos.length > 1) return { erro: `cliente ambíguo "${nome}": ${parecidos.map(c => c.nome).join(', ')}` }
  return { erro: `cliente não encontrado: "${nome}"` }
}

// ---------- Execução ----------

export async function executarEscrita(nome: string, input: any): Promise<string> {
  try {
    if (nome === 'preparar_upload_midia') return await prepararUpload(input || {})
    if (nome === 'criar_postagens') return await criarPostagens(input || {})
    if (nome === 'atualizar_postagens') return await atualizarPostagens(input || {})
    return JSON.stringify({ erro: `ferramenta desconhecida: ${nome}` })
  } catch (e: any) {
    return JSON.stringify({ erro: e?.message || 'falha na escrita' })
  }
}

async function prepararUpload(input: any): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return JSON.stringify({ erro: 'BLOB_READ_WRITE_TOKEN não configurado nesta instância' })
  const arquivos: any[] = Array.isArray(input.arquivos) ? input.arquivos : []
  if (!arquivos.length) return JSON.stringify({ erro: 'informe ao menos um arquivo' })
  if (arquivos.length > MAX_ARQUIVOS_UPLOAD) return JSON.stringify({ erro: `no máximo ${MAX_ARQUIVOS_UPLOAD} arquivos por chamada` })
  const invalidos = arquivos.filter(a => !TIPOS_MIDIA.includes(a?.tipo)).map(a => `${a?.nome}: tipo ${a?.tipo}`)
  if (invalidos.length) return JSON.stringify({ erro: 'tipo de arquivo não aceito', invalidos, aceitos: TIPOS_MIDIA })

  const validUntil = Date.now() + VALIDADE_TOKEN_MS
  const uploads = await Promise.all(arquivos.map(async a => {
    const pathname = `midia/mcp-${uuid().slice(0, 8)}-${nomeSeguro(a.nome)}`
    const clientToken = await generateClientTokenFromReadWriteToken({
      token, pathname, allowedContentTypes: [a.tipo], maximumSizeInBytes: TAMANHO_MAX, validUntil, addRandomSuffix: true,
    })
    return { nome: a.nome, tipo: a.tipo, pathname, token: clientToken }
  }))
  return JSON.stringify({ validoAte: new Date(validUntil).toISOString(), uploads })
}

async function criarPostagens(input: any): Promise<string> {
  const itens: any[] = Array.isArray(input.postagens) ? input.postagens : []
  if (!itens.length) return JSON.stringify({ erro: 'informe ao menos uma postagem' })
  if (itens.length > MAX_POSTS_LOTE) return JSON.stringify({ erro: `no máximo ${MAX_POSTS_LOTE} postagens por chamada` })

  const { redis } = await import('./redis')
  const ids = await redis.smembers('clientes')
  const clientes = (ids.length ? ((await redis.mget<(Cliente | null)[]>(...ids.map(i => `cliente:${i}`))).filter(Boolean) as Cliente[]) : [])
    .filter(c => !(c as any).arquivado)

  const storeId = storeIdDoToken(process.env.BLOB_READ_WRITE_TOKEN)
  const prontos: { valor: PostagemValida; cliente: Cliente }[] = []
  const erros: { item: number; erros: string[] }[] = []
  itens.forEach((item, n) => {
    const v = validarPostagem(item, storeId)
    if ('erros' in v) { erros.push({ item: n + 1, erros: v.erros }); return }
    const achado = acharCliente(clientes, v.valor.cliente)
    if ('erro' in achado) { erros.push({ item: n + 1, erros: [achado.erro] }); return }
    prontos.push({ valor: v.valor, cliente: achado.cliente })
  })
  if (erros.length) return JSON.stringify({ erro: 'nenhuma postagem criada — corrija os itens abaixo', erros })

  const { indexarPost } = await import('./postsIndex')
  const agora = new Date().toISOString()
  const criados = []
  for (const { valor, cliente } of prontos) {
    const post: Post = {
      id: uuid(),
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      imagens: valor.imagens,
      legenda: valor.legenda,
      status: valor.status,
      formato: valor.formato,
      ...(valor.dataAgendada ? { dataAgendada: valor.dataAgendada } : {}),
      codigo: Math.floor(100000 + Math.random() * 900000).toString(),
      criadoPor: AUTOR_CONECTOR,
      criadoEm: agora,
      atualizadoEm: agora,
      ...(valor.colaboradores.length ? { colaboradores: valor.colaboradores } : {}),
      redes: ['instagram', 'facebook'],
    }
    await redis.set(`post:${post.id}`, post)
    await redis.sadd('posts', post.id)
    await indexarPost(post.clienteId, post.id)
    criados.push({ id: post.id, cliente: post.clienteNome, formato: post.formato, status: post.status, data: post.dataAgendada || null, link: `${process.env.APPROVAL_BASE_URL || ''}/aprovar/${post.id}` })
  }
  return JSON.stringify({ criados: criados.length, postagens: criados })
}

async function atualizarPostagens(input: any): Promise<string> {
  const itens: any[] = Array.isArray(input.postagens) ? input.postagens : []
  if (!itens.length) return JSON.stringify({ erro: 'informe ao menos uma postagem' })
  if (itens.length > MAX_POSTS_LOTE) return JSON.stringify({ erro: `no máximo ${MAX_POSTS_LOTE} postagens por chamada` })

  const validos: (AtualizacaoValida | null)[] = []
  const erros: { item: number; erros: string[] }[] = []
  const vistos = new Set<string>()
  itens.forEach((item, n) => {
    const v = validarAtualizacao(item)
    if ('erros' in v) { erros.push({ item: n + 1, erros: v.erros }); validos.push(null); return }
    if (vistos.has(v.valor.id)) { erros.push({ item: n + 1, erros: [`id repetido no lote: ${v.valor.id}`] }); validos.push(null); return }
    vistos.add(v.valor.id)
    validos.push(v.valor)
  })

  const { redis } = await import('./redis')
  const ids = validos.map(v => v?.id).filter(Boolean) as string[]
  const encontrados = ids.length ? await redis.mget<(Post | null)[]>(...ids.map(id => `post:${id}`)) : []
  const porId = new Map<string, Post>()
  ids.forEach((id, k) => { if (encontrados[k]) porId.set(id, encontrados[k] as Post) })

  validos.forEach((v, n) => {
    if (!v) return
    const post = porId.get(v.id)
    if (!post) { erros.push({ item: n + 1, erros: [`post não encontrado: ${v.id}`] }); return }
    if ((post as any).excluidoEm) { erros.push({ item: n + 1, erros: ['post está na lixeira'] }); return }
    if (!(STATUS_PERMITIDOS as readonly string[]).includes(post.status)) {
      erros.push({ item: n + 1, erros: [`status "${post.status}" não pode ser editado pelo conector (só rascunho ou aguardando_aprovacao)`] })
    }
  })
  if (erros.length) {
    erros.sort((a, b) => a.item - b.item)
    return JSON.stringify({ erro: 'nenhuma postagem alterada — corrija os itens abaixo', erros })
  }

  const agora = new Date().toISOString()
  const atualizados = []
  for (const v of validos as AtualizacaoValida[]) {
    const post = porId.get(v.id) as Post
    const atualizado: Post = {
      ...post,
      ...(v.dataAgendada ? { dataAgendada: v.dataAgendada } : {}),
      ...(v.legenda !== undefined ? { legenda: v.legenda } : {}),
      atualizadoEm: agora,
    }
    await redis.set(`post:${post.id}`, atualizado)
    // A pauta mudou de data: a tarefa da unidade acompanha (mesmo caminho do PUT /api/posts).
    if (post.tarefaId && v.dataAgendada && v.dataAgendada !== post.dataAgendada) {
      try { const { sincronizarTarefaComPauta } = await import('./tarefasDaPauta'); await sincronizarTarefaComPauta(post, atualizado, AUTOR_CONECTOR) } catch { /* segue */ }
    }
    atualizados.push({ id: atualizado.id, cliente: atualizado.clienteNome, formato: atualizado.formato, status: atualizado.status, data: atualizado.dataAgendada || null, link: `${process.env.APPROVAL_BASE_URL || ''}/aprovar/${atualizado.id}` })
  }
  return JSON.stringify({ atualizados: atualizados.length, postagens: atualizados })
}

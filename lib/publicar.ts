import { del } from '@vercel/blob'
import { Post } from '@/lib/redis'

// v21+ é necessário para Reels e para a tag de colaboradores (collaborators)
const VERSION = process.env.META_API_VERSION_PUBLISH || 'v21.0'
const BASE = `https://graph.facebook.com/${VERSION}`

const isVideo = (url: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(url)

// Formata o erro da Graph API com o máximo de detalhe (mensagem + código/subcódigo + msg ao usuário)
function fmtErro(e: any): string {
  if (!e) return 'Erro desconhecido'
  const cod = [e.code, e.error_subcode].filter((v: any) => v !== undefined && v !== null).join('/')
  const partes = [e.message, e.error_user_msg, cod ? `[${cod}]` : '', e.fbtrace_id ? `trace ${e.fbtrace_id}` : '']
  return partes.filter(Boolean).join(' — ')
}

function postForm(url: string, params: Record<string, string>) {
  return fetch(url, { method: 'POST', body: new URLSearchParams(params) }).then(r => r.json())
}

async function aguardarContainer(igId: string, token: string, creationId: string, tentativas = 20): Promise<boolean> {
  for (let i = 0; i < tentativas; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const st = await fetch(`${BASE}/${creationId}?fields=status_code&access_token=${token}`).then(r => r.json())
    if (st?.status_code === 'FINISHED') return true
    if (st?.status_code === 'ERROR') return false
  }
  return false
}

// Publicação via "API com login do Instagram" (graph.instagram.com)
const IG_BASE = `https://graph.instagram.com/${VERSION}`

async function aguardarContainerIG(token: string, creationId: string, tentativas = 20): Promise<boolean> {
  for (let i = 0; i < tentativas; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const st = await fetch(`${IG_BASE}/${creationId}?fields=status_code&access_token=${token}`).then(r => r.json())
    if (st?.status_code === 'FINISHED') return true
    if (st?.status_code === 'ERROR') return false
  }
  return false
}

// Erro de colaborador inválido (110/2207018 — "cannot be accessed")
function ehErroColab(e: any): boolean {
  if (!e) return false
  return e.code === 110 || e.error_subcode === 2207018 || /cannot be accessed/i.test(e.message || '')
}

// Cria o container de mídia; se o colaborador for inválido, tenta de novo SEM a tag de colab
async function criarMidiaIG(igId: string, token: string, params: Record<string, string>, colabParam: Record<string, string>): Promise<any> {
  const c = await postForm(`${IG_BASE}/${igId}/media`, { ...params, ...colabParam })
  if (c?.error && Object.keys(colabParam).length && ehErroColab(c.error)) {
    return await postForm(`${IG_BASE}/${igId}/media`, params)
  }
  return c
}

// Espera o container ficar pronto e publica, com novas tentativas caso a mídia ainda não esteja pronta (9007/2207027)
async function publicarMidiaIG(igId: string, token: string, creationId: string): Promise<{ ok: boolean; error?: string }> {
  await aguardarContainerIG(token, creationId, 20)
  for (let i = 0; i < 6; i++) {
    const pub = await postForm(`${IG_BASE}/${igId}/media_publish`, { access_token: token, creation_id: creationId })
    if (!pub?.error) return { ok: true }
    const naoPronta = pub.error.code === 9007 || pub.error.error_subcode === 2207027
    if (naoPronta) { await new Promise(r => setTimeout(r, 4000)); continue }
    return { ok: false, error: fmtErro(pub.error) }
  }
  return { ok: false, error: 'A mídia não ficou pronta a tempo no Instagram. Tente publicar novamente.' }
}

export async function publishToInstagram(post: Post, cliente?: any): Promise<{ ok: boolean; error?: string }> {
  const TOKEN = cliente?.instagramToken
  const IG_ID = cliente?.instagramUserId
  if (!TOKEN || !IG_ID) return { ok: false, error: 'Instagram não conectado (faça a conexão com login do Instagram).' }

  const midias = post.imagens || []
  if (midias.length === 0) return { ok: false, error: 'O post não possui mídia para publicar.' }

  const colab = (post.colaboradores || []).slice(0, 3)
  const colabParam: Record<string, string> = colab.length ? { collaborators: JSON.stringify(colab) } : {}
  const formato = post.formato || 'feed'
  const capas = post.capasVideo || {}

  try {
    if (formato === 'story') {
      const m = midias[0]
      const c = await postForm(`${IG_BASE}/${IG_ID}/media`, { access_token: TOKEN, media_type: 'STORIES', ...(isVideo(m) ? { video_url: m } : { image_url: m }) })
      if (c?.error) return { ok: false, error: fmtErro(c.error) }
      return await publicarMidiaIG(IG_ID, TOKEN, c.id)
    }

    if (midias.length === 1) {
      const m = midias[0]
      const params = isVideo(m)
        ? { access_token: TOKEN, media_type: 'REELS', video_url: m, caption: post.legenda, ...(capas[m] ? { cover_url: capas[m] } : {}) }
        : { access_token: TOKEN, image_url: m, caption: post.legenda }
      const c = await criarMidiaIG(IG_ID, TOKEN, params, colabParam)
      if (c?.error) return { ok: false, error: fmtErro(c.error) }
      return await publicarMidiaIG(IG_ID, TOKEN, c.id)
    }

    const itensIds: string[] = []
    for (const m of midias) {
      const item = await postForm(`${IG_BASE}/${IG_ID}/media`, isVideo(m)
        ? { access_token: TOKEN, media_type: 'VIDEO', video_url: m, is_carousel_item: 'true', ...(capas[m] ? { cover_url: capas[m] } : {}) }
        : { access_token: TOKEN, image_url: m, is_carousel_item: 'true' })
      if (item?.error) return { ok: false, error: fmtErro(item.error) }
      if (isVideo(m) && !(await aguardarContainerIG(TOKEN, item.id))) return { ok: false, error: 'Falha no processamento de um vídeo do carrossel.' }
      itensIds.push(item.id)
    }
    const carousel = await criarMidiaIG(IG_ID, TOKEN, { access_token: TOKEN, media_type: 'CAROUSEL', children: itensIds.join(','), caption: post.legenda }, colabParam)
    if (carousel?.error) return { ok: false, error: fmtErro(carousel.error) }
    return await publicarMidiaIG(IG_ID, TOKEN, carousel.id)
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro de comunicação com o Instagram.' }
  }
}

// Publica o vídeo na Página do Facebook.
// Estratégia 1 (preferida): baixa o vídeo do nosso Blob e ENVIA o arquivo direto
//   ao Facebook (upload "source" multipart). Assim o Facebook não precisa buscar a
//   URL, eliminando o erro 389/1363057 "Unable to fetch video file from URL".
// Estratégia 2 (fallback): pede ao Facebook para buscar a URL (file_url), com
//   repetição em falhas transitórias de fetch.
async function publicarVideoFB(pageId: string, token: string, fileUrl: string, descricao: string): Promise<any> {
  // 1) Upload direto do arquivo (source)
  try {
    const resp = await fetch(fileUrl)
    if (resp.ok) {
      const buf = Buffer.from(await resp.arrayBuffer())
      const nome = (fileUrl.split('?')[0].split('/').pop() || 'video.mp4')
      const ehMov = /\.mov(\?|$)/i.test(fileUrl)
      const fd = new FormData()
      fd.append('access_token', token)
      if (descricao) fd.append('description', descricao)
      fd.append('source', new Blob([buf], { type: ehMov ? 'video/quicktime' : 'video/mp4' }), nome)
      const r = await fetch(`${BASE}/${pageId}/videos`, { method: 'POST', body: fd }).then(x => x.json())
      if (!r?.error) return r
      // Se for erro de formato/permissão (não de fetch), retorna já — o file_url não resolveria
      const sub = r.error?.error_subcode
      const ehFalhaDeFetch = r.error?.code === 389 || [1363057, 1363019, 1363030, 1363037].includes(sub)
      if (!ehFalhaDeFetch) return r
    }
  } catch { /* cai para o fallback file_url */ }

  // 2) Fallback: file_url com repetição em falhas transitórias de fetch
  let ultimo: any = null
  for (let i = 0; i < 3; i++) {
    const r = await postForm(`${BASE}/${pageId}/videos`, { access_token: token, file_url: fileUrl, description: descricao })
    if (!r?.error) return r
    ultimo = r
    const sub = r.error?.error_subcode
    const ehFalhaDeFetch = r.error?.code === 389 || [1363057, 1363019, 1363030, 1363037].includes(sub)
    if (!ehFalhaDeFetch) break
    await new Promise(res => setTimeout(res, 5000 * (i + 1)))
  }
  return ultimo
}

export async function publishToFacebook(post: Post, cliente?: any): Promise<{ ok: boolean; error?: string }> {
  const TOKEN = cliente?.metaConectado && cliente?.facebookPageToken ? cliente.facebookPageToken : undefined
  const PAGE_ID = cliente?.metaConectado && cliente?.facebookPageId ? cliente.facebookPageId : undefined
  if (!TOKEN || !PAGE_ID) return { ok: false, error: 'Página do Facebook não conectada.' }

  const midias = post.imagens || []
  const imagens = midias.filter(m => !isVideo(m))
  const videos = midias.filter(isVideo)
  if (midias.length === 0) return { ok: false, error: 'O post não possui mídia para publicar.' }

  try {
    for (const v of videos) {
      const r = await publicarVideoFB(PAGE_ID, TOKEN, v, post.legenda)
      if (r?.error) return { ok: false, error: fmtErro(r.error) }
    }
    if (imagens.length === 1) {
      const r = await postForm(`${BASE}/${PAGE_ID}/photos`, { access_token: TOKEN, url: imagens[0], caption: post.legenda })
      if (r?.error) return { ok: false, error: fmtErro(r.error) }
    } else if (imagens.length > 1) {
      const ids: { media_fbid: string }[] = []
      for (const img of imagens) {
        const r = await postForm(`${BASE}/${PAGE_ID}/photos`, { access_token: TOKEN, url: img, published: 'false' })
        if (r?.error) return { ok: false, error: fmtErro(r.error) }
        ids.push({ media_fbid: r.id })
      }
      const feed = await postForm(`${BASE}/${PAGE_ID}/feed`, { access_token: TOKEN, message: post.legenda, attached_media: JSON.stringify(ids) })
      if (feed?.error) return { ok: false, error: fmtErro(feed.error) }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro de comunicação com o Facebook.' }
  }
}

const ehNossoBlob = (u: string) => /blob\.vercel-storage\.com\/.*midia\//.test(u)

function escolherThumbnail(post: Post): string | undefined {
  const midias = post.imagens || []
  const img = midias.find(m => !isVideo(m))
  if (img) return img
  const vid = midias.find(isVideo)
  if (vid && post.capasVideo?.[vid]) return post.capasVideo[vid]
  return undefined
}

async function limparMidiasMantendoCapa(post: Post): Promise<{ removidas: boolean; thumbnail?: string }> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  const thumbnail = escolherThumbnail(post)
  if (!token) return { removidas: false, thumbnail }
  const todas = [...(post.imagens || []), ...Object.values(post.capasVideo || {})]
  const apagar = todas.filter(u => ehNossoBlob(u) && u !== thumbnail)
  if (apagar.length === 0) return { removidas: false, thumbnail }
  try {
    await del(apagar, { token })
    return { removidas: true, thumbnail }
  } catch (e) {
    console.error('[limpeza] Falha ao remover mídias do Blob:', e)
    return { removidas: false, thumbnail }
  }
}

export type ResultadoPublicacao = {
  ok: boolean
  campos: Partial<Post> // campos a salvar no post
  redesOk: string
  motivo: string
}

// Publica nas redes selecionadas do post, faz a limpeza e devolve os campos a salvar.
// IMPORTANTE: respeita `redesPublicadas` — nunca republica numa rede que já deu certo.
export async function processarPublicacao(post: Post, cliente?: any): Promise<ResultadoPublicacao> {
  const temFB = !!(cliente?.facebookPageToken && cliente?.facebookPageId)
  let redes = post.redes && post.redes.length ? [...post.redes] : ['instagram', 'facebook']
  if (!temFB) redes = redes.filter(r => r !== 'facebook')
  if (redes.length === 0) redes = ['instagram']

  // Remove redes que JÁ foram publicadas com sucesso (evita duplicação)
  const jaPublicadas = (post.redesPublicadas || []) as string[]
  const redesPendentes = redes.filter(r => !jaPublicadas.includes(r))

  // Se todas as redes já foram publicadas, não faz nada (proteção contra re-execução)
  if (redesPendentes.length === 0) {
    const limpeza = await limparMidiasMantendoCapa(post)
    return {
      ok: true, redesOk: jaPublicadas.join(' e '), motivo: '',
      campos: { status: 'publicado', erroPublicacao: undefined, redesPublicadas: jaPublicadas,
        ...(limpeza.removidas ? { midiaRemovida: true } : {}),
        ...(limpeza.thumbnail ? { thumbnail: limpeza.thumbnail } : {}),
        atualizadoEm: new Date().toISOString() },
    }
  }

  const ig = redesPendentes.includes('instagram') ? await publishToInstagram(post, cliente) : { ok: true as const }
  const fb = redesPendentes.includes('facebook') ? await publishToFacebook(post, cliente) : { ok: true as const }
  const agora = new Date().toISOString()

  // Registra cada rede que deu certo (acumula com as anteriores)
  const novasOk: string[] = [...jaPublicadas]
  if (ig.ok && redesPendentes.includes('instagram')) novasOk.push('instagram')
  if (fb.ok && redesPendentes.includes('facebook')) novasOk.push('facebook')

  const todasOk = redes.every(r => novasOk.includes(r))

  if (todasOk) {
    const limpeza = await limparMidiasMantendoCapa(post)
    return {
      ok: true, redesOk: novasOk.join(' e '), motivo: '',
      campos: { status: 'publicado', erroPublicacao: undefined, redesPublicadas: novasOk,
        ...(limpeza.removidas ? { midiaRemovida: true } : {}),
        ...(limpeza.thumbnail ? { thumbnail: limpeza.thumbnail } : {}),
        atualizadoEm: agora },
    }
  }

  const motivo = [
    !ig.ok && redesPendentes.includes('instagram') ? `Instagram — ${(ig as any).error}` : null,
    !fb.ok && redesPendentes.includes('facebook') ? `Facebook — ${(fb as any).error}` : null,
  ].filter(Boolean).join(' | ')

  return {
    ok: false, redesOk: novasOk.join(' e '), motivo,
    campos: { status: 'falha_publicacao', erroPublicacao: motivo, redesPublicadas: novasOk, atualizadoEm: agora },
  }
}

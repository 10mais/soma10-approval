import { del } from '@vercel/blob'
import { Post } from '@/lib/redis'

// v21+ é necessário para Reels e para a tag de colaboradores (collaborators)
const VERSION = process.env.META_API_VERSION_PUBLISH || 'v21.0'
const BASE = `https://graph.facebook.com/${VERSION}`

const isVideo = (url: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(url)

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

export async function publishToInstagram(post: Post, cliente?: any): Promise<{ ok: boolean; error?: string }> {
  const TOKEN = (cliente?.metaConectado && cliente?.facebookPageToken) ? cliente.facebookPageToken : process.env.INSTAGRAM_ACCESS_TOKEN
  const IG_ID = (cliente?.metaConectado && cliente?.instagramBusinessId) ? cliente.instagramBusinessId : process.env.INSTAGRAM_BUSINESS_ID
  if (!TOKEN || !IG_ID) return { ok: false, error: 'Conta do Instagram não conectada.' }

  const midias = post.imagens || []
  if (midias.length === 0) return { ok: false, error: 'O post não possui mídia para publicar.' }

  const colab = (post.colaboradores || []).slice(0, 3)
  const colabParam: Record<string, string> = colab.length ? { collaborators: JSON.stringify(colab) } : {}
  const formato = post.formato || 'feed'
  const capas = post.capasVideo || {}

  try {
    if (formato === 'story') {
      const m = midias[0]
      const c = await postForm(`${BASE}/${IG_ID}/media`, { access_token: TOKEN, media_type: 'STORIES', ...(isVideo(m) ? { video_url: m } : { image_url: m }) })
      if (c?.error) return { ok: false, error: c.error.message }
      if (isVideo(m) && !(await aguardarContainer(IG_ID, TOKEN, c.id))) return { ok: false, error: 'Falha no processamento do vídeo do story.' }
      const pub = await postForm(`${BASE}/${IG_ID}/media_publish`, { access_token: TOKEN, creation_id: c.id })
      if (pub?.error) return { ok: false, error: pub.error.message }
      return { ok: true }
    }

    if (midias.length === 1) {
      const m = midias[0]
      const params = isVideo(m)
        ? { access_token: TOKEN, media_type: 'REELS', video_url: m, caption: post.legenda, ...(capas[m] ? { cover_url: capas[m] } : {}), ...colabParam }
        : { access_token: TOKEN, image_url: m, caption: post.legenda, ...colabParam }
      const c = await postForm(`${BASE}/${IG_ID}/media`, params)
      if (c?.error) return { ok: false, error: c.error.message }
      if (isVideo(m) && !(await aguardarContainer(IG_ID, TOKEN, c.id))) return { ok: false, error: 'Falha no processamento do vídeo/reel.' }
      const pub = await postForm(`${BASE}/${IG_ID}/media_publish`, { access_token: TOKEN, creation_id: c.id })
      if (pub?.error) return { ok: false, error: pub.error.message }
      return { ok: true }
    }

    const itensIds: string[] = []
    for (const m of midias) {
      const item = await postForm(`${BASE}/${IG_ID}/media`, isVideo(m)
        ? { access_token: TOKEN, media_type: 'VIDEO', video_url: m, is_carousel_item: 'true', ...(capas[m] ? { cover_url: capas[m] } : {}) }
        : { access_token: TOKEN, image_url: m, is_carousel_item: 'true' })
      if (item?.error) return { ok: false, error: item.error.message }
      if (isVideo(m) && !(await aguardarContainer(IG_ID, TOKEN, item.id))) return { ok: false, error: 'Falha no processamento de um vídeo do carrossel.' }
      itensIds.push(item.id)
    }
    const carousel = await postForm(`${BASE}/${IG_ID}/media`, { access_token: TOKEN, media_type: 'CAROUSEL', children: itensIds.join(','), caption: post.legenda, ...colabParam })
    if (carousel?.error) return { ok: false, error: carousel.error.message }
    await aguardarContainer(IG_ID, TOKEN, carousel.id, 10)
    const pub = await postForm(`${BASE}/${IG_ID}/media_publish`, { access_token: TOKEN, creation_id: carousel.id })
    if (pub?.error) return { ok: false, error: pub.error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro de comunicação com o Instagram.' }
  }
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
      const r = await postForm(`${BASE}/${PAGE_ID}/videos`, { access_token: TOKEN, file_url: v, description: post.legenda })
      if (r?.error) return { ok: false, error: r.error.message }
    }
    if (imagens.length === 1) {
      const r = await postForm(`${BASE}/${PAGE_ID}/photos`, { access_token: TOKEN, url: imagens[0], caption: post.legenda })
      if (r?.error) return { ok: false, error: r.error.message }
    } else if (imagens.length > 1) {
      const ids: { media_fbid: string }[] = []
      for (const img of imagens) {
        const r = await postForm(`${BASE}/${PAGE_ID}/photos`, { access_token: TOKEN, url: img, published: 'false' })
        if (r?.error) return { ok: false, error: r.error.message }
        ids.push({ media_fbid: r.id })
      }
      const feed = await postForm(`${BASE}/${PAGE_ID}/feed`, { access_token: TOKEN, message: post.legenda, attached_media: JSON.stringify(ids) })
      if (feed?.error) return { ok: false, error: feed.error.message }
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
export async function processarPublicacao(post: Post, cliente?: any): Promise<ResultadoPublicacao> {
  const redes = post.redes && post.redes.length ? post.redes : ['instagram', 'facebook']
  const ig = redes.includes('instagram') ? await publishToInstagram(post, cliente) : { ok: true as const }
  const fb = redes.includes('facebook') ? await publishToFacebook(post, cliente) : { ok: true as const }
  const agora = new Date().toISOString()

  if (ig.ok && fb.ok) {
    const limpeza = await limparMidiasMantendoCapa(post)
    return {
      ok: true,
      redesOk: redes.join(' e '),
      motivo: '',
      campos: {
        status: 'publicado',
        erroPublicacao: undefined,
        ...(limpeza.removidas ? { midiaRemovida: true } : {}),
        ...(limpeza.thumbnail ? { thumbnail: limpeza.thumbnail } : {}),
        atualizadoEm: agora,
      },
    }
  }

  const motivo = [!ig.ok ? `Instagram — ${(ig as any).error}` : null, !fb.ok ? `Facebook — ${(fb as any).error}` : null].filter(Boolean).join(' | ')
  return {
    ok: false,
    redesOk: '',
    motivo,
    campos: { status: 'falha_publicacao', erroPublicacao: motivo, atualizadoEm: agora },
  }
}

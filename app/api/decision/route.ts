import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Post } from '@/lib/redis'
import { list, put } from '@vercel/blob'
import nodemailer from 'nodemailer'
import { notificarEquipe } from '@/lib/notificacoes'

const NOTIFY_EMAIL = 'marketing@grupo10mais.com.br'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { id, type, annotations, rejectReason, codigo } = body

  // Buscar post do Redis
  let post = await redis.get<Post>(`post:${id}`)

  // Fallback: Blob
  if (!post) {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    const { blobs } = await list({ prefix: `briefings/${id}.json`, token })
    if (!blobs.length) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
    const res = await fetch(blobs[0].url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    post = await res.json() as Post
  }

  // Autorização: cliente logado (sessão) OU código de 6 dígitos (link público)
  const session = await getServerSession(authOptions)
  const sessionRole = (session?.user as any)?.role
  const sessionClienteId = (session?.user as any)?.clienteId

  const autorizadoPorSessao = sessionRole === 'cliente' && sessionClienteId === post.clienteId
  const autorizadoPorCodigo = post.codigo && codigo === post.codigo

  if (!autorizadoPorSessao && !autorizadoPorCodigo) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  // Atualizar status
  const novoStatus = type === 'approved' ? 'aprovado' : type === 'corrected' ? 'corrigir' : 'reprovado'
  const atualizado = { ...post, status: novoStatus, anotacoes: annotations, motivoReprovacao: rejectReason, atualizadoEm: new Date().toISOString() }
  await redis.set(`post:${id}`, atualizado)

  // Notificar a equipe interna sobre a decisão do cliente
  try {
    const clienteNome = (post as any).clienteNome || (post as any).cliente || 'Cliente'
    const notifInfo: Record<string, { tipo: any; titulo: string; mensagem: string }> = {
      approved: { tipo: 'post_aprovado', titulo: `Post aprovado — ${clienteNome}`, mensagem: `${clienteNome} aprovou um post. A publicação será iniciada automaticamente.` },
      corrected: { tipo: 'post_corrigir', titulo: `Correção solicitada — ${clienteNome}`, mensagem: `${clienteNome} pediu ajustes em um post.${rejectReason ? ' Motivo: ' + rejectReason : ''}` },
      rejected: { tipo: 'post_reprovado', titulo: `Post reprovado — ${clienteNome}`, mensagem: `${clienteNome} reprovou um post.${rejectReason ? ' Motivo: ' + rejectReason : ''}` },
    }
    const info = notifInfo[type]
    if (info) await notificarEquipe(info.tipo, info.titulo, info.mensagem, id)
  } catch (e) { console.error('Erro ao notificar equipe:', e) }

  // Email
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.titan.email',
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

    const labels: Record<string, string> = { approved: '✅ APROVADO', corrected: '✏️ CORREÇÃO SOLICITADA', rejected: '❌ REPROVADO' }
    const colors: Record<string, string> = { approved: '#22c55e', corrected: '#ffc00f', rejected: '#ef4444' }

    const annotationsHtml = annotations?.length > 0
      ? `<h3>Anotações:</h3><ol>${annotations.map((a: any, i: number) => `<li><strong>Ponto ${i + 1}:</strong> ${a.text}</li>`).join('')}</ol>`
      : ''

    await transporter.sendMail({
      from: `"Soma10Approval" <${process.env.SMTP_USER}>`,
      to: NOTIFY_EMAIL,
      subject: `${labels[type]} — ${(post as any).clienteNome || (post as any).cliente}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:${colors[type]};padding:24px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="color:${type === 'corrected' ? '#111' : '#fff'};margin:0">${labels[type]}</h1>
          </div>
          <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #eee">
            <p><strong>Cliente:</strong> ${(post as any).clienteNome || (post as any).cliente}</p>
            <p><strong>Decisão em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            ${annotationsHtml}
            ${rejectReason ? `<h3>Motivo:</h3><p>${rejectReason}</p>` : ''}
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">Soma10Approval · Grupo 10+</p>
          </div>
        </div>
      `,
    })
  } catch (e) { console.error('Erro email:', e) }

  // Publicar no Instagram + Facebook se aprovado — registra sucesso/falha e notifica a equipe
  if (type === 'approved') {
    const clienteNome = (post as any).clienteNome || (post as any).cliente || 'Cliente'
    try {
      const cliente = post.clienteId ? await redis.get<any>(`cliente:${post.clienteId}`) : null

      const ig = await publishToInstagram(post as Post, cliente)
      const fb = await publishToFacebook(post as Post, cliente)

      const okGeral = ig.ok || fb.ok
      const redesOk = [ig.ok ? 'Instagram' : null, fb.ok ? 'Facebook' : null].filter(Boolean).join(' e ')
      const falhas = [!ig.ok ? `Instagram: ${ig.error}` : null, !fb.ok ? `Facebook: ${fb.error}` : null].filter(Boolean).join(' | ')

      if (ig.ok && fb.ok) {
        await redis.set(`post:${id}`, { ...atualizado, status: 'publicado', erroPublicacao: undefined, atualizadoEm: new Date().toISOString() })
        await notificarEquipe('post_publicado', `Post publicado — ${clienteNome}`, `O post de ${clienteNome} foi publicado com sucesso no Instagram e no Facebook.`, id)
      } else if (okGeral) {
        // Publicou em parte das redes
        await redis.set(`post:${id}`, { ...atualizado, status: 'publicado', erroPublicacao: falhas, atualizadoEm: new Date().toISOString() })
        await notificarEquipe('post_publicado', `Post publicado parcialmente — ${clienteNome}`, `Publicado em ${redesOk}. Falha em: ${falhas}`, id)
      } else {
        await redis.set(`post:${id}`, { ...atualizado, status: 'falha_publicacao', erroPublicacao: falhas, atualizadoEm: new Date().toISOString() })
        await notificarEquipe('post_falha_publicacao', `⚠️ Falha ao publicar — ${clienteNome}`, `Não foi possível publicar o post de ${clienteNome}. ${falhas}`, id)
      }
    } catch (e: any) {
      console.error('Erro publicação:', e)
      const erro = e?.message || 'Erro desconhecido ao publicar.'
      await redis.set(`post:${id}`, { ...atualizado, status: 'falha_publicacao', erroPublicacao: erro, atualizadoEm: new Date().toISOString() })
      await notificarEquipe('post_falha_publicacao', `⚠️ Falha ao publicar — ${clienteNome}`, `Não foi possível publicar o post de ${clienteNome}. Erro: ${erro}`, id)
    }
  }

  return NextResponse.json({ ok: true })
}

// v21+ é necessário para Reels e para a tag de colaboradores (collaborators)
const VERSION = process.env.META_API_VERSION_PUBLISH || 'v21.0'
const BASE = `https://graph.facebook.com/${VERSION}`

const isVideo = (url: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(url)

function postForm(url: string, params: Record<string, string>) {
  return fetch(url, { method: 'POST', body: new URLSearchParams(params) }).then(r => r.json())
}

// Aguarda o container de vídeo/reel terminar o processamento antes de publicar
async function aguardarContainer(igId: string, token: string, creationId: string, tentativas = 20): Promise<boolean> {
  for (let i = 0; i < tentativas; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const st = await fetch(`${BASE}/${creationId}?fields=status_code&access_token=${token}`).then(r => r.json())
    if (st?.status_code === 'FINISHED') return true
    if (st?.status_code === 'ERROR') return false
  }
  return false
}

async function publishToInstagram(post: Post, cliente?: any): Promise<{ ok: boolean; error?: string }> {
  const TOKEN = (cliente?.metaConectado && cliente?.facebookPageToken) ? cliente.facebookPageToken : process.env.INSTAGRAM_ACCESS_TOKEN
  const IG_ID = (cliente?.metaConectado && cliente?.instagramBusinessId) ? cliente.instagramBusinessId : process.env.INSTAGRAM_BUSINESS_ID
  if (!TOKEN || !IG_ID) return { ok: false, error: 'Conta do Instagram não conectada.' }

  const midias = post.imagens || []
  if (midias.length === 0) return { ok: false, error: 'O post não possui mídia para publicar.' }

  // Tags de colab (máx. 3 no Instagram) — requer versão recente da Graph API
  const colab = (post.colaboradores || []).slice(0, 3)
  const colabParam: Record<string, string> = colab.length ? { collaborators: JSON.stringify(colab) } : {}
  const formato = post.formato || 'feed'

  try {
    // Story — uma mídia única
    if (formato === 'story') {
      const m = midias[0]
      const c = await postForm(`${BASE}/${IG_ID}/media`, { access_token: TOKEN, media_type: 'STORIES', ...(isVideo(m) ? { video_url: m } : { image_url: m }) })
      if (c?.error) return { ok: false, error: c.error.message }
      if (isVideo(m) && !(await aguardarContainer(IG_ID, TOKEN, c.id))) return { ok: false, error: 'Falha no processamento do vídeo do story.' }
      const pub = await postForm(`${BASE}/${IG_ID}/media_publish`, { access_token: TOKEN, creation_id: c.id })
      if (pub?.error) return { ok: false, error: pub.error.message }
      return { ok: true }
    }

    // Mídia única (imagem ou vídeo/reel)
    if (midias.length === 1) {
      const m = midias[0]
      const params = isVideo(m)
        ? { access_token: TOKEN, media_type: 'REELS', video_url: m, caption: post.legenda, ...colabParam }
        : { access_token: TOKEN, image_url: m, caption: post.legenda, ...colabParam }
      const c = await postForm(`${BASE}/${IG_ID}/media`, params)
      if (c?.error) return { ok: false, error: c.error.message }
      if (isVideo(m) && !(await aguardarContainer(IG_ID, TOKEN, c.id))) return { ok: false, error: 'Falha no processamento do vídeo/reel.' }
      const pub = await postForm(`${BASE}/${IG_ID}/media_publish`, { access_token: TOKEN, creation_id: c.id })
      if (pub?.error) return { ok: false, error: pub.error.message }
      return { ok: true }
    }

    // Carrossel (imagens e/ou vídeos)
    const itensIds: string[] = []
    for (const m of midias) {
      const item = await postForm(`${BASE}/${IG_ID}/media`, isVideo(m)
        ? { access_token: TOKEN, media_type: 'VIDEO', video_url: m, is_carousel_item: 'true' }
        : { access_token: TOKEN, image_url: m, is_carousel_item: 'true' })
      if (item?.error) return { ok: false, error: item.error.message }
      if (isVideo(m) && !(await aguardarContainer(IG_ID, TOKEN, item.id))) return { ok: false, error: 'Falha no processamento de um vídeo do carrossel.' }
      itensIds.push(item.id)
    }
    const carousel = await postForm(`${BASE}/${IG_ID}/media`, { access_token: TOKEN, media_type: 'CAROUSEL', children: itensIds.join(','), caption: post.legenda, ...colabParam })
    if (carousel?.error) return { ok: false, error: carousel.error.message }
    if (!(await aguardarContainer(IG_ID, TOKEN, carousel.id, 10))) { /* carrossel costuma ficar pronto rápido; segue para publish */ }
    const pub = await postForm(`${BASE}/${IG_ID}/media_publish`, { access_token: TOKEN, creation_id: carousel.id })
    if (pub?.error) return { ok: false, error: pub.error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro de comunicação com o Instagram.' }
  }
}

async function publishToFacebook(post: Post, cliente?: any): Promise<{ ok: boolean; error?: string }> {
  const TOKEN = cliente?.metaConectado && cliente?.facebookPageToken ? cliente.facebookPageToken : undefined
  const PAGE_ID = cliente?.metaConectado && cliente?.facebookPageId ? cliente.facebookPageId : undefined
  if (!TOKEN || !PAGE_ID) return { ok: false, error: 'Página do Facebook não conectada.' }

  const midias = post.imagens || []
  const imagens = midias.filter(m => !isVideo(m))
  const videos = midias.filter(isVideo)
  if (midias.length === 0) return { ok: false, error: 'O post não possui mídia para publicar.' }

  try {
    // Vídeos — cada um vira um post de vídeo na Página
    for (const v of videos) {
      const r = await postForm(`${BASE}/${PAGE_ID}/videos`, { access_token: TOKEN, file_url: v, description: post.legenda })
      if (r?.error) return { ok: false, error: r.error.message }
    }

    if (imagens.length === 1) {
      const r = await postForm(`${BASE}/${PAGE_ID}/photos`, { access_token: TOKEN, url: imagens[0], caption: post.legenda })
      if (r?.error) return { ok: false, error: r.error.message }
    } else if (imagens.length > 1) {
      // Álbum: sobe cada foto sem publicar, depois cria o post do feed com todas anexadas
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

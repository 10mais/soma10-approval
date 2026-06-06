import { NextRequest, NextResponse } from 'next/server'
import { redis, Post } from '@/lib/redis'
import { list, put } from '@vercel/blob'
import nodemailer from 'nodemailer'

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

  // Verificar código se for post do Redis
  if (post.codigo && codigo !== post.codigo) {
    return NextResponse.json({ error: 'código inválido' }, { status: 401 })
  }

  // Atualizar status
  const novoStatus = type === 'approved' ? 'aprovado' : type === 'corrected' ? 'corrigir' : 'reprovado'
  const atualizado = { ...post, status: novoStatus, anotacoes: annotations, motivoReprovacao: rejectReason, atualizadoEm: new Date().toISOString() }
  await redis.set(`post:${id}`, atualizado)

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

  // Publicar no Instagram se aprovado
  if (type === 'approved') {
    try {
      // Buscar dados de integração do cliente
      const cliente = post.clienteId ? await redis.get<any>(`cliente:${post.clienteId}`) : null
      await publishToInstagram(post as Post, cliente)
    } catch (e) { console.error('Erro Instagram:', e) }
  }

  return NextResponse.json({ ok: true })
}

async function publishToInstagram(post: Post, cliente?: any) {
  const VERSION = process.env.META_API_VERSION || 'v19.0'
  const BASE = `https://graph.facebook.com/${VERSION}`

  // Usar token e ID do cliente se disponível, senão usar credenciais da 10+
  const TOKEN = (cliente?.metaConectado && cliente?.facebookPageToken)
    ? cliente.facebookPageToken
    : process.env.INSTAGRAM_ACCESS_TOKEN
  const IG_ID = (cliente?.metaConectado && cliente?.instagramBusinessId)
    ? cliente.instagramBusinessId
    : process.env.INSTAGRAM_BUSINESS_ID

  if (!TOKEN || !IG_ID) return

  const imagens = post.imagens || []
  if (imagens.length === 1) {
    const c = await fetch(`${BASE}/${IG_ID}/media`, { method: 'POST', body: new URLSearchParams({ access_token: TOKEN, image_url: imagens[0], caption: post.legenda }) }).then(r => r.json())
    await fetch(`${BASE}/${IG_ID}/media_publish`, { method: 'POST', body: new URLSearchParams({ access_token: TOKEN, creation_id: c.id }) })
  } else {
    const ids = await Promise.all(imagens.map(img => fetch(`${BASE}/${IG_ID}/media`, { method: 'POST', body: new URLSearchParams({ access_token: TOKEN, image_url: img, is_carousel_item: 'true' }) }).then(r => r.json()).then(d => d.id)))
    const carousel = await fetch(`${BASE}/${IG_ID}/media`, { method: 'POST', body: new URLSearchParams({ access_token: TOKEN, media_type: 'CAROUSEL', children: ids.join(','), caption: post.legenda }) }).then(r => r.json())
    await new Promise(r => setTimeout(r, 5000))
    await fetch(`${BASE}/${IG_ID}/media_publish`, { method: 'POST', body: new URLSearchParams({ access_token: TOKEN, creation_id: carousel.id }) })
  }
}

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

  // Publicar no Instagram se aprovado — registra sucesso/falha no próprio post e notifica a equipe
  if (type === 'approved') {
    const clienteNome = (post as any).clienteNome || (post as any).cliente || 'Cliente'
    try {
      const cliente = post.clienteId ? await redis.get<any>(`cliente:${post.clienteId}`) : null
      const resultado = await publishToInstagram(post as Post, cliente)
      if (resultado.ok) {
        await redis.set(`post:${id}`, { ...atualizado, status: 'publicado', erroPublicacao: undefined, atualizadoEm: new Date().toISOString() })
        await notificarEquipe('post_publicado', `Post publicado — ${clienteNome}`, `O post de ${clienteNome} foi publicado com sucesso no Instagram.`, id)
      } else {
        await redis.set(`post:${id}`, { ...atualizado, status: 'falha_publicacao', erroPublicacao: resultado.error, atualizadoEm: new Date().toISOString() })
        await notificarEquipe('post_falha_publicacao', `⚠️ Falha ao publicar — ${clienteNome}`, `Não foi possível publicar o post de ${clienteNome} no Instagram. ${resultado.error ? 'Erro: ' + resultado.error : ''}`, id)
      }
    } catch (e: any) {
      console.error('Erro Instagram:', e)
      const erro = e?.message || 'Erro desconhecido ao publicar.'
      await redis.set(`post:${id}`, { ...atualizado, status: 'falha_publicacao', erroPublicacao: erro, atualizadoEm: new Date().toISOString() })
      await notificarEquipe('post_falha_publicacao', `⚠️ Falha ao publicar — ${clienteNome}`, `Não foi possível publicar o post de ${clienteNome} no Instagram. Erro: ${erro}`, id)
    }
  }

  return NextResponse.json({ ok: true })
}

async function publishToInstagram(post: Post, cliente?: any): Promise<{ ok: boolean; error?: string }> {
  const VERSION = process.env.META_API_VERSION || 'v19.0'
  const BASE = `https://graph.facebook.com/${VERSION}`

  // Usar token e ID do cliente se disponível, senão usar credenciais da 10+
  const TOKEN = (cliente?.metaConectado && cliente?.facebookPageToken)
    ? cliente.facebookPageToken
    : process.env.INSTAGRAM_ACCESS_TOKEN
  const IG_ID = (cliente?.metaConectado && cliente?.instagramBusinessId)
    ? cliente.instagramBusinessId
    : process.env.INSTAGRAM_BUSINESS_ID

  if (!TOKEN || !IG_ID) return { ok: false, error: 'Conta do Instagram não conectada para este cliente.' }

  try {
    const imagens = post.imagens || []
    if (imagens.length === 0) return { ok: false, error: 'O post não possui imagens para publicar.' }

    if (imagens.length === 1) {
      const c = await fetch(`${BASE}/${IG_ID}/media`, { method: 'POST', body: new URLSearchParams({ access_token: TOKEN, image_url: imagens[0], caption: post.legenda }) }).then(r => r.json())
      if (c?.error) return { ok: false, error: c.error.message || 'Erro ao criar mídia.' }
      const pub = await fetch(`${BASE}/${IG_ID}/media_publish`, { method: 'POST', body: new URLSearchParams({ access_token: TOKEN, creation_id: c.id }) }).then(r => r.json())
      if (pub?.error) return { ok: false, error: pub.error.message || 'Erro ao publicar mídia.' }
    } else {
      const itens = await Promise.all(imagens.map(img => fetch(`${BASE}/${IG_ID}/media`, { method: 'POST', body: new URLSearchParams({ access_token: TOKEN, image_url: img, is_carousel_item: 'true' }) }).then(r => r.json())))
      const erroItem = itens.find((d: any) => d?.error)
      if (erroItem) return { ok: false, error: erroItem.error.message || 'Erro ao preparar imagens do carrossel.' }
      const ids = itens.map((d: any) => d.id)
      const carousel = await fetch(`${BASE}/${IG_ID}/media`, { method: 'POST', body: new URLSearchParams({ access_token: TOKEN, media_type: 'CAROUSEL', children: ids.join(','), caption: post.legenda }) }).then(r => r.json())
      if (carousel?.error) return { ok: false, error: carousel.error.message || 'Erro ao criar carrossel.' }
      await new Promise(r => setTimeout(r, 5000))
      const pub = await fetch(`${BASE}/${IG_ID}/media_publish`, { method: 'POST', body: new URLSearchParams({ access_token: TOKEN, creation_id: carousel.id }) }).then(r => r.json())
      if (pub?.error) return { ok: false, error: pub.error.message || 'Erro ao publicar carrossel.' }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro de comunicação com o Instagram.' }
  }
}

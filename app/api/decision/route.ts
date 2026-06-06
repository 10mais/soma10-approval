import { NextRequest, NextResponse } from 'next/server'
import { list, put } from '@vercel/blob'
import nodemailer from 'nodemailer'

const NOTIFY_EMAIL = 'marketing@grupo10mais.com.br'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { id, type, annotations, rejectReason, imageIndex } = body

  // Buscar briefing no Blob
  const { blobs } = await list({ prefix: `briefings/${id}.json` })
  if (!blobs.length) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const res = await fetch(blobs[0].url)
  const brief = await res.json()

  // Atualizar status
  brief.status = type
  brief.decision = { type, annotations, rejectReason, imageIndex, decidedAt: new Date().toISOString() }

  await put(`briefings/${id}.json`, JSON.stringify(brief, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  })

  // Enviar email de notificação
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

    const labels: Record<string, string> = {
      approved: '✅ APROVADO',
      corrected: '✏️ CORREÇÃO SOLICITADA',
      rejected: '❌ REPROVADO',
    }
    const colors: Record<string, string> = {
      approved: '#22c55e',
      corrected: '#ffc00f',
      rejected: '#ef4444',
    }

    const annotationsHtml = annotations?.length > 0
      ? `<h3 style="color:#111">Anotações na imagem:</h3><ol>${annotations.map((a: any, i: number) =>
          `<li style="margin-bottom:6px"><strong>Ponto ${i + 1}:</strong> ${a.text}</li>`).join('')}</ol>`
      : ''

    const rejectHtml = rejectReason
      ? `<h3 style="color:#111">Motivo da reprovação:</h3><p style="color:#555">${rejectReason}</p>`
      : ''

    await transporter.sendMail({
      from: `"Soma10 Approval" <${process.env.SMTP_USER}>`,
      to: NOTIFY_EMAIL,
      subject: `${labels[type]} — ${brief.cliente}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border-radius:12px;overflow:hidden;border:1px solid #eee">
          <div style="background:${colors[type]};padding:24px;text-align:center">
            <h1 style="color:${type === 'corrected' ? '#111' : '#fff'};margin:0;font-size:22px">${labels[type]}</h1>
          </div>
          <div style="background:#fff;padding:28px">
            <p style="margin:0 0 8px"><strong>Cliente:</strong> ${brief.cliente}</p>
            <p style="margin:0 0 20px"><strong>Decisão em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            ${annotationsHtml}
            ${rejectHtml}
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;margin:0;text-align:center">
              Sistema de Aprovação · <strong style="color:#ffc00f">Soma10</strong> · Grupo 10+
            </p>
          </div>
        </div>
      `,
    })
  } catch (e) {
    console.error('Erro ao enviar email:', e)
  }

  // Se aprovado, publicar no Instagram
  if (type === 'approved') {
    try {
      await publishToInstagram(brief)
    } catch (e) {
      console.error('Erro ao publicar no Instagram:', e)
    }
  }

  return NextResponse.json({ ok: true })
}

async function publishToInstagram(brief: any) {
  const TOKEN = process.env[`INSTAGRAM_TOKEN_${brief.clienteSlug?.toUpperCase().replace(/-/g, '_')}`]
    || process.env.INSTAGRAM_ACCESS_TOKEN
  const IG_ID = process.env[`INSTAGRAM_ID_${brief.clienteSlug?.toUpperCase().replace(/-/g, '_')}`]
    || process.env.INSTAGRAM_BUSINESS_ID
  const VERSION = process.env.META_API_VERSION || 'v19.0'
  const BASE = `https://graph.facebook.com/${VERSION}`

  if (!TOKEN || !IG_ID) return

  if (brief.imagens.length === 1) {
    const container = await fetch(`${BASE}/${IG_ID}/media`, {
      method: 'POST',
      body: new URLSearchParams({ access_token: TOKEN, image_url: brief.imagens[0], caption: brief.legenda }),
    }).then(r => r.json())

    await fetch(`${BASE}/${IG_ID}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({ access_token: TOKEN, creation_id: container.id }),
    })
  } else {
    const ids = await Promise.all(brief.imagens.map((img: string) =>
      fetch(`${BASE}/${IG_ID}/media`, {
        method: 'POST',
        body: new URLSearchParams({ access_token: TOKEN, image_url: img, is_carousel_item: 'true' }),
      }).then(r => r.json()).then(d => d.id)
    ))

    const carousel = await fetch(`${BASE}/${IG_ID}/media`, {
      method: 'POST',
      body: new URLSearchParams({ access_token: TOKEN, media_type: 'CAROUSEL', children: ids.join(','), caption: brief.legenda }),
    }).then(r => r.json())

    await new Promise(r => setTimeout(r, 5000))

    await fetch(`${BASE}/${IG_ID}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({ access_token: TOKEN, creation_id: carousel.id }),
    })
  }
}

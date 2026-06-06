import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import nodemailer from 'nodemailer'

const NOTIFY_EMAIL = 'marketing@grupo10mais.com.br'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { id, type, annotations, rejectReason, imageIndex } = body

  const filePath = path.join(process.cwd(), 'data', 'pendentes', `${id}.json`)
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const brief = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  brief.status = type
  brief.decision = { type, annotations, rejectReason, imageIndex, decidedAt: new Date().toISOString() }
  fs.writeFileSync(filePath, JSON.stringify(brief, null, 2))

  // Enviar email de notificação
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

    const labels: Record<string, string> = { approved: '✅ APROVADO', corrected: '✏️ CORREÇÃO SOLICITADA', rejected: '❌ REPROVADO' }
    const colors: Record<string, string> = { approved: '#22c55e', corrected: '#f5a623', rejected: '#ef4444' }

    const annotationsHtml = annotations?.length > 0
      ? `<h3>Anotações na imagem:</h3><ol>${annotations.map((a: any, i: number) => `<li><strong>Ponto ${i + 1}:</strong> ${a.text}</li>`).join('')}</ol>`
      : ''

    const rejectHtml = rejectReason ? `<h3>Motivo da reprovação:</h3><p>${rejectReason}</p>` : ''

    await transporter.sendMail({
      from: `"Sistema de Aprovação" <${process.env.SMTP_USER}>`,
      to: NOTIFY_EMAIL,
      subject: `${labels[type]} — ${brief.cliente}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:${colors[type]};padding:20px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:24px">${labels[type]}</h1>
          </div>
          <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #eee">
            <p><strong>Cliente:</strong> ${brief.cliente}</p>
            <p><strong>Decisão em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            ${annotationsHtml}
            ${rejectHtml}
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
            <p style="color:#888;font-size:12px">Sistema de Aprovação — Grupo 10+</p>
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
  const envPath = path.join(process.cwd(), 'clientes', brief.clienteSlug, '.env')
  if (!fs.existsSync(envPath)) return

  const env = Object.fromEntries(
    fs.readFileSync(envPath, 'utf-8').split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => l.split('=').map(p => p.trim()))
  )

  const TOKEN = env.INSTAGRAM_ACCESS_TOKEN
  const IG_ID = env.INSTAGRAM_BUSINESS_ID
  const BASE = `https://graph.facebook.com/${env.META_API_VERSION || 'v19.0'}`

  if (brief.imagens.length === 1) {
    // Post simples
    const container = await fetch(`${BASE}/${IG_ID}/media`, {
      method: 'POST',
      body: new URLSearchParams({ access_token: TOKEN, image_url: brief.imagens[0], caption: brief.legenda }),
    }).then(r => r.json())

    await fetch(`${BASE}/${IG_ID}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({ access_token: TOKEN, creation_id: container.id }),
    })
  } else {
    // Carrossel
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

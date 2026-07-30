import { NextRequest, NextResponse } from 'next/server'
import { redis, Cliente } from '@/lib/redis'
import { gerarResumoSemanal } from '@/lib/resumoSemanal'
import { capturarErro } from '@/lib/erros'
import nodemailer from 'nodemailer'

export const runtime = 'nodejs'
export const maxDuration = 300

// Envio automático do resumo semanal por e-mail a todos os clientes com login.
// Agende 1x por semana no cron-job.org apontando para
// /api/cron/resumo-semanal?secret=<CRON_SECRET> (ou Authorization: Bearer).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    const qs = req.nextUrl.searchParams.get('secret')
    if (auth !== `Bearer ${secret}` && qs !== secret) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  if (!process.env.SMTP_USER) return NextResponse.json({ ok: false, error: 'SMTP não configurado' })
  try {
    return await enviarResumos()
  } catch (e) {
    await capturarErro('cron/resumo-semanal', e)
    return NextResponse.json({ error: 'falha no resumo semanal' }, { status: 500 })
  }
}

async function enviarResumos(): Promise<NextResponse> {
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.titan.email', port: Number(process.env.SMTP_PORT) || 587, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })

  const ids = await redis.smembers('clientes')
  let enviados = 0
  for (const id of ids) {
    const c = await redis.get<Cliente>(`cliente:${id}`)
    if (!c || c.tipo === 'interno' || (c as any).arquivado || !c.loginEmail) continue
    const r = await gerarResumoSemanal(id)
    if (!r) continue
    try {
      await transporter.sendMail({ from: `"Soma10 Approval" <${process.env.SMTP_USER}>`, to: c.loginEmail, subject: `Resumo da semana — ${c.nome}`, html: r.html })
      enviados++
    } catch { /* segue para o próximo */ }
  }
  return NextResponse.json({ ok: true, enviados })
}

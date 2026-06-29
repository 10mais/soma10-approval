import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { gerarResumoSemanal, ResumoTemplate } from '@/lib/resumoSemanal'
import { redis } from '@/lib/redis'
import nodemailer from 'nodemailer'

export const runtime = 'nodejs'

// Resolve a predefinicao (template) pelo id, lendo config:resumoTemplates.
async function resolverTemplate(templateId?: string | null): Promise<ResumoTemplate | undefined> {
  if (!templateId) return undefined
  const lista = await redis.get<{ id: string; intro: string; fechamento: string }[]>('config:resumoTemplates')
  const t = Array.isArray(lista) ? lista.find(x => x.id === templateId) : null
  return t ? { intro: t.intro, fechamento: t.fechamento } : undefined
}

// GET ?clienteId=&templateId= -> devolve o texto do resumo (para WhatsApp/copiar)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const clienteId = req.nextUrl.searchParams.get('clienteId')
  if (!clienteId) return NextResponse.json({ error: 'clienteId obrigatório' }, { status: 400 })
  const tpl = await resolverTemplate(req.nextUrl.searchParams.get('templateId'))
  const r = await gerarResumoSemanal(clienteId, tpl)
  if (!r) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  return NextResponse.json({ texto: r.texto, publicados: r.publicados, aguardando: r.aguardando, proximos: r.proximos, emailCliente: r.cliente.loginEmail || '' })
}

// POST { clienteId } -> envia o resumo por e-mail para o cliente
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { clienteId, templateId } = await req.json()
  const tpl = await resolverTemplate(templateId)
  const r = await gerarResumoSemanal(clienteId, tpl)
  if (!r) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  if (!r.cliente.loginEmail) return NextResponse.json({ error: 'O cliente não tem e-mail cadastrado.' }, { status: 400 })
  if (!process.env.SMTP_USER) return NextResponse.json({ error: 'E-mail (SMTP) não configurado no servidor.' }, { status: 500 })
  try {
    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.titan.email', port: Number(process.env.SMTP_PORT) || 587, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
    await transporter.sendMail({ from: `"Soma10 Approval" <${process.env.SMTP_USER}>`, to: r.cliente.loginEmail, subject: `Resumo da semana — ${r.cliente.nome}`, html: r.html })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Falha ao enviar e-mail: ' + (e?.message || '') }, { status: 500 })
  }
}

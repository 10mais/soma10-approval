import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Post } from '@/lib/redis'
import { list } from '@vercel/blob'
import nodemailer from 'nodemailer'
import { notificarEquipe } from '@/lib/notificacoes'
import { processarPublicacao } from '@/lib/publicar'

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

    const labels: Record<string, string> = { approved: 'APROVADO', corrected: 'CORREÇÃO SOLICITADA', rejected: 'REPROVADO' }
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

  // Publicar nas redes selecionadas se aprovado — registra sucesso/falha e notifica a equipe
  if (type === 'approved') {
    const clienteNome = (post as any).clienteNome || (post as any).cliente || 'Cliente'
    try {
      const cliente = post.clienteId ? await redis.get<any>(`cliente:${post.clienteId}`) : null
      const resultado = await processarPublicacao(post as Post, cliente)
      await redis.set(`post:${id}`, { ...atualizado, ...resultado.campos })
      if (resultado.ok) {
        await notificarEquipe('post_publicado', `Post publicado — ${clienteNome}`, `O post de ${clienteNome} foi publicado em ${resultado.redesOk}.`, id)
      } else {
        await notificarEquipe('post_falha_publicacao', `Falha ao publicar — ${clienteNome}`, `Não foi possível publicar o post de ${clienteNome}. Motivo: ${resultado.motivo}`, id)
      }
    } catch (e: any) {
      console.error('Erro publicação:', e)
      const erro = e?.message || 'Erro desconhecido ao publicar.'
      await redis.set(`post:${id}`, { ...atualizado, status: 'falha_publicacao', erroPublicacao: erro, atualizadoEm: new Date().toISOString() })
      await notificarEquipe('post_falha_publicacao', `Falha ao publicar — ${clienteNome}`, `Não foi possível publicar o post de ${clienteNome}. Erro: ${erro}`, id)
    }
  }

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Usuario } from '@/lib/redis'
import { gerarSegredo, otpauthUrl, verificarCodigo } from '@/lib/twoFactor'
import { dispararCodigoEmail, verificarCodigoEmail } from '@/lib/twoFactorEmail'
import { doisFatoresGlobalAtivo } from '@/lib/seguranca'
import { registrarAuditoria } from '@/lib/auditoria'
import QRCode from 'qrcode'

export const runtime = 'nodejs'

// Gestão do 2FA do PRÓPRIO usuário (cada um protege a sua conta). Opt-in.
// Dois métodos: 'app' (TOTP, QR) ou 'email' (código por e-mail, sem app).
export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const u = await redis.get<Usuario>(`usuario:${email}`)
  return NextResponse.json({ ativo: !!u?.twoFactorEnabled, metodo: u?.twoFactorMethod || null, globalAtivo: await doisFatoresGlobalAtivo() })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const u = await redis.get<Usuario>(`usuario:${email}`)
  if (!u) return NextResponse.json({ error: 'usuário não encontrado' }, { status: 404 })
  const { acao, codigo, metodo } = await req.json().catch(() => ({} as any))

  // Inicia a configuração (PENDENTE — ainda não ativa).
  if (acao === 'setup') {
    if (metodo === 'email') {
      await redis.set(`usuario:${email}`, { ...u, twoFactorMethod: 'email', twoFactorSecret: undefined, twoFactorEnabled: false })
      const enviado = await dispararCodigoEmail(email)
      if (!enviado) return NextResponse.json({ error: 'Não foi possível enviar o e-mail (SMTP não configurado?).' }, { status: 500 })
      return NextResponse.json({ ok: true, metodo: 'email' })
    }
    // padrão: app autenticador (TOTP) — gera segredo + QR
    const segredo = gerarSegredo()
    await redis.set(`usuario:${email}`, { ...u, twoFactorSecret: segredo, twoFactorMethod: 'app', twoFactorEnabled: false })
    const qr = await QRCode.toDataURL(otpauthUrl(email, segredo))
    return NextResponse.json({ ok: true, qr, segredo, metodo: 'app' })
  }

  // Confirma o código pendente e ATIVA.
  if (acao === 'ativar') {
    const met = u.twoFactorMethod || 'app'
    const ok = met === 'email' ? await verificarCodigoEmail(email, codigo || '') : await verificarCodigo(codigo || '', u.twoFactorSecret)
    if (!ok) return NextResponse.json({ error: 'Código inválido. Tente de novo.' }, { status: 400 })
    await redis.set(`usuario:${email}`, { ...u, twoFactorEnabled: true })
    await registrarAuditoria({ ator: u.nome || email, acao: '2fa_ativado', alvo: email, detalhe: `Método: ${met}` })
    return NextResponse.json({ ok: true })
  }

  // Reenviar o código de e-mail (setup ou login).
  if (acao === 'reenviar-email') {
    const enviado = await dispararCodigoEmail(email)
    return NextResponse.json({ ok: enviado })
  }

  // Desativa — a própria sessão autenticada já é prova de identidade.
  if (acao === 'desativar') {
    const limpo: Usuario = { ...u }
    delete (limpo as any).twoFactorSecret
    delete (limpo as any).twoFactorEnabled
    delete (limpo as any).twoFactorMethod
    await redis.set(`usuario:${email}`, limpo)
    await registrarAuditoria({ ator: u.nome || email, acao: '2fa_desativado', alvo: email })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
}

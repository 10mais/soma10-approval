import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Usuario } from '@/lib/redis'
import { gerarSegredo, otpauthUrl, verificarCodigo } from '@/lib/twoFactor'
import { registrarAuditoria } from '@/lib/auditoria'
import QRCode from 'qrcode'

export const runtime = 'nodejs'

// Gestão do 2FA do PRÓPRIO usuário (cada um protege a sua conta). Opt-in.
export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const u = await redis.get<Usuario>(`usuario:${email}`)
  return NextResponse.json({ ativo: !!u?.twoFactorEnabled })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const u = await redis.get<Usuario>(`usuario:${email}`)
  if (!u) return NextResponse.json({ error: 'usuário não encontrado' }, { status: 404 })
  const { acao, codigo } = await req.json().catch(() => ({} as any))

  // Gera um segredo PENDENTE (ainda não ativa) + QR para o app autenticador.
  if (acao === 'setup') {
    const segredo = gerarSegredo()
    await redis.set(`usuario:${email}`, { ...u, twoFactorSecret: segredo, twoFactorEnabled: false })
    const url = otpauthUrl(email, segredo)
    const qr = await QRCode.toDataURL(url)
    return NextResponse.json({ ok: true, qr, segredo })
  }

  // Confirma o código do app e ATIVA o 2FA.
  if (acao === 'ativar') {
    if (!u.twoFactorSecret) return NextResponse.json({ error: 'inicie a configuração primeiro' }, { status: 400 })
    if (!(await verificarCodigo(codigo || '', u.twoFactorSecret))) return NextResponse.json({ error: 'Código inválido. Confira no app e tente de novo.' }, { status: 400 })
    await redis.set(`usuario:${email}`, { ...u, twoFactorEnabled: true })
    await registrarAuditoria({ ator: u.nome || email, acao: '2fa_ativado', alvo: email })
    return NextResponse.json({ ok: true })
  }

  // Desativa (exige um código válido enquanto estiver ativo, para evitar desligar sem posse).
  if (acao === 'desativar') {
    if (u.twoFactorEnabled && u.twoFactorSecret && !(await verificarCodigo(codigo || '', u.twoFactorSecret))) {
      return NextResponse.json({ error: 'Código inválido — necessário para desativar.' }, { status: 400 })
    }
    const semSegredo: Usuario = { ...u }
    delete (semSegredo as any).twoFactorSecret
    delete (semSegredo as any).twoFactorEnabled
    await redis.set(`usuario:${email}`, semSegredo)
    await registrarAuditoria({ ator: u.nome || email, acao: '2fa_desativado', alvo: email })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
}

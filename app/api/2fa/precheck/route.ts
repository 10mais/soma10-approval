import { NextRequest, NextResponse } from 'next/server'
import { redis, Usuario } from '@/lib/redis'
import { checarRate } from '@/lib/rateLimit'
import { loginBloqueado, registrarFalhaLogin } from '@/lib/loginThrottle'
import { dispararCodigoEmail } from '@/lib/twoFactorEmail'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

// Pré-verificação do login: confere e-mail+senha e diz se a conta exige 2FA,
// para a tela de login mostrar (ou não) o campo de código. Rate-limited por IP
// + throttle por e-mail (mesmo contador do login, anti-força-bruta).
export async function POST(req: NextRequest) {
  const rl = await checarRate(req, '2fa-precheck', 20, 60); if (rl) return rl
  const { email, senha } = await req.json().catch(() => ({} as any))
  if (!email || !senha) return NextResponse.json({ ok: false })
  if (await loginBloqueado(email)) return NextResponse.json({ ok: false })
  const u = await redis.get<Usuario>(`usuario:${email}`)
  if (!u) { await registrarFalhaLogin(email); return NextResponse.json({ ok: false }) }
  const senhaOk = await bcrypt.compare(senha, u.senha)
  if (!senhaOk) { await registrarFalhaLogin(email); return NextResponse.json({ ok: false }) }
  // Não zera o contador aqui — só o login completo (authorize) zera.
  const metodo = u.twoFactorEnabled ? (u.twoFactorMethod || 'app') : null
  // Método e-mail: já dispara o código para a caixa do usuário.
  if (metodo === 'email') await dispararCodigoEmail(email)
  return NextResponse.json({ ok: true, needs2FA: !!u.twoFactorEnabled, metodo })
}

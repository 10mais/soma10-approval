import { redis } from './redis'
import nodemailer from 'nodemailer'

// 2FA por E-MAIL (alternativa app-free ao TOTP). O código de 6 dígitos vive só
// no Redis (5 min) e é enviado por SMTP. Mesmo padrão do resto do sistema.

const TTL = 300 // 5 minutos
const chave = (email: string) => `2fa_email:${(email || '').trim().toLowerCase()}`

export function gerarCodigoEmail(): string {
  return String(Math.floor(100000 + Math.random() * 900000)) // 6 dígitos
}

export async function salvarCodigoEmail(email: string, codigo: string): Promise<void> {
  await redis.set(chave(email), codigo, { ex: TTL })
}

export async function verificarCodigoEmail(email: string, codigo: string): Promise<boolean> {
  try {
    const alvo = await redis.get<string | number>(chave(email))
    if (alvo == null) return false
    const ok = String(alvo) === String(codigo || '').trim()
    if (ok) await redis.del(chave(email))
    return ok
  } catch {
    return false
  }
}

export async function enviarCodigoEmail(email: string, codigo: string): Promise<boolean> {
  if (!process.env.SMTP_USER) return false
  try {
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.titan.email',
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
    await t.sendMail({
      from: `"Soma10 Approval" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Código de acesso: ${codigo}`,
      html: `<div style="font-family:sans-serif;max-width:420px">
        <p style="font-size:14px;color:#333">Seu código de verificação para entrar no Soma10 Approval:</p>
        <p style="font-size:30px;font-weight:800;letter-spacing:6px;color:#111;margin:10px 0">${codigo}</p>
        <p style="color:#888;font-size:12.5px">Válido por 5 minutos. Se você não tentou entrar, ignore este e-mail e troque sua senha.</p>
      </div>`,
    })
    return true
  } catch {
    return false
  }
}

// Gera + guarda + envia num passo. Retorna true se o e-mail saiu.
export async function dispararCodigoEmail(email: string): Promise<boolean> {
  const c = gerarCodigoEmail()
  await salvarCodigoEmail(email, c)
  return enviarCodigoEmail(email, c)
}

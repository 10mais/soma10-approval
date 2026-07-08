import { generateSecret, generateURI, verify } from 'otplib'

// Verificação em 2 fatores (TOTP — apps tipo Google Authenticator/Authy/1Password).
// Opt-in por usuário; nada muda no login de quem não ativou. otplib v13 (API async).

const EMISSOR = 'Soma10 Approval'

export function gerarSegredo(): string {
  return generateSecret()
}

// URL otpauth:// que o app autenticador lê no QR Code.
export function otpauthUrl(email: string, segredo: string): string {
  return generateURI({ issuer: EMISSOR, label: email, secret: segredo })
}

// epochTolerance 30s = aceita o código do passo anterior/seguinte (relógios levemente fora).
export async function verificarCodigo(codigo: string, segredo?: string): Promise<boolean> {
  if (!segredo) return false
  try {
    const r = await verify({ secret: segredo, token: String(codigo || '').trim(), epochTolerance: 30 })
    return !!r?.valid
  } catch {
    return false
  }
}

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enviarPushDetalhado } from '@/lib/webpush'
import crypto from 'crypto'

export const runtime = 'nodejs'

// Deriva a chave PUBLICA a partir da PRIVADA (EC P-256) e compara com a publica
// configurada. Se nao baterem, o par foi colado errado no Vercel (causa de 403).
function checarChaves() {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || ''
  const privada = process.env.VAPID_PRIVATE_KEY || ''
  if (!publica || !privada) return { publicaConfigurada: !!publica, privadaConfigurada: !!privada, chavesConferem: false }
  try {
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.setPrivateKey(Buffer.from(privada, 'base64url'))
    const derivada = ecdh.getPublicKey().toString('base64url')
    return {
      publicaConfigurada: true,
      privadaConfigurada: true,
      chavesConferem: derivada === publica,
      publicaInicio: publica.slice(0, 12),
      subject: process.env.VAPID_SUBJECT || '(default mailto:)',
    }
  } catch (e: any) {
    return { publicaConfigurada: true, privadaConfigurada: true, chavesConferem: false, erroChave: e?.message || String(e) }
  }
}

async function diagnostico() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'não autorizado — faça login primeiro' }, { status: 401 })

  const chaves = checarChaves()
  const envio = await enviarPushDetalhado(email, {
    title: 'Soma10 Approval',
    body: 'Notificação de teste — se você está vendo isto, o push está funcionando! 🎉',
    url: '/dashboard',
    tag: 'teste-push',
  })
  return NextResponse.json({ email, chaves, envio })
}

// GET e POST fazem o mesmo: abrir a URL no navegador (logado) ja roda o teste.
export async function GET() { return diagnostico() }
export async function POST() { return diagnostico() }

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { youtubeConfigurado, urlConsentimentoYouTube } from '@/lib/youtube'

export const runtime = 'nodejs'

// Começa a conexão do CANAL DO YOUTUBE de um cliente (tela "Adicionar perfil" → YouTube).
// Manda para a tela de consentimento do Google; quem recebe a volta é /callback.
//
// `cliente`  — de quem é o canal
// `nova=1`   — perfil ADICIONAL (contas[]), em vez de sobrescrever a conta principal
// `conta`    — reconectar um perfil que já existe
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  const base = (process.env.APPROVAL_BASE_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '')
  if (!youtubeConfigurado()) {
    return NextResponse.redirect(`${base}/dashboard?youtube_erro=sem_credenciais#clientes`)
  }

  const cliente = (req.nextUrl.searchParams.get('cliente') || '').trim()
  if (!cliente) return NextResponse.redirect(`${base}/dashboard?youtube_erro=sem_cliente#clientes`)
  const nova = req.nextUrl.searchParams.get('nova') === '1' ? '1' : '0'
  const conta = (req.nextUrl.searchParams.get('conta') || '').trim()

  // O `state` é o único jeito de levar contexto por um redirect — e o Google devolve
  // exatamente o que foi mandado, então ele também confere que a volta é da nossa ida.
  const estado = Buffer.from(JSON.stringify({ cliente, nova, conta, em: Date.now() })).toString('base64url')
  return NextResponse.redirect(urlConsentimentoYouTube(estado))
}

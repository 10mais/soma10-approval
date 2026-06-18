import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Inicia o login do Instagram (API com login do Instagram). Conecta UMA conta profissional.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const APP_ID = process.env.INSTAGRAM_APP_ID?.trim()
  if (!APP_ID) {
    return NextResponse.json({ error: 'INSTAGRAM_APP_ID não configurado na Vercel.' }, { status: 500 })
  }

  const BASE_URL = process.env.NEXTAUTH_URL || 'https://approval.soma10.com.br'
  const REDIRECT_URI = `${BASE_URL}/api/instagram/callback`

  const clienteAlvo = req.nextUrl.searchParams.get('cliente') || ''
  const state = clienteAlvo ? `soma10:${clienteAlvo}` : 'soma10'

  // Permissões da API com login do Instagram (publicação de conteúdo)
  const scope = ['instagram_business_basic', 'instagram_business_content_publish'].join(',')

  const url = `https://www.instagram.com/oauth/authorize`
    + `?client_id=${APP_ID}`
    + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
    + `&response_type=code`
    + `&scope=${encodeURIComponent(scope)}`
    + `&state=${encodeURIComponent(state)}`

  return NextResponse.redirect(url)
}

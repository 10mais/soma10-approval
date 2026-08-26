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
  // Permissões da API com login do Instagram. Publicação sempre; mensagens só quando
  // ?messaging=1 (caminho dedicado do CRM). A permissão de mensagens ainda não é
  // aprovada, então mantê-la fora do fluxo padrão evita quebrar a conexão de clientes
  // reais (não-testadores) antes do App Review.
  const comMensagens = req.nextUrl.searchParams.get('messaging') === '1'
  // `nova=1`: perfil ADICIONAL (contas[]), viaja no state (OAuth é redirect).
  const comoNova = req.nextUrl.searchParams.get('nova') === '1'
  // Sem cliente + mensagens = conexão da PRÓPRIA AGÊNCIA (state soma10msg)
  const state = clienteAlvo ? `soma10:${clienteAlvo}${comoNova ? ':nova' : ''}` : (comMensagens ? 'soma10msg' : 'soma10')

  // insights entra no consentimento desde o 1º clique: o App Review exige VER o
  // usuário concedendo a permissão (reprovação de 20/08), e sem ela as métricas de
  // CONTA do Analytics (alcance/visitas/demografia) falham caladas. Token JÁ salvo
  // não muda — só vale para conexão nova.
  const scopeArr = ['instagram_business_basic', 'instagram_business_content_publish', 'instagram_business_manage_insights']
  if (comMensagens) scopeArr.push('instagram_business_manage_messages', 'instagram_business_manage_comments')
  const scope = scopeArr.join(',')

  const url = `https://www.instagram.com/oauth/authorize`
    + `?client_id=${APP_ID}`
    + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
    + `&response_type=code`
    + `&scope=${encodeURIComponent(scope)}`
    + `&state=${encodeURIComponent(state)}`

  return NextResponse.redirect(url)
}

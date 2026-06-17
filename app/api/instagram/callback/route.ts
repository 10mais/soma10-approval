import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Recebe o code do Instagram, troca por token de longa duração, busca os dados da conta
// e guarda em Redis para o dashboard vincular a um cliente (reusa o painel de seleção).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state') || ''
  const clienteAlvo = state.startsWith('soma10:') ? state.slice('soma10:'.length) : ''
  const sufixoCliente = clienteAlvo ? `&meta_cliente=${encodeURIComponent(clienteAlvo)}` : ''

  const BASE_URL = process.env.NEXTAUTH_URL || 'https://approval.soma10.com.br'
  const REDIRECT_URI = `${BASE_URL}/api/instagram/callback`
  const APP_ID = process.env.INSTAGRAM_APP_ID!
  const APP_SECRET = process.env.INSTAGRAM_APP_SECRET!

  if (error || !code) {
    return NextResponse.redirect(`${BASE_URL}/dashboard?meta_error=acesso_negado#clientes`)
  }
  if (!APP_ID || !APP_SECRET) {
    return NextResponse.redirect(`${BASE_URL}/dashboard?meta_error=ig_nao_configurado#clientes`)
  }

  try {
    // 1. code -> token curto (+ user_id)
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: APP_ID,
        client_secret: APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code,
      }),
    })
    const tokenJson: any = await tokenRes.json()
    // A resposta pode vir como objeto ou dentro de data[0]
    const curto = tokenJson?.access_token ? tokenJson : (Array.isArray(tokenJson?.data) ? tokenJson.data[0] : null)
    if (!curto?.access_token) {
      return NextResponse.redirect(`${BASE_URL}/dashboard?meta_error=token_falhou#clientes`)
    }

    // 2. token curto -> token longo (~60 dias)
    const longoRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${APP_SECRET}&access_token=${curto.access_token}`
    )
    const longoJson: any = await longoRes.json()
    const token = longoJson?.access_token || curto.access_token

    // 3. Dados da conta
    const meRes = await fetch(`https://graph.instagram.com/me?fields=user_id,username,account_type,profile_picture_url&access_token=${token}`)
    const me: any = await meRes.json()
    const igUserId = me?.user_id || curto.user_id
    if (!igUserId) {
      return NextResponse.redirect(`${BASE_URL}/dashboard?meta_error=sem_conta_ig#clientes`)
    }

    // 4. Guarda no formato que o painel de vínculo já entende (reaproveita o fluxo)
    const conta = [{
      pageId: String(igUserId),
      pageName: me?.username || 'Instagram',
      pageToken: null,
      igToken: token,
      igUserId: String(igUserId),
      instagram: { id: String(igUserId), username: me?.username, profilePic: me?.profile_picture_url },
    }]

    const pagesId = uuid()
    await redis.set(`metapages:${pagesId}`, conta, { ex: 600 })
    return NextResponse.redirect(`${BASE_URL}/dashboard?meta_pages=${pagesId}${sufixoCliente}#clientes`)
  } catch (err: any) {
    console.error('Instagram callback error:', err)
    return NextResponse.redirect(`${BASE_URL}/dashboard?meta_error=erro_interno#clientes`)
  }
}

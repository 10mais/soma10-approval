import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state') || ''
  const clienteAlvo = state.startsWith('soma10:') ? state.slice('soma10:'.length) : ''
  const sufixoCliente = clienteAlvo ? `&meta_cliente=${encodeURIComponent(clienteAlvo)}` : ''

  const BASE_URL = process.env.NEXTAUTH_URL || 'https://soma10-approval.vercel.app'
  const REDIRECT_URI = `${BASE_URL}/api/meta/callback`
  const APP_ID = process.env.APP_ID!
  const APP_SECRET = process.env.APP_SECRET!
  const VERSION = process.env.META_API_VERSION || 'v19.0'

  if (error || !code) {
    return NextResponse.redirect(`${BASE_URL}/dashboard?meta_error=acesso_negado#clientes`)
  }

  try {
    // 1. Trocar code por user access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/${VERSION}/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${APP_SECRET}&code=${code}`
    )
    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${BASE_URL}/dashboard?meta_error=token_falhou#clientes`)
    }

    const userToken = tokenData.access_token

    // 2. Buscar todas as páginas que o usuário administra
    const pagesRes = await fetch(
      `https://graph.facebook.com/${VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userToken}`
    )
    const pagesData = await pagesRes.json()

    if (!pagesData.data || pagesData.data.length === 0) {
      return NextResponse.redirect(`${BASE_URL}/dashboard?meta_error=sem_paginas#clientes`)
    }

    // 3. Para cada página, buscar dados do Instagram
    const paginas = await Promise.all(
      pagesData.data.map(async (page: any) => {
        let instagram = null
        if (page.instagram_business_account) {
          const igRes = await fetch(
            `https://graph.facebook.com/${VERSION}/${page.instagram_business_account.id}?fields=username,profile_picture_url&access_token=${page.access_token}`
          )
          const igData = await igRes.json()
          instagram = {
            id: page.instagram_business_account.id,
            username: igData.username,
            profilePic: igData.profile_picture_url,
          }
        }
        return {
          pageId: page.id,
          pageName: page.name,
          pageToken: page.access_token,
          instagram,
        }
      })
    )

    // 4. Salvar resultado em cookie temporário e redirecionar para dashboard
    const payload = encodeURIComponent(JSON.stringify(paginas))
    const response = NextResponse.redirect(`${BASE_URL}/dashboard?meta_pages=1${sufixoCliente}#clientes`)
    response.cookies.set('meta_pages', payload, {
      httpOnly: false, // precisa ser lido pelo client
      maxAge: 300, // 5 minutos
      path: '/',
      sameSite: 'lax',
    })

    return response

  } catch (err: any) {
    console.error('Meta callback error:', err)
    return NextResponse.redirect(`${BASE_URL}/dashboard?meta_error=erro_interno#clientes`)
  }
}

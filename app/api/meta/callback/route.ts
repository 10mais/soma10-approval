import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state') || ''
  // state: "soma10:<clienteId>" ou "soma10:<clienteId>:nova" (perfil adicional).
  const partesState = state.startsWith('soma10:') ? state.slice('soma10:'.length).split(':') : []
  const clienteAlvo = partesState[0] || ''
  const comoNova = partesState[1] === 'nova'
  const sufixoCliente = clienteAlvo ? `&meta_cliente=${encodeURIComponent(clienteAlvo)}${comoNova ? '&meta_nova=1' : ''}` : ''

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
    const G = `https://graph.facebook.com/${VERSION}`
    const PAGE_FIELDS = 'id,name,access_token,instagram_business_account'

    const buscarJson = async (url: string): Promise<any> => {
      try { return await fetch(url).then(r => r.json()) } catch { return {} }
    }

    // 2. Reúne páginas de TODAS as fontes: diretas (/me/accounts) e via Business Manager (owned + client)
    const brutos: any[] = []

    const contas = await buscarJson(`${G}/me/accounts?fields=${PAGE_FIELDS}&limit=100&access_token=${userToken}`)
    if (Array.isArray(contas?.data)) brutos.push(...contas.data)

    const negocios = await buscarJson(`${G}/me/businesses?fields=id&limit=100&access_token=${userToken}`)
    if (Array.isArray(negocios?.data)) {
      for (const biz of negocios.data) {
        const owned = await buscarJson(`${G}/${biz.id}/owned_pages?fields=${PAGE_FIELDS}&limit=100&access_token=${userToken}`)
        if (Array.isArray(owned?.data)) brutos.push(...owned.data)
        const client = await buscarJson(`${G}/${biz.id}/client_pages?fields=${PAGE_FIELDS}&limit=100&access_token=${userToken}`)
        if (Array.isArray(client?.data)) brutos.push(...client.data)
      }
    }

    // Remove duplicadas por id
    const vistos = new Set<string>()
    const unicas: any[] = []
    for (const p of brutos) {
      if (p?.id && !vistos.has(p.id)) { vistos.add(p.id); unicas.push(p) }
    }

    if (unicas.length === 0) {
      return NextResponse.redirect(`${BASE_URL}/dashboard?meta_error=sem_paginas#clientes`)
    }

    // 3. Para cada página, garante token e busca dados do Instagram
    const paginas = await Promise.all(
      unicas.map(async (page: any) => {
        // Páginas vindas do Business às vezes não trazem o token — busca individualmente
        let pageToken = page.access_token
        let igAccount = page.instagram_business_account
        if (!pageToken) {
          const det = await buscarJson(`${G}/${page.id}?fields=access_token,instagram_business_account&access_token=${userToken}`)
          pageToken = det?.access_token
          igAccount = igAccount || det?.instagram_business_account
        }

        let instagram = null
        if (igAccount?.id && pageToken) {
          const igData = await buscarJson(`${G}/${igAccount.id}?fields=username,profile_picture_url&access_token=${pageToken}`)
          instagram = { id: igAccount.id, username: igData?.username, profilePic: igData?.profile_picture_url }
        }
        return { pageId: page.id, pageName: page.name, pageToken, instagram }
      })
    )

    // 4. Salvar as páginas no servidor (Redis) — cookie estourava o limite de tamanho com tokens longos.
    //    O dashboard busca via /api/meta/pages?id=<id>.
    const pagesId = uuid()
    await redis.set(`metapages:${pagesId}`, paginas, { ex: 600 }) // expira em 10 min
    return NextResponse.redirect(`${BASE_URL}/dashboard?meta_pages=${pagesId}${sufixoCliente}#clientes`)

  } catch (err: any) {
    console.error('Meta callback error:', err)
    return NextResponse.redirect(`${BASE_URL}/dashboard?meta_error=erro_interno#clientes`)
  }
}

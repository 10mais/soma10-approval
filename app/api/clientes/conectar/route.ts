import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'
import { revalidateTag } from 'next/cache'
import { copiarFotoParaBlob } from '@/lib/blobFoto'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { clienteId, facebookPageId, facebookPageToken, instagramBusinessId, instagramUsername, igToken, igUserId } = body

  if (!clienteId) {
    return NextResponse.json({ error: 'clienteId é obrigatório' }, { status: 400 })
  }

  // Conexão via "API com login do Instagram" (graph.instagram.com) — não usa Página do Facebook
  if (igToken && igUserId) {
    const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

    let fotoPerfil: string | undefined
    try {
      const me = await fetch(`https://graph.instagram.com/me?fields=username,profile_picture_url&access_token=${igToken}`).then(r => r.json())
      if (me?.profile_picture_url) fotoPerfil = (await copiarFotoParaBlob(me.profile_picture_url, clienteId)) || me.profile_picture_url
    } catch {}

    const atualizado: Cliente = {
      ...cliente,
      instagramToken: igToken,
      instagramUserId: String(igUserId),
      instagramUsername: instagramUsername || cliente.instagramUsername,
      instagramConectado: true,
      metaConectado: true,
      ...(fotoPerfil ? { logo: fotoPerfil } : {}),
    }
    await redis.set(`cliente:${clienteId}`, atualizado)
    revalidateTag('clientes')

    // Inscreve a conta nos webhooks de mensagens do app (necessário para receber DMs no
    // CRM). Best-effort: só funciona se o token tiver a permissão de mensagens.
    try {
      const VER = process.env.META_API_VERSION_PUBLISH || 'v21.0'
      await fetch(`https://graph.instagram.com/${VER}/me/subscribed_apps?subscribed_fields=messages&access_token=${igToken}`, { method: 'POST' })
    } catch { /* silencioso — a assinatura tambem pode ser feita no painel */ }

    return NextResponse.json({ ok: true, instagram: instagramUsername, tipo: 'instagram-login' })
  }

  if (!facebookPageId) {
    return NextResponse.json({ error: 'facebookPageId é obrigatório' }, { status: 400 })
  }

  const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN
  const VERSION = process.env.META_API_VERSION || 'v19.0'
  const BASE = `https://graph.facebook.com/${VERSION}`

  try {
    let pageToken = facebookPageToken
    let igId = instagramBusinessId
    let igUsername = instagramUsername

    // Se não veio token pré-preenchido (fluxo manual com ID), buscar via API
    if (!pageToken) {
      if (!TOKEN) return NextResponse.json({ error: 'Token Meta não configurado' }, { status: 500 })

      const pageRes = await fetch(
        `${BASE}/${facebookPageId}?fields=name,access_token,instagram_business_account&access_token=${TOKEN}`
      )
      const pageData = await pageRes.json()

      if (pageData.error) {
        return NextResponse.json({
          error: `Erro ao acessar a página: ${pageData.error.message}`,
          dica: 'Verifique se a conta da 10+ é administradora desta Página do Facebook.'
        }, { status: 400 })
      }
      if (!pageData.access_token) {
        return NextResponse.json({ error: 'Não foi possível obter o token da página.' }, { status: 400 })
      }
      if (!pageData.instagram_business_account) {
        return NextResponse.json({
          error: 'Esta Página não possui Instagram vinculado.',
          dica: 'O cliente precisa vincular o Instagram à Página nas configurações da Página.'
        }, { status: 400 })
      }

      pageToken = pageData.access_token
      igId = pageData.instagram_business_account.id

      const igRes = await fetch(`${BASE}/${igId}?fields=username&access_token=${pageToken}`)
      const igData = await igRes.json()
      igUsername = igData.username
    }

    const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

    // Busca a foto de perfil do Instagram para usar como imagem do cliente automaticamente
    let fotoPerfil: string | undefined
    try {
      if (igId && pageToken) {
        const fotoRes = await fetch(`${BASE}/${igId}?fields=profile_picture_url&access_token=${pageToken}`)
        const fotoData = await fotoRes.json()
        if (fotoData?.profile_picture_url) fotoPerfil = (await copiarFotoParaBlob(fotoData.profile_picture_url, clienteId)) || fotoData.profile_picture_url
      }
    } catch {}

    const clienteAtualizado: Cliente = {
      ...cliente,
      facebookPageId,
      facebookPageToken: pageToken,
      instagramBusinessId: igId,
      instagramUsername: igUsername,
      metaConectado: true,
      ...(fotoPerfil ? { logo: fotoPerfil } : {}),
    }

    await redis.set(`cliente:${clienteId}`, clienteAtualizado)
    revalidateTag('clientes')
    return NextResponse.json({ ok: true, instagram: igUsername, instagramId: igId })

  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno: ' + err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const { clienteId } = await req.json()
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const clienteAtualizado: Cliente = {
    ...cliente,
    facebookPageId: undefined,
    facebookPageToken: undefined,
    instagramBusinessId: undefined,
    instagramUsername: undefined,
    instagramToken: undefined,
    instagramUserId: undefined,
    instagramConectado: false,
    metaConectado: false,
  }

  await redis.set(`cliente:${clienteId}`, clienteAtualizado)
  revalidateTag('clientes')
  return NextResponse.json({ ok: true })
}

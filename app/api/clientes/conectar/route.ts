import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'

// Conecta o Instagram de um cliente usando o Page ID do Facebook
// Pré-requisito: a 10+ deve ser admin da Página do Facebook do cliente
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const { clienteId, facebookPageId } = await req.json()
  if (!clienteId || !facebookPageId) {
    return NextResponse.json({ error: 'clienteId e facebookPageId são obrigatórios' }, { status: 400 })
  }

  const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN
  const VERSION = process.env.META_API_VERSION || 'v19.0'
  const BASE = `https://graph.facebook.com/${VERSION}`

  if (!TOKEN) {
    return NextResponse.json({ error: 'Token Meta não configurado' }, { status: 500 })
  }

  try {
    // 1. Buscar token da página do cliente (a 10+ precisa ser admin)
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
      return NextResponse.json({
        error: 'Não foi possível obter o token da página.',
        dica: 'A conta da 10+ precisa ser administradora da Página do Facebook do cliente.'
      }, { status: 400 })
    }

    if (!pageData.instagram_business_account) {
      return NextResponse.json({
        error: 'Esta Página do Facebook não possui Instagram vinculado.',
        dica: 'O cliente precisa vincular o Instagram à Página do Facebook nas configurações da Página.'
      }, { status: 400 })
    }

    const igId = pageData.instagram_business_account.id

    // 2. Buscar username do Instagram
    const igRes = await fetch(
      `${BASE}/${igId}?fields=username,name&access_token=${pageData.access_token}`
    )
    const igData = await igRes.json()

    // 3. Atualizar cliente no Redis
    const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    const clienteAtualizado: Cliente = {
      ...cliente,
      facebookPageId,
      facebookPageToken: pageData.access_token,
      instagramBusinessId: igId,
      instagramUsername: igData.username || igData.name,
      metaConectado: true,
    }

    await redis.set(`cliente:${clienteId}`, clienteAtualizado)

    return NextResponse.json({
      ok: true,
      instagram: igData.username,
      instagramId: igId,
      pageName: pageData.name,
    })

  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno: ' + err.message }, { status: 500 })
  }
}

// Desconectar
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
    metaConectado: false,
  }

  await redis.set(`cliente:${clienteId}`, clienteAtualizado)
  return NextResponse.json({ ok: true })
}

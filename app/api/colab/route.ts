import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'

export const runtime = 'nodejs'

// Valida um @usuário exato no Instagram via Business Discovery, usando o token
// conectado do cliente selecionado. A API do Meta não oferece busca/autocomplete,
// então confirmamos o username exato e devolvemos foto + nome para seleção.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const clienteId = req.nextUrl.searchParams.get('clienteId') || ''
  const usernameBruto = (req.nextUrl.searchParams.get('username') || '').trim().replace(/^@/, '')

  if (!usernameBruto) return NextResponse.json({ error: 'username é obrigatório' }, { status: 400 })
  if (!/^[A-Za-z0-9._]{1,30}$/.test(usernameBruto)) {
    return NextResponse.json({ encontrado: false, error: 'Usuário inválido.' })
  }
  if (!clienteId) return NextResponse.json({ error: 'Selecione um cliente primeiro.' }, { status: 400 })

  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  const VERSION = process.env.META_API_VERSION || 'v19.0'
  const BASE = `https://graph.facebook.com/${VERSION}`
  const TOKEN = (cliente.metaConectado && cliente.facebookPageToken) ? cliente.facebookPageToken : process.env.INSTAGRAM_ACCESS_TOKEN
  const IG_ID = (cliente.metaConectado && cliente.instagramBusinessId) ? cliente.instagramBusinessId : process.env.INSTAGRAM_BUSINESS_ID

  if (!TOKEN || !IG_ID) {
    return NextResponse.json({
      encontrado: false,
      conectado: false,
      error: 'Conta do Instagram não conectada para este cliente. Conecte o Meta para buscar perfis.',
    })
  }

  const fields = `business_discovery.username(${usernameBruto}){username,name,profile_picture_url,followers_count}`
  const url = `${BASE}/${IG_ID}?fields=${encodeURIComponent(fields)}&access_token=${TOKEN}`

  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data?.error) {
      // Erro típico quando o perfil não existe ou não é business/creator
      return NextResponse.json({ encontrado: false, error: 'Perfil não encontrado ou não é uma conta comercial/criador.' })
    }
    const bd = data?.business_discovery
    if (!bd?.username) {
      return NextResponse.json({ encontrado: false, error: 'Perfil não encontrado.' })
    }
    return NextResponse.json({
      encontrado: true,
      perfil: {
        username: bd.username,
        nome: bd.name || '',
        foto: bd.profile_picture_url || '',
        seguidores: bd.followers_count ?? null,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ encontrado: false, error: e?.message || 'Falha ao consultar a API do Meta.' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'
import { capturarErro } from '@/lib/erros'

export const runtime = 'nodejs'

// Valida um @usuário exato no Instagram via Business Discovery, usando o token
// conectado do cliente selecionado. A API do Meta não oferece busca/autocomplete,
// então confirmamos o username exato e devolvemos foto + nome para seleção.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  // Ferramenta interna (menções em tarefas): bloqueia cliente — evita usar o token
  // Meta de OUTRO cliente (via ?clienteId=) para buscar perfis no Instagram.
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

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
      const e = data.error
      // Conexão da busca vencida ou sem permissão (190 = token; 102 = sessão; 10/200 = permissão):
      // a BUSCA está fora, o perfil pode muito bem existir. Antes, isto aparecia como "Perfil não
      // encontrado" para todo @ digitado (dono, 26/10/2026: "erro na hora de marcar em colab").
      if ([190, 102, 10, 200].includes(Number(e.code))) {
        // Saúde do sistema avisa o admin (no máximo 1x por hora — cada letra digitada faz uma busca).
        const primeira = await redis.set('aviso:colab-busca-fora', '1', { nx: true, ex: 3600 }).catch(() => null)
        if (primeira) await capturarErro('colab/busca', new Error(`Busca de perfis do colab fora do ar: a conexão com a Meta usada na busca venceu ou perdeu permissão (${e.code}${e.error_subcode ? `/${e.error_subcode}` : ''}). Renove o token da busca.`), { origem: cliente.metaConectado && cliente.facebookPageToken ? 'cliente' : 'agencia' })
        return NextResponse.json({ encontrado: false, indisponivel: true, error: 'A busca de perfis está indisponível agora. Confira o @ e adicione mesmo assim.' })
      }
      // Perfil pessoal não aparece na busca da Meta (ela só enxerga contas comerciais e de criador).
      return NextResponse.json({ encontrado: false, error: 'Não apareceu na busca (ela só mostra contas comerciais e de criador). Se o @ estiver certo, adicione mesmo assim.' })
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

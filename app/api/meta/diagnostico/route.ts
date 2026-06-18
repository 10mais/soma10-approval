import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'

export const runtime = 'nodejs'

// Diagnóstico da conexão Meta de um cliente: tipo da conta IG, vínculo da Página e
// permissões reais do token. Ajuda a entender o erro #10 ao publicar.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const clienteId = req.nextUrl.searchParams.get('clienteId') || ''
  if (!clienteId) {
    // Sem clienteId: lista os clientes conectados para você copiar o id
    const ids = await redis.smembers('clientes')
    const clientes = (await Promise.all(ids.map(id => redis.get<Cliente>(`cliente:${id}`)))).filter(Boolean) as Cliente[]
    return NextResponse.json({
      dica: 'Adicione ?clienteId=<id> na URL para diagnosticar. Lista abaixo:',
      clientes: clientes.map(c => ({ id: c.id, nome: c.nome, instagram: c.instagramUsername, conectado: !!c.metaConectado })),
    })
  }

  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  const VERSION = process.env.META_API_VERSION_PUBLISH || 'v21.0'
  const BASE = `https://graph.facebook.com/${VERSION}`
  const TOKEN = cliente.facebookPageToken
  const PAGE_ID = cliente.facebookPageId
  const IG_ID = cliente.instagramBusinessId
  const APP_ID = process.env.APP_ID
  const APP_SECRET = process.env.APP_SECRET

  if (!TOKEN) return NextResponse.json({ error: 'cliente sem token (não conectado)' }, { status: 400 })

  const buscar = async (url: string) => {
    try { return await fetch(url).then(r => r.json()) } catch (e: any) { return { erro: e?.message } }
  }

  // 1. Tipo da conta Instagram (precisa ser BUSINESS para publicar)
  const ig = IG_ID ? await buscar(`${BASE}/${IG_ID}?fields=id,username,name,account_type,profile_picture_url&access_token=${TOKEN}`) : { erro: 'sem instagramBusinessId' }

  // 2. Vínculo da Página com o Instagram
  const pagina = PAGE_ID ? await buscar(`${BASE}/${PAGE_ID}?fields=name,instagram_business_account&access_token=${TOKEN}`) : { erro: 'sem facebookPageId' }

  // 3. Permissões/escopos reais do token
  let escopos: any = { erro: 'APP_ID/APP_SECRET ausentes' }
  if (APP_ID && APP_SECRET) {
    const dbg = await buscar(`${BASE}/debug_token?input_token=${TOKEN}&access_token=${APP_ID}|${APP_SECRET}`)
    escopos = {
      scopes: dbg?.data?.scopes,
      granular_scopes: dbg?.data?.granular_scopes,
      type: dbg?.data?.type,
      app_id: dbg?.data?.app_id,
      is_valid: dbg?.data?.is_valid,
      erro: dbg?.error,
    }
  }

  // 4. Conexão via login do Instagram (graph.instagram.com) — qual conta e últimas publicações
  let instagramLogin: any = { conectado: false }
  if (cliente.instagramToken && cliente.instagramUserId) {
    const IG_BASE = `https://graph.instagram.com/${VERSION}`
    const me = await buscar(`${IG_BASE}/me?fields=user_id,username,account_type,profile_picture_url&access_token=${cliente.instagramToken}`)
    const midias = await buscar(`${IG_BASE}/me/media?fields=id,caption,media_type,permalink,timestamp&limit=5&access_token=${cliente.instagramToken}`)
    instagramLogin = {
      conectado: true,
      instagramUserId: cliente.instagramUserId,
      conta: me,
      ultimasPublicacoes: midias?.data || midias,
    }
  }

  return NextResponse.json({
    cliente: cliente.nome,
    instagramLogin,
    instagram_classico: ig,
    pagina,
    token: escopos,
    dica: 'Veja instagramLogin.conta.username (conta conectada) e instagramLogin.ultimasPublicacoes (se o post saiu, aparece aqui com permalink).',
  }, { status: 200 })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import type { Cliente } from '@/lib/redis'
import { enviarDMInstagram, salvarMensagemIg, resolverContaIg, listarContasMensagemIg, IgConversa, IgMensagem } from '@/lib/instagramDM'

export const runtime = 'nodejs'

async function autorizado() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

// Central de mensagens do CRM (Instagram Direct). GET lista conversas ou o
// histórico de um IG user id; POST envia; PUT vincula a conversa a um contato.
export async function GET(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const id = (req.nextUrl.searchParams.get('id') || '').trim()

  // Histórico de uma conversa (e marca como lida)
  if (id) {
    const raw = await redis.lrange(`ig:msgs:${id}`, 0, -1)
    const mensagens: IgMensagem[] = raw.map(m => { try { return typeof m === 'string' ? JSON.parse(m) : m } catch { return null } }).filter(Boolean) as IgMensagem[]
    const conversa = await redis.get<IgConversa>(`ig:conversa:${id}`)
    if (conversa && conversa.naoLidas) await redis.set(`ig:conversa:${id}`, { ...conversa, naoLidas: 0 })
    return NextResponse.json({ conversa, mensagens })
  }

  // Lista de conversas (ordenadas pela última mensagem)
  const ids = await redis.smembers('ig:conversas')
  const conversas = ids.length
    ? ((await Promise.all(ids.map(i => redis.get<IgConversa>(`ig:conversa:${i}`)))).filter(Boolean) as IgConversa[])
    : []
  conversas.sort((a, b) => new Date(b.ultimaEm || 0).getTime() - new Date(a.ultimaEm || 0).getTime())
  // "configurado" = há conta de mensagens da agência OU um cliente com Instagram conectado
  const contasAgencia = await listarContasMensagemIg()
  const cids = await redis.smembers('clientes')
  const clientes = cids.length ? ((await redis.mget<(Cliente | null)[]>(...cids.map(i => `cliente:${i}`))).filter(Boolean) as Cliente[]) : []
  const algumConectado = contasAgencia.length > 0 || clientes.some(c => c.instagramConectado || !!c.instagramUserId || !!c.instagramBusinessId)
  return NextResponse.json({ configurado: algumConectado, conversas })
}

export async function POST(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { id, texto } = await req.json()
  const igId = String(id || '').trim()
  if (!igId || !String(texto || '').trim()) {
    return NextResponse.json({ error: 'id e texto são obrigatórios' }, { status: 400 })
  }

  const conversa = await redis.get<IgConversa>(`ig:conversa:${igId}`)
  // Token da conta que RECEBEU esta conversa (agência ou cliente)
  const conta = conversa?.contaId ? await resolverContaIg(conversa.contaId) : null

  if (!conta?.token) {
    // Sem token/permissão: registra como rascunho local para não perder o histórico
    await salvarMensagemIg(igId, { id: crypto.randomUUID(), de: 'agente', texto: String(texto), em: new Date().toISOString(), autor: session.user?.name || '' })
    return NextResponse.json({ ok: false, error: 'Instagram Direct ainda não aprovado/conectado — mensagem registrada localmente, mas não enviada.', registrado: true })
  }

  const r = await enviarDMInstagram(conta.token, igId, String(texto), session.user?.name || '')
  if (!r.ok) return NextResponse.json({ error: r.erro || 'falha ao enviar' }, { status: 502 })
  return NextResponse.json({ ok: true })
}

// Vincula a conversa a um contato do CRM (e opcionalmente nome)
export async function PUT(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { id, contatoId, nome } = await req.json()
  const igId = String(id || '').trim()
  if (!igId) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const atual = (await redis.get<IgConversa>(`ig:conversa:${igId}`)) || { id: igId }
  await redis.set(`ig:conversa:${igId}`, { ...atual, id: igId, ...(contatoId !== undefined ? { contatoId } : {}), ...(nome !== undefined ? { nome } : {}) })
  return NextResponse.json({ ok: true })
}

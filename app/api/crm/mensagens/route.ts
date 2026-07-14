import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { enviarWhatsApp, whatsappConfigurado, salvarMensagem, WaConversa, WaMensagem } from '@/lib/whatsapp'

export const runtime = 'nodejs'

async function autorizado() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

// Central de mensagens do CRM (WhatsApp). GET lista conversas ou mensagens de
// um telefone; POST envia uma mensagem; PUT vincula a conversa a um contato.
export async function GET(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const tel = (req.nextUrl.searchParams.get('tel') || '').replace(/\D/g, '')

  // Busca full-text DENTRO das conversas (não só na última mensagem): varre o
  // histórico de cada conversa e devolve as que casam + um trecho de contexto.
  const busca = (req.nextUrl.searchParams.get('busca') || '').trim().toLowerCase()
  if (busca) {
    if (busca.length < 2) return NextResponse.json({ matches: [] })
    const tels = await redis.smembers('wa:conversas')
    const historicos = tels.length ? await Promise.all(tels.map(t => redis.lrange(`wa:msgs:${t}`, 0, -1))) : []
    const matches: { tel: string; snippet: string }[] = []
    tels.forEach((t, i) => {
      for (const m of historicos[i]) {
        let texto = ''
        try { const o = typeof m === 'string' ? JSON.parse(m) : m; texto = o?.texto || '' } catch { texto = '' }
        const pos = texto.toLowerCase().indexOf(busca)
        if (pos >= 0) {
          const ini = Math.max(0, pos - 25)
          const fim = pos + busca.length + 25
          matches.push({ tel: t, snippet: (ini > 0 ? '…' : '') + texto.slice(ini, fim) + (fim < texto.length ? '…' : '') })
          break // primeira ocorrência por conversa basta
        }
      }
    })
    return NextResponse.json({ matches: matches.slice(0, 60) })
  }

  // Histórico de uma conversa (e marca como lida)
  if (tel) {
    const raw = await redis.lrange(`wa:msgs:${tel}`, 0, -1)
    const mensagens: WaMensagem[] = raw.map(m => { try { return typeof m === 'string' ? JSON.parse(m) : m } catch { return null } }).filter(Boolean) as WaMensagem[]
    const conversa = await redis.get<WaConversa>(`wa:conversa:${tel}`)
    if (conversa && conversa.naoLidas) await redis.set(`wa:conversa:${tel}`, { ...conversa, naoLidas: 0 })
    return NextResponse.json({ configurado: whatsappConfigurado(), conversa, mensagens })
  }

  // Lista de conversas (ordenadas pela última mensagem)
  const tels = await redis.smembers('wa:conversas')
  const conversas = tels.length
    ? ((await Promise.all(tels.map(t => redis.get<WaConversa>(`wa:conversa:${t}`)))).filter(Boolean) as WaConversa[])
    : []
  conversas.sort((a, b) => new Date(b.ultimaEm || 0).getTime() - new Date(a.ultimaEm || 0).getTime())
  return NextResponse.json({ configurado: whatsappConfigurado(), conversas })
}

export async function POST(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { telefone, texto } = await req.json()
  if (!String(telefone || '').trim() || !String(texto || '').trim()) {
    return NextResponse.json({ error: 'telefone e texto são obrigatórios' }, { status: 400 })
  }

  if (!whatsappConfigurado()) {
    // Sem credenciais: registra como rascunho local para não perder o histórico
    await salvarMensagem(telefone, { id: crypto.randomUUID(), de: 'agente', texto: String(texto), em: new Date().toISOString(), autor: session.user?.name || '' })
    return NextResponse.json({ ok: false, error: 'WhatsApp ainda não configurado — mensagem registrada localmente, mas não enviada.', registrado: true })
  }

  const r = await enviarWhatsApp(String(telefone), String(texto), session.user?.name || '')
  if (!r.ok) return NextResponse.json({ error: r.erro || 'falha ao enviar' }, { status: 502 })
  return NextResponse.json({ ok: true })
}

// Vincula a conversa a um contato (e opcionalmente nome)
export async function PUT(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { telefone, contatoId, nome } = await req.json()
  const tel = String(telefone || '').replace(/\D/g, '')
  if (!tel) return NextResponse.json({ error: 'telefone obrigatório' }, { status: 400 })
  const atual = (await redis.get<WaConversa>(`wa:conversa:${tel}`)) || { telefone: tel }
  await redis.set(`wa:conversa:${tel}`, { ...atual, telefone: tel, ...(contatoId !== undefined ? { contatoId } : {}), ...(nome !== undefined ? { nome } : {}) })
  return NextResponse.json({ ok: true })
}

// Exclui a conversa inteira (histórico + metadados + índice). Permissão CRM/excluir.
// Se o número mandar mensagem de novo, o webhook recria a conversa do zero.
export async function DELETE(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const tel = (req.nextUrl.searchParams.get('tel') || '').replace(/\D/g, '')
  if (!tel) return NextResponse.json({ error: 'telefone obrigatório' }, { status: 400 })
  await redis.del(`wa:msgs:${tel}`)
  await redis.del(`wa:conversa:${tel}`)
  await redis.srem('wa:conversas', tel)
  return NextResponse.json({ ok: true })
}

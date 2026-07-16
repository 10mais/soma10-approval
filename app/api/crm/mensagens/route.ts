import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { enviarWhatsApp, enviarMidiaWhatsApp, editarMensagemWhatsApp, whatsappConfigurado, salvarMensagem, WaConversa, WaMensagem } from '@/lib/whatsapp'
import { apagarMensagemDaConversa } from '@/lib/apagarMensagem'
import { telefoneWhatsApp, soDigitos } from '@/lib/telefoneBR'

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

  const { telefone, texto, midia } = await req.json()
  const temMidia = midia && typeof midia?.url === 'string' && midia.url
  if (!String(telefone || '').trim() || (!String(texto || '').trim() && !temMidia)) {
    return NextResponse.json({ error: 'telefone e texto são obrigatórios' }, { status: 400 })
  }

  // Grupo: o destino precisa ser o JID completo (@g.us), não o número.
  // telefoneWhatsApp acrescenta o 55 do país quando falta (contato digitado como
  // "55 99976-6707" iria para OUTRO número). Grupo/estrangeiro não normalizam:
  // caem no fallback e seguem como estavam.
  const telDest = telefoneWhatsApp(telefone) || soDigitos(String(telefone))
  const conv = await redis.get<WaConversa>(`wa:conversa:${telDest}`)
  const destinoJid = conv?.grupo && conv?.jid ? conv.jid : undefined

  if (!whatsappConfigurado()) {
    // Sem credenciais: registra como rascunho local para não perder o histórico
    await salvarMensagem(telDest, { id: crypto.randomUUID(), de: 'agente', texto: String(texto || (temMidia ? `[${midia.tipo || 'mídia'}]` : '')), em: new Date().toISOString(), autor: session.user?.name || '' })
    return NextResponse.json({ ok: false, error: 'WhatsApp ainda não configurado — mensagem registrada localmente, mas não enviada.', registrado: true })
  }

  // Encaminhar/enviar mídia (URL já no nosso Blob)
  if (temMidia) {
    const r = await enviarMidiaWhatsApp(telDest, {
      tipo: midia.tipo || 'documento', url: String(midia.url),
      ...(midia.mimetype ? { mimetype: String(midia.mimetype) } : {}),
      ...(midia.fileName ? { fileName: String(midia.fileName) } : {}),
      ...(String(texto || '').trim() ? { caption: String(texto).trim() } : {}),
    }, session.user?.name || '', destinoJid)
    if (!r.ok) return NextResponse.json({ error: r.erro || 'falha ao enviar mídia' }, { status: 502 })
    return NextResponse.json({ ok: true })
  }

  const r = await enviarWhatsApp(telDest, String(texto), session.user?.name || '', destinoJid)
  if (!r.ok) return NextResponse.json({ error: r.erro || 'falha ao enviar' }, { status: 502 })
  return NextResponse.json({ ok: true })
}

// Vincula a conversa a um contato (e opcionalmente nome). Também EDITA uma
// mensagem enviada ({ telefone, editarMsgId, novoTexto } — regra do WhatsApp).
export async function PUT(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { telefone, contatoId, nome, editarMsgId, novoTexto } = await req.json()
  const tel = telefoneWhatsApp(telefone) || soDigitos(String(telefone || ''))
  if (!tel) return NextResponse.json({ error: 'telefone obrigatório' }, { status: 400 })

  // Edição de mensagem enviada (só nossas, texto puro, dentro de ~15 min)
  if (editarMsgId) {
    const txt = String(novoTexto || '').trim()
    if (!txt) return NextResponse.json({ error: 'informe o novo texto' }, { status: 400 })
    const raw = await redis.lrange(`wa:msgs:${tel}`, 0, -1)
    const idx = raw.findIndex(m => { try { const o = typeof m === 'string' ? JSON.parse(m) : m; return o?.id === editarMsgId } catch { return false } })
    if (idx < 0) return NextResponse.json({ error: 'mensagem não encontrada' }, { status: 404 })
    const msg: WaMensagem = typeof raw[idx] === 'string' ? JSON.parse(raw[idx] as string) : raw[idx] as any
    if (msg.de !== 'agente') return NextResponse.json({ error: 'só é possível editar mensagens enviadas por você' }, { status: 400 })
    if (msg.tipo) return NextResponse.json({ error: 'mídia não pode ser editada' }, { status: 400 })
    if (Date.now() - new Date(msg.em).getTime() > 15 * 60 * 1000) {
      return NextResponse.json({ error: 'o WhatsApp só permite editar até ~15 minutos após o envio' }, { status: 400 })
    }
    const conv = await redis.get<WaConversa>(`wa:conversa:${tel}`)
    const r = await editarMensagemWhatsApp(tel, editarMsgId, txt, conv?.jid)
    if (!r.ok) return NextResponse.json({ error: r.erro || 'falha ao editar no WhatsApp' }, { status: 502 })
    const editada: WaMensagem = { ...msg, texto: txt, editada: true }
    await redis.lset(`wa:msgs:${tel}`, idx, JSON.stringify(editada))
    if (conv && idx === raw.length - 1) await redis.set(`wa:conversa:${tel}`, { ...conv, ultimaMsg: txt.slice(0, 120) })
    return NextResponse.json({ ok: true })
  }

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

  // Com msgId: apaga UMA mensagem (só do Soma10 — segue no celular do cliente).
  // Sem msgId: apaga a conversa inteira, como já era.
  const msgId = req.nextUrl.searchParams.get('msgId') || ''
  if (msgId) {
    const ok = await apagarMensagemDaConversa(`wa:msgs:${tel}`, `wa:conversa:${tel}`, msgId)
    if (!ok) return NextResponse.json({ error: 'mensagem não encontrada' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }

  await redis.del(`wa:msgs:${tel}`)
  await redis.del(`wa:conversa:${tel}`)
  await redis.srem('wa:conversas', tel)
  return NextResponse.json({ ok: true })
}

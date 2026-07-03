import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { salvarMensagemIg, resolverContaIg, IgConversa } from '@/lib/instagramDM'
import { notificarEquipe } from '@/lib/notificacoes'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// GET — verificação do webhook pela Meta (hub.challenge). Configure a mesma
// string em INSTAGRAM_VERIFY_TOKEN e no painel da Meta (Instagram → Webhooks).
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const mode = p.get('hub.mode')
  const token = p.get('hub.verify_token')
  const challenge = p.get('hub.challenge')
  if (mode === 'subscribe' && token && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    return new NextResponse(challenge || '', { status: 200 })
  }
  return new NextResponse('forbidden', { status: 403 })
}

// POST — mensagens recebidas do Instagram Direct (entry[].messaging[]).
// Armazena a conversa (vinculada ao cliente dono da conta) e avisa a equipe.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Diagnostico: confirma nos logs da Vercel que a Meta esta chamando o webhook
    console.log('[ig-webhook] POST recebido:', JSON.stringify(body).slice(0, 800))
    for (const entry of (body.entry || [])) {
      const contaId = entry.id // id da conta profissional (lado que recebeu)
      for (const ev of (entry.messaging || [])) {
        const msg = ev.message
        if (!msg || msg.is_echo) continue // ignora ecos das nossas próprias respostas
        const from = ev.sender?.id
        if (!from) continue
        const texto = msg.text || `[${Array.isArray(msg.attachments) && msg.attachments.length ? 'anexo' : 'mensagem'}]`
        const em = ev.timestamp ? new Date(Number(ev.timestamp)).toISOString() : new Date().toISOString()
        const conta = await resolverContaIg(String(contaId)).catch(() => null)
        // Enriquece com o perfil do remetente (nome, @username, foto) — só na 1ª vez
        const extra: Partial<IgConversa> = { contaId: String(contaId), clienteId: conta?.clienteId }
        const existente = await redis.get<IgConversa>(`ig:conversa:${from}`).catch(() => null)
        if (conta?.token && !(existente?.nome || existente?.foto)) {
          const VER = process.env.META_API_VERSION_PUBLISH || 'v21.0'
          const perfil: any = await fetch(`https://graph.instagram.com/${VER}/${from}?fields=name,username,profile_pic&access_token=${encodeURIComponent(conta.token)}`).then(r => r.json()).catch(() => ({}))
          if (perfil?.name) extra.nome = perfil.name
          if (perfil?.username) extra.username = perfil.username
          if (perfil?.profile_pic) extra.foto = perfil.profile_pic
        }
        await salvarMensagemIg(String(from), { id: msg.mid || uuid(), de: 'cliente', texto, em }, extra)
        await notificarEquipe('geral', `Instagram: ${extra.nome || conta?.nome || from}`, texto.slice(0, 120)).catch(() => {})
      }
    }
  } catch { /* nunca falhar o webhook — a Meta reentrega em erro */ }
  return NextResponse.json({ ok: true })
}

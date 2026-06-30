import { NextRequest, NextResponse } from 'next/server'
import { salvarMensagem } from '@/lib/whatsapp'
import { notificarEquipe } from '@/lib/notificacoes'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// GET — verificação do webhook pela Meta (hub.challenge). Configure a mesma
// string em WHATSAPP_VERIFY_TOKEN e no painel da Meta.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const mode = p.get('hub.mode')
  const token = p.get('hub.verify_token')
  const challenge = p.get('hub.challenge')
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge || '', { status: 200 })
  }
  return new NextResponse('forbidden', { status: 403 })
}

// POST — eventos da Meta (mensagens recebidas). Armazena a conversa e avisa a equipe.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        const value = change.value || {}
        const nomePerfil = value.contacts?.[0]?.profile?.name
        for (const m of (value.messages || [])) {
          const from = m.from
          const texto = m.text?.body || `[${m.type || 'mensagem'}]`
          const em = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString()
          await salvarMensagem(from, { id: m.id || uuid(), de: 'cliente', texto, em }, { nome: nomePerfil })
          await notificarEquipe('geral', `WhatsApp: ${nomePerfil || from}`, texto.slice(0, 120)).catch(() => {})
        }
      }
    }
  } catch { /* nunca falhar o webhook — a Meta reentrega em erro */ }
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { salvarMensagem, textoMensagemEvolution, fotoPerfilEvolution, capturarMidiaEvolution, nomeGrupoEvolution, WaConversa } from '@/lib/whatsapp'
import { redis } from '@/lib/redis'
import { notificarEquipe } from '@/lib/notificacoes'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// GET — verificação do webhook. Serve a Meta (hub.challenge) E o Evolution
// (que só faz um GET simples). Configure a mesma string em WHATSAPP_VERIFY_TOKEN.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const mode = p.get('hub.mode')
  const token = p.get('hub.verify_token')
  const challenge = p.get('hub.challenge')
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge || '', { status: 200 })
  }
  if (!mode) return NextResponse.json({ ok: true }) // ping do Evolution/health
  return new NextResponse('forbidden', { status: 403 })
}

// Recebe UMA mensagem do Evolution (messages.upsert) e grava. Ignora as próprias
// (fromMe) e mensagens de grupo. Devolve true se gravou algo.
async function processarEvolution(body: any): Promise<boolean> {
  // Opcional: exige ?token= igual ao WHATSAPP_VERIFY_TOKEN quando este existir.
  if (body?.event && !String(body.event).includes('messages.upsert')) return false
  const eventos = Array.isArray(body?.data) ? body.data : [body?.data].filter(Boolean)
  let gravou = false
  for (const d of eventos) {
    const jid: string = d?.key?.remoteJid || ''
    if (d?.key?.fromMe) continue // mensagem enviada por nós
    const ehGrupo = jid.endsWith('@g.us')
    const tel = jid.split('@')[0]
    if (!tel) continue
    const texto = textoMensagemEvolution(d?.message) || '[mensagem]'
    const em = d?.messageTimestamp ? new Date(Number(d.messageTimestamp) * 1000).toISOString() : new Date().toISOString()
    // Mídia (imagem/vídeo/áudio/documento): baixa e guarda no Blob (best-effort).
    const midia = await capturarMidiaEvolution(d)
    const existente = await redis.get<WaConversa>(`wa:conversa:${tel.replace(/\D/g, '')}`)
    // Grupo: nome da conversa = assunto do grupo (busca uma vez); autor por mensagem.
    // Individual: foto de perfil (busca uma vez) + nome do contato (pushName).
    let foto: string | undefined
    let nomeConversa: string | undefined
    if (ehGrupo) {
      nomeConversa = (existente as any)?.grupo && existente?.nome ? existente.nome : ((await nomeGrupoEvolution(jid)) || `Grupo ${tel.slice(-6)}`)
    } else {
      if (!(existente as any)?.foto) { foto = (await fotoPerfilEvolution(tel)) || undefined }
      nomeConversa = d?.pushName
    }
    await salvarMensagem(tel,
      { id: d?.key?.id || uuid(), de: 'cliente', texto, em, ...(ehGrupo && d?.pushName ? { autor: d.pushName } : {}), ...(midia || {}) },
      { ...(nomeConversa ? { nome: nomeConversa } : {}), ...(foto ? { foto } : {}), jid, ...(ehGrupo ? { grupo: true } : {}) } as any)
    await notificarEquipe('geral', `WhatsApp: ${ehGrupo ? nomeConversa : (d?.pushName || tel)}`, texto.slice(0, 120)).catch(() => {})
    gravou = true
  }
  return gravou
}

// POST — eventos de WhatsApp. Detecta o formato: Evolution (event/data) ou Meta (entry/changes).
export async function POST(req: NextRequest) {
  try {
    // Se WHATSAPP_VERIFY_TOKEN existe, aceita o token por header apikey ou query ?token=
    const token = process.env.WHATSAPP_VERIFY_TOKEN
    if (token && process.env.EVOLUTION_API_URL) {
      const passado = req.headers.get('apikey') || req.nextUrl.searchParams.get('token')
      // só bloqueia se um token foi enviado e está errado; Evolution nem sempre manda
      if (passado && passado !== token) return NextResponse.json({ ok: false }, { status: 401 })
    }
    const body = await req.json()

    // Formato Evolution
    if (body?.event || body?.instance) { await processarEvolution(body); return NextResponse.json({ ok: true }) }

    // Formato Meta Cloud API
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
  } catch { /* nunca falhar o webhook — reentrega em erro */ }
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { salvarMensagem, atualizarMensagem, mensagemExiste, textoMensagemEvolution, fotoPerfilEvolution, capturarMidiaEvolution, tipoMidiaEvolution, nomeGrupoEvolution, WaConversa } from '@/lib/whatsapp'
import { redis } from '@/lib/redis'
import { notificarEquipe } from '@/lib/notificacoes'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'
// Baixar a mídia do Evolution + subir ao Blob leva tempo; sem isto a função era
// MORTA no meio (status 0 nos logs) e a mensagem se perdia inteira.
export const maxDuration = 60

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

// Recebe UMA mensagem do Evolution (messages.upsert) e grava — inclusive as que
// a equipe manda pelo CELULAR/WhatsApp Web (fromMe), para o histórico do CRM
// refletir o atendimento inteiro. O eco das que o próprio sistema enviou é
// descartado por ID (elas já foram gravadas no envio). Devolve true se gravou.
async function processarEvolution(body: any): Promise<boolean> {
  // Opcional: exige ?token= igual ao WHATSAPP_VERIFY_TOKEN quando este existir.
  if (body?.event && !String(body.event).includes('messages.upsert')) return false
  const eventos = Array.isArray(body?.data) ? body.data : [body?.data].filter(Boolean)
  let gravou = false
  for (const d of eventos) {
    const jid: string = d?.key?.remoteJid || ''
    const ehGrupo = jid.endsWith('@g.us')
    const daEquipe = !!d?.key?.fromMe // saiu do nosso número (sistema, celular ou WhatsApp Web)
    const tel = jid.split('@')[0]
    if (!tel) continue
    // Eco do que o sistema acabou de enviar: mesmo key.id já gravado — ignora.
    const msgId = d?.key?.id || uuid()
    if (daEquipe && await mensagemExiste(tel, msgId)) continue
    const texto = textoMensagemEvolution(d?.message) || '[mensagem]'
    const em = d?.messageTimestamp ? new Date(Number(d.messageTimestamp) * 1000).toISOString() : new Date().toISOString()
    const tipoMidia = tipoMidiaEvolution(d?.message)
    const existente = await redis.get<WaConversa>(`wa:conversa:${tel.replace(/\D/g, '')}`)
    // Grupo: nome da conversa = assunto do grupo (busca uma vez); autor por mensagem.
    // Individual: foto de perfil + nome do contato (pushName) — mas NUNCA a partir
    // de uma mensagem nossa: aí o pushName é o nome do NOSSO número.
    let foto: string | undefined
    let nomeConversa: string | undefined
    if (ehGrupo) {
      nomeConversa = (existente as any)?.grupo && existente?.nome ? existente.nome : ((await nomeGrupoEvolution(jid)) || `Grupo ${tel.slice(-6)}`)
    } else {
      if (!(existente as any)?.foto) { foto = (await fotoPerfilEvolution(tel)) || undefined }
      if (!daEquipe) nomeConversa = d?.pushName
    }
    // 1) GRAVA a mensagem primeiro (já marcada como mídia). Assim ela nunca se
    //    perde, mesmo que a captura abaixo demore, falhe ou mate a função.
    await salvarMensagem(tel,
      {
        id: msgId, de: daEquipe ? 'agente' : 'cliente', texto, em,
        // Fora do sistema não dá para saber QUEM da equipe digitou; marca a origem
        // para a auditoria do atendimento não confundir com envio pelo Soma10.
        ...(daEquipe ? { autor: 'via celular/Web' } : (ehGrupo && d?.pushName ? { autor: d.pushName } : {})),
        ...(tipoMidia ? { tipo: tipoMidia } : {}),
      },
      { ...(nomeConversa ? { nome: nomeConversa } : {}), ...(foto ? { foto } : {}), jid, ...(ehGrupo ? { grupo: true } : {}) } as any)
    // Só avisa a equipe do que CHEGA (mensagem nossa não é notificação).
    if (!daEquipe) await notificarEquipe('geral', `WhatsApp: ${ehGrupo ? nomeConversa : (d?.pushName || tel)}`, texto.slice(0, 120)).catch(() => {})
    gravou = true

    // 2) Só então baixa a mídia e anexa à mensagem já salva (best-effort).
    if (tipoMidia) {
      const midia = await capturarMidiaEvolution(d)
      if (midia?.midiaUrl) {
        const ok = await atualizarMensagem(tel, msgId, { midiaUrl: midia.midiaUrl, ...(midia.mimetype ? { mimetype: midia.mimetype } : {}), ...(midia.fileName ? { fileName: midia.fileName } : {}) })
        console.log('[wa-midia] anexada', tipoMidia, ok ? 'ok' : 'FALHOU-update', msgId)
      } else {
        console.warn('[wa-midia] sem url para', tipoMidia, msgId)
      }
    }
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

import { redis } from './redis'
import { put, get } from '@vercel/blob'

// Integração WhatsApp — DOIS transportes possíveis (o Evolution tem prioridade):
//
// A) Conector "WhatsApp Web" via EVOLUTION API (mantém o número antigo, pareia por QR):
//   EVOLUTION_API_URL   — URL pública do host do Evolution (ex.: https://xxx.up.railway.app)
//   EVOLUTION_API_KEY   — AUTHENTICATION_API_KEY do Evolution
//   EVOLUTION_INSTANCE  — nome da instância pareada (ex.: norah)
//   WHATSAPP_VERIFY_TOKEN (opcional) — protege o webhook (query ?token=)
//
// B) WhatsApp Business CLOUD API (Meta) — exige migrar o número (fallback/legado):
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, META_API_VERSION_PUBLISH
//
// Sem NENHUM dos dois, o envio é no-op (scaffold seguro antes de configurar).

export type WaMensagem = {
  id: string; de: 'cliente' | 'agente'; texto: string; em: string; autor?: string
  // Mídia recebida (F1 do inbox rico): bytes ficam no Blob; aqui só a referência.
  tipo?: 'imagem' | 'video' | 'audio' | 'documento' | 'figurinha'
  midiaUrl?: string
  mimetype?: string
  fileName?: string
  editada?: boolean // mensagem nossa editada depois de enviada (regra dos ~15 min)
}
export type WaConversa = {
  telefone: string; nome?: string; foto?: string; contatoId?: string; ultimaMsg?: string; ultimaEm?: string; naoLidas?: number
  jid?: string // remoteJid completo (necessário p/ grupos e edição de mensagem)
  grupo?: boolean // conversa de GRUPO (@g.us)
}

export function evolutionConfigurado(): boolean {
  return !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE)
}
export function cloudConfigurado(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}
export function whatsappConfigurado(): boolean {
  return evolutionConfigurado() || cloudConfigurado()
}

const soDigitos = (t: string) => (t || '').replace(/\D/g, '')

// Normaliza a URL do Evolution: aceita com ou sem https:// (o fetch exige protocolo)
// e remove a barra final. Ex.: "xxx.up.railway.app/" -> "https://xxx.up.railway.app".
export function normalizarUrlEvolution(u?: string): string {
  const s = (u || '').trim().replace(/\/+$/, '')
  if (!s) return ''
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

// Busca a URL da foto de perfil do contato no WhatsApp (Evolution). Best-effort.
export async function fotoPerfilEvolution(numero: string): Promise<string | null> {
  if (!evolutionConfigurado()) return null
  try {
    const base = normalizarUrlEvolution(process.env.EVOLUTION_API_URL)
    const r = await fetch(`${base}/chat/fetchProfilePictureUrl/${process.env.EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { apikey: process.env.EVOLUTION_API_KEY as string, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: (numero || '').replace(/\D/g, '') }),
    })
    const d = await r.json().catch(() => ({} as any))
    return d?.profilePictureUrl || null
  } catch { return null }
}

// Nome (subject) de um grupo — best-effort, usado ao criar a conversa do grupo.
export async function nomeGrupoEvolution(jid: string): Promise<string | null> {
  if (!evolutionConfigurado() || !jid.endsWith('@g.us')) return null
  try {
    const base = normalizarUrlEvolution(process.env.EVOLUTION_API_URL)
    const r = await fetch(`${base}/group/findGroupInfos/${process.env.EVOLUTION_INSTANCE}?groupJid=${encodeURIComponent(jid)}`, {
      headers: { apikey: process.env.EVOLUTION_API_KEY as string },
    })
    const d = await r.json().catch(() => ({} as any))
    return d?.subject || null
  } catch { return null }
}

// Extrai o texto de um payload de mensagem do Evolution (messages.upsert).
// Cobre texto simples, extendedText e legenda de mídia; mídia sem legenda vira rótulo.
export function textoMensagemEvolution(message: any): string {
  if (!message) return ''
  if (typeof message.conversation === 'string') return message.conversation
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text
  const cap = message.imageMessage?.caption || message.videoMessage?.caption || message.documentMessage?.caption
  if (cap) return cap
  if (message.imageMessage) return '[imagem]'
  if (message.videoMessage) return '[vídeo]'
  if (message.audioMessage) return '[áudio]'
  if (message.documentMessage) return '[documento]'
  if (message.stickerMessage) return '[figurinha]'
  if (message.locationMessage) return '[localização]'
  return ''
}

// Tipo da mídia SEM baixar nada — o webhook usa para salvar a mensagem já
// marcada como mídia antes de tentar a captura (que é lenta e pode falhar).
export function tipoMidiaEvolution(message: any): NonNullable<WaMensagem['tipo']> | null {
  return noMidiaEvolution(message)?.tipo || null
}

// Nó de mídia do payload do Evolution (imagem/vídeo/áudio/documento/figurinha).
function noMidiaEvolution(message: any): { tipo: NonNullable<WaMensagem['tipo']>; no: any } | null {
  if (!message) return null
  if (message.imageMessage) return { tipo: 'imagem', no: message.imageMessage }
  if (message.videoMessage) return { tipo: 'video', no: message.videoMessage }
  if (message.audioMessage) return { tipo: 'audio', no: message.audioMessage }
  if (message.documentMessage) return { tipo: 'documento', no: message.documentMessage }
  if (message.stickerMessage) return { tipo: 'figurinha', no: message.stickerMessage }
  return null
}

const EXT_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/3gpp': '3gp',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac',
  'application/pdf': 'pdf',
}

// Grava no Blob se adaptando ao modo do store da INSTÂNCIA (cada projeto tem o
// seu — a Norah é privado de propósito, dado sensível de saúde/paciente; a
// agência é público, pois posts precisam ser buscáveis pelo Instagram/Facebook
// na publicação). Tenta 'private' primeiro (mais seguro por padrão); se o store
// só aceitar 'public', cai para 'public' sozinho — sem env nova por instância.
// Cacheia o modo que funcionou (só dura enquanto a lambda ficar quente).
let blobAccessModo: 'public' | 'private' | null = null
async function putBlobAdaptativo(pathname: string, buf: Buffer, contentType: string): Promise<{ url: string; privado: boolean }> {
  const tentar = (access: 'public' | 'private') => put(pathname, buf, { access, contentType, token: process.env.BLOB_READ_WRITE_TOKEN } as any)
  const ordem: ('public' | 'private')[] = blobAccessModo ? [blobAccessModo] : ['private', 'public']
  let ultimoErro: any
  for (const modo of ordem) {
    try {
      const blob = await tentar(modo)
      blobAccessModo = modo
      return { url: blob.url, privado: modo === 'private' }
    } catch (e: any) {
      ultimoErro = e
      if (!/private access|public access/i.test(e?.message || '')) throw e // erro não relacionado ao modo — não insiste
      blobAccessModo = null // modo cacheado mudou/errou — redescobre na próxima
    }
  }
  throw ultimoErro
}

// Pede ao Evolution os bytes (base64) de uma mensagem de mídia. Loga falhas
// no runtime da Vercel para diagnóstico ([wa-midia]).
async function pedirBase64Evolution(corpo: any): Promise<{ b64: string; mimetype?: string }> {
  const base = normalizarUrlEvolution(process.env.EVOLUTION_API_URL)
  const r = await fetch(`${base}/chat/getBase64FromMediaMessage/${process.env.EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: { apikey: process.env.EVOLUTION_API_KEY as string, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const d = await r.json().catch(() => ({} as any))
  if (!r.ok) { console.warn('[wa-midia] getBase64 HTTP', r.status, d?.message || d?.error || ''); return { b64: '' } }
  return { b64: typeof d?.base64 === 'string' ? d.base64 : '', mimetype: d?.mimetype }
}

// Captura a MÍDIA de uma mensagem recebida e guarda no Blob (URL permanente).
// 1º tenta o base64 já embutido no webhook (registramos o webhook com base64:true);
// senão pede os bytes ao Evolution (getBase64FromMediaMessage — tenta os DOIS
// formatos de corpo, key-só e mensagem completa, p/ cobrir versões). Best-effort:
// qualquer falha devolve só o tipo — a mensagem fica com o rótulo, nada quebra.
export async function capturarMidiaEvolution(data: any): Promise<Pick<WaMensagem, 'tipo' | 'midiaUrl' | 'mimetype' | 'fileName'> | null> {
  try {
    const m = noMidiaEvolution(data?.message)
    if (!m) {
      // Diagnóstico: payload tem cara de mídia mas num formato que não conhecemos
      const ks = Object.keys(data?.message || {})
      if (ks.some(k => /image|video|audio|document|sticker|media/i.test(k))) console.warn('[wa-midia] formato desconhecido:', ks.join(','))
      return null
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) { console.warn('[wa-midia] sem BLOB_READ_WRITE_TOKEN'); return { tipo: m.tipo } }
    let b64: string = typeof data?.message?.base64 === 'string' ? data.message.base64
      : typeof data?.base64 === 'string' ? data.base64
      : typeof m.no?.base64 === 'string' ? m.no.base64 : ''
    let mimetype: string = m.no?.mimetype || ''
    if (!b64 && evolutionConfigurado() && data?.key?.id) {
      let r = await pedirBase64Evolution({ message: { key: data.key }, convertToMp4: false })
      if (!r.b64) r = await pedirBase64Evolution({ message: data, convertToMp4: false }) // formato antigo (mensagem completa)
      if (r.b64) { b64 = r.b64; mimetype = r.mimetype || mimetype }
    }
    if (!b64) { console.warn('[wa-midia] sem base64 para', m.tipo, data?.key?.id || ''); return { tipo: m.tipo } }
    if (b64.length > 34_000_000) return { tipo: m.tipo } // ~25MB binário: grande demais p/ guardar
    const buf = Buffer.from(b64, 'base64')
    mimetype = (mimetype || 'application/octet-stream').split(';')[0].trim()
    const ext = EXT_POR_MIME[mimetype] || ((mimetype.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin')
    const { url } = await putBlobAdaptativo(`whatsapp/${Date.now()}-${String(data?.key?.id || 'msg').replace(/[^a-zA-Z0-9]/g, '').slice(-12)}.${ext}`, buf, mimetype)
    const nomeOriginal = m.no?.fileName ? String(m.no.fileName).slice(0, 120) : ''
    return { tipo: m.tipo, midiaUrl: url, mimetype, ...(nomeOriginal ? { fileName: nomeOriginal } : {}) }
  } catch (e: any) { console.warn('[wa-midia] erro:', e?.message || String(e)); return null }
}

// Lê os bytes de uma mídia do Blob para o proxy autenticado. Blob PRIVADO exige
// o get() do SDK (fetch cru com Bearer não autentica); tenta private e, se o
// store da instância for público, cai para public. Devolve stream + headers.
export async function lerBlobMidia(url: string): Promise<{ stream: ReadableStream; contentType?: string; tamanho?: number } | null> {
  for (const access of ['private', 'public'] as const) {
    try {
      const r = await get(url, { access, token: process.env.BLOB_READ_WRITE_TOKEN })
      if (r?.stream) return { stream: r.stream as any, contentType: (r as any)?.blob?.contentType, tamanho: (r as any)?.blob?.size }
    } catch { /* modo errado para este store — tenta o outro */ }
  }
  return null
}

// A mensagem já está no histórico? Usado para não duplicar o ECO do WhatsApp:
// o que o sistema envia é gravado na hora do envio e volta pelo webhook (fromMe)
// com o mesmo key.id. Olha só as últimas (o eco chega em segundos).
export async function mensagemExiste(telefone: string, msgId: string): Promise<boolean> {
  const tel = soDigitos(telefone)
  if (!tel || !msgId) return false
  try {
    const raw = await redis.lrange(`wa:msgs:${tel}`, -40, -1)
    return raw.some(m => { try { const o: any = typeof m === 'string' ? JSON.parse(m) : m; return o?.id === msgId } catch { return false } })
  } catch { return false }
}

// Atualiza UMA mensagem já gravada (ex.: anexar a mídia depois que ela subiu ao
// Blob). Procura de trás pra frente: a mensagem alvo é quase sempre a última.
export async function atualizarMensagem(telefone: string, msgId: string, patch: Partial<WaMensagem>): Promise<boolean> {
  const tel = soDigitos(telefone)
  if (!tel || !msgId) return false
  try {
    const raw = await redis.lrange(`wa:msgs:${tel}`, -25, -1)
    for (let i = raw.length - 1; i >= 0; i--) {
      let o: any
      try { o = typeof raw[i] === 'string' ? JSON.parse(raw[i] as string) : raw[i] } catch { continue }
      if (o?.id !== msgId) continue
      const idx = -(raw.length - i) // índice negativo real na lista
      await redis.lset(`wa:msgs:${tel}`, idx, JSON.stringify({ ...o, ...patch }))
      return true
    }
  } catch (e: any) { console.warn('[wa-midia] falha ao atualizar msg:', e?.message || String(e)) }
  return false
}

// Salva uma mensagem na conversa (por telefone) e atualiza os metadados/índice.
export async function salvarMensagem(telefone: string, msg: WaMensagem, extra?: Partial<WaConversa>) {
  const tel = soDigitos(telefone)
  if (!tel) return
  await redis.rpush(`wa:msgs:${tel}`, JSON.stringify(msg))
  await redis.sadd('wa:conversas', tel)
  const atual = (await redis.get<WaConversa>(`wa:conversa:${tel}`)) || { telefone: tel }
  const conversa: WaConversa = {
    ...atual, ...extra, telefone: tel,
    ultimaMsg: msg.texto.slice(0, 120), ultimaEm: msg.em,
    naoLidas: msg.de === 'cliente' ? (atual.naoLidas || 0) + 1 : (extra?.naoLidas ?? atual.naoLidas ?? 0),
  }
  await redis.set(`wa:conversa:${tel}`, conversa)
}

// Envia mensagem de texto. Prioriza o Evolution (número antigo via QR); se não
// houver, usa a Cloud API; sem nenhum, no-op. `destinoJid` (opcional) força o
// destinatário no Evolution — necessário para GRUPOS (@g.us).
export async function enviarWhatsApp(telefone: string, texto: string, autor?: string, destinoJid?: string): Promise<{ ok: boolean; erro?: string }> {
  const tel = soDigitos(telefone)
  if (!tel) return { ok: false, erro: 'telefone inválido' }

  // A) Evolution API
  if (evolutionConfigurado()) {
    try {
      const base = normalizarUrlEvolution(process.env.EVOLUTION_API_URL)
      const r = await fetch(`${base}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: { apikey: process.env.EVOLUTION_API_KEY as string, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: destinoJid || tel, text: texto }),
      })
      const d = await r.json().catch(() => ({} as any))
      if (!r.ok) return { ok: false, erro: d?.message || d?.error || `HTTP ${r.status}` }
      await salvarMensagem(tel, { id: d?.key?.id || crypto.randomUUID(), de: 'agente', texto, em: new Date().toISOString(), autor })
      return { ok: true }
    } catch (e: any) {
      return { ok: false, erro: e?.message || String(e) }
    }
  }

  // B) Cloud API (Meta) — legado
  if (cloudConfigurado()) {
    const versao = process.env.META_API_VERSION_PUBLISH || 'v21.0'
    try {
      const r = await fetch(`https://graph.facebook.com/${versao}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: tel, type: 'text', text: { body: texto } }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return { ok: false, erro: d?.error?.message || `HTTP ${r.status}` }
      await salvarMensagem(tel, { id: d?.messages?.[0]?.id || crypto.randomUUID(), de: 'agente', texto, em: new Date().toISOString(), autor })
      return { ok: true }
    } catch (e: any) {
      return { ok: false, erro: e?.message || String(e) }
    }
  }

  return { ok: false, erro: 'WhatsApp não configurado (faltam credenciais)' }
}

// EDITA uma mensagem já enviada (regra do WhatsApp: só as nossas, ~15 min).
// A key é reconstruída: id da mensagem + remoteJid da conversa + fromMe.
export async function editarMensagemWhatsApp(telefone: string, msgId: string, novoTexto: string, jid?: string): Promise<{ ok: boolean; erro?: string }> {
  if (!evolutionConfigurado()) return { ok: false, erro: 'edição disponível só no conector Evolution' }
  const tel = soDigitos(telefone)
  const remoteJid = jid || `${tel}@s.whatsapp.net`
  try {
    const base = normalizarUrlEvolution(process.env.EVOLUTION_API_URL)
    const r = await fetch(`${base}/chat/updateMessage/${process.env.EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { apikey: process.env.EVOLUTION_API_KEY as string, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: remoteJid, key: { remoteJid, fromMe: true, id: msgId }, text: novoTexto }),
    })
    const d = await r.json().catch(() => ({} as any))
    if (!r.ok) return { ok: false, erro: d?.message || d?.error || `HTTP ${r.status}` }
    return { ok: true }
  } catch (e: any) { return { ok: false, erro: e?.message || String(e) } }
}

// Envia MÍDIA (imagem/vídeo/documento por URL; áudio via endpoint próprio).
// Usado pelo "encaminhar" do inbox — a mídia já está no nosso Blob.
export async function enviarMidiaWhatsApp(
  telefone: string,
  midia: { tipo: NonNullable<WaMensagem['tipo']>; url: string; mimetype?: string; fileName?: string; caption?: string },
  autor?: string,
  destinoJid?: string,
): Promise<{ ok: boolean; erro?: string }> {
  if (!evolutionConfigurado()) return { ok: false, erro: 'envio de mídia disponível só no conector Evolution' }
  const tel = soDigitos(telefone)
  if (!tel) return { ok: false, erro: 'telefone inválido' }
  try {
    const base = normalizarUrlEvolution(process.env.EVOLUTION_API_URL)
    const headers = { apikey: process.env.EVOLUTION_API_KEY as string, 'Content-Type': 'application/json' }
    // O Evolution não consegue baixar um Blob PRIVADO por URL (é o caso da
    // clínica). Então lemos os bytes aqui e mandamos em base64 — funciona nos
    // dois modos de store. URL externa (não-Blob) segue direto.
    let media = midia.url
    if (/\.vercel-storage\.com/i.test(midia.url)) {
      const b = await lerBlobMidia(midia.url)
      if (!b) return { ok: false, erro: 'não foi possível ler a mídia para encaminhar' }
      const buf = Buffer.from(await new Response(b.stream as any).arrayBuffer())
      media = buf.toString('base64')
    }
    let r: Response
    if (midia.tipo === 'audio') {
      r = await fetch(`${base}/message/sendWhatsAppAudio/${process.env.EVOLUTION_INSTANCE}`, {
        method: 'POST', headers, body: JSON.stringify({ number: destinoJid || tel, audio: media }),
      })
    } else {
      const mediatype = midia.tipo === 'imagem' || midia.tipo === 'figurinha' ? 'image' : midia.tipo === 'video' ? 'video' : 'document'
      r = await fetch(`${base}/message/sendMedia/${process.env.EVOLUTION_INSTANCE}`, {
        method: 'POST', headers,
        body: JSON.stringify({ number: destinoJid || tel, mediatype, media, ...(midia.mimetype ? { mimetype: midia.mimetype } : {}), ...(midia.fileName ? { fileName: midia.fileName } : { ...(midia.tipo === 'documento' ? { fileName: 'documento' } : {}) }), ...(midia.caption ? { caption: midia.caption } : {}) }),
      })
    }
    const d = await r.json().catch(() => ({} as any))
    if (!r.ok) return { ok: false, erro: d?.message || d?.error || `HTTP ${r.status}` }
    await salvarMensagem(tel, {
      id: d?.key?.id || crypto.randomUUID(), de: 'agente', em: new Date().toISOString(), autor,
      texto: midia.caption || `[${midia.tipo}]`, tipo: midia.tipo === 'figurinha' ? 'imagem' : midia.tipo,
      midiaUrl: midia.url, ...(midia.mimetype ? { mimetype: midia.mimetype } : {}), ...(midia.fileName ? { fileName: midia.fileName } : {}),
    })
    return { ok: true }
  } catch (e: any) { return { ok: false, erro: e?.message || String(e) } }
}

import { redis } from './redis'

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

export type WaMensagem = { id: string; de: 'cliente' | 'agente'; texto: string; em: string; autor?: string }
export type WaConversa = { telefone: string; nome?: string; contatoId?: string; ultimaMsg?: string; ultimaEm?: string; naoLidas?: number }

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
// houver, usa a Cloud API; sem nenhum, no-op.
export async function enviarWhatsApp(telefone: string, texto: string, autor?: string): Promise<{ ok: boolean; erro?: string }> {
  const tel = soDigitos(telefone)
  if (!tel) return { ok: false, erro: 'telefone inválido' }

  // A) Evolution API
  if (evolutionConfigurado()) {
    try {
      const base = normalizarUrlEvolution(process.env.EVOLUTION_API_URL)
      const r = await fetch(`${base}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: { apikey: process.env.EVOLUTION_API_KEY as string, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: tel, text: texto }),
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

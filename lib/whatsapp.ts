import { redis } from './redis'

// Integração WhatsApp Business Cloud API (Meta). Credenciais em env (Vercel):
//   WHATSAPP_TOKEN          — token de acesso (System User / permanente)
//   WHATSAPP_PHONE_NUMBER_ID— ID do número (Phone Number ID)
//   WHATSAPP_VERIFY_TOKEN   — string que você escolhe; mesma no painel da Meta (verificação do webhook)
//   META_API_VERSION_PUBLISH (opcional) — versão da Graph API (default v21.0)
// Sem token/phone id, o envio é no-op (scaffold seguro antes de configurar).

export type WaMensagem = { id: string; de: 'cliente' | 'agente'; texto: string; em: string; autor?: string }
export type WaConversa = { telefone: string; nome?: string; contatoId?: string; ultimaMsg?: string; ultimaEm?: string; naoLidas?: number }

export function whatsappConfigurado(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

const soDigitos = (t: string) => (t || '').replace(/\D/g, '')

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

// Envia mensagem de texto (janela de 24h). Fora da janela, use templates (HSM) — fase seguinte.
export async function enviarWhatsApp(telefone: string, texto: string, autor?: string): Promise<{ ok: boolean; erro?: string }> {
  const tel = soDigitos(telefone)
  if (!whatsappConfigurado()) return { ok: false, erro: 'WhatsApp não configurado (faltam credenciais)' }
  if (!tel) return { ok: false, erro: 'telefone inválido' }
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

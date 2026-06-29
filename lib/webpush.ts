import { redis } from './redis'

// Envio de Web Push. As chaves VAPID vivem em env (Vercel):
//   VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
// Sem as chaves, tudo vira no-op silencioso (deploy seguro antes de configurar).

export type PushPayload = { title: string; body: string; url?: string; tag?: string }

function chaves() {
  const publica = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:contato@grupo10mais.com.br'
  if (!publica || !privada) return null
  return { publica, privada, subject }
}

export function pushConfigurado(): boolean {
  return !!chaves()
}

// Envia a notificacao push para TODAS as inscricoes do usuario. Poda as expiradas (404/410).
export async function enviarPush(email: string, payload: PushPayload): Promise<void> {
  const cfg = chaves()
  if (!cfg) return
  const inscricoes = await redis.smembers(`push:${email}`)
  if (!inscricoes.length) return

  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(cfg.subject, cfg.publica, cfg.privada)

  const corpo = JSON.stringify(payload)
  await Promise.all(inscricoes.map(async (raw) => {
    let sub: any
    try { sub = JSON.parse(raw) } catch { await redis.srem(`push:${email}`, raw); return }
    try {
      await webpush.sendNotification(sub, corpo)
    } catch (e: any) {
      // Inscricao expirada/invalida -> remove do indice
      if (e?.statusCode === 404 || e?.statusCode === 410) await redis.srem(`push:${email}`, raw)
    }
  }))
}

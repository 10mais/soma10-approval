import { redis } from './redis'

// Envio de Web Push. As chaves VAPID vivem em env (Vercel):
//   VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
// Sem as chaves, tudo vira no-op silencioso (deploy seguro antes de configurar).

export type PushPayload = { title: string; body: string; url?: string; tag?: string }

// O subject precisa ser 'mailto:...' ou uma URL. Normaliza para ser tolerante a config.
function normalizarSubject(s?: string): string {
  const v = (s || '').trim()
  if (!v) return 'mailto:contato@grupo10mais.com.br'
  if (v.startsWith('mailto:') || v.startsWith('http://') || v.startsWith('https://')) return v
  if (v.includes('@')) return 'mailto:' + v
  return 'mailto:contato@grupo10mais.com.br'
}

function chaves() {
  const publica = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  const subject = normalizarSubject(process.env.VAPID_SUBJECT)
  if (!publica || !privada) return null
  return { publica, privada, subject }
}

export function pushConfigurado(): boolean {
  return !!chaves()
}

export type ResultadoPush = { configurado: boolean; inscricoes: number; enviadas: number; falhas: number; erro?: string }

// Envia para TODAS as inscricoes do usuario e devolve um resumo (para diagnostico).
// Poda inscricoes expiradas (404/410).
export async function enviarPushDetalhado(email: string, payload: PushPayload): Promise<ResultadoPush> {
  const cfg = chaves()
  if (!cfg) return { configurado: false, inscricoes: 0, enviadas: 0, falhas: 0, erro: 'VAPID nao configurado' }

  const inscricoes = await redis.smembers(`push:${email}`)
  if (!inscricoes.length) return { configurado: true, inscricoes: 0, enviadas: 0, falhas: 0, erro: 'sem inscricoes para este usuario' }

  let webpush: any
  try {
    webpush = (await import('web-push')).default
    webpush.setVapidDetails(cfg.subject, cfg.publica, cfg.privada)
  } catch (e: any) {
    return { configurado: true, inscricoes: inscricoes.length, enviadas: 0, falhas: inscricoes.length, erro: 'VAPID invalido: ' + (e?.message || e) }
  }

  const corpo = JSON.stringify(payload)
  let enviadas = 0, falhas = 0, primeiroErro = ''
  await Promise.all(inscricoes.map(async (raw: any) => {
    // O Upstash auto-desserializa JSON: `raw` pode vir como objeto OU string.
    let sub: any = raw
    if (typeof raw === 'string') { try { sub = JSON.parse(raw) } catch { sub = null } }
    if (!sub || !sub.endpoint) { falhas++; if (!primeiroErro) primeiroErro = 'inscrição ilegível'; return }
    try {
      await webpush.sendNotification(sub, corpo)
      enviadas++
    } catch (e: any) {
      falhas++
      if (!primeiroErro) primeiroErro = `status ${e?.statusCode || '?'}: ${e?.body || e?.message || e}`
      if (e?.statusCode === 404 || e?.statusCode === 410) await redis.srem(`push:${email}`, raw)
    }
  }))
  return { configurado: true, inscricoes: inscricoes.length, enviadas, falhas, ...(primeiroErro ? { erro: primeiroErro } : {}) }
}

// Versao fire-and-forget usada pelas notificacoes (nao bloqueia nem quebra nada).
export async function enviarPush(email: string, payload: PushPayload): Promise<void> {
  try { await enviarPushDetalhado(email, payload) } catch { /* silencioso */ }
}

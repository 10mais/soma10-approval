import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { listarErros } from '@/lib/erros'
import { stripeConfigurado } from '@/lib/stripe'
import { pushConfigurado } from '@/lib/webpush'
import { ideogramConfigurado } from '@/lib/ideogram'
import { whatsappConfigurado } from '@/lib/whatsapp'
import { list } from '@vercel/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Painel de Saúde do sistema — SOMENTE ADMIN. Diz o que está no ar:
// status do banco, quais integrações estão configuradas, últimos erros
// e o backup mais recente. É o "raio-x" do produto antes de abrir para clientes.

type Integracao = { chave: string; label: string; ligado: boolean; obs?: string }

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  // Banco
  let redisOk = false
  let redisLatencia = 0
  try {
    const t = Date.now()
    await redis.ping()
    redisLatencia = Date.now() - t
    redisOk = true
  } catch {
    redisOk = false
  }

  // Integrações (essenciais e opcionais)
  const env = process.env
  const integracoes: Integracao[] = [
    { chave: 'redis', label: 'Banco de dados (Upstash Redis)', ligado: redisOk, obs: redisOk ? `${redisLatencia}ms` : 'sem resposta' },
    { chave: 'blob', label: 'Armazenamento de mídia (Vercel Blob)', ligado: !!env.BLOB_READ_WRITE_TOKEN },
    { chave: 'auth', label: 'Autenticação (NextAuth)', ligado: !!env.NEXTAUTH_SECRET },
    { chave: 'anthropic', label: 'IA (Anthropic Claude)', ligado: !!env.ANTHROPIC_API_KEY },
    { chave: 'meta', label: 'Publicação Instagram/Facebook (Meta)', ligado: !!(env.APP_ID && env.APP_SECRET) },
    { chave: 'smtp', label: 'E-mail (SMTP)', ligado: !!(env.SMTP_USER && env.SMTP_PASS) },
    { chave: 'cron', label: 'Proteção de crons (CRON_SECRET)', ligado: !!env.CRON_SECRET },
    { chave: 'stripe', label: 'Cobrança (Stripe)', ligado: stripeConfigurado(), obs: env.STRIPE_WEBHOOK_SECRET ? undefined : 'falta STRIPE_WEBHOOK_SECRET' },
    { chave: 'push', label: 'Notificações push (VAPID)', ligado: pushConfigurado() },
    { chave: 'ideogram', label: 'Foto realista por IA (Ideogram)', ligado: ideogramConfigurado() },
    { chave: 'whatsapp', label: 'WhatsApp oficial (Cloud API)', ligado: whatsappConfigurado() },
  ]

  // Últimos erros
  const erros = await listarErros(50)

  // Backup mais recente (lista os blobs em backups/)
  let ultimoBackup: { pathname: string; tamanho: number; em: string } | null = null
  try {
    if (env.BLOB_READ_WRITE_TOKEN) {
      const { blobs } = await list({ prefix: 'backups/', limit: 40 })
      if (blobs.length) {
        const mais = blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1))[0]
        ultimoBackup = { pathname: mais.pathname, tamanho: mais.size, em: mais.uploadedAt as any }
      }
    }
  } catch {
    ultimoBackup = null
  }

  return NextResponse.json({ integracoes, erros, ultimoBackup, ts: new Date().toISOString() }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

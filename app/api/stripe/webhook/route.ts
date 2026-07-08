import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { redis, Cliente } from '@/lib/redis'
import { notificarAdmins } from '@/lib/notificacoes'
import { capturarErro } from '@/lib/erros'

export const runtime = 'nodejs'

// Acha o cliente vinculado a um customer do Stripe (varre o set — baixa cardinalidade).
async function acharPorCustomer(customerId: string): Promise<Cliente | null> {
  const ids = await redis.smembers('clientes')
  const clientes = (await Promise.all(ids.map(id => redis.get<Cliente>(`cliente:${id}`)))).filter(Boolean) as Cliente[]
  return clientes.find(c => c.stripeCustomerId === customerId) || null
}

async function patchCliente(customerId: string, patch: Partial<Cliente>) {
  const c = await acharPorCustomer(customerId)
  if (!c) return
  await redis.set(`cliente:${c.id}`, { ...c, ...patch })
}

// Status de assinatura que valem como "em dia" (acesso liberado).
const EM_DIA = new Set(['active', 'trialing'])

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'stripe não configurado' }, { status: 503 })

  const raw = await req.text()
  const sig = req.headers.get('stripe-signature') || ''
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

  let event: any
  try {
    // Com secret: valida a assinatura (produção). Sem secret: aceita o payload cru (dev).
    event = whSecret ? stripe.webhooks.constructEvent(raw, sig, whSecret) : JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'assinatura inválida' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const emDia = EM_DIA.has(sub.status)
        await patchCliente(sub.customer, {
          stripeSubscriptionId: sub.id,
          assinaturaStatus: sub.status,
          inadimplente: !emDia,
          ...(emDia ? { suspensoDesde: undefined } : {}),
        })
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        await patchCliente(sub.customer, { assinaturaStatus: 'canceled', inadimplente: true, suspensoDesde: new Date().toISOString() })
        break
      }
      case 'invoice.paid': {
        const inv = event.data.object
        if (inv.customer) await patchCliente(inv.customer, { inadimplente: false, suspensoDesde: undefined, assinaturaStatus: 'active' })
        break
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object
        if (inv.customer) {
          await patchCliente(inv.customer, { inadimplente: true, suspensoDesde: new Date().toISOString(), assinaturaStatus: 'past_due' })
          const c = await acharPorCustomer(inv.customer)
          try { await notificarAdmins('geral', 'Pagamento falhou', `A cobrança de ${c?.nome || 'um cliente'} falhou. O acesso ao portal foi suspenso automaticamente.`) } catch { /* não bloqueia */ }
        }
        break
      }
    }
  } catch (e) {
    await capturarErro('stripe/webhook', e, { tipo: event?.type })
    // Nunca falhar o webhook por erro interno (Stripe reenvia; evita loop de retry infinito por bug nosso).
    return NextResponse.json({ received: true, warn: 'erro ao processar' })
  }

  return NextResponse.json({ received: true })
}

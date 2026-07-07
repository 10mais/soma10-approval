import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'
import { getStripe, stripeConfigurado } from '@/lib/stripe'
import { totalMensalModulos } from '@/lib/modulos'

export const runtime = 'nodejs'

// Diz ao front se o Stripe está ligado (mostra ou não o botão de cobrança).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json({ configurado: stripeConfigurado() })
}

// Cria (ou reaproveita) o customer e abre um Checkout de ASSINATURA mensal com o
// total do cliente (contrato + módulos). Recorrência = cartão (PIX do Stripe é avulso).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'Stripe não configurado. Defina STRIPE_SECRET_KEY na Vercel.' }, { status: 503 })

  const { clienteId } = await req.json()
  const c = clienteId ? await redis.get<Cliente>(`cliente:${clienteId}`) : null
  if (!c) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  const total = (Number(c.contratoValor) || 0) + totalMensalModulos(c.modulos)
  if (total <= 0) return NextResponse.json({ error: 'Defina um valor mensal (contrato e/ou módulos) antes de cobrar.' }, { status: 400 })

  // Customer: reaproveita se já existe; senão cria e vincula.
  let customerId = c.stripeCustomerId
  if (!customerId) {
    const cust = await stripe.customers.create({ name: c.nome, email: c.loginEmail || undefined, metadata: { clienteId: c.id } })
    customerId = cust.id
    await redis.set(`cliente:${c.id}`, { ...c, stripeCustomerId: customerId })
  }

  const origin = req.headers.get('origin') || process.env.NEXTAUTH_URL || ''
  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{
      price_data: {
        currency: 'brl',
        product_data: { name: `Assinatura mensal — ${c.nome}` },
        unit_amount: Math.round(total * 100),
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    success_url: `${origin}/dashboard?cobranca=ok`,
    cancel_url: `${origin}/dashboard?cobranca=cancel`,
    metadata: { clienteId: c.id },
  })

  return NextResponse.json({ url: checkout.url })
}

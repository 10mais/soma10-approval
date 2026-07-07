import Stripe from 'stripe'

// Integração Stripe (assinatura recorrente + dunning). No-op enquanto não houver
// STRIPE_SECRET_KEY — mesmo padrão de WhatsApp/Ideogram no projeto.
export function stripeConfigurado(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

let _stripe: Stripe | null = null
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (!_stripe) _stripe = new Stripe(key)
  return _stripe
}

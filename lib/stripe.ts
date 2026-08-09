import Stripe from 'stripe'

let stripeClient: Stripe | undefined

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('Stripe server configuration is missing')
  stripeClient ??= new Stripe(secretKey)
  return stripeClient
}

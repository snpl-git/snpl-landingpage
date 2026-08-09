export type PaymentBinding = {
  scheduledPaymentId: string
  orderId: string
  amount: number | null
  orderTotalCents: number | null
  orderStatus: string | null
  stripeCustomerId: string | null
  paymentMethodId: string | null
  paymentMethodCustomerId: string | null
}

export function paymentIntentIdempotencyKey(scheduledPaymentId: string) {
  return `snpl-scheduled-payment:${scheduledPaymentId}`
}

export function paymentBindingIsValid(value: PaymentBinding) {
  return Boolean(
    value.scheduledPaymentId && value.orderId && value.amount &&
    value.amount === value.orderTotalCents && value.orderStatus === 'scheduled' &&
    value.stripeCustomerId && value.paymentMethodId && value.paymentMethodId !== 'pm_pending' &&
    value.paymentMethodCustomerId === value.stripeCustomerId
  )
}

export function failureTransition(terminal: boolean) {
  return terminal ? 'failed' as const : 'scheduled' as const
}

export const CANCELLABLE_PAYMENT_STATUS = 'scheduled'

export function canCancelScheduledPayment(status: string, processingAt: string | null) {
  return status === CANCELLABLE_PAYMENT_STATUS && processingAt === null
}

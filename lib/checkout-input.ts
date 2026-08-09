import { z } from 'zod'
import { MAX_CART_QUANTITY, MAX_DISTINCT_ITEMS, MAX_QUANTITY_PER_ITEM } from './checkout-security.ts'

export const CheckoutBodySchema = z.object({
  requestId: z.string().uuid(),
  items: z.array(z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
    qty: z.number().int().min(1).max(MAX_QUANTITY_PER_ITEM),
  }).strict()).min(1).max(MAX_DISTINCT_ITEMS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict().superRefine(({ items }, context) => {
  if (new Set(items.map(({ id }) => id)).size !== items.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate products are not allowed' })
  }
  if (items.reduce((sum, item) => sum + item.qty, 0) > MAX_CART_QUANTITY) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Cart quantity is too large' })
  }
})

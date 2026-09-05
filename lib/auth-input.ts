import { z } from 'zod'

export const PhoneOtpRequestSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  captchaToken: z.string().min(20).max(2048).regex(/^\S+$/),
}).strict()

export function phoneOtpCredentials(input: z.infer<typeof PhoneOtpRequestSchema>) {
  return {
    phone: input.phone,
    options: { captchaToken: input.captchaToken },
  }
}

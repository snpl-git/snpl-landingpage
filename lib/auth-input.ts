import { z } from 'zod'

export const EmailAuthRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  captchaToken: z.string().min(20).max(2048).regex(/^\S+$/),
}).strict()

export function emailOtpCredentials(input: z.infer<typeof EmailAuthRequestSchema>) {
  return {
    email: input.email,
    options: { captchaToken: input.captchaToken },
  }
}
